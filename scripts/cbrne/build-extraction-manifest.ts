import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CBRNE_AUTHORITATIVE_SOURCE_FACTS } from "../../src/data/cbrne/authoritative/authoritativeSourceFacts.js";
import { CBRNE_SOURCE_ARTIFACTS } from "../../src/data/cbrne/authoritative/sourceArtifacts.js";
import { extractLocalArtifact } from "../../src/lib/cbrne/sourceCorpusExtraction.js";
import type { ExtractionDisposition, SourceArtifactExtractionManifest } from "../../src/lib/cbrne/authoritativeSourceTypes.js";

const ROOT = resolve(import.meta.dirname, "../..");
const OUTPUT = resolve(ROOT, "src/data/cbrne/authoritative/generated-extraction-manifest.json");
const generatedAt = "2026-09-11T00:00:00.000Z";

function isIndexArtifact(title: string, id: string) {
  return /index|sitemap|catalog|release|openapi/i.test(`${title} ${id}`);
}

function inspectContent(artifact: (typeof CBRNE_SOURCE_ARTIFACTS)[number]) {
  if (!artifact.localSnapshotPath || !existsSync(resolve(ROOT, artifact.localSnapshotPath))) {
    return { hashValidation: "MISSING" as const, bytes: null, sections: 0, records: 0, pages: null, warnings: ["Local snapshot is not present."], parserLimitations: [] };
  }
  const bytes = readFileSync(resolve(ROOT, artifact.localSnapshotPath));
  const hashValidation = artifact.sha256 && createHash("sha256").update(bytes).digest("hex") === artifact.sha256
    ? "VERIFIED" as const : "FAILED" as const;
  if (hashValidation === "FAILED") return { hashValidation, bytes: bytes.length, sections: 0, records: 0, pages: null, warnings: ["Integrity failed; parser was not run."], parserLimitations: [] };
  const structure = extractLocalArtifact(artifact, ROOT);
  return { hashValidation, bytes: structure.usableContentBytes, sections: structure.sections.length, records: structure.records.length, pages: structure.pages, warnings: structure.warnings, parserLimitations: structure.parserLimitations };
}

function extractionDisposition(
  artifact: (typeof CBRNE_SOURCE_ARTIFACTS)[number],
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
  if (parserLimitations.some((item) => item.startsWith("OCR was not attempted"))) return "PARSER_LIMITATION";
  if (artifact.artifactType === "JSON_API" || artifact.artifactType === "DATASET") return "STRUCTURED_DATA_IMPORTED";
  if (!facts.length && isIndexArtifact(artifact.title, artifact.sourceArtifactId)) return "REFERENCE_ONLY";
  if (!facts.length) return "NO_RELEVANT_OPERATIONAL_FACTS";
  if (facts.every((fact) => fact.fieldGroup === "IDENTITY")) return "IDENTITY_ONLY";
  return "EXTRACTED";
}

const manifest: SourceArtifactExtractionManifest[] = CBRNE_SOURCE_ARTIFACTS.map((artifact) => {
  const content = inspectContent(artifact);
  const facts = CBRNE_AUTHORITATIVE_SOURCE_FACTS.filter((fact) => fact.sourceArtifactId === artifact.sourceArtifactId);
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
  return {
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
  } satisfies SourceArtifactExtractionManifest;
});

const output = `${JSON.stringify({
  generatedFile: true,
  generatedBy: "scripts/cbrne/build-extraction-manifest.ts",
  generatedAt,
  sourceArtifactCount: CBRNE_SOURCE_ARTIFACTS.length,
  distinctAcquiredArtifactCount: CBRNE_SOURCE_ARTIFACTS.filter((artifact) => artifact.currentStatus === "ACQUIRED").length,
  manifest,
}, null, 2)}\n`;

if (!existsSync(OUTPUT) || readFileSync(OUTPUT, "utf8") !== output) writeFileSync(OUTPUT, output);
process.stdout.write(JSON.stringify({ output: OUTPUT, artifacts: manifest.length, bytes: statSync(OUTPUT).size }, null, 2));
