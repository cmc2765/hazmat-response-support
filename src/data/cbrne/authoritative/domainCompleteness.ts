import { CBRNE_MASTER_RECORDS } from "../cbrne-master-records.js";
import { CBRNE_COMPLETENESS_DOMAINS, type CbrneCompletenessDomain, type CbrneCompletenessState, type CbrneDomainCompletenessMatrix } from "../../../lib/cbrne/authoritativeSourceTypes.js";
import { authoritativeFactsForRecord } from "./authoritativeSourceFacts.js";
import { findCanonicalCbrneIdentity } from "./canonicalIdentities.js";
import { detectAuthoritativeFactConflicts } from "../../../lib/cbrne/sourceFactReview.js";
import { findSourceArtifact } from "./sourceArtifacts.js";

const FIELD_TO_DOMAIN: Readonly<Record<string, CbrneCompletenessDomain>> = Object.freeze({
  IDENTITY: "IDENTITY",
  HAZARDS: "CHARACTERISTICS",
  SYMPTOMS: "HEALTH",
  DETECTION: "DETECTION",
  RADIOLOGICAL_SURVEY: "DETECTION",
  SAMPLING: "SAMPLING",
  ANALYSIS: "ANALYSIS",
  PPE: "PPE",
  DECON: "DECONTAMINATION",
  MEDICAL: "MEDICAL",
  PROTECTIVE_ACTION: "PROTECTIVE_ACTION",
  COORDINATION: "COMMAND_COORDINATION",
  TECHNICAL_OPERATIONS: "RESPONDER_SAFETY",
  RADIONUCLIDE_PHYSICS: "CHARACTERISTICS",
});

function sourceStatus(facts: ReturnType<typeof authoritativeFactsForRecord>, domain: CbrneCompletenessDomain): CbrneCompletenessState {
  const relevant = domain === "SOURCE_PROVENANCE"
    ? facts.filter((fact) => Boolean(fact.sourceArtifactId && fact.sourceArtifactSha256))
    : facts.filter((fact) => FIELD_TO_DOMAIN[fact.fieldGroup] === domain);
  if (relevant.some((fact) => fact.reviewStatus === "CONFLICTING_SOURCES")) return "CONFLICTING_SOURCES";
  if (relevant.length) return relevant.every((fact) => fact.reviewStatus === "VERIFIED_AUTHORITATIVE") ? "SOURCE_BACKED" : "SOURCE_BACKED_PENDING_REVIEW";
  return "SOURCE_NOT_AVAILABLE";
}

function hasLinkedArtifact(recordId: string) {
  return authoritativeFactsForRecord(recordId).some((fact) => Boolean(findSourceArtifact(fact.sourceArtifactId)));
}

function missingState(recordId: string, domain: CbrneCompletenessDomain): CbrneCompletenessState {
  const identity = findCanonicalCbrneIdentity(recordId);
  if (domain === "IDENTITY" && !identity) return "IDENTITY_AMBIGUOUS";
  return hasLinkedArtifact(recordId) ? "SOURCE_NOT_AVAILABLE" : "SOURCE_ARTIFACT_MISSING";
}

function matrixForRecord(recordId: string): CbrneDomainCompletenessMatrix {
  const facts = authoritativeFactsForRecord(recordId);
  const conflicts = detectAuthoritativeFactConflicts(facts);
  const domains = Object.fromEntries(CBRNE_COMPLETENESS_DOMAINS.map((domain) => {
    const status = sourceStatus(facts, domain);
    if (status !== "SOURCE_NOT_AVAILABLE") return [domain, status];
    if (conflicts.some((conflict) => FIELD_TO_DOMAIN[conflict.fieldGroup] === domain)) return [domain, "CONFLICTING_SOURCES"];
    return [domain, missingState(recordId, domain)];
  })) as Record<CbrneCompletenessDomain, CbrneCompletenessState>;
  return { canonicalRecordId: recordId, domains };
}

export const CBRNE_DOMAIN_COMPLETENESS_MATRICES: readonly CbrneDomainCompletenessMatrix[] = Object.freeze(
  CBRNE_MASTER_RECORDS.map((record) => matrixForRecord(record.id)),
);

export function completenessMatrixForRecord(recordId: string) {
  return CBRNE_DOMAIN_COMPLETENESS_MATRICES.find((matrix) => matrix.canonicalRecordId === recordId) ?? null;
}
