import type { CbrneRecordReconciliation, CanonicalCbrneIdentity } from "../../../lib/cbrne/authoritativeSourceTypes.js";
import { hydrateCbrneDatabase } from "../../../lib/cbrne/hydrateCbrneDatabase.js";
import { CBRNE_MASTER_RECORDS } from "../cbrne-master-records.js";
import { authoritativeFactsForRecord } from "./authoritativeSourceFacts.js";
import { chemicalCompanionCrosswalkForRecord } from "./chemicalCompanionCrosswalk.js";
import { findCanonicalCbrneIdentity } from "./canonicalIdentities.js";
import { CBRNE_MANUAL_ACQUISITION_QUEUE } from "./completeness.js";
import { findRadionuclidePhysicsRecord } from "./radionuclidePhysics.js";
import { findSourceArtifact } from "./sourceArtifacts.js";

function canonicalIdentityLabel(identity: CanonicalCbrneIdentity) {
  if (identity.namespace === "CWA_CHEMICAL") return `cbrne:${identity.canonicalCbrneId}`;
  if (identity.namespace === "RADIONUCLIDE") return identity.canonicalNuclideId;
  if (identity.namespace === "RAD_NUCLEAR_SCENARIO") return identity.canonicalScenarioId;
  return identity.canonicalBiologicalId;
}

function identityArtifactIds(identity: CanonicalCbrneIdentity, recordId: string) {
  if (identity.namespace === "CWA_CHEMICAL") return [
    identity.epaQrgArtifactId,
    identity.ershArtifactId,
    identity.opcwClassification ? "opcw-handbook-2024" : null,
    recordId === "fourth-generation-agents" ? "chemm-fga-medical-management" : null,
  ].filter((value): value is string => Boolean(value));
  if (identity.namespace === "BIOLOGICAL" || identity.namespace === "BIOLOGICAL_TOXIN") {
    return [identity.epaQrgArtifactId].filter((value): value is string => Boolean(value));
  }
  if (identity.namespace === "RADIONUCLIDE") return findRadionuclidePhysicsRecord(recordId)?.sourceArtifacts ?? [];
  if (identity.namespace !== "RAD_NUCLEAR_SCENARIO") return [];
  if (identity.scenarioType === "RDD") return ["nrt-qrg-rad-rdd", "epa-pag-2017"];
  if (identity.scenarioType === "IND") return ["nrt-qrg-rad-ind", "fema-nuclear-planning-third-edition"];
  return [];
}

const database = hydrateCbrneDatabase();

export const CBRNE_RECORD_RECONCILIATIONS: readonly CbrneRecordReconciliation[] = Object.freeze(CBRNE_MASTER_RECORDS.map((record) => {
  const identity = findCanonicalCbrneIdentity(record.id);
  if (!identity) throw new Error(`No canonical identity during reconciliation: ${record.id}`);
  const facts = authoritativeFactsForRecord(record.id);
  const localFacts = database.sourceFacts.filter((fact) => fact.recordId === record.id && !fact.sourceArtifactId);
  const crosswalk = chemicalCompanionCrosswalkForRecord(record.id);
  if (!crosswalk) throw new Error(`No Chemical Companion crosswalk during reconciliation: ${record.id}`);
  const officialArtifactsFound = [...new Set([
    ...identityArtifactIds(identity, record.id),
    ...facts.map((fact) => fact.sourceArtifactId),
  ])];
  const artifactsAcquired = officialArtifactsFound.filter((artifactId) => findSourceArtifact(artifactId)?.currentStatus === "ACQUIRED");
  const manualFollowUpRequired = CBRNE_MANUAL_ACQUISITION_QUEUE
    .filter((item) => item.targetCanonicalRecords.includes(record.id))
    .map((item) => item.sourceArtifactId);
  const missingDomains = [
    ...(!officialArtifactsFound.length ? ["authoritative identity artifact"] : []),
    ...(!facts.length ? ["reviewable responder facts"] : []),
    ...(record.category === "RADIONUCLIDE" && !findRadionuclidePhysicsRecord(record.id) ? ["evaluated radionuclide physics"] : []),
  ];
  return {
    canonicalRecordId: record.id,
    domain: record.domain,
    existingIdentity: record.displayName,
    authoritativeIdentitiesFound: [canonicalIdentityLabel(identity)],
    officialArtifactsFound,
    artifactsAcquired,
    identityCrosswalksEstablished: crosswalk.identityStatus === "MATCHED_TO_AUTHORITY"
      ? [`Chemical Companion ${crosswalk.companionTable}: ${crosswalk.companionIds.join(", ")}`]
      : [],
    factsImported: facts.map((fact) => fact.factId),
    factsRetainedAsLocallyCurated: localFacts.map((fact) => fact.id),
    factsRejected: crosswalk.operationalDataStatus === "SOURCE_UNPROVEN"
      ? ["Chemical Companion operational values were not admitted to the authoritative fact layer."]
      : [],
    conflicts: crosswalk.identityStatus === "CONFLICTS_WITH_AUTHORITY" ? ["Chemical Companion identity conflicts with authoritative identity."] : [],
    missingDomains,
    reviewStatus: facts.length ? "SOURCE_IMPORTED_PENDING_REVIEW" as const : "SOURCE_INCOMPLETE" as const,
    manualFollowUpRequired,
  };
}));

export function reconciliationForRecord(recordId: string) {
  return CBRNE_RECORD_RECONCILIATIONS.find((record) => record.canonicalRecordId === recordId) ?? null;
}
