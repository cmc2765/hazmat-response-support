import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CBRNE_AUTHORITATIVE_SOURCE_FACTS } from "../../src/data/cbrne/authoritative/authoritativeSourceFacts.js";
import { CBRNE_SOURCE_ARTIFACTS } from "../../src/data/cbrne/authoritative/sourceArtifacts.js";
import { extractLocalArtifact } from "../../src/lib/cbrne/sourceCorpusExtraction.js";
import type { AuthoritativeSourceFact, CbrneExtractionCheckpoint, ExtractionDisposition, PdfPageExtraction, SourceArtifact, SourceArtifactExtractionManifest } from "../../src/lib/cbrne/authoritativeSourceTypes.js";

const ROOT = resolve(import.meta.dirname, "../..");
const OUTPUT = resolve(ROOT, "src/data/cbrne/authoritative/generated-extraction-manifest.json");
const generatedAt = "2026-09-11T00:00:00.000Z";
const PDF_PARSER_VERSION = "5";

type GeneratedExtractionManifest = {
  generatedFile: true;
  generatedBy: string;
  generatedAt: string;
  sourceArtifactCount: number;
  distinctAcquiredArtifactCount: number;
  checkpoint: CbrneExtractionCheckpoint;
  manifest: SourceArtifactExtractionManifest[];
};

export type BuildExtractionManifestOptions = {
  repositoryRoot?: string;
  outputPath?: string;
  artifacts?: readonly SourceArtifact[];
  facts?: readonly AuthoritativeSourceFact[];
  extractArtifact?: typeof extractLocalArtifact;
};

function isIndexArtifact(title: string, id: string) {
  return /index|sitemap|catalog|release|openapi/i.test(`${title} ${id}`);
}

function inspectContent(artifact: SourceArtifact, repositoryRoot: string, extractArtifact: typeof extractLocalArtifact) {
  if (!artifact.localSnapshotPath || !existsSync(resolve(repositoryRoot, artifact.localSnapshotPath))) {
    return { hashValidation: "MISSING" as const, bytes: null, sections: 0, records: 0, pages: null, warnings: ["Local snapshot is not present."], parserLimitations: [], pdfPages: [], failureCategory: null };
  }
  const bytes = readFileSync(resolve(repositoryRoot, artifact.localSnapshotPath));
  const hashValidation = artifact.sha256 && createHash("sha256").update(bytes).digest("hex") === artifact.sha256
    ? "VERIFIED" as const : "FAILED" as const;
  if (hashValidation === "FAILED") return { hashValidation, bytes: bytes.length, sections: 0, records: 0, pages: null, warnings: ["Integrity failed; parser was not run."], parserLimitations: [], pdfPages: [], failureCategory: null };
  const structure = extractArtifact(artifact, repositoryRoot);
  return { hashValidation, bytes: structure.usableContentBytes, sections: structure.sections.length, records: structure.records.length, pages: structure.pages, warnings: structure.warnings, parserLimitations: structure.parserLimitations, pdfPages: structure.pdfPages, failureCategory: structure.failureCategory };
}

function extractionDisposition(
  artifact: SourceArtifact,
  hashValidation: SourceArtifactExtractionManifest["hashValidation"],
  parserLimitations: string[],
  facts: typeof CBRNE_AUTHORITATIVE_SOURCE_FACTS,
): ExtractionDisposition {
  if (artifact.currentStatus === "DUPLICATE") return "DUPLICATE_REUSED";
  if (artifact.currentStatus === "SUPERSEDED") return "SUPERSEDED_REFERENCE";
  if (artifact.currentStatus === "OUT_OF_SCOPE") return "INTENTIONALLY_EXCLUDED";
  if (artifact.currentStatus === "MANUAL_ACQUISITION_REQUIRED") return "MANUAL_EXTRACTION_REQUIRED";
  if (artifact.currentStatus === "ACCESS_BLOCKED" || artifact.currentStatus === "FAILED") return "SOURCE_NOT_PRESENT";
  if (hashValidation === "FAILED" || hashValidation === "MISSING") return "ARTIFACT_INTEGRITY_FAILED";
  if (parserLimitations.some((item) => /embedded text is unavailable|page locator/i.test(item))) return "PARSER_LIMITATION";
  if (artifact.artifactType === "JSON_API" || artifact.artifactType === "DATASET") return "STRUCTURED_DATA_IMPORTED";
  if (!facts.length && isIndexArtifact(artifact.title, artifact.sourceArtifactId)) return "REFERENCE_ONLY";
  if (!facts.length) return "NO_RELEVANT_OPERATIONAL_FACTS";
  if (facts.every((fact) => fact.fieldGroup === "IDENTITY")) return "IDENTITY_ONLY";
  return "EXTRACTED";
}

