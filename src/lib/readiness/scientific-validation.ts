export const SAFETY_DATA_STATUS = {
  NO_CURRENT_DATA: "No Current Data Exists",
  NOT_LISTED: "Not listed by current source",
  NOT_APPLICABLE: "Not applicable to this hazard",
  UNAVAILABLE: "Data unavailable from current source",
} as const;

export type SafetyDataStatus = typeof SAFETY_DATA_STATUS[keyof typeof SAFETY_DATA_STATUS];

export const SAFETY_CRITICAL_FIELDS = [
  "idlh", "exposure_limit", "lel", "uel", "flash_point", "isolation_distance",
  "protective_action_distance", "ppe", "respiratory_protection", "suit_compatibility",
  "decon", "medical", "plume_model_input", "plume_model_output",
] as const;

export type SafetyCriticalField = typeof SAFETY_CRITICAL_FIELDS[number];

export interface ApprovedSourceRecord {
  field: SafetyCriticalField;
  value: unknown;
  sourceName: string;
  sourceRecordId: string;
  approved: boolean;
  linkVerified?: boolean;
  isCurrent?: boolean;
  isHistorical?: boolean;
  sourceVersion?: string;
  sourceLocator?: string;
  limitations?: string[];
}

export interface DisplayableSafetyValue {
  field: SafetyCriticalField;
  value: string;
  source: string;
  sourceRecordId: string;
  sourceVersion?: string;
  sourceLocator?: string;
  limitations: string[];
  current: boolean;
  historical: boolean;
}

const NOT_LISTED_MARKERS = /^(?:not\s+(?:listed|established)(?:\s+by\s+current\s+source)?|none\s+listed)$/i;
const NOT_APPLICABLE_MARKERS = /^(?:not\s+(?:relevant|applicable)|n\/a\s*[-–—]\s*not\s+applicable)$/i;
const UNAVAILABLE_MARKERS = /^(?:(?:data\s+)?unavailable(?:\s+from\s+current\s+source)?|n\/?a|not\s+available|null|undefined|[-–—])$/i;

/** Maps source state to the exact fail-closed UI text without inventing a value. */
export function safetyDisplayValue(value: unknown): string {
  if (value === null || value === undefined || String(value).trim() === "") {
    return SAFETY_DATA_STATUS.NO_CURRENT_DATA;
  }
  const text = String(value).trim();
  if (NOT_LISTED_MARKERS.test(text)) return SAFETY_DATA_STATUS.NOT_LISTED;
  if (NOT_APPLICABLE_MARKERS.test(text)) return SAFETY_DATA_STATUS.NOT_APPLICABLE;
  if (UNAVAILABLE_MARKERS.test(text)) return SAFETY_DATA_STATUS.UNAVAILABLE;
  return text;
}

function isChemicalCompanion(record: ApprovedSourceRecord) {
  return /^chemical companion(?: master)?$/i.test(record.sourceName.trim());
}

export function isApprovedDirectRecord(record: ApprovedSourceRecord): boolean {
  if (!record.approved || !record.sourceName.trim() || !record.sourceRecordId.trim()) return false;
  return isChemicalCompanion(record) || record.linkVerified === true;
}

/**
 * Resolves only approved direct records. For IDLH, Chemical Companion master data
 * precedes verified links, source-declared current values precede historical values,
 * and every supported value is retained with its own source label.
 */
export function resolveSafetyValues(
  field: SafetyCriticalField,
  records: ApprovedSourceRecord[],
): DisplayableSafetyValue[] {
  const resolved = records
    .filter((record) => record.field === field && isApprovedDirectRecord(record))
    .map((record, index) => ({ record, index }))
    .sort((a, b) => {
      if (field === "idlh") {
        const aMissing = Object.values(SAFETY_DATA_STATUS).includes(safetyDisplayValue(a.record.value) as SafetyDataStatus);
        const bMissing = Object.values(SAFETY_DATA_STATUS).includes(safetyDisplayValue(b.record.value) as SafetyDataStatus);
        if (aMissing !== bMissing) return Number(aMissing) - Number(bMissing);
        const companionOrder = Number(isChemicalCompanion(b.record)) - Number(isChemicalCompanion(a.record));
        if (companionOrder) return companionOrder;
        const currentOrder = Number(b.record.isCurrent === true) - Number(a.record.isCurrent === true);
        if (currentOrder) return currentOrder;
        const historicalOrder = Number(a.record.isHistorical === true) - Number(b.record.isHistorical === true);
        if (historicalOrder) return historicalOrder;
      }
      return a.index - b.index;
    })
    .map(({ record }) => ({
      field,
      value: safetyDisplayValue(record.value),
      source: record.sourceName,
      sourceRecordId: record.sourceRecordId,
      ...(record.sourceVersion ? { sourceVersion: record.sourceVersion } : {}),
      ...(record.sourceLocator ? { sourceLocator: record.sourceLocator } : {}),
      limitations: record.limitations ?? [],
      current: record.isCurrent === true,
      historical: record.isHistorical === true,
    }));
  return resolved;
}

export function primarySafetyValue(field: SafetyCriticalField, records: ApprovedSourceRecord[]): string {
  return resolveSafetyValues(field, records)[0]?.value ?? SAFETY_DATA_STATUS.NO_CURRENT_DATA;
}
