import type {
  CbrneCategory,
  CbrneDomain,
  CbrneMasterRecord,
  CbrneSourceFact,
  CbrneSourceName,
} from "./cbrneTypes.js";
import type { CbrneSourceRegistryId } from "../../data/cbrne/cbrne-source-registry.js";

export type CbrneImportPackage = {
  packageId: string;
  packageName: string;
  sourceRegistryId: CbrneSourceRegistryId;
  sourceName?: CbrneSourceName;
  sourceDocumentTitle: string;
  sourceUrl?: string;
  sourceDate?: string;
  importedAt: string;
  importedBy: "Manual" | "Internal";
  reviewStatus: "Draft" | "Source Imported" | "Requires SME Review" | "Approved" | "Rejected";
  records: CbrneImportRecord[];
};

export type CbrneNormalizedImportPackage = Omit<CbrneImportPackage, "sourceName"> & {
  sourceName: CbrneSourceName;
};

export type CbrneImportRecord = {
  displayName: string;
  scientificName?: string;
  domain: CbrneDomain;
  category: CbrneCategory;
  aliases?: string[];
  agentCodes?: string[];
  cas?: string[];
  unNaNumbers?: string[];
  radionuclideSymbol?: string;
  isotopeMassNumber?: number;
  sourceFacts: CbrneImportSourceFact[];
};

export type CbrneImportSourceFact = {
  fieldGroup: CbrneSourceFact["fieldGroup"];
  fieldName: string;
  value: CbrneSourceFact["value"];
  units?: string;
  sourcePage?: string;
  sourceUrl?: string;
  sourceName?: CbrneSourceName;
  sourceDocumentTitle?: string;
  sourceDate?: string;
  verificationStatus: Exclude<CbrneSourceFact["verificationStatus"], "Rejected">;
  notes?: string;
};

export type CbrneImportValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalizedPackage?: CbrneNormalizedImportPackage;
};

export type CbrneImportConflict = {
  recordId: string;
  fieldGroup: string;
  fieldName: string;
  existingFactId: string;
  importedFactId: string;
  existingValue: CbrneSourceFact["value"];
  importedValue: CbrneSourceFact["value"];
};

export type CbrneStagedRecord = {
  matchType: "existing" | "new";
  record: CbrneMasterRecord;
  importedFacts: CbrneSourceFact[];
  conflicts: CbrneImportConflict[];
};

export type CbrneImportStageResult = {
  packageId: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  records: CbrneStagedRecord[];
};