function readPriorManifest(outputPath: string) {
  if (!existsSync(outputPath)) return new Map<string, SourceArtifactExtractionManifest>();
  try {
    const parsed = JSON.parse(readFileSync(outputPath, "utf8")) as Partial<GeneratedExtractionManifest>;
    if (parsed.generatedBy !== "scripts/cbrne/build-extraction-manifest.ts" || !Array.isArray(parsed.manifest)) return new Map<string, SourceArtifactExtractionManifest>();
    return new Map(parsed.manifest.filter((item): item is SourceArtifactExtractionManifest => Boolean(item && typeof item.sourceArtifactId === "string")).map((item) => [item.sourceArtifactId, item]));
  } catch {
    return new Map<string, SourceArtifactExtractionManifest>();
  }
}

function priorEntryIsComplete(entry: SourceArtifactExtractionManifest | undefined, artifact: SourceArtifact, actualHash: string | null, expectedFactIds: readonly string[], repositoryRoot: string) {
  if (!entry || entry.sourceArtifactId !== artifact.sourceArtifactId) return false;
  if (entry.acquisitionDisposition !== artifact.currentStatus || entry.expectedFileType !== artifact.artifactType) return false;
  if (artifact.artifactType === "PDF" && (!entry.pageExtractionArtifactPath
    || entry.pageExtractionArtifactPath !== pageExtractionPath(repositoryRoot, artifact.sourceArtifactId).relativePath
    || !existsSync(resolve(repositoryRoot, entry.pageExtractionArtifactPath))
    || (() => { try { return JSON.parse(readFileSync(resolve(repositoryRoot, entry.pageExtractionArtifactPath!), "utf8")).parserVersion !== PDF_PARSER_VERSION; } catch { return true; } })())) return false;
  if (artifact.currentStatus === "ACQUIRED" || artifact.currentStatus === "DUPLICATE") {
    return entry.hashValidation === "VERIFIED"
      && actualHash === artifact.sha256
      && entry.sourceArtifactSha256 === artifact.sha256
      && [...entry.factsProduced].sort().join("\n") === [...expectedFactIds].sort().join("\n");
  }
  return entry.hashValidation === (artifact.sha256 ? "VERIFIED" : "MISSING")
    && entry.sourceArtifactSha256 === artifact.sha256
    && [...entry.factsProduced].sort().join("\n") === [...expectedFactIds].sort().join("\n");
}

function pageExtractionPath(repositoryRoot: string, sourceArtifactId: string) {
  const relativePath = `src/data/cbrne/authoritative/pdf-extractions/${sourceArtifactId}.json`;
  return { relativePath, absolutePath: resolve(repositoryRoot, relativePath) };
}

function writePageExtraction(repositoryRoot: string, artifact: SourceArtifact, pages: PdfPageExtraction[], failureCategory: SourceArtifactExtractionManifest["failureCategory"]) {
  if (artifact.artifactType !== "PDF" || !artifact.localSnapshotPath || !artifact.sha256) return null;
  const { relativePath, absolutePath } = pageExtractionPath(repositoryRoot, artifact.sourceArtifactId);
  mkdirSync(resolve(absolutePath, ".."), { recursive: true });
  const temporaryPath = `${absolutePath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify({
    generatedFile: true,
    generatedBy: "scripts/cbrne/build-extraction-manifest.ts",
    parserVersion: PDF_PARSER_VERSION,
    sourceArtifactId: artifact.sourceArtifactId,
    sourceArtifactSha256: artifact.sha256,
    parser: "PDF_STRUCTURE",
    failureCategory,
    pageCount: pages.length,
    pages,
  }, null, 2)}\n`);
  renameSync(temporaryPath, absolutePath);
  return relativePath;
}

function actualSnapshotHash(artifact: SourceArtifact, repositoryRoot: string) {
  if (!artifact.localSnapshotPath || !existsSync(resolve(repositoryRoot, artifact.localSnapshotPath))) return null;
  return createHash("sha256").update(readFileSync(resolve(repositoryRoot, artifact.localSnapshotPath))).digest("hex");
}

