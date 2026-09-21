import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CBRNE_MASTER_RECORDS } from "../../src/data/cbrne/cbrne-master-records.js";
import { CBRNE_EXTRACTION_MANIFEST } from "../../src/data/cbrne/authoritative/extractionManifest.js";
import { findSourceArtifact } from "../../src/data/cbrne/authoritative/sourceArtifacts.js";
import { CBRNE_AUTHORITATIVE_SOURCE_FACTS } from "../../src/data/cbrne/authoritative/authoritativeSourceFacts.js";
import { findCanonicalCbrneIdentity } from "../../src/data/cbrne/authoritative/canonicalIdentities.js";
import type {
  AuthoritativeSourceFact,
  CbrneSemanticExtractionArtifactResult,
  CbrneSemanticExtractionCheckpoint,
  CbrneSemanticExtractionDisposition,
  PdfPageExtraction,
  SourceArtifactExtractionManifest,
} from "../../src/lib/cbrne/authoritativeSourceTypes.js";

const ROOT = resolve(import.meta.dirname, "../..");
const OUTPUT = resolve(ROOT, "src/data/cbrne/authoritative/generated-resolved-pdf-facts.json");
const GENERATED_AT = "2026-09-11T00:00:00.000Z";
const GENERATED_BY = "scripts/cbrne/extract-resolved-pdf-facts.ts";
const SEMANTIC_PARSER_VERSION = "2";

const ACTIVE_RECORDS = new Set(CBRNE_MASTER_RECORDS.map((record) => record.id));

const DIRECT_RECORDS: Readonly<Record<string, string>> = Object.freeze({
  "nrt-qrg-chemical-sarin-gb": "sarin-gb",
  "nrt-qrg-chemical-tabun-ga": "tabun-ga",
  "nrt-qrg-chemical-soman-gd": "soman-gd",
  "nrt-qrg-chemical-cyclosarin-gf": "cyclosarin-gf",
  "nrt-qrg-chemical-vx": "vx",
  "nrt-qrg-chemical-sulfur-mustard-hd": "sulfur-mustard-hd",
  "nrt-qrg-chemical-mustard-lewisite-hl": "mustard-lewisite-hl",
  "nrt-qrg-chemical-lewisite-l": "lewisite-l",
  "nrt-qrg-chemical-chlorine": "chlorine-cl",
  "nrt-qrg-chemical-phosgene": "phosgene-cg",
  "nrt-qrg-chemical-arsine": "arsine-sa",
  "nrt-qrg-chemical-hydrogen-cyanide": "hydrogen-cyanide-ac",
  "nrt-qrg-biological-anthrax": "anthrax",
  "nrt-qrg-biological-plague": "plague",
  "nrt-qrg-biological-brucellosis": "brucellosis",
  "nrt-qrg-biological-q-fever": "q-fever",
  "nrt-qrg-biological-tularemia": "tularemia",
  "nrt-qrg-biological-hemorrhagic-fever-viruses": "viral-hemorrhagic-fever",
  "nrt-qrg-biological-hantavirus": "hantavirus-pulmonary-syndrome",
  "nrt-qrg-biological-botulinum-toxin": "botulinum-toxin",
  "nrt-qrg-rad-ind": "improvised-nuclear-device",
  "nrt-qrg-rad-rdd": "radiological-dispersal-device",
});

type SemanticRule = {
  group: AuthoritativeSourceFact["fieldGroup"];
  subdomain: string;
  field: string;
  pattern: RegExp;
};

