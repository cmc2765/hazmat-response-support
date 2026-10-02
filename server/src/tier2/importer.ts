import { readFile } from "node:fs/promises";
import { and, eq, gte, lte } from "drizzle-orm";
import type { DbClient } from "../db.js";
import * as schema from "../schema.js";

export const TIER2_SOURCE_SYSTEM = "E-Plan Tier II";
export const EPLAN_COORDINATE_SOURCE = "E-Plan reported coordinates";
export const EPA_TIER2_REFERENCE_URL = "https://www.epa.gov/epcra/tier-ii-forms-and-instructions";
export const TIER2_SOURCE_USAGE_NOTE = "Authorized imported facility data; not a live EPA facility feed.";

export type Tier2FacilityField =
  | "sourceFacilityId"
  | "stateFacilityId"
  | "facilityName"
  | "companyName"
  | "filingYear"
  | "filingType"
  | "latitude"
  | "longitude"
  | "street"
  | "city"
  | "county"
  | "state"
  | "zip"
  | "maximumOccupants"
  | "manned"
  | "sicCode"
  | "naicsCode"
  | "lastModifiedDate"
  | "firstSubmitDate"
  | "deRegistrationDate"
  | "hasDocuments"
  | "facilityNote";

export type Tier2FacilityProfile = {
  name: string;
  state: string;
  headers: Partial<Record<Tier2FacilityField, string[]>>;
};

// State-specific profiles keep source headings out of the normalized model. Add
// another profile here when a state publishes a different E-Plan export shape.
export const ALABAMA_EPLAN_FACILITY_INFO_PROFILE: Tier2FacilityProfile = {
  name: "Alabama E-Plan Facility Info",
  state: "AL",
  headers: {
    sourceFacilityId: ["Facility ID"],
    stateFacilityId: ["State Facility ID"],
    facilityName: ["Facility Name"],
    companyName: ["Company Name"],
    filingYear: ["Filing Year"],
    filingType: ["Filing Type"],
    latitude: ["Latitude"],
    longitude: ["Longitude"],
    street: ["Street"],
    city: ["City"],
    county: ["County"],
    state: ["State"],
    zip: ["Zip", "ZIP"],
    maximumOccupants: ["Maximum No. of Occupants"],
    manned: ["Manned(Y/N)", "Manned (Y/N)"],
    sicCode: ["SIC Code"],
    naicsCode: ["NAICS Code"],
    lastModifiedDate: ["Last Modified Date"],
    firstSubmitDate: ["First Submit Date"],
    deRegistrationDate: ["De-Registration Date", "Deregistration Date"],
    hasDocuments: ["Has Doc(s)", "Has Docs"],
    facilityNote: ["Facility Note"],
  },
};

export function tier2FacilityProfileForState(state: string): Tier2FacilityProfile {
  const normalized = state.trim().toUpperCase();
  if (normalized === "AL") return ALABAMA_EPLAN_FACILITY_INFO_PROFILE;
  return {
    name: `${normalized || "National"} E-Plan Facility Info`,
    state: normalized,
    headers: ALABAMA_EPLAN_FACILITY_INFO_PROFILE.headers,
  };
}

export type CsvRecord = Record<string, string>;

/** Parse RFC-4180-style CSV, including quoted commas and embedded newlines. */
export function parseCsv(text: string): CsvRecord[] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  if (!rows.length) return [];

  const headings = rows[0].map((heading) => heading.trim());
  return rows.slice(1).map((values) => Object.fromEntries(
    headings.map((heading, index) => [heading, (values[index] ?? "").trim()]),
  ));
}

function valueFor(row: CsvRecord, headings: string[] | undefined): string {
  for (const heading of headings ?? []) {
    if (Object.prototype.hasOwnProperty.call(row, heading)) return row[heading].trim();
  }
  const normalizeHeading = (heading: string) => heading.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedHeadings = new Set((headings ?? []).map(normalizeHeading));
  const match = Object.keys(row).find((heading) => normalizedHeadings.has(normalizeHeading(heading)));
  if (match) return row[match].trim();
  return "";
}

function integerValue(value: string): number | null {
  if (!value) return null;
  return /^[-+]?\d+$/.test(value) ? Number(value) : null;
}

function filingYearValue(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const labels = normalized.match(/\d{4}(?:\s*\([^)]*\))?/g);
  return labels?.length ? labels.join("; ") : normalized.replace(/\s+/g, " ");
}

function filingYearLabels(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(";").map((label) => label.trim()).filter(Boolean);
}