function writeCheckpoint(outputPath: string, artifacts: readonly SourceArtifact[], entries: Map<string, SourceArtifactExtractionManifest>, status: "IN_PROGRESS" | "COMPLETE", lastCompletedArtifactId: string | null) {
  const orderedManifest = artifacts.filter((artifact) => entries.has(artifact.sourceArtifactId)).map((artifact) => Object.fromEntries(
    Object.entries(entries.get(artifact.sourceArtifactId)!).filter(([key]) => key !== "pdfPages"),
  ) as SourceArtifactExtractionManifest);
  const output: GeneratedExtractionManifest = {
    generatedFile: true,
    generatedBy: "scripts/cbrne/build-extraction-manifest.ts",
    generatedAt,
    sourceArtifactCount: artifacts.length,
    distinctAcquiredArtifactCount: artifacts.filter((artifact) => artifact.currentStatus === "ACQUIRED").length,
    checkpoint: { status, completedArtifactCount: orderedManifest.length, lastCompletedArtifactId },
    manifest: orderedManifest,
  };
  mkdirSync(resolve(outputPath, ".."), { recursive: true });
  const temporaryPath = `${outputPath}.tmp`;
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  writeFileSync(temporaryPath, serialized);
  renameSync(temporaryPath, outputPath);
  return { output: outputPath, artifacts: orderedManifest.length, bytes: statSync(outputPath).size, checkpoint: output.checkpoint };
}

export function buildExtractionManifest(options: BuildExtractionManifestOptions = {}) {
  const repositoryRoot = options.repositoryRoot ?? ROOT;
  const outputPath = options.outputPath ?? OUTPUT;
  const artifacts = options.artifacts ?? CBRNE_SOURCE_ARTIFACTS;
  const allFacts = options.facts ?? CBRNE_AUTHORITATIVE_SOURCE_FACTS;
  const extractArtifact = options.extractArtifact ?? extractLocalArtifact;
  const entries = readPriorManifest(outputPath);
  let lastCompletedArtifactId: string | null = null;

  for (const artifact of artifacts) {
    const actualHash = actualSnapshotHash(artifact, repositoryRoot);
    const facts = allFacts.filter((fact) => fact.sourceArtifactId === artifact.sourceArtifactId);
    if (priorEntryIsComplete(entries.get(artifact.sourceArtifactId), artifact, actualHash, facts.map((fact) => fact.factId), repositoryRoot)) {
      lastCompletedArtifactId = artifact.sourceArtifactId;
      continue;
    }

    const content = inspectContent(artifact, repositoryRoot, extractArtifact);
    const linked = [...new Set(facts.map((fact) => fact.canonicalRecordId))];
    const disposition = extractionDisposition(artifact, content.hashValidation, content.parserLimitations, facts);
    const warnings = [
      ...(artifact.currentStatus === "DUPLICATE" ? ["DUPLICATE_REUSED: linked to canonical artifact; no independent fact extraction performed."] : []),
      ...(artifact.currentStatus === "SUPERSEDED" ? ["Superseded material retained for provenance and excluded from active authority selection."] : []),
      ...(artifact.currentStatus === "MANUAL_ACQUISITION_REQUIRED" || artifact.currentStatus === "ACCESS_BLOCKED" ? [artifact.failureReason ?? "Source acquisition gap retained."] : []),
      ...(content.warnings ?? []),
      ...(content.parserLimitations.some((item) => item.includes("OCR was not attempted")) ? ["OCR_REQUIRED: embedded text was unavailable; no OCR output was admitted."] : []),
      ...(disposition === "NO_RELEVANT_OPERATIONAL_FACTS" ? ["Artifact was processed locally; no source-backed operational fact was admitted to the canonical fact layer."] : []),
    ];
    const parserLimitations = content.parserLimitations ?? [];
    const pageExtractionArtifactPath = writePageExtraction(repositoryRoot, artifact, content.pdfPages, content.failureCategory);
    entries.set(artifact.sourceArtifactId, {
      sourceArtifactId: artifact.sourceArtifactId,
      acquisitionDisposition: artifact.currentStatus,
      extractionDisposition: disposition,
      parser: artifact.currentStatus === "ACQUIRED" || artifact.currentStatus === "DUPLICATE" ? artifact.parseMethod : "NOT_RUN",
      hashValidation: content.hashValidation,
      sourceArtifactSha256: artifact.sha256,
      expectedFileType: artifact.artifactType,
      usableContentBytes: content.bytes,
      pagesSectionsRecordsProcessed: { pages: content.pages, sections: content.sections, records: content.records },
      identitiesLinked: linked,
      factsProduced: facts.map((fact) => fact.factId),
      warnings,
      parserLimitations,
      reviewRequirements: facts.length ? ["SOURCE_IMPORTED_PENDING_REVIEW facts require appropriate SME/agency review before operational use."] : [],
      duplicateOf: artifact.duplicateOf,
      supersededBy: artifact.supersededBy,
      failureCategory: content.failureCategory,
      pageExtractionArtifactPath,
    });
    lastCompletedArtifactId = artifact.sourceArtifactId;
    writeCheckpoint(outputPath, artifacts, entries, "IN_PROGRESS", lastCompletedArtifactId);
  }

  return writeCheckpoint(outputPath, artifacts, entries, "COMPLETE", lastCompletedArtifactId);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(buildExtractionManifest(), null, 2)}\n`);
}
