import { CBRNE_AUTHORITATIVE_SOURCE_FACTS } from "../../src/data/cbrne/authoritative/authoritativeSourceFacts.js";
import { CBRNE_ADDITIONAL_CANONICAL_RECORDS, CBRNE_CANONICAL_RECORD_CANDIDATES } from "../../src/data/cbrne/authoritative/canonicalRecordCandidates.js";
import { CBRNE_CHEMICAL_COMPANION_CROSSWALKS } from "../../src/data/cbrne/authoritative/chemicalCompanionCrosswalk.js";
import { CBRNE_MANUAL_ACQUISITION_QUEUE, CBRNE_SOURCE_COMPLETENESS } from "../../src/data/cbrne/authoritative/completeness.js";
import { CBRNE_RECORD_RECONCILIATIONS } from "../../src/data/cbrne/authoritative/reconciliation.js";
import { CBRNE_SOURCE_ARTIFACTS } from "../../src/data/cbrne/authoritative/sourceArtifacts.js";

const operationalFactsForRecord = (recordId: string) => CBRNE_AUTHORITATIVE_SOURCE_FACTS.filter((fact) => (
  fact.canonicalRecordId === recordId && !["IDENTITY", "RADIONUCLIDE_PHYSICS"].includes(fact.fieldGroup)
));
const anyFactsForRecord = (recordId: string) => CBRNE_AUTHORITATIVE_SOURCE_FACTS.filter((fact) => fact.canonicalRecordId === recordId);

const totals = {
  publicOfficialArtifactsDiscovered: CBRNE_SOURCE_ARTIFACTS.length,
  acquired: CBRNE_SOURCE_ARTIFACTS.filter((artifact) => artifact.currentStatus === "ACQUIRED").length,
  duplicate: CBRNE_SOURCE_ARTIFACTS.filter((artifact) => artifact.currentStatus === "DUPLICATE").length,
  hashed: CBRNE_SOURCE_ARTIFACTS.filter((artifact) => artifact.sha256).length,
  parsed: CBRNE_SOURCE_ARTIFACTS.filter((artifact) => artifact.parsed).length,
  manualAcquisitionRequired: CBRNE_SOURCE_ARTIFACTS.filter((artifact) => artifact.currentStatus === "MANUAL_ACQUISITION_REQUIRED").length,
  accessBlocked: CBRNE_SOURCE_ARTIFACTS.filter((artifact) => artifact.currentStatus === "ACCESS_BLOCKED").length,
  failed: CBRNE_SOURCE_ARTIFACTS.filter((artifact) => artifact.currentStatus === "FAILED").length,
  superseded: CBRNE_SOURCE_ARTIFACTS.filter((artifact) => artifact.currentStatus === "SUPERSEDED").length,
  intentionallyExcluded: CBRNE_SOURCE_ARTIFACTS.filter((artifact) => artifact.currentStatus === "OUT_OF_SCOPE").length,
  silentlySkipped: CBRNE_SOURCE_COMPLETENESS.reduce((total, family) => total + family.silentlySkipped, 0),
};

const records = {
  reconciled: CBRNE_RECORD_RECONCILIATIONS.length,
  withAuthoritativeIdentity: CBRNE_RECORD_RECONCILIATIONS.filter((record) => record.authoritativeIdentitiesFound.length > 0).length,
  withOperationalSourceFacts: CBRNE_RECORD_RECONCILIATIONS.filter((record) => operationalFactsForRecord(record.canonicalRecordId).length > 0).length,
  identityOnly: CBRNE_RECORD_RECONCILIATIONS.filter((record) => anyFactsForRecord(record.canonicalRecordId).length > 0 && operationalFactsForRecord(record.canonicalRecordId).length === 0).length,
  withoutImportedSourceFacts: CBRNE_RECORD_RECONCILIATIONS.filter((record) => anyFactsForRecord(record.canonicalRecordId).length === 0).length,
  withSourceConflicts: CBRNE_RECORD_RECONCILIATIONS.filter((record) => record.conflicts.length > 0).length,
  requiringManualReview: CBRNE_RECORD_RECONCILIATIONS.filter((record) => record.reviewStatus !== "VERIFIED_AUTHORITATIVE").length,
};

const facts = {
  imported: CBRNE_AUTHORITATIVE_SOURCE_FACTS.length,
  pendingReview: CBRNE_AUTHORITATIVE_SOURCE_FACTS.filter((fact) => fact.reviewStatus === "SOURCE_IMPORTED_PENDING_REVIEW").length,
  rejectedOperationalValues: CBRNE_RECORD_RECONCILIATIONS.reduce((total, record) => total + record.factsRejected.length, 0),
};

const crosswalks = {
  total: CBRNE_CHEMICAL_COMPANION_CROSSWALKS.length,
  identityMatched: CBRNE_CHEMICAL_COMPANION_CROSSWALKS.filter((crosswalk) => crosswalk.identityStatus === "MATCHED_TO_AUTHORITY").length,
  operationalSourceUnproven: CBRNE_CHEMICAL_COMPANION_CROSSWALKS.filter((crosswalk) => crosswalk.operationalDataStatus === "SOURCE_UNPROVEN").length,
  notApplicable: CBRNE_CHEMICAL_COMPANION_CROSSWALKS.filter((crosswalk) => crosswalk.operationalDataStatus === "NOT_APPLICABLE").length,
};

process.stdout.write(`${JSON.stringify({
  sourceFamilyCompleteness: CBRNE_SOURCE_COMPLETENESS,
  totals,
  records,
  facts,
  crosswalks,
  candidates: { discovered: CBRNE_CANONICAL_RECORD_CANDIDATES.length, canonicalRecordsCreated: CBRNE_ADDITIONAL_CANONICAL_RECORDS.length },
  manualQueue: CBRNE_MANUAL_ACQUISITION_QUEUE,
}, null, 2)}\n`);
