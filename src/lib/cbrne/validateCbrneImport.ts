import { CBRNE_MASTER_RECORDS } from "../../data/cbrne/cbrne-master-records.js";
import { CBRNE_SOURCE_FACTS } from "../../data/cbrne/cbrne-source-facts.js";
import { findCbrneSourceRegistryEntry } from "../../data/cbrne/cbrne-source-registry.js";
import { containsBiologicalMisuseContent } from "./cbrneSafetyGates.js";
import type {
  CbrneImportConflict,
  CbrneImportPackage,
  CbrneImportRecord,
  CbrneNormalizedImportPackage,
  CbrneImportStageResult,
  CbrneImportValidationResult,
} from "./cbrneImportTypes.js";
import type { CbrneCategory, CbrneDomain, CbrneMasterRecord, CbrneSourceFact } from "./cbrneTypes.js";
import { normalizeCbrneSourceFacts } from "./normalizeCbrneSourceFacts.js";

const DOMAINS = new Set<CbrneDomain>(["CHEMICAL_WARFARE", "BIOLOGICAL", "RADIOLOGICAL", "NUCLEAR", "EXPLOSIVE", "CBRNE_SCENARIO"]);
const CATEGORIES = new Set<CbrneCategory>([
  "NERVE_AGENT", "BLISTER_AGENT", "BLOOD_AGENT", "CHOKING_AGENT", "INCAPACITATING_AGENT",
  "RIOT_CONTROL_AGENT", "FOURTH_GENERATION_AGENT", "TOXIC_INDUSTRIAL_CHEMICAL", "BACTERIAL_AGENT",
  "VIRAL_AGENT", "BIOLOGICAL_TOXIN", "RADIONUCLIDE", "RADIOACTIVE_MATERIAL",
  "RADIOLOGICAL_DISPERSAL_DEVICE", "IMPROVISED_NUCLEAR_DEVICE", "UNKNOWN",
]);
const NON_TACTICAL_GROUPS = new Set(["IDENTITY", "SOURCES", "LIMITATIONS"]);

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validHttpsUrl(value: unknown): value is string {
  if (!nonEmpty(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function normalizedSourceName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function validateCbrneImportPackage(input: unknown): CbrneImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!input || typeof input !== "object") return { valid: false, errors: ["Import package must be an object."], warnings };
  const data = input as Partial<CbrneImportPackage>;
  if (!nonEmpty(data.packageId)) errors.push("packageId is required.");
  if (!nonEmpty(data.packageName)) errors.push("packageName is required.");
  const registryEntry = nonEmpty(data.sourceRegistryId) ? findCbrneSourceRegistryEntry(data.sourceRegistryId) : null;
  if (!registryEntry) errors.push("sourceRegistryId must identify an approved CBRNE source.");
  if (nonEmpty(data.sourceName) && registryEntry && normalizedSourceName(data.sourceName) !== normalizedSourceName(registryEntry.name)) {
    errors.push("sourceName must match the approved registry entry name for sourceRegistryId.");
  }
  if (!nonEmpty(data.sourceDocumentTitle)) errors.push("sourceDocumentTitle is required.");
  if (!validHttpsUrl(data.sourceUrl)) errors.push("sourceUrl must be an absolute HTTPS URL.");
  if (!nonEmpty(data.importedAt) || Number.isNaN(Date.parse(data.importedAt))) errors.push("importedAt must be a valid date-time.");
  if (data.importedBy !== "Manual" && data.importedBy !== "Internal") errors.push("importedBy must be Manual or Internal.");
  if (!["Draft", "Source Imported", "Requires SME Review", "Approved", "Rejected"].includes(data.reviewStatus ?? "")) errors.push("reviewStatus is invalid or missing.");
  if (!Array.isArray(data.records) || !data.records.length) errors.push("At least one import record is required.");

  (Array.isArray(data.records) ? data.records : []).forEach((record, recordIndex) => {
    const prefix = `records[${recordIndex}]`;
    if (!nonEmpty(record?.displayName)) errors.push(`${prefix}.displayName is required.`);
    if (!DOMAINS.has(record?.domain)) errors.push(`${prefix}.domain is invalid or missing.`);
    if (!CATEGORIES.has(record?.category)) errors.push(`${prefix}.category is invalid or missing.`);
    if (!Array.isArray(record?.sourceFacts)) errors.push(`${prefix}.sourceFacts must be an array.`);
    if (record?.domain === "BIOLOGICAL" && containsBiologicalMisuseContent(record)) {
      errors.push(`${prefix} contains prohibited biological misuse-enabling content.`);
    }
    (Array.isArray(record?.sourceFacts) ? record.sourceFacts : []).forEach((fact, factIndex) => {
      const factPrefix = `${prefix}.sourceFacts[${factIndex}]`;
      const tactical = !NON_TACTICAL_GROUPS.has(fact?.fieldGroup);
      if (registryEntry && !registryEntry.profileFieldGroups.includes(fact?.fieldGroup)) errors.push(`${factPrefix}.fieldGroup is not approved for ${registryEntry.id}.`);
      if (fact?.sourceName && registryEntry && normalizedSourceName(fact.sourceName) !== normalizedSourceName(registryEntry.name)) errors.push(`${factPrefix}.sourceName does not match its sourceRegistryId.`);
      if (fact?.sourceUrl && !validHttpsUrl(fact.sourceUrl)) errors.push(`${factPrefix}.sourceUrl must be an absolute HTTPS URL.`);
      if (!nonEmpty(fact?.sourceDocumentTitle) && !nonEmpty(data.sourceDocumentTitle)) errors.push(`${factPrefix} requires sourceDocumentTitle.`);
      if (!nonEmpty(fact?.sourceUrl) && !validHttpsUrl(data.sourceUrl)) errors.push(`${factPrefix} requires sourceUrl.`);
      if (tactical && !nonEmpty(fact?.sourcePage)) errors.push(`${factPrefix} tactical facts require a source page or section locator.`);
      if (fact?.value === null && fact?.verificationStatus !== "No Current Data Exists") {
        errors.push(`${factPrefix} has a null value without No Current Data Exists status.`);
      }
      if (fact?.verificationStatus === "Verified") warnings.push(`${factPrefix} requested Verified status; imports are never auto-verified and will be downgraded.`);
      if (record?.domain === "BIOLOGICAL" && containsBiologicalMisuseContent(fact)) {
        errors.push(`${factPrefix} contains prohibited biological misuse-enabling content.`);
      }
    });
  });

  if (errors.length) return { valid: false, errors, warnings };
  if (!warnings.some((warning) => warning.includes("never auto-verified"))) warnings.push("Imported tactical facts are never auto-verified and require SME review.");
  const packageData = data as CbrneImportPackage;
  const normalizedPackage: CbrneNormalizedImportPackage = {
    ...packageData,
    packageId: packageData.packageId.trim(),
    packageName: packageData.packageName.trim(),
    sourceRegistryId: packageData.sourceRegistryId,
    sourceName: registryEntry!.name,
    sourceUrl: packageData.sourceUrl!.trim(),
    sourceDocumentTitle: packageData.sourceDocumentTitle.trim(),
    records: packageData.records.map((record) => ({
      ...record,
      displayName: record.displayName.trim(),
      scientificName: record.scientificName?.trim(),
      aliases: [...new Set((record.aliases ?? []).map((value) => value.trim()).filter(Boolean))],
      agentCodes: [...new Set((record.agentCodes ?? []).map((value) => value.trim()).filter(Boolean))],
      cas: [...new Set((record.cas ?? []).map((value) => value.trim()).filter(Boolean))],
      unNaNumbers: [...new Set((record.unNaNumbers ?? []).map((value) => value.trim()).filter(Boolean))],
      sourceFacts: record.sourceFacts.map((fact) => ({
        ...fact,
        sourceName: registryEntry!.name,
        sourceDocumentTitle: fact.sourceDocumentTitle?.trim() || packageData.sourceDocumentTitle.trim(),
        sourceUrl: fact.sourceUrl?.trim() || packageData.sourceUrl!.trim(),
        sourcePage: fact.sourcePage?.trim(),
      })),
    })),
  };
  return { valid: true, errors, warnings, normalizedPackage };
}

function normalized(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function importTerms(record: CbrneImportRecord) {
  return [record.displayName, record.scientificName, ...(record.aliases ?? []), ...(record.agentCodes ?? []), ...(record.cas ?? []), record.radionuclideSymbol]
    .filter(Boolean).map(normalized);
}

function masterTerms(record: CbrneMasterRecord) {
  return [record.displayName, record.scientificName, ...record.commonNames, ...record.aliases, ...(record.agentCodes ?? []), ...(record.cas ?? []), record.radionuclideSymbol]
    .filter(Boolean).map(normalized);
}

function matchingRecord(imported: CbrneImportRecord, records: readonly CbrneMasterRecord[]) {
  const terms = new Set(importTerms(imported));
  return records.find((record) => masterTerms(record).some((term) => terms.has(term))) ?? null;
}

function slug(value: string) {
  return value.toLocaleLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function importedMasterRecord(record: CbrneImportRecord, packageData: CbrneImportPackage): CbrneMasterRecord {
  return {
    id: `${slug(record.displayName)}-${slug(packageData.packageId)}`,
    domain: record.domain,
    category: record.category,
    displayName: record.displayName,
    scientificName: record.scientificName,
    commonNames: [],
    aliases: record.aliases ?? [],
    agentCodes: record.agentCodes,
    cas: record.cas,
    unNaNumbers: record.unNaNumbers,
    radionuclideSymbol: record.radionuclideSymbol,
    isotopeMassNumber: record.isotopeMassNumber,
    verificationStatus: "Requires SME Review",
    sourceFactIds: [],
    createdAt: packageData.importedAt,
    updatedAt: packageData.importedAt,
  };
}

export function stageCbrneImportPackage(
  input: unknown,
  existingRecords: readonly CbrneMasterRecord[] = CBRNE_MASTER_RECORDS,
  existingFacts: readonly CbrneSourceFact[] = CBRNE_SOURCE_FACTS,
): CbrneImportStageResult {
  const validation = validateCbrneImportPackage(input);
  if (!validation.valid || !validation.normalizedPackage) {
    return { packageId: (input as Partial<CbrneImportPackage>)?.packageId ?? "invalid", valid: false, errors: validation.errors, warnings: validation.warnings, records: [] };
  }
  const packageData = validation.normalizedPackage;
  const staged = packageData.records.map((importRecord) => {
    const match = matchingRecord(importRecord, existingRecords);
    const baseRecord = match ?? importedMasterRecord(importRecord, packageData);
    const normalizedFacts = normalizeCbrneSourceFacts(packageData, importRecord, baseRecord.id);
    const conflicts: CbrneImportConflict[] = [];
    const importedFacts = normalizedFacts.map((fact) => {
      const existing = existingFacts.find((candidate) => candidate.recordId === baseRecord.id
        && candidate.fieldGroup === fact.fieldGroup
        && normalized(candidate.fieldName) === normalized(fact.fieldName)
        && candidate.value !== null
        && fact.value !== null
        && normalized(candidate.value) !== normalized(fact.value));
      if (!existing) return fact;
      conflicts.push({
        recordId: baseRecord.id,
        fieldGroup: fact.fieldGroup,
        fieldName: fact.fieldName,
        existingFactId: existing.id,
        importedFactId: fact.id,
        existingValue: existing.value,
        importedValue: fact.value,
      });
      return { ...fact, verificationStatus: "Conflicting Sources" as const };
    });
    return {
      matchType: match ? "existing" as const : "new" as const,
      record: { ...baseRecord, sourceFactIds: [...new Set([...baseRecord.sourceFactIds, ...importedFacts.map((fact) => fact.id)])] },
      importedFacts,
      conflicts,
    };
  });
  return { packageId: packageData.packageId, valid: true, errors: [], warnings: validation.warnings, records: staged };
}