const RULES: readonly SemanticRule[] = Object.freeze([
  { group: "PPE", subdomain: "PPE", field: "Responder PPE source statement", pattern: /\b(?:PPE selection|personal protective equipment|respiratory protection|protective clothing|SCBA|APR|PAPR|HASP|encapsulating suit|Level [A-D] provides)\b/i },
  { group: "DECON", subdomain: "DECONTAMINATION", field: "Decontamination source statement", pattern: /\b(?:decontamination (?:procedures?|of|for|requirements?)|decontaminate|decon (?:of|for)|wash bare skin|remove contaminated articles)\b/i },
  { group: "DETECTION", subdomain: "DETECTION", field: "Detection or monitoring source statement", pattern: /\b(?:detection (?:equipment|technolog|instead|limit|of)|field detection|radiation monitoring|radiation survey|survey instrument|monitoring equipment|detector (?:for|used|can))\w*/i },
  { group: "SAMPLING", subdomain: "SAMPLING", field: "Sampling source statement", pattern: /\b(?:sampling (?:note|plan|location|purpose|procedure|equipment|requirements?)|sample collection|specimen collection|swab samples?)\b/i },
  { group: "ANALYSIS", subdomain: "ANALYSIS", field: "Analysis or laboratory source statement", pattern: /\b(?:laborator(?:y|ies) (?:analysis|requirements?|assets?|testing)|analytical techniques?|confirmatory (?:analysis|testing)|presumptive (?:test|identification)|chain of custody)\b/i },
  { group: "SYMPTOMS", subdomain: "HEALTH_EFFECTS", field: "Health effects or symptoms source statement", pattern: /\b(?:signs?\s*\/\s*symptoms?|symptoms? general|health effects?|clinical presentation|onset(?::| of symptoms?))\b/i },
  { group: "MEDICAL", subdomain: "MEDICAL", field: "Medical management source statement", pattern: /\b(?:medical management|medical:|first aid:|treatment:|antidote:|supportive care|patient (?:triage|treatment)|triage (?:and|,)? treatment)\b/i },
  { group: "PROTECTIVE_ACTION", subdomain: "PROTECTIVE_ACTION", field: "Protective action source statement", pattern: /\b(?:protective actions?|shelter(?:ing)? (?:in|indoors|should|must)|evacuat(?:e|ion) (?:should|must|corridor)|fallout (?:shelter|exposure|hazard)|community reception center)\b/i },
  { group: "COORDINATION", subdomain: "COMMAND_COORDINATION", field: "Command and coordination source statement", pattern: /\b(?:coordination (?:with|among|constructs?)|coordinate with|incident command|unified command|FRMAC|FOSC|EOC|joint information)\b/i },
  { group: "TECHNICAL_OPERATIONS", subdomain: "RESPONDER_SAFETY", field: "Responder safety or technical operations source statement", pattern: /\b(?:personnel safety|responder safety|response personnel (?:should|must)|safety officer|site-specific (?:safety|plan))\b/i },
]);

const IGNORED_SECTION_PATTERNS: readonly [string, RegExp][] = [
  ["REFERENCES_OR_LINKS", /https?:\/\/|www\.|\breferences?\b|bibliograph/i],
  ["NAVIGATION_OR_TOC", /\.{4,}|table of contents|contents\b/i],
  ["COPYRIGHT_OR_DISCLAIMER", /copyright|accessibility statement|for assistance in accessing/i],
];

type GeneratedSemanticOutput = {
  generatedFile: true;
  generatedBy: string;
  generatedAt: string;
  semanticParserVersion: string;
  baselineFactCount: number;
  targetArtifactCount: number;
  checkpoint: CbrneSemanticExtractionCheckpoint;
  artifacts: CbrneSemanticExtractionArtifactResult[];
  facts: AuthoritativeSourceFact[];
};

export type ExtractResolvedPdfFactsOptions = {
  repositoryRoot?: string;
  outputPath?: string;
  extractionManifest?: readonly SourceArtifactExtractionManifest[];
  existingFacts?: readonly AuthoritativeSourceFact[];
  targetArtifactIds?: readonly string[];
  onArtifactProcessed?: (sourceArtifactId: string) => void;
};

function slug(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cleanText(value: string) {
  return [...value.normalize("NFKC")].map((character) => {
    const code = character.charCodeAt(0);
    return (code >= 0 && code <= 31) || code === 127 ? " " : character;
  }).join("").replace(/\s+/g, " ").trim();
}

function isSuspicious(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return (code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31) || character === "�";
  });
}

