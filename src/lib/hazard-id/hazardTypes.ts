export type HazardIdLane = "CHEMICAL" | "CBRNE_CWA" | "RADIOLOGICAL";

export type HazardVerificationStatus =
  | "Verified"
  | "Source Imported"
  | "Requires SME Review"
  | "Conflicting Sources"
  | "Requires Review"
  | "No Current Data Exists"
  | "Rejected";

export type HazardSearchResult = {
  id: string;
  lane: HazardIdLane;
  displayName: string;
  scientificName?: string;
  domain?: string;
  category: string;
  aliases?: string[];
  agentCodes?: string[];
  cas?: string[];
  unNaNumbers?: string[];
  radionuclideSymbol?: string;
  verificationStatus: HazardVerificationStatus;
  sourceSummary?: string[];
};

export type HazardSourceFact = {
  id: string;
  sourceRegistryId?: string;
  sourceName: string;
  sourceDocumentTitle?: string;
  sourcePage?: string;
  fieldName: string;
  value: string | number | boolean | null;
  units?: string;
  sourceUrl?: string;
  lastVerified?: string;
  verificationStatus: HazardVerificationStatus;
  notes?: string;
};

export type HazardProfile = {
  id: string;
  lane: HazardIdLane;
  displayName: string;
  category: string;
  verificationStatus: HazardVerificationStatus;
  scientificName?: string;
  domain?: string;
  identifiers: Record<string, string | string[] | number | null>;
  overviewFacts: HazardSourceFact[];
  hazardFacts: HazardSourceFact[];
  detectionFacts: HazardSourceFact[];
  ppeFacts: HazardSourceFact[];
  isolationStandoffFacts: HazardSourceFact[];
  medicalFacts: HazardSourceFact[];
  deconFacts: HazardSourceFact[];
  technicalOperationsFacts: HazardSourceFact[];
  sourceFacts: HazardSourceFact[];
  actionCards?: Array<{ title: string; status: string; summary: string }>;
  limitations?: string[];
  dataStatusBadges?: HazardVerificationStatus[];
  sourceStatus?: {
    sourcePacksLoaded: number;
    sourceFactCount: number;
    sourceNames: string[];
    requiresSmeReviewCount: number;
    conflictingSourcesCount: number;
    missingFieldCount: number;
    lastImportUpdate: string;
    warnings: string[];
  };
};
