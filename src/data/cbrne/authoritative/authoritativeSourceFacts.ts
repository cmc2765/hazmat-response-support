import type { AuthoritativeSourceFact, CanonicalCbrneIdentity } from "../../../lib/cbrne/authoritativeSourceTypes.js";
import { hydrateCbrneDatabase } from "../../../lib/cbrne/hydrateCbrneDatabase.js";
import { CBRNE_MASTER_RECORDS } from "../cbrne-master-records.js";
import { CBRNE_CANONICAL_RECORD_CANDIDATES } from "./canonicalRecordCandidates.js";
import { findCanonicalCbrneIdentity } from "./canonicalIdentities.js";
import { RADIONUCLIDE_PHYSICS_RECORDS } from "./radionuclidePhysics.js";
import { findSourceArtifact } from "./sourceArtifacts.js";

const IMPORTED_AT = "2026-09-10T00:00:00.000Z";

function identityNamespace(identity: CanonicalCbrneIdentity): AuthoritativeSourceFact["identityNamespace"] {
  return identity.namespace;
}

function baseArtifactFact(
  artifactId: string,
  values: Pick<AuthoritativeSourceFact, "factId" | "canonicalRecordId" | "identityNamespace" | "domain" | "fieldGroup" | "field" | "value" | "units" | "sourceLocator" | "extractionMethod" | "factKind" | "factBasis" | "hazmatiqProcessing" | "limitations">,
): AuthoritativeSourceFact | null {
  const artifact = findSourceArtifact(artifactId);
  if (!artifact || artifact.currentStatus !== "ACQUIRED") return null;
  return {
    ...values,
    sourceArtifactId: artifact.sourceArtifactId,
    sourceAgency: artifact.agency,
    sourceFamily: artifact.sourceFamily,
    sourceDocumentTitle: artifact.title,
    officialUrl: artifact.officialUrl,
    sourceVersion: artifact.sourceVersion,
    publicationDate: artifact.publicationDate,
    importedAt: IMPORTED_AT,
    reviewStatus: "SOURCE_IMPORTED_PENDING_REVIEW",
    reviewedBy: null,
    reviewedAt: null,
    superseded: false,
    supersededBy: null,
  };
}

function authoritativeIdentityArtifact(identity: CanonicalCbrneIdentity) {
  if (identity.namespace === "CWA_CHEMICAL") {
    if (identity.epaQrgArtifactId) return identity.epaQrgArtifactId;
    if (identity.opcwClassification?.includes("Schedule 1")) return "opcw-schedule-1";
    if (identity.opcwClassification?.includes("Schedule 3")) return "opcw-schedule-3";
    return null;
  }
  if (identity.namespace === "BIOLOGICAL" || identity.namespace === "BIOLOGICAL_TOXIN") return identity.epaQrgArtifactId;
  if (identity.namespace === "RAD_NUCLEAR_SCENARIO") {
    if (identity.scenarioType === "RDD") return "nrt-qrg-rad-rdd";
    if (identity.scenarioType === "IND") return "nrt-qrg-rad-ind";
  }
  return null;
}

const identityFacts: AuthoritativeSourceFact[] = CBRNE_MASTER_RECORDS.flatMap((record) => {
  const identity = findCanonicalCbrneIdentity(record.id);
  if (!identity || identity.namespace === "RADIONUCLIDE") return [];
  const artifactId = authoritativeIdentityArtifact(identity);
  if (!artifactId) return [];
  const fact = baseArtifactFact(artifactId, {
    factId: `authoritative-identity-${record.id}`,
    canonicalRecordId: record.id,
    identityNamespace: identityNamespace(identity),
    domain: record.domain,
    fieldGroup: "IDENTITY",
    field: "Authoritative identity",
    value: record.displayName,
    units: null,
    sourceLocator: "Document title and agent/scenario heading",
    extractionMethod: "TITLE_IDENTITY",
    factKind: "SOURCE_DERIVED_FACT",
    factBasis: "The official artifact explicitly identifies the named agent, biological hazard, or scenario.",
    hazmatiqProcessing: "Mapped by typed identity; display-name matching alone was not used to create a cross-domain link.",
    limitations: ["Identity evidence does not establish incident conditions or tactical guidance."],
  });
  return fact ? [fact] : [];
});

