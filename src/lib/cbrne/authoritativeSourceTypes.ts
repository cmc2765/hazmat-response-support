import type { CbrneDomain, CbrneFieldGroup } from "./cbrneTypes.js";

export type SourceArtifactStatus =
  | "ACQUIRED"
  | "DUPLICATE"
  | "SUPERSEDED"
  | "OUT_OF_SCOPE"
  | "ACCESS_BLOCKED"
  | "MANUAL_ACQUISITION_REQUIRED"
  | "FAILED";

export type SourceArtifactType = "PDF" | "WEB_PAGE" | "JSON_API" | "DATASET";

export type SourceArtifactCandidate = {
  sourceArtifactId: string;
  agency: string;
  department: string | null;
  sourceFamily: string;
  title: string;
  documentIdentifier: string | null;
  officialUrl: string;
  officialDomain: string;
  publicationDate: string | null;
  revisionDate: string | null;
  sourceVersion: string | null;
  artifactType: SourceArtifactType;
  acquisitionMethod: "HTTPS_DOWNLOAD" | "PUBLIC_API" | "MANUAL_ONLY" | "INDEX_DISCOVERY";
  localSnapshotPath: string | null;
  copyrightOrUseStatus: string | null;
  intendedDisposition?: Exclude<SourceArtifactStatus, "ACQUIRED" | "FAILED">;
  supersedes: string | null;
  supersededBy: string | null;
  notes: string | null;
};

export type SourceArtifact = SourceArtifactCandidate & {
  retrievedAt: string | null;
  sha256: string | null;
  contentType: string | null;
  fileSize: number | null;
  currentStatus: SourceArtifactStatus;
  parsed: boolean;
  parseMethod: "PDF_STRUCTURE" | "HTML_DOCUMENT" | "STRUCTURED_JSON" | "NOT_PARSED";
  duplicateOf: string | null;
  failureReason: string | null;
};

export type AuthoritativeFactReviewStatus =
  | "SOURCE_IMPORTED_PENDING_REVIEW"
  | "VERIFIED_AUTHORITATIVE"
  | "VERIFIED_SECONDARY"
  | "SOURCE_VERSION_UNKNOWN"
  | "SOURCE_INCOMPLETE"
  | "IDENTITY_MATCH_FAILED"
  | "CONFLICTING_SOURCES"
  | "LOCALLY_CURATED"
  | "HAZMATIQ_DERIVED"
  | "NOT_VERIFIED"
  | "REJECTED";

export type AuthoritativeFactKind =
  | "SOURCE_DERIVED_FACT"
  | "SOURCE_DERIVED_COORDINATION_GUIDANCE"
  | "HAZMATIQ_DERIVED_TACTICAL_RECOMMENDATION"
  | "REQUIRES_FIELD_MEASUREMENT"
  | "REQUIRES_SME_AGENCY_COORDINATION"
  | "UNVERIFIED_NOT_AVAILABLE";

export type AuthoritativeSourceFact = {
  factId: string;
  canonicalRecordId: string;
  identityNamespace: "CWA_CHEMICAL" | "BIOLOGICAL" | "BIOLOGICAL_TOXIN" | "RADIONUCLIDE" | "RAD_NUCLEAR_SCENARIO" | "FEDERAL_COORDINATION" | "EXPLOSIVES_COORDINATION";
  domain: CbrneDomain | "FEDERAL_CRIMINAL_NEXUS";
  fieldGroup: CbrneFieldGroup | "RADIONUCLIDE_PHYSICS" | "COORDINATION";
  field: string;
  value: string | number | boolean | null;
  units: string | null;
  sourceArtifactId: string;
  sourceAgency: string;
  sourceFamily: string;
  sourceDocumentTitle: string;
  officialUrl: string;
  sourceVersion: string | null;
  publicationDate: string | null;
  sourceLocator: string;
  extractionMethod: "STRUCTURED_API" | "DOCUMENT_REVIEW" | "WEB_PAGE_REVIEW" | "TITLE_IDENTITY";
  importedAt: string;
  reviewStatus: AuthoritativeFactReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  factKind: AuthoritativeFactKind;
  factBasis: string;
  hazmatiqProcessing: string;
  limitations: string[];
  superseded: boolean;
  supersededBy: string | null;
};