function ignoredCategory(text: string) {
  return IGNORED_SECTION_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

function sectionFor(rule: SemanticRule, text: string) {
  const labels: Readonly<Record<string, string>> = {
    PPE: "PERSONNEL_SAFETY_PPE",
    DECONTAMINATION: "DECONTAMINATION",
    DETECTION: "DETECTION_MONITORING",
    SAMPLING: "SAMPLING",
    ANALYSIS: "LABORATORY_ANALYSIS",
    HEALTH_EFFECTS: "SIGNS_SYMPTOMS_HEALTH_EFFECTS",
    MEDICAL: "MEDICAL_FIRST_AID_TREATMENT",
    PROTECTIVE_ACTION: "PROTECTIVE_ACTIONS",
    COMMAND_COORDINATION: "COMMAND_COORDINATION",
    RESPONDER_SAFETY: "RESPONDER_SAFETY_TECHNICAL_OPERATIONS",
  };
  const explicit = text.match(/(?:\d+(?:\.\d+)*\.?\s*)?(?:agent characteristics|signs\s*\/\s*symptoms|exposure routes|personnel safety|sampling|laboratory analysis|first aid|medical|protective actions?|command|coordination|detection|monitoring|decontamination)/i)?.[0];
  return explicit ? cleanText(explicit).slice(0, 100) : labels[rule.subdomain] ?? rule.subdomain;
}

function sourceSnippet(rawText: string, cleaned: string, pattern: RegExp) {
  const match = pattern.exec(cleaned);
  const startAt = match?.index ?? 0;
  const previousBoundary = Math.max(cleaned.lastIndexOf(". ", startAt), cleaned.lastIndexOf("; ", startAt), cleaned.lastIndexOf("•", startAt));
  const start = previousBoundary >= 0 && startAt - previousBoundary < 180 ? previousBoundary + 2 : startAt;
  const nextMatch = cleaned.slice(startAt).match(/[.!?](?:\s|$)/);
  const nextBoundary = nextMatch ? startAt + nextMatch.index! : -1;
  const end = nextBoundary > start ? nextBoundary + 1 : Math.min(cleaned.length, start + 220);
  const normalized = cleaned.slice(start, end).trim();
  const rawNormalized = rawText.replace(/\s+/g, " ").trim();
  const rawStart = Math.max(0, rawNormalized.toLocaleLowerCase().indexOf(normalized.toLocaleLowerCase().slice(0, 36)));
  const rawSnippet = rawStart >= 0 ? rawNormalized.slice(rawStart, Math.min(rawNormalized.length, rawStart + normalized.length + 24)).trim() : rawNormalized.slice(0, normalized.length);
  return { raw: rawSnippet.slice(0, 240), normalized: normalized.slice(0, 220) };
}

function hasActionableContext(artifactId: string, text: string) {
  if (!/^fema-/.test(artifactId)) return true;
  if (/Metropolis|FireStation|EmergencyPlanner|Jayden|Sophia|Jose|T \+ \d+/i.test(text) && !/ActionItem|Recommended Action/i.test(text)) return false;
  return /ActionItem|Recommended Action|\b(?:should|must|need to|recommend(?:s|ed)?|establish|conduct|ensure|provide|coordinate)\b/i.test(text);
}

function scenarioFor(artifactId: string, text: string) {
  if (/nrt-qrg-rad-ind|nuclear detonation|fallout|\bIND\b/i.test(`${artifactId} ${text}`)) return "nuclear detonation / fallout response";
  if (/nrt-qrg-rad-rdd|radiological dispersal|\bRDD\b|radiological incident|radiation emergency/i.test(`${artifactId} ${text}`)) return "radiological incident response";
  if (/QRG|chemical|agent/i.test(artifactId)) return "hazard-specific release response";
  if (/biological|anthrax|plague|toxin/i.test(artifactId)) return "biological incident response";
  return "source-described emergency response context";
}

function recordsFor(artifactId: string, text: string) {
  const direct = DIRECT_RECORDS[artifactId];
  if (direct) return [direct];
  if (artifactId === "nrt-qrg-biological-glanders-melioidosis") {
    if (/glanders/i.test(text) && !/melioidosis/i.test(text)) return ["glanders"];
    if (/melioidosis/i.test(text) && !/glanders/i.test(text)) return ["melioidosis"];
    return [];
  }
  if (artifactId === "nrt-qrg-biological-smallpox-mpox") {
    return /smallpox/i.test(text) && !/mpox|monkeypox/i.test(text) ? ["smallpox"] : [];
  }
  if (artifactId === "nrt-qrg-biological-ricin-abrin") {
    if (/ricin/i.test(text) && !/abrin/i.test(text)) return ["ricin"];
    if (/abrin/i.test(text) && !/ricin/i.test(text)) return ["abrin"];
    return [];
  }
  if (/fema-nuclear-planning|fema-nuclear-first-72-hours|fema-nuclear-communications/i.test(artifactId)) return ["improvised-nuclear-device"];
  if (artifactId === "fema-nria") {
    if (/nuclear detonation|\bIND\b/i.test(text) && !/\bRDD\b|radiological dispersal/i.test(text)) return ["improvised-nuclear-device"];
    if (/\bRDD\b|radiological dispersal/i.test(text) && !/nuclear detonation|\bIND\b/i.test(text)) return ["radiological-dispersal-device"];
    return [];
  }
  if (/epa-pag-2017|cdc-population-monitoring-second-edition|cdc-radiation-public-shelters/i.test(artifactId)
    && /radiation emergency|radiological incident|community reception center|\bCRC\b|public shelter|fallout/i.test(text)) return ["radiological-dispersal-device"];
  return [];
}

function inferContext(recordId: string, artifactId: string, section: string, text: string, rule: SemanticRule): Record<string, string | number | boolean | null> {
  const context: Record<string, string> = {
    agentOrRecord: recordId,
    scenario: scenarioFor(artifactId, text),
    phase: /pre-incident|preparedness|planning/i.test(text) ? "preparedness / pre-incident" : "response / source-described phase",
    evidentiaryStatus: "source-stated; SOURCE_IMPORTED_PENDING_REVIEW",
    sourceSection: section,
    sourceLimitation: "Embedded PDF text retained in page/block order; layout, table semantics, and source interpretation require review.",
  };
  const route = text.match(/\b(inhalation|ingestion|dermal|skin|eye|injection|external|internal)\b/i)?.[1];
  const duration = text.match(/\b\d+(?:\.\d+)?\s*(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b/i)?.[0];
  const population = /patient|victim|clinical|hospital/i.test(text) ? "patient / affected person" : /public|population|community/i.test(text) ? "public / affected population" : "responder / response personnel";
  if (route) context.route = route.toLocaleLowerCase();
  if (duration) context.duration = duration;
  context.population = population;
  if (rule.group === "SAMPLING" || rule.group === "ANALYSIS") context.setting = /laborator|assay|confirmatory/i.test(text) ? "field/laboratory interface" : "field operations";
  if (/contaminat/i.test(text)) context.contaminationOrExposure = "contamination or exposure as stated in source";
  if (/internal/i.test(text)) context.exposureCompartment = "internal as stated";
  if (/external/i.test(text)) context.exposureCompartment = "external as stated";
  if (/dry|powder|particulate/i.test(text)) context.materialState = "dry / particulate as stated";
  if (/liquid|wet|aqueous/i.test(text)) context.materialState = "wet / liquid as stated";
  if (/presumptive/i.test(text)) context.analysisStage = "presumptive as stated";
  if (/confirmatory/i.test(text)) context.analysisStage = "confirmatory as stated";
  if (/gross decontamin|gross decon/i.test(text)) context.decontaminationScale = "gross as stated";
  if (/technical decontamin|technical decon/i.test(text)) context.decontaminationScale = "technical as stated";
  return context;
}

function semanticDomain(group: AuthoritativeSourceFact["fieldGroup"]) {
  if (group === "PPE") return "PPE";
  if (group === "DECON") return "DECONTAMINATION";
  if (group === "DETECTION") return "DETECTION";
  if (group === "SAMPLING") return "SAMPLING";
  if (group === "ANALYSIS") return "ANALYSIS";
  if (group === "SYMPTOMS") return "HEALTH";
  if (group === "MEDICAL") return "MEDICAL";
  if (group === "PROTECTIVE_ACTION") return "PROTECTIVE_ACTION";
  if (group === "COORDINATION") return "COMMAND_COORDINATION";
  return "RESPONDER_SAFETY";
}

function fingerprint(fact: Pick<AuthoritativeSourceFact, "canonicalRecordId" | "fieldGroup" | "field" | "valueNormalized" | "unitsNormalized" | "context">) {
  return JSON.stringify([fact.canonicalRecordId, fact.fieldGroup, fact.field, fact.valueNormalized ?? null, fact.unitsNormalized ?? null, fact.context ?? null]);
}

function readPrior(outputPath: string) {
  if (!existsSync(outputPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(outputPath, "utf8")) as GeneratedSemanticOutput;
    return parsed.generatedBy === GENERATED_BY && parsed.semanticParserVersion === SEMANTIC_PARSER_VERSION && Array.isArray(parsed.artifacts) && Array.isArray(parsed.facts) ? parsed : null;
  } catch { return null; }
}

function writeCheckpoint(outputPath: string, checkpoint: CbrneSemanticExtractionCheckpoint, artifacts: readonly CbrneSemanticExtractionArtifactResult[], facts: readonly AuthoritativeSourceFact[], baselineFactCount: number, targetArtifactCount: number) {
  mkdirSync(resolve(outputPath, ".."), { recursive: true });
  const temporaryPath = `${outputPath}.tmp`;
  const output: GeneratedSemanticOutput = { generatedFile: true, generatedBy: GENERATED_BY, generatedAt: GENERATED_AT, semanticParserVersion: SEMANTIC_PARSER_VERSION, baselineFactCount, targetArtifactCount, checkpoint, artifacts: [...artifacts], facts: [...facts] };
  writeFileSync(temporaryPath, `${JSON.stringify(output, null, 2)}\n`);
  renameSync(temporaryPath, outputPath);
  return output;
}

function candidateFor(artifactId: string, artifactSha256: string, recordId: string, page: PdfPageExtraction, block: PdfPageExtraction["textBlocks"][number], rule: SemanticRule, snippet: { raw: string; normalized: string }, section: string, artifact: ReturnType<typeof findSourceArtifact>) {
  const identity = findCanonicalCbrneIdentity(recordId);
  const master = CBRNE_MASTER_RECORDS.find((record) => record.id === recordId);
  if (!identity || !master || !artifact) return null;
  const factId = `pdf-${slug(artifactId)}-p${page.humanPageNumber ?? page.pdfPageIndex + 1}-b${block.order}-${slug(rule.subdomain)}`;
  const limitations = [
    "Source statement remains review-gated and cannot drive tactical recommendations.",
    "PDF table geometry and column semantics were not interpreted automatically.",
    ...(isSuspicious(snippet.raw) ? ["Source extraction contains suspicious encoding; verify the source representation before use."] : []),
  ];
  return {
    factId,
    canonicalRecordId: recordId,
    identityNamespace: identity.namespace,
    domain: master.domain,
    fieldGroup: rule.group,
    field: rule.field,
    subdomain: rule.subdomain,
    value: snippet.normalized,
    units: null,
    valueOriginal: snippet.raw,
    unitsOriginal: null,
    valueNormalized: snippet.normalized,
    unitsNormalized: null,
    normalizationMethod: "Embedded PDF text whitespace/control normalization; original source statement retained.",
    applicability: null,
    context: inferContext(recordId, artifactId, section, snippet.normalized, rule),
    sourceArtifactId: artifactId,
    sourceArtifactSha256: artifactSha256,
    sourceAgency: artifact.agency,
    sourceFamily: artifact.sourceFamily,
    sourceDocumentTitle: artifact.title,
    officialUrl: artifact.officialUrl,
    sourceVersion: artifact.sourceVersion,
    publicationDate: artifact.publicationDate,
    sourceLocator: `Page ${page.humanPageNumber ?? page.pdfPageIndex + 1} — block ${block.order} — ${section}`,
    extractionMethod: "DOCUMENT_REVIEW" as const,
    importedAt: GENERATED_AT,
    reviewStatus: "SOURCE_IMPORTED_PENDING_REVIEW" as const,
    reviewedBy: null,
    reviewedAt: null,
    factKind: rule.group === "COORDINATION" ? "SOURCE_DERIVED_COORDINATION_GUIDANCE" as const : "SOURCE_DERIVED_FACT" as const,
    factBasis: "Atomic source statement selected from an existing page-aware embedded-text extraction; no tactical recommendation was derived.",
    hazmatiqProcessing: "Typed identity, page, block, section, and source context retained; no family inheritance, dose prescription, standoff value, or evacuation distance was inferred.",
    limitations,
    superseded: false,
    supersededBy: null,
  } satisfies AuthoritativeSourceFact;
}

function processArtifact(artifactId: string, manifestEntry: SourceArtifactExtractionManifest, repositoryRoot: string, knownFingerprints: Set<string>) {
  const artifact = findSourceArtifact(artifactId);
  if (!artifact || !manifestEntry.sourceArtifactSha256 || !manifestEntry.pageExtractionArtifactPath) throw new Error(`${artifactId} has no verified semantic extraction input.`);
  const extraction = JSON.parse(readFileSync(resolve(repositoryRoot, manifestEntry.pageExtractionArtifactPath), "utf8")) as { sourceArtifactId: string; sourceArtifactSha256: string; parser: string; pages: PdfPageExtraction[] };
  if (extraction.sourceArtifactId !== artifactId || extraction.sourceArtifactSha256 !== manifestEntry.sourceArtifactSha256 || extraction.parser !== "PDF_STRUCTURE") throw new Error(`${artifactId} page extraction metadata does not match the manifest.`);
  const facts: AuthoritativeSourceFact[] = [];
  const factsCreated: string[] = [];
  const duplicateFactsSkipped: string[] = [];
  const operationalSections = new Set<string>();
  const ignoredSections = new Set<string>();
  const linked = new Set<string>();
  const domains = new Set<string>();
  let rejectedUnsafeFactCandidates = 0;
  let blocksProcessed = 0;
  for (const page of extraction.pages) {
    for (const block of page.textBlocks) {
      if (block.role !== "BODY") continue;
      blocksProcessed += 1;
      const rawText = block.text;
      const text = cleanText(rawText);
      const ignored = ignoredCategory(text);
      if (ignored) { ignoredSections.add(ignored); continue; }
      const rule = RULES.find((candidate) => candidate.pattern.test(text));
      if (!rule || !hasActionableContext(artifactId, text)) continue;
      const section = sectionFor(rule, text);
      operationalSections.add(section);
      const records = recordsFor(artifactId, text).filter((recordId) => ACTIVE_RECORDS.has(recordId));
      const snippet = sourceSnippet(rawText, text, rule.pattern);
      if (snippet.normalized.length < 45 || !records.length || (rule.group === "PROTECTIVE_ACTION" && /standoff|isolation distance|evacuation distance|\b(?:feet|miles|kilometers?)\b/i.test(snippet.normalized))) {
        rejectedUnsafeFactCandidates += 1;
        continue;
      }
      for (const recordId of records) {
        const candidate = candidateFor(artifactId, manifestEntry.sourceArtifactSha256, recordId, page, block, rule, snippet, section, artifact);
        if (!candidate) { rejectedUnsafeFactCandidates += 1; continue; }
        const key = fingerprint(candidate);
        if (knownFingerprints.has(key)) { duplicateFactsSkipped.push(candidate.factId); continue; }
        knownFingerprints.add(key);
        facts.push(candidate);
        factsCreated.push(candidate.factId);
        linked.add(recordId);
        domains.add(semanticDomain(rule.group));
      }
    }
  }
  const disposition: CbrneSemanticExtractionDisposition = factsCreated.length || duplicateFactsSkipped.length ? "FACTS_EXTRACTED" : "NO_SAFE_FACTS_ADMITTED";
  const result: CbrneSemanticExtractionArtifactResult = {
    sourceArtifactId: artifactId,
    sourceArtifactSha256: manifestEntry.sourceArtifactSha256,
    disposition,
    pagesProcessed: extraction.pages.length,
    blocksProcessed,
    operationalSectionsFound: [...operationalSections].sort(),
    factsCreated,
    duplicateFactsSkipped,
    rejectedUnsafeFactCandidates,
    identitiesLinked: [...linked].sort(),
    domainsUpdated: [...domains].sort(),
    ignoredSectionCategories: [...ignoredSections].sort(),
    parserSemanticLimitations: [
      "Semantic pass used only existing page-aware embedded-text output; it did not reacquire or reparse source PDFs.",
      "Tables, multi-column layout, and suspicious encoding remain review-gated.",
    ],
  };
  return { result, facts };
}

export function extractResolvedPdfFacts(options: ExtractResolvedPdfFactsOptions = {}) {
  const repositoryRoot = options.repositoryRoot ?? ROOT;
  const outputPath = options.outputPath ?? OUTPUT;
  const manifest = options.extractionManifest ?? CBRNE_EXTRACTION_MANIFEST;
  const targetArtifactIds = options.targetArtifactIds ?? manifest
    .filter((entry) => entry.expectedFileType === "PDF" && entry.failureCategory && entry.extractionDisposition !== "PARSER_LIMITATION" && entry.pageExtractionArtifactPath)
    .map((entry) => entry.sourceArtifactId);
  if (targetArtifactIds.length !== 46) throw new Error(`Expected exactly 46 resolved PDF artifacts; found ${targetArtifactIds.length}.`);
  const prior = readPrior(outputPath);
  const suppliedFacts = options.existingFacts ?? CBRNE_AUTHORITATIVE_SOURCE_FACTS;
  const baselineFacts = options.existingFacts ? suppliedFacts : suppliedFacts.filter((fact) => !fact.factId.startsWith("pdf-"));
  const facts = [...(prior?.facts ?? [])];
  const knownFingerprints = new Set([...baselineFacts, ...facts].map((fact) => fingerprint(fact)));
  const artifactResults = [...(prior?.artifacts ?? [])].filter((result) => targetArtifactIds.includes(result.sourceArtifactId));
  const completed = new Set<string>();
  for (const result of artifactResults) {
    const entry = manifest.find((item) => item.sourceArtifactId === result.sourceArtifactId);
    if (entry && result.sourceArtifactSha256 === entry.sourceArtifactSha256 && result.disposition && result.pagesProcessed >= 0) completed.add(result.sourceArtifactId);
  }
  const resultById = new Map(artifactResults.map((result) => [result.sourceArtifactId, result]));
  let completedCount = completed.size;
  let lastCompletedArtifactId: string | null = null;
  for (const artifactId of targetArtifactIds) {
    const entry = manifest.find((item) => item.sourceArtifactId === artifactId);
    if (!entry) throw new Error(`Resolved PDF is absent from extraction manifest: ${artifactId}`);
    if (completed.has(artifactId)) { lastCompletedArtifactId = artifactId; continue; }
    const processed = processArtifact(artifactId, entry, repositoryRoot, knownFingerprints);
    facts.push(...processed.facts);
    resultById.set(artifactId, processed.result);
    completedCount += 1;
    lastCompletedArtifactId = artifactId;
    options.onArtifactProcessed?.(artifactId);
    writeCheckpoint(outputPath, { status: "IN_PROGRESS", expectedArtifactCount: targetArtifactIds.length, completedArtifactCount: completedCount, lastCompletedArtifactId }, targetArtifactIds.map((id) => resultById.get(id)).filter((item): item is CbrneSemanticExtractionArtifactResult => Boolean(item)), facts, baselineFacts.length, targetArtifactIds.length);
  }
  return writeCheckpoint(outputPath, { status: "COMPLETE", expectedArtifactCount: targetArtifactIds.length, completedArtifactCount: targetArtifactIds.length, lastCompletedArtifactId }, targetArtifactIds.map((id) => resultById.get(id)).filter((item): item is CbrneSemanticExtractionArtifactResult => Boolean(item)), facts, baselineFacts.length, targetArtifactIds.length);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(extractResolvedPdfFacts(), null, 2)}\n`);
}