const candidateIdentityFacts: AuthoritativeSourceFact[] = CBRNE_CANONICAL_RECORD_CANDIDATES.flatMap((candidate) => {
  if (candidate.disposition !== "CANONICAL_RECORD_CREATED") return [];
  const fact = baseArtifactFact(candidate.sourceArtifactIds[0], {
    factId: `candidate-authoritative-identity-${candidate.candidateId}`,
    canonicalRecordId: candidate.candidateId,
    identityNamespace: candidate.namespace,
    domain: candidate.namespace === "BIOLOGICAL" ? "BIOLOGICAL" : "CHEMICAL_WARFARE",
    fieldGroup: "IDENTITY",
    field: "Authoritative candidate identity",
    value: candidate.scientificName ? `${candidate.displayName} — ${candidate.scientificName}` : candidate.displayName,
    units: null,
    sourceLocator: "Document title and agent heading",
    extractionMethod: "TITLE_IDENTITY",
    factKind: "SOURCE_DERIVED_FACT",
    factBasis: "The current official EPA/NRT catalog and child QRG explicitly identify this hazard.",
    hazmatiqProcessing: "Created as a review-gated canonical record outside the original active 43; no tactical facts were inferred.",
    limitations: ["Candidate identity is authenticated; operational sections remain incomplete until source extraction and SME review."],
  });
  return fact ? [fact] : [];
});

const radionuclideFacts: AuthoritativeSourceFact[] = RADIONUCLIDE_PHYSICS_RECORDS.flatMap((physics) => {
  const record = CBRNE_MASTER_RECORDS.find((candidate) => candidate.id === physics.canonicalRecordId);
  if (!record) return [];
  const identity = baseArtifactFact(physics.sourceArtifacts[0], {
    factId: `nndc-identity-${physics.canonicalRecordId}`,
    canonicalRecordId: physics.canonicalRecordId,
    identityNamespace: "RADIONUCLIDE",
    domain: "RADIOLOGICAL",
    fieldGroup: "IDENTITY",
    field: "Evaluated nuclide identity",
    value: physics.canonicalNuclideId,
    units: null,
    sourceLocator: `ENSDF API nuclide record ${physics.nndcName}; record ID ${physics.nndcNuclideId}`,
    extractionMethod: "STRUCTURED_API",
    factKind: "SOURCE_DERIVED_FACT",
    factBasis: "Structured NNDC nuclide identity response.",
    hazmatiqProcessing: "Normalized element, atomic number, mass number, and metastable state into a typed nuclide ID.",
    limitations: ["Nuclide identity is not incident dose or response guidance."],
  });
  const halfLife = baseArtifactFact(physics.sourceArtifacts[1], {
    factId: `nndc-half-life-${physics.canonicalRecordId}`,
    canonicalRecordId: physics.canonicalRecordId,
    identityNamespace: "RADIONUCLIDE",
    domain: "RADIOLOGICAL",
    fieldGroup: "RADIONUCLIDE_PHYSICS",
    field: "Evaluated ground-state half-life",
    value: physics.halfLifeValue,
    units: physics.halfLifeUnits,
    sourceLocator: `ENSDF adopted ground-state dataset ${physics.adoptedDataset.datasetId ?? "unknown"}; level index 0`,
    extractionMethod: "STRUCTURED_API",
    factKind: "SOURCE_DERIVED_FACT",
    factBasis: `NNDC evaluated value retained in original form: ${physics.halfLifeOriginal ?? "not available"}.`,
    hazmatiqProcessing: "Selected the adopted ground-state level and retained original units plus normalized seconds.",
    limitations: ["Half-life does not establish incident dose, safe standoff, shielding, PPE, evacuation, or treatment."],
  });
  const decay = baseArtifactFact(physics.sourceArtifacts[2], {
    factId: `nndc-decay-modes-${physics.canonicalRecordId}`,
    canonicalRecordId: physics.canonicalRecordId,
    identityNamespace: "RADIONUCLIDE",
    domain: "RADIOLOGICAL",
    fieldGroup: "RADIONUCLIDE_PHYSICS",
    field: "Evaluated ground-state decay modes",
    value: physics.decayModes.map((mode) => mode.decayMode).join(", ") || null,
    units: null,
    sourceLocator: `ENSDF ground-state parent decay datasets ${physics.decayModes.map((mode) => mode.datasetId).filter(Boolean).join(", ") || "none returned"}`,
    extractionMethod: "STRUCTURED_API",
    factKind: "SOURCE_DERIVED_FACT",
    factBasis: "NNDC evaluated parent ground-state decay records; daughter and dataset metadata remain in the normalized physics record.",
    hazmatiqProcessing: "Deduplicated identical API rows by decay mode, daughter, and dataset without collapsing differing evaluated sources.",
    limitations: ["Decay mode and energy data do not establish incident tactics or a shielding prescription."],
  });
  return [identity, halfLife, decay].filter((fact): fact is AuthoritativeSourceFact => Boolean(fact));
});

