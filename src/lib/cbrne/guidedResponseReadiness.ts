import { authoritativeFactsForRecord } from "../../data/cbrne/authoritative/authoritativeSourceFacts.js";
import { CBRNE_MASTER_RECORDS } from "../../data/cbrne/cbrne-master-records.js";
import { completenessMatrixForRecord } from "../../data/cbrne/authoritative/domainCompleteness.js";
import type { AuthoritativeSourceFact } from "./authoritativeSourceTypes.js";

export type GuidedResponseDataReadiness = "DATA_READY_FOR_FUTURE_GUIDED_RESPONSE_REVIEW" | "PARTIALLY_READY" | "FAIL_CLOSED";

export type GuidedResponseEvidence = {
  factId: string;
  authority: string;
  document: string;
  version: string | null;
  sourceLocator: string;
  factualBasis: string;
  processingState: AuthoritativeSourceFact["factKind"];
  reviewStatus: AuthoritativeSourceFact["reviewStatus"];
  limitations: string[];
};

export function authoritativeFactMayDriveGuidedResponse(fact: AuthoritativeSourceFact) {
  return fact.reviewStatus === "VERIFIED_AUTHORITATIVE"
    && fact.factKind !== "REQUIRES_FIELD_MEASUREMENT"
    && fact.factKind !== "REQUIRES_SME_AGENCY_COORDINATION"
    && fact.identityNamespace !== "RADIONUCLIDE"
    && fact.fieldGroup !== "RADIONUCLIDE_PHYSICS";
}

function operationalFacts(recordId: string) {
  return authoritativeFactsForRecord(recordId).filter((fact) => !["IDENTITY", "RADIONUCLIDE_PHYSICS"].includes(fact.fieldGroup));
}

export function guidedResponseReadinessForRecord(recordId: string): GuidedResponseDataReadiness {
  const facts = authoritativeFactsForRecord(recordId);
  const operational = operationalFacts(recordId);
  if (!facts.length) return "FAIL_CLOSED";
  if (!operational.length) return "PARTIALLY_READY";
  const matrix = completenessMatrixForRecord(recordId);
  const covered = matrix ? Object.values(matrix.domains).filter((state) => state === "SOURCE_BACKED" || state === "SOURCE_BACKED_PENDING_REVIEW").length : 0;
  return covered >= 5 ? "DATA_READY_FOR_FUTURE_GUIDED_RESPONSE_REVIEW" : "PARTIALLY_READY";
}

export function guidedResponseEvidenceForRecord(recordId: string): GuidedResponseEvidence[] {
  return authoritativeFactsForRecord(recordId).map((fact) => ({
    factId: fact.factId,
    authority: fact.sourceAgency,
    document: fact.sourceDocumentTitle,
    version: fact.sourceVersion,
    sourceLocator: fact.sourceLocator,
    factualBasis: fact.factBasis,
    processingState: fact.factKind,
    reviewStatus: fact.reviewStatus,
    limitations: fact.limitations,
  }));
}

export const CBRNE_GUIDED_RESPONSE_READINESS = Object.freeze(CBRNE_MASTER_RECORDS.map((record) => ({
  canonicalRecordId: record.id,
  readiness: guidedResponseReadinessForRecord(record.id),
})));
