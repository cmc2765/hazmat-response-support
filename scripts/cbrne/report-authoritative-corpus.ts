import { CBRNE_AUTHORITATIVE_SOURCE_FACTS } from "../../src/data/cbrne/authoritative/authoritativeSourceFacts.js";
import { CBRNE_ADDITIONAL_CANONICAL_RECORDS, CBRNE_CANONICAL_RECORD_CANDIDATES } from "../../src/data/cbrne/authoritative/canonicalRecordCandidates.js";
import { CBRNE_CANONICAL_IDENTITIES } from "../../src/data/cbrne/authoritative/canonicalIdentities.js";
import { CBRNE_CHEMICAL_COMPANION_CROSSWALKS } from "../../src/data/cbrne/authoritative/chemicalCompanionCrosswalk.js";
import { CBRNE_MANUAL_ACQUISITION_QUEUE, CBRNE_SOURCE_COMPLETENESS } from "../../src/data/cbrne/authoritative/completeness.js";
import { CBRNE_RECORD_RECONCILIATIONS } from "../../src/data/cbrne/authoritative/reconciliation.js";
import { CBRNE_SOURCE_ARTIFACTS } from "../../src/data/cbrne/authoritative/sourceArtifacts.js";
import { CBRNE_MASTER_RECORDS } from "../../src/data/cbrne/cbrne-master-records.js";
import { CBRNE_EXTRACTION_MANIFEST } from "../../src/data/cbrne/authoritative/extractionManifest.js";
import { CBRNE_DOMAIN_COMPLETENESS_MATRICES } from "../../src/data/cbrne/authoritative/domainCompleteness.js";
import { CBRNE_GUIDED_RESPONSE_READINESS } from "../../src/lib/cbrne/guidedResponseReadiness.js";

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
  bySourceFamily: Object.fromEntries([...new Set(CBRNE_AUTHORITATIVE_SOURCE_FACTS.map((fact) => fact.sourceFamily))].map((family) => [family, CBRNE_AUTHORITATIVE_SOURCE_FACTS.filter((fact) => fact.sourceFamily === family).length])),
  byCanonicalRecord: Object.fromEntries(CBRNE_MASTER_RECORDS.map((record) => [record.id, CBRNE_AUTHORITATIVE_SOURCE_FACTS.filter((fact) => fact.canonicalRecordId === record.id).length])),
  byDomain: Object.fromEntries([...new Set(CBRNE_AUTHORITATIVE_SOURCE_FACTS.map((fact) => fact.domain))].map((domain) => [domain, CBRNE_AUTHORITATIVE_SOURCE_FACTS.filter((fact) => fact.domain === domain).length])),
  byReviewState: Object.fromEntries([...new Set(CBRNE_AUTHORITATIVE_SOURCE_FACTS.map((fact) => fact.reviewStatus))].map((state) => [state, CBRNE_AUTHORITATIVE_SOURCE_FACTS.filter((fact) => fact.reviewStatus === state).length])),
  byFieldGroup: Object.fromEntries([...new Set(CBRNE_AUTHORITATIVE_SOURCE_FACTS.map((fact) => fact.fieldGroup))].map((fieldGroup) => [fieldGroup, CBRNE_AUTHORITATIVE_SOURCE_FACTS.filter((fact) => fact.fieldGroup === fieldGroup).length])),
};

const countFacts = (predicate: (fact: (typeof CBRNE_AUTHORITATIVE_SOURCE_FACTS)[number]) => boolean) => CBRNE_AUTHORITATIVE_SOURCE_FACTS.filter(predicate).length;
const countRecords = (predicate: (recordId: string) => boolean) => CBRNE_MASTER_RECORDS.filter((record) => predicate(record.id)).length;
const cwaRecordIds = new Set(CBRNE_CANONICAL_IDENTITIES.filter((identity) => identity.namespace === "CWA_CHEMICAL").map((identity) => identity.canonicalCbrneId));
const biologicalRecordIds = new Set(CBRNE_CANONICAL_IDENTITIES.filter((identity) => identity.namespace === "BIOLOGICAL" || identity.namespace === "BIOLOGICAL_TOXIN").map((identity) => identity.canonicalBiologicalId.replace(/^bio:/, "")));
const radiologicalRecordIds = new Set(CBRNE_MASTER_RECORDS.filter((record) => record.category === "RADIONUCLIDE" || record.domain === "NUCLEAR" || record.category === "RADIOLOGICAL_DISPERSAL_DEVICE").map((record) => record.id));
const hasFactGroup = (recordId: string, groups: string[]) => CBRNE_AUTHORITATIVE_SOURCE_FACTS.some((fact) => fact.canonicalRecordId === recordId && groups.includes(fact.fieldGroup));

