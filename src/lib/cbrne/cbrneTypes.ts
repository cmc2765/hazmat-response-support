export type CbrneDomain =
  | "CHEMICAL_WARFARE"
  | "BIOLOGICAL"
  | "RADIOLOGICAL"
  | "NUCLEAR"
  | "EXPLOSIVE"
  | "CBRNE_SCENARIO";

export type CbrneCategory =
  | "NERVE_AGENT"
  | "BLISTER_AGENT"
  | "BLOOD_AGENT"
  | "CHOKING_AGENT"
  | "INCAPACITATING_AGENT"
  | "RIOT_CONTROL_AGENT"
  | "FOURTH_GENERATION_AGENT"
  | "TOXIC_INDUSTRIAL_CHEMICAL"
  | "BACTERIAL_AGENT"
  | "VIRAL_AGENT"
  | "BIOLOGICAL_TOXIN"
  | "RADIONUCLIDE"
  | "RADIOACTIVE_MATERIAL"
  | "RADIOLOGICAL_DISPERSAL_DEVICE"
  | "IMPROVISED_NUCLEAR_DEVICE"
  | "UNKNOWN";

export type CbrneVerificationStatus =
  | "Verified"
  | "Source Imported"
  | "Requires SME Review"
  | "Conflicting Sources"
  | "No Current Data Exists"
  | "Rejected";

export type CbrneSourceName =
  | "NIOSH Emergency Response Safety and Health Database"
  | "National Response Team CBRN Quick Reference Guides"
  | "NRT Quick Reference Guide: Bacillus anthracis / Anthrax"
  | "Chemical Hazards Emergency Medical Management"
  | "CHEMM Nerve Agents"
  | "CHEMM Sarin Prehospital Medical Management"
  | "CAMEO Chemicals"
  | "EPA Acute Exposure Guideline Levels"
  | "OPCW Scheduled Chemicals Database"
  | "OPCW Schedule 1 Chemicals"
  | "OSHA/NIOSH CBRN PPE Selection Matrix for Emergency Responders"
  | "PHMSA Emergency Response Guidebook 2024"
  | "Radiation Emergency Medical Management"
  | "REMM PPE in a Radiation Emergency"
  | "REMM Radiation Contamination Survey"
  | "REMM External Contamination / Decontamination"
  | "EPA Protective Action Guides for Radiological Incidents"
  | "REMM Protective Actions and Protective Action Guides"
  | "IAEA Manual for First Responders to a Radiological Emergency"
  | "IAEA GSG-2 Suggested Inner Cordoned Area Guidance"
  | "NNDC NuDat"
  | "IAEA LiveChart of Nuclides"
  | "49 CFR Class 7 Radioactive Material Transport References"
  | "RESRAD-RDD / IND"
  | "HotSpot Health Physics Codes"
  | "Manual Review";

export type CbrneFieldGroup =
  | "IDENTITY"
  | "HAZARDS"
  | "SYMPTOMS"
  | "DETECTION"
  | "PPE"
  | "ISOLATION_STANDOFF"
  | "DECON"
  | "MEDICAL"
  | "TECHNICAL_OPERATIONS"
  | "RADIOLOGICAL_SURVEY"
  | "PROTECTIVE_ACTION"
  | "LIMITATIONS"
  | "SOURCES";

export type CbrneMasterRecord = {
  id: string;
  domain: CbrneDomain;
  category: CbrneCategory;
  displayName: string;
  scientificName?: string;
  commonNames: string[];
  aliases: string[];
  agentCodes?: string[];
  cas?: string[];
  unNaNumbers?: string[];
  radionuclideSymbol?: string;
  isotopeMassNumber?: number;
  opcwSchedule?: string;
  recordSummary?: string;
  verificationStatus: CbrneVerificationStatus;
  sourceFactIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type CbrneSourceFact = {
  id: string;
  recordId: string;
  sourceRegistryId: string;
  sourceName: CbrneSourceName;
  sourceDocumentTitle?: string;
  sourceUrl?: string;
  sourcePage?: string;
  sourceDate?: string;
  lastVerified?: string;
  fieldGroup: CbrneFieldGroup;
  fieldName: string;
  value: string | number | boolean | null;
  units?: string;
  verificationStatus: CbrneVerificationStatus;
  notes?: string;
};

export type CbrneSearchResult = {
  id: string;
  displayName: string;
  scientificName?: string;
  domain: CbrneDomain;
  category: CbrneCategory;
  aliases: string[];
  agentCodes?: string[];
  cas?: string[];
  unNaNumbers?: string[];
  radionuclideSymbol?: string;
  verificationStatus: CbrneVerificationStatus;
  sourceSummary: string[];
};

export type CbrneProfileFact = CbrneSourceFact;

export type CbrneActionCard = {
  title: string;
  status: "Source Backed" | "Requires SME Review" | "No Current Data Exists";
  summary: string;
};

export type CbrneProfile = {
  id: string;
  lane: "CBRNE_CWA" | "RADIOLOGICAL";
  domain: CbrneDomain;
  displayName: string;
  scientificName?: string;
  category: CbrneCategory;
  verificationStatus: CbrneVerificationStatus;
  identifiers: Record<string, string | string[] | number | null>;
  overviewFacts: CbrneProfileFact[];
  hazardFacts: CbrneProfileFact[];
  detectionFacts: CbrneProfileFact[];
  ppeFacts: CbrneProfileFact[];
  isolationStandoffFacts: CbrneProfileFact[];
  medicalFacts: CbrneProfileFact[];
  deconFacts: CbrneProfileFact[];
  technicalOperationsFacts: CbrneProfileFact[];
  sourceFacts: CbrneProfileFact[];
  actionCards: CbrneActionCard[];
  limitations: string[];
  dataStatusBadges: CbrneVerificationStatus[];
  sourceStatus: {
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