function coordinateValue(value: string, minimum: number, maximum: number): { value: number | null; invalid: boolean } {
  if (!value) return { value: null, invalid: false };
  const parsed = Number(value);
  return { value: Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null, invalid: !Number.isFinite(parsed) || parsed < minimum || parsed > maximum };
}

function booleanValue(value: string): boolean | null {
  if (/^(y|yes|true|1)$/i.test(value)) return true;
  if (/^(n|no|false|0)$/i.test(value)) return false;
  return null;
}

function mannedValue(value: string): string {
  if (/^(y|yes|true|1)$/i.test(value)) return "yes";
  if (/^(n|no|false|0)$/i.test(value)) return "no";
  return "unknown";
}

export type NormalizedTier2Facility = typeof schema.tier2Facilities.$inferInsert;

export type Tier2ImportReport = {
  recordsFound: number;
  uniqueFacilities: number;
  facilitiesWithCoordinates: number;
  facilitiesMissingCoordinates: number;
  duplicateFacilityIds: number;
  invalidCoordinates: number;
  missingFacilityNames: number;
  missingFacilityIds: number;
  statesDetected: string[];
  filingYearsDetected: string[];
  skippedRecords: number;
  errors: string[];
};

export type Tier2ImportResult = {
  report: Tier2ImportReport;
  records: NormalizedTier2Facility[];
};

export function normalizeTier2Facilities(
  rows: CsvRecord[],
  profile = ALABAMA_EPLAN_FACILITY_INFO_PROFILE,
  stateFilter = "",
  importedAt = new Date().toISOString(),
): Tier2ImportResult {
  const normalizedStateFilter = stateFilter.trim().toUpperCase();
  const selectedRows = normalizedStateFilter
    ? rows.filter((row) => valueFor(row, profile.headers.state).toUpperCase() === normalizedStateFilter)
    : rows;
  const sourceIdCounts = new Map<string, number>();
  selectedRows.forEach((row) => {
    const sourceId = valueFor(row, profile.headers.sourceFacilityId);
    if (sourceId) sourceIdCounts.set(sourceId, (sourceIdCounts.get(sourceId) ?? 0) + 1);
  });

  const invalidCoordinateIds = new Set<string>();
  const recordsBySourceId = new Map<string, NormalizedTier2Facility>();
  let invalidCoordinates = 0;
  let missingFacilityNames = 0;
  let missingFacilityIds = 0;
  const errors: string[] = [];

  selectedRows.forEach((row, rowIndex) => {
    const sourceFacilityId = valueFor(row, profile.headers.sourceFacilityId);
    if (!sourceFacilityId) {
      missingFacilityIds += 1;
      errors.push(`Row ${rowIndex + 2}: missing Facility ID`);
      return;
    }
    const latitude = coordinateValue(valueFor(row, profile.headers.latitude), -90, 90);
    const longitude = coordinateValue(valueFor(row, profile.headers.longitude), -180, 180);
    const hasInvalidCoordinates = latitude.invalid || longitude.invalid;
    if (hasInvalidCoordinates) {
      invalidCoordinates += 1;
      invalidCoordinateIds.add(sourceFacilityId);
    }
    const facilityName = valueFor(row, profile.headers.facilityName) || null;
    if (!facilityName) missingFacilityNames += 1;

    const state = valueFor(row, profile.headers.state).toUpperCase() || null;
    const record: NormalizedTier2Facility = {
      id: `${TIER2_SOURCE_SYSTEM.toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${sourceFacilityId}`,
      sourceFacilityId,
      stateFacilityId: valueFor(row, profile.headers.stateFacilityId) || null,
      facilityName,
      companyName: valueFor(row, profile.headers.companyName) || null,
      street: valueFor(row, profile.headers.street) || null,
      city: valueFor(row, profile.headers.city) || null,
      county: valueFor(row, profile.headers.county) || null,
      state,
      zip: valueFor(row, profile.headers.zip) || null,
      latitude: hasInvalidCoordinates ? null : latitude.value,
      longitude: hasInvalidCoordinates ? null : longitude.value,
      coordinateSource: !hasInvalidCoordinates && latitude.value !== null && longitude.value !== null
        ? EPLAN_COORDINATE_SOURCE
        : null,
      filingYear: filingYearValue(valueFor(row, profile.headers.filingYear)),
      filingType: valueFor(row, profile.headers.filingType) || null,
      maximumOccupants: integerValue(valueFor(row, profile.headers.maximumOccupants)),
      manned: mannedValue(valueFor(row, profile.headers.manned)),
      sicCode: valueFor(row, profile.headers.sicCode) || null,
      naicsCode: valueFor(row, profile.headers.naicsCode) || null,
      lastModifiedDate: valueFor(row, profile.headers.lastModifiedDate) || null,
      firstSubmitDate: valueFor(row, profile.headers.firstSubmitDate) || null,
      deRegistrationDate: valueFor(row, profile.headers.deRegistrationDate) || null,
      hasDocuments: booleanValue(valueFor(row, profile.headers.hasDocuments)),
      facilityNote: valueFor(row, profile.headers.facilityNote) || null,
      sourceSystem: TIER2_SOURCE_SYSTEM,
      importedAt,
    };
    // Last source row wins for duplicate IDs, while the report preserves the duplicate signal.
    recordsBySourceId.set(sourceFacilityId, record);
  });

  const records = [...recordsBySourceId.values()];
  const statesDetected = [...new Set(records.map((record) => record.state).filter(Boolean) as string[])].sort();
  const filingYearsDetected = [...new Set(records.flatMap((record) => filingYearLabels(record.filingYear)))].sort();
  const facilitiesWithCoordinates = records.filter((record) => record.latitude !== null && record.longitude !== null).length;

  return {
    records,
    report: {
      recordsFound: selectedRows.length,
      uniqueFacilities: records.length,
      facilitiesWithCoordinates,
      facilitiesMissingCoordinates: records.length - facilitiesWithCoordinates,
      duplicateFacilityIds: [...sourceIdCounts.values()].filter((count) => count > 1).length,
      invalidCoordinates,
      missingFacilityNames,
      missingFacilityIds,
      statesDetected,
      filingYearsDetected,
      skippedRecords: missingFacilityIds,
      errors: [...errors, ...[...invalidCoordinateIds].map((id) => `Facility ID ${id}: invalid coordinate value(s)`)],
    },
  };
}

