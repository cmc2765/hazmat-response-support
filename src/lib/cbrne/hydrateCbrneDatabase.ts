import { CBRNE_MASTER_RECORDS } from "../../data/cbrne/cbrne-master-records.js";
import { CBRNE_MANUAL_SOURCE_PACKS, CBRNE_SOURCE_PACK_WARNINGS } from "../../data/cbrne/cbrne-source-packs.js";
import type { CbrneNormalizedImportPackage } from "./cbrneImportTypes.js";
import type { CbrneMasterRecord, CbrneSourceFact } from "./cbrneTypes.js";
import { stageCbrneImportPackage, validateCbrneImportPackage } from "./validateCbrneImport.js";

export type CbrneImportReport = {
  packageId: string;
  packageName: string;
  sourceRegistryId: string;
  sourceName: string;
  importedAt: string;
  valid: boolean;
  recordIds: string[];
  recordsMatched: number;
  sourceFactsImported: number;
  errors: string[];
  warnings: string[];
};

export type HydratedCbrneDatabase = {
  records: CbrneMasterRecord[];
  sourceFacts: CbrneSourceFact[];
  importReports: CbrneImportReport[];
  warnings: string[];
};

let hydratedDatabase: HydratedCbrneDatabase | null = null;

function unique(values: readonly string[] | undefined) {
  return [...new Set((values ?? []).filter(Boolean))];
}

function recordForPackageEntry(packageData: CbrneNormalizedImportPackage, record: CbrneMasterRecord) {
  const imported = packageData.records.find((candidate) => {
    const terms = [candidate.displayName, candidate.scientificName, ...(candidate.aliases ?? []), ...(candidate.agentCodes ?? []), candidate.radionuclideSymbol]
      .filter(Boolean)
      .map((value) => String(value).trim().toLocaleLowerCase());
    const masterTerms = [record.displayName, record.scientificName, ...record.aliases, ...record.commonNames, ...(record.agentCodes ?? []), record.radionuclideSymbol]
      .filter(Boolean)
      .map((value) => String(value).trim().toLocaleLowerCase());
    return terms.some((term) => masterTerms.includes(term));
  });
  if (!imported) return record;
  return {
    ...record,
    scientificName: record.scientificName ?? imported.scientificName,
    aliases: unique([...record.aliases, ...(imported.aliases ?? [])]),
    agentCodes: unique([...(record.agentCodes ?? []), ...(imported.agentCodes ?? [])]),
    cas: unique([...(record.cas ?? []), ...(imported.cas ?? [])]),
    unNaNumbers: unique([...(record.unNaNumbers ?? []), ...(imported.unNaNumbers ?? [])]),
    radionuclideSymbol: record.radionuclideSymbol ?? imported.radionuclideSymbol,
    isotopeMassNumber: record.isotopeMassNumber ?? imported.isotopeMassNumber,
    updatedAt: packageData.importedAt,
  };
}

/**
 * Builds the runtime CBRNE/RAD database entirely from bundled local modules.
 * Imported tactical facts always remain pending SME review.
 */
export function hydrateCbrneDatabase(): HydratedCbrneDatabase {
  if (hydratedDatabase) return hydratedDatabase;

  let records = CBRNE_MASTER_RECORDS.map((record) => ({ ...record, sourceFactIds: [...record.sourceFactIds] }));
  let sourceFacts: CbrneSourceFact[] = [];
  const importReports: CbrneImportReport[] = [];
  const warnings: string[] = [...CBRNE_SOURCE_PACK_WARNINGS];

  CBRNE_MANUAL_SOURCE_PACKS.forEach((packageData) => {
    const validation = validateCbrneImportPackage(packageData);
    const staged = stageCbrneImportPackage(packageData, records, sourceFacts);
    const normalizedPackage = validation.normalizedPackage;
    const report: CbrneImportReport = {
      packageId: packageData.packageId,
      packageName: packageData.packageName,
      sourceRegistryId: packageData.sourceRegistryId,
      sourceName: normalizedPackage?.sourceName ?? "Unknown approved source",
      importedAt: packageData.importedAt,
      valid: staged.valid,
      recordIds: staged.records.map((item) => item.record.id),
      recordsMatched: staged.records.length,
      sourceFactsImported: staged.records.reduce((count, item) => count + item.importedFacts.length, 0),
      errors: [...staged.errors],
      warnings: [...staged.warnings],
    };
    importReports.push(report);
    if (!staged.valid || !normalizedPackage) {
      warnings.push(`${packageData.packageName}: ${staged.errors.join(" ")}`);
      return;
    }

    staged.records.forEach((item) => {
      const nextRecord = recordForPackageEntry(normalizedPackage, item.record);
      const existingIndex = records.findIndex((record) => record.id === item.record.id);
      if (existingIndex >= 0) records[existingIndex] = { ...nextRecord, sourceFactIds: [...item.record.sourceFactIds] };
      else records.push({ ...nextRecord, sourceFactIds: [...item.record.sourceFactIds] });
      sourceFacts.push(...item.importedFacts);
    });
  });

  sourceFacts = [...new Map(sourceFacts.map((sourceFact) => [sourceFact.id, sourceFact])).values()];
  records = records.map((record) => ({
    ...record,
    sourceFactIds: sourceFacts.filter((fact) => fact.recordId === record.id).map((fact) => fact.id),
  }));

  hydratedDatabase = { records, sourceFacts, importReports, warnings };
  return hydratedDatabase;
}