const domainCoverage = Object.fromEntries([
  "CHARACTERISTICS", "HEALTH", "EXPOSURE_GUIDANCE", "RESPONDER_SAFETY", "PPE", "DETECTION", "SAMPLING", "ANALYSIS",
  "DECONTAMINATION", "MEDICAL", "PROTECTIVE_ACTION", "COMMAND_COORDINATION",
].map((domain) => [domain, CBRNE_DOMAIN_COMPLETENESS_MATRICES.filter((matrix) => ["SOURCE_BACKED", "SOURCE_BACKED_PENDING_REVIEW"].includes(matrix.domains[domain as keyof typeof matrix.domains])).length]));

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
  extraction: {
    totalRegistryArtifacts: CBRNE_EXTRACTION_MANIFEST.length,
    distinctAcquiredArtifacts: CBRNE_EXTRACTION_MANIFEST.filter((item) => item.acquisitionDisposition === "ACQUIRED").length,
    hashVerified: CBRNE_EXTRACTION_MANIFEST.filter((item) => item.hashValidation === "VERIFIED").length,
    byDisposition: Object.fromEntries([...new Set(CBRNE_EXTRACTION_MANIFEST.map((item) => item.extractionDisposition))].map((state) => [state, CBRNE_EXTRACTION_MANIFEST.filter((item) => item.extractionDisposition === state).length])),
    silentSkips: CBRNE_EXTRACTION_MANIFEST.filter((item) => item.extractionDisposition === "SOURCE_NOT_PRESENT" && item.acquisitionDisposition === "ACQUIRED").length,
  },
  domainCoverage,
  familyCoverage: {
    chemical: {
      opcwLinkedIdentities: CBRNE_CANONICAL_IDENTITIES.filter((identity) => identity.namespace === "CWA_CHEMICAL" && Boolean(identity.opcwClassification)).length,
      epaNrtCoveredRecords: countRecords((recordId) => cwaRecordIds.has(recordId) && CBRNE_AUTHORITATIVE_SOURCE_FACTS.some((fact) => fact.canonicalRecordId === recordId && fact.sourceFamily === "EPA_NRT_QRG")),
      chemmMedicalFacts: countFacts((fact) => fact.sourceFamily === "CHEMM"),
      ppeCoveredRecords: countRecords((recordId) => cwaRecordIds.has(recordId) && hasFactGroup(recordId, ["PPE"])),
      detectionCoveredRecords: countRecords((recordId) => cwaRecordIds.has(recordId) && hasFactGroup(recordId, ["DETECTION"])),
      deconCoveredRecords: countRecords((recordId) => cwaRecordIds.has(recordId) && hasFactGroup(recordId, ["DECON"])),
    },
    biological: {
      identities: biologicalRecordIds.size,
      transmissionCoveredRecords: countRecords((recordId) => biologicalRecordIds.has(recordId) && hasFactGroup(recordId, ["HAZARDS"])),
      incubationCoveredRecords: countRecords((recordId) => biologicalRecordIds.has(recordId) && hasFactGroup(recordId, ["SYMPTOMS"])),
      ppeCoveredRecords: countRecords((recordId) => biologicalRecordIds.has(recordId) && hasFactGroup(recordId, ["PPE"])),
      detectionCoveredRecords: countRecords((recordId) => biologicalRecordIds.has(recordId) && hasFactGroup(recordId, ["DETECTION"])),
      samplingCoveredRecords: countRecords((recordId) => biologicalRecordIds.has(recordId) && hasFactGroup(recordId, ["TECHNICAL_OPERATIONS"])),
      deconCoveredRecords: countRecords((recordId) => biologicalRecordIds.has(recordId) && hasFactGroup(recordId, ["DECON"])),
      medicalCoveredRecords: countRecords((recordId) => biologicalRecordIds.has(recordId) && hasFactGroup(recordId, ["MEDICAL"])),
    },
    radiological: {
      nndcNormalizedRadionuclides: CBRNE_MASTER_RECORDS.filter((record) => record.category === "RADIONUCLIDE" && CBRNE_AUTHORITATIVE_SOURCE_FACTS.some((fact) => fact.canonicalRecordId === record.id && fact.sourceFamily === "NNDC_ENSDF")).length,
      physicsCoverage: countFacts((fact) => fact.sourceFamily === "NNDC_ENSDF"),
      remmOperationalFacts: countFacts((fact) => fact.sourceFamily === "REMM"),
      internalContaminationFacts: countFacts((fact) => fact.sourceFamily === "REMM" && /internal/i.test(fact.field)),
      medicalFacts: countFacts((fact) => fact.sourceFamily === "REMM" && fact.fieldGroup === "MEDICAL"),
      cdcMonitoringFacts: countFacts((fact) => fact.sourceFamily === "CDC_RADIATION_POPULATION_MONITORING"),
      epaPagFacts: countFacts((fact) => fact.sourceFamily === "EPA_PAG"),
      femaScenarioFacts: countFacts((fact) => fact.sourceFamily === "FEMA_NUCLEAR_RESPONSE" || fact.sourceFamily === "FEMA_CBRNE_DOCTRINE"),
      scenarioRecordsWithRadFacts: countRecords((recordId) => radiologicalRecordIds.has(recordId) && CBRNE_AUTHORITATIVE_SOURCE_FACTS.some((fact) => fact.canonicalRecordId === recordId && ["REMM", "CDC_RADIATION_POPULATION_MONITORING", "EPA_PAG", "FEMA_NUCLEAR_RESPONSE"].includes(fact.sourceFamily))),
    },
  },
  completenessMatrices: { total: CBRNE_DOMAIN_COMPLETENESS_MATRICES.length, domainsPerRecord: 14 },
  guidedResponseReadiness: Object.fromEntries([...new Set(CBRNE_GUIDED_RESPONSE_READINESS.map((item) => item.readiness))].map((state) => [state, CBRNE_GUIDED_RESPONSE_READINESS.filter((item) => item.readiness === state).length])),
  candidates: {
    discovered: CBRNE_CANONICAL_RECORD_CANDIDATES.length,
    canonicalRecordsCreated: CBRNE_ADDITIONAL_CANONICAL_RECORDS.length,
    dispositions: CBRNE_CANONICAL_RECORD_CANDIDATES.map((candidate) => ({ candidateId: candidate.candidateId, disposition: candidate.disposition, sourceArtifactIds: candidate.sourceArtifactIds, reason: candidate.reason })),
  },
  manualQueue: CBRNE_MANUAL_ACQUISITION_QUEUE,
}, null, 2)}\n`);