const projectedFacts: AuthoritativeSourceFact[] = hydrateCbrneDatabase().sourceFacts.flatMap((fact) => {
  if (!fact.sourceArtifactId || !fact.sourceLocator) return [];
  const record = CBRNE_MASTER_RECORDS.find((candidate) => candidate.id === fact.recordId);
  const identity = findCanonicalCbrneIdentity(fact.recordId);
  const artifact = findSourceArtifact(fact.sourceArtifactId);
  if (!record || !identity || !artifact || artifact.currentStatus !== "ACQUIRED") return [];
  const legacyLimitation = artifact.sourceFamily === "NIOSH_ERSH_LEGACY"
    ? ["NIOSH ERSH is retained as a legacy/supplemental source and cannot override current domain authority."]
    : [];
  return [{
    factId: fact.id,
    canonicalRecordId: fact.recordId,
    identityNamespace: identityNamespace(identity),
    domain: record.domain,
    fieldGroup: fact.fieldGroup,
    field: fact.fieldName,
    value: fact.value,
    units: fact.units ?? null,
    sourceArtifactId: artifact.sourceArtifactId,
    sourceAgency: artifact.agency,
    sourceFamily: artifact.sourceFamily,
    sourceDocumentTitle: artifact.title,
    officialUrl: artifact.officialUrl,
    sourceVersion: artifact.sourceVersion,
    publicationDate: artifact.publicationDate,
    sourceLocator: fact.sourceLocator,
    extractionMethod: fact.extractionMethod ?? "DOCUMENT_REVIEW",
    importedAt: IMPORTED_AT,
    reviewStatus: fact.detailedReviewStatus ?? "SOURCE_IMPORTED_PENDING_REVIEW",
    reviewedBy: null,
    reviewedAt: null,
    factKind: fact.factKind ?? "SOURCE_DERIVED_FACT",
    factBasis: "Responder-facing paraphrase retained with the exact source locator.",
    hazmatiqProcessing: "Mapped to a typed canonical record; no automatic verification or tactical derivation was applied.",
    limitations: [...(fact.limitations ?? []), ...legacyLimitation],
    superseded: false,
    supersededBy: null,
  }];
});