export type ChemicalCwaIdentity = {
  namespace: "CWA_CHEMICAL";
  canonicalCbrneId: string;
  name: string;
  aliases: string[];
  cas: string[];
  agentCodes: string[];
  opcwClassification: string | null;
  epaQrgArtifactId: string | null;
  ershArtifactId: string | null;
};

export type BiologicalIdentity = {
  namespace: "BIOLOGICAL" | "BIOLOGICAL_TOXIN";
  canonicalBiologicalId: string;
  commonName: string;
  scientificName: string | null;
  classification: string;
  taxonomy: string | null;
  aliases: string[];
  epaQrgArtifactId: string | null;
};

export type RadionuclideIdentity = {
  namespace: "RADIONUCLIDE";
  canonicalNuclideId: string;
  element: string;
  elementSymbol: string;
  atomicNumber: number;
  massNumber: number;
  metastableState: string | null;
  nndcName: string;
};

export type RadNuclearScenarioIdentity = {
  namespace: "RAD_NUCLEAR_SCENARIO";
  canonicalScenarioId: string;
  name: string;
  scenarioType: "RDD" | "IND" | "SEALED_SOURCE" | "ORPHAN_SOURCE" | "TRANSPORT_PACKAGE" | "CONTAMINATION" | "EXPOSURE" | "COMBINED_EXPOSURE_CONTAMINATION";
};

export type CanonicalCbrneIdentity = ChemicalCwaIdentity | BiologicalIdentity | RadionuclideIdentity | RadNuclearScenarioIdentity;

export type CbrneRecordReconciliation = {
  canonicalRecordId: string;
  domain: CbrneDomain;
  existingIdentity: string;
  authoritativeIdentitiesFound: string[];
  officialArtifactsFound: string[];
  artifactsAcquired: string[];
  identityCrosswalksEstablished: string[];
  factsImported: string[];
  factsRetainedAsLocallyCurated: string[];
  factsRejected: string[];
  conflicts: string[];
  missingDomains: string[];
  reviewStatus: AuthoritativeFactReviewStatus;
  manualFollowUpRequired: string[];
};

export type ChemicalCompanionCrosswalkStatus =
  | "MATCHED_TO_AUTHORITY"
  | "CONFLICTS_WITH_AUTHORITY"
  | "SOURCE_UNPROVEN"
  | "IDENTITY_AMBIGUOUS"
  | "NOT_APPLICABLE";

export type ChemicalCompanionCrosswalk = {
  canonicalRecordId: string;
  identityNamespace: CanonicalCbrneIdentity["namespace"];
  companionTable: string | null;
  companionIds: number[];
  matchBasis: "CAS" | "ELEMENT_MASS_METASTABLE" | "TYPED_BIOLOGICAL_NAME" | "NONE";
  identityStatus: ChemicalCompanionCrosswalkStatus;
  operationalDataStatus: ChemicalCompanionCrosswalkStatus;
  notes: string[];
};

export type SourceFamilyCompleteness = {
  sourceFamily: string;
  officialIndexDiscovered: boolean;
  officialChildArtifactsDiscovered: number;
  currentArtifactsExpected: number;
  successfullyAcquired: number;
  successfullyHashed: number;
  successfullyParsed: number;
  factsImported: number;
  artifactsSuperseded: number;
  artifactsIntentionallyExcluded: number;
  artifactsRequiringManualAcquisition: number;
  networkAccessFailures: number;
  silentlySkipped: number;
};

export type ManualAcquisitionQueueItem = {
  sourceArtifactId: string;
  agency: string;
  title: string;
  officialUrl: string;
  reasonAutomationFailed: string;
  expectedArtifactType: SourceArtifactType;
  expectedData: string[];
  targetCanonicalRecords: string[];
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
};