export async function parseTier2FacilityFile(
  filePath: string,
  state = "",
): Promise<Tier2ImportResult> {
  const profile = tier2FacilityProfileForState(state || "AL");
  const csv = await readFile(filePath, "utf8");
  return normalizeTier2Facilities(parseCsv(csv), profile, state);
}

export async function importTier2Facilities(db: DbClient, records: NormalizedTier2Facility[]): Promise<number> {
  if (!records.length) return 0;
  db.transaction((transaction) => {
    for (const record of records) {
      transaction.insert(schema.tier2Facilities).values(record).onConflictDoUpdate({
        target: schema.tier2Facilities.id,
        set: {
          sourceFacilityId: record.sourceFacilityId,
          stateFacilityId: record.stateFacilityId,
          facilityName: record.facilityName,
          companyName: record.companyName,
          street: record.street,
          city: record.city,
          county: record.county,
          state: record.state,
          zip: record.zip,
          latitude: record.latitude,
          longitude: record.longitude,
          coordinateSource: record.coordinateSource,
          filingYear: record.filingYear,
          filingType: record.filingType,
          maximumOccupants: record.maximumOccupants,
          manned: record.manned,
          sicCode: record.sicCode,
          naicsCode: record.naicsCode,
          lastModifiedDate: record.lastModifiedDate,
          firstSubmitDate: record.firstSubmitDate,
          deRegistrationDate: record.deRegistrationDate,
          hasDocuments: record.hasDocuments,
          facilityNote: record.facilityNote,
          sourceSystem: record.sourceSystem,
          importedAt: record.importedAt,
        },
      }).run();
    }
  });
  return records.length;
}

export function validateMapBounds(bounds: Record<string, string | undefined>): { west: number; east: number; south: number; north: number } | null {
  const values = [bounds.west, bounds.east, bounds.south, bounds.north].map((value) => Number(value));
  if (values.some((value) => !Number.isFinite(value))) return null;
  const [west, east, south, north] = values;
  if (west < -180 || west > 180 || east < -180 || east > 180 || south < -90 || south > 90 || north < -90 || north > 90 || south > north) return null;
  return { west, east, south, north };
}

export async function findTier2FacilitiesInBounds(
  db: DbClient,
  bounds: { west: number; east: number; south: number; north: number },
) {
  return db.select().from(schema.tier2Facilities).where(and(
    eq(schema.tier2Facilities.sourceSystem, TIER2_SOURCE_SYSTEM),
    // Coordinates are null for missing/malformed source values and therefore do not match.
    gte(schema.tier2Facilities.longitude, bounds.west),
    lte(schema.tier2Facilities.longitude, bounds.east),
    gte(schema.tier2Facilities.latitude, bounds.south),
    lte(schema.tier2Facilities.latitude, bounds.north),
  ));
}