const coordinationFacts: AuthoritativeSourceFact[] = [
  {
    factId: "cdc-radiation-exposure-contamination-distinction",
    canonicalRecordId: "radiological-dispersal-device",
    identityNamespace: "RAD_NUCLEAR_SCENARIO",
    domain: "RADIOLOGICAL",
    fieldGroup: "LIMITATIONS",
    field: "Exposure and contamination distinction",
    value: "Radiation exposure and radioactive contamination are distinct: a person can be exposed without becoming contaminated, while contamination means radioactive material is on or inside the body.",
    units: null,
    sourceArtifactId: "cdc-radiation-contamination-vs-exposure",
    sourceAgency: "CDC",
    sourceFamily: "CDC_RADIATION_POPULATION_MONITORING",
    sourceDocumentTitle: "Radiation Contamination Versus Exposure",
    officialUrl: "https://www.cdc.gov/radiation-emergencies/infographic/contamination-versus-exposure.html",
    sourceVersion: null,
    publicationDate: null,
    sourceLocator: "Contamination versus exposure — definitions and diagrams",
    extractionMethod: "WEB_PAGE_REVIEW",
    importedAt: IMPORTED_AT,
    reviewStatus: "SOURCE_IMPORTED_PENDING_REVIEW",
    reviewedBy: null,
    reviewedAt: null,
    factKind: "SOURCE_DERIVED_FACT",
    factBasis: "Direct distinction stated by the CDC public radiation-emergency page.",
    hazmatiqProcessing: "Normalized as a safety distinction; no dose or disposition was inferred.",
    limitations: ["This distinction does not determine an individual's dose, contamination level, medical disposition, or clearance."],
    superseded: false,
    supersededBy: null,
  },
  {
    factId: "fema-ind-local-state-federal-coordination",
    canonicalRecordId: "improvised-nuclear-device",
    identityNamespace: "RAD_NUCLEAR_SCENARIO",
    domain: "NUCLEAR",
    fieldGroup: "COORDINATION",
    field: "Whole-community response coordination",
    value: "Nuclear-detonation planning requires coordinated local, state, tribal, territorial, federal, private-sector, and nongovernmental response roles.",
    units: null,
    sourceArtifactId: "fema-nuclear-planning-third-edition",
    sourceAgency: "FEMA",
    sourceFamily: "FEMA_NUCLEAR_RESPONSE",
    sourceDocumentTitle: "Planning Guidance for Response to a Nuclear Detonation, Third Edition",
    officialUrl: "https://www.fema.gov/sites/default/files/documents/fema_nuc-detonation-planning-guide.pdf",
    sourceVersion: "Third Edition",
    publicationDate: null,
    sourceLocator: "Executive Summary — whole community planning context",
    extractionMethod: "DOCUMENT_REVIEW",
    importedAt: IMPORTED_AT,
    reviewStatus: "SOURCE_IMPORTED_PENDING_REVIEW",
    reviewedBy: null,
    reviewedAt: null,
    factKind: "SOURCE_DERIVED_COORDINATION_GUIDANCE",
    factBasis: "FEMA planning doctrine describing the whole-community response context.",
    hazmatiqProcessing: "Normalized as coordination guidance only; no incident authority or tactic was assigned.",
    limitations: ["The fact describes coordination context and does not assign incident-specific authority or tactics."],
    superseded: false,
    supersededBy: null,
  },
  {
    factId: "fbi-public-wmd-coordinator-role",
    canonicalRecordId: "radiological-dispersal-device",
    identityNamespace: "FEDERAL_COORDINATION",
    domain: "FEDERAL_CRIMINAL_NEXUS",
    fieldGroup: "COORDINATION",
    field: "Public FBI WMD coordination role",
    value: "FBI WMD coordinators work with federal, state, local, tribal, territorial, academic, and private-sector partners on prevention, preparedness, and response coordination.",
    units: null,
    sourceArtifactId: "fbi-wmd-coordinators-2025",
    sourceAgency: "FBI",
    sourceFamily: "FBI_PUBLIC_WMD",
    sourceDocumentTitle: "WMD Coordinators: Keeping America Left-of-Boom Safe",
    officialUrl: "https://www.fbi.gov/news/stories/wmd-coordinators-aim-for-left-of-boom-in-outreach-and-training-efforts",
    sourceVersion: null,
    publicationDate: "2025-01-29",
    sourceLocator: "WMD Coordinators — public role description",
    extractionMethod: "WEB_PAGE_REVIEW",
    importedAt: IMPORTED_AT,
    reviewStatus: "SOURCE_IMPORTED_PENDING_REVIEW",
    reviewedBy: null,
    reviewedAt: null,
    factKind: "SOURCE_DERIVED_COORDINATION_GUIDANCE",
    factBasis: "Public FBI description of the WMD Coordinator role.",
    hazmatiqProcessing: "Restricted procedures were excluded and the fact was isolated to the federal criminal-nexus domain.",
    limitations: ["Restricted threat-credibility and investigative procedures are intentionally excluded."],
    superseded: false,
    supersededBy: null,
  },
  {
    factId: "atf-public-national-response-team-role",
    canonicalRecordId: "radiological-dispersal-device",
    identityNamespace: "EXPLOSIVES_COORDINATION",
    domain: "EXPLOSIVE",
    fieldGroup: "COORDINATION",
    field: "Public ATF explosives response role",
    value: "ATF National Response Teams provide public-described technical and investigative support for major fire and explosion incidents when requested.",
    units: null,
    sourceArtifactId: "atf-national-response-team",
    sourceAgency: "ATF",
    sourceFamily: "ATF_PUBLIC_EXPLOSIVES",
    sourceDocumentTitle: "National Response Teams",
    officialUrl: "https://www.atf.gov/careers/rapid-response-teams/national-response-teams",
    sourceVersion: null,
    publicationDate: null,
    sourceLocator: "National Response Teams — mission and activation overview",
    extractionMethod: "WEB_PAGE_REVIEW",
    importedAt: IMPORTED_AT,
    reviewStatus: "SOURCE_IMPORTED_PENDING_REVIEW",
    reviewedBy: null,
    reviewedAt: null,
    factKind: "SOURCE_DERIVED_COORDINATION_GUIDANCE",
    factBasis: "Public ATF description of National Response Team support.",
    hazmatiqProcessing: "Normalized as a public coordination fact; no controlled system content or investigative tactic was imported.",
    limitations: ["This public role description does not expose BATS or controlled investigative procedures and is not an activation request."],
    superseded: false,
    supersededBy: null,
  },
];

function preserveSourceRepresentation(fact: AuthoritativeSourceFact): AuthoritativeSourceFact {
  const artifact = findSourceArtifact(fact.sourceArtifactId);
  const physics = fact.factId.startsWith("nndc-half-life-")
    ? RADIONUCLIDE_PHYSICS_RECORDS.find((record) => fact.canonicalRecordId === record.canonicalRecordId)
    : null;
  const sourceLocator = artifact?.artifactType === "PDF" && !/^Page\s+\d+/i.test(fact.sourceLocator)
    ? `Page 1 — ${fact.sourceLocator}`
    : fact.sourceLocator;
  return {
    ...fact,
    sourceArtifactSha256: artifact?.sha256 ?? null,
    valueOriginal: fact.value,
    unitsOriginal: fact.units,
    valueNormalized: physics?.halfLifeSeconds ?? fact.value,
    unitsNormalized: physics?.halfLifeSeconds === null || physics?.halfLifeSeconds === undefined ? fact.units : "s",
    normalizationMethod: physics?.halfLifeSeconds === null || physics?.halfLifeSeconds === undefined
      ? "SOURCE_VALUE_PRESERVED"
      : "ENSDF half-life converted to seconds using the evaluated source unit",
    sourceLocator,
    applicability: null,
    context: null,
  };
}

export const CBRNE_AUTHORITATIVE_SOURCE_FACTS: readonly AuthoritativeSourceFact[] = Object.freeze([
  ...identityFacts,
  ...candidateIdentityFacts,
  ...radionuclideFacts,
  ...projectedFacts,
  ...coordinationFacts,
].map(preserveSourceRepresentation));

export function authoritativeFactsForRecord(recordId: string) {
  return CBRNE_AUTHORITATIVE_SOURCE_FACTS.filter((fact) => fact.canonicalRecordId === recordId);
}
