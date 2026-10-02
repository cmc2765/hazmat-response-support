import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  importTier2Facilities,
  normalizeTier2Facilities,
  parseCsv,
  validateMapBounds,
} from "../src/tier2/importer.js";
import * as schema from "../src/schema.js";
import { normalizeTier2Details } from "../src/tier2/details.js";

describe("Tier II Facility importer", () => {
  it("parses Alabama E-Plan headings and maps Facility ID and coordinates", () => {
    const rows = parseCsv([
      "Facility ID,State Facility ID,Facility Name,Company Name,Latitude,Longitude,State,Filing Year,Manned(Y/N),Has Doc(s)",
      "AL-001,STATE-001,\"North, Plant\",Example Co,33.5,-86.8,AL,2025(Tier2),Y,N",
    ].join("\n"));
    const result = normalizeTier2Facilities(rows);
    expect(result.report).toMatchObject({ recordsFound: 1, uniqueFacilities: 1, facilitiesWithCoordinates: 1 });
    expect(result.records[0]).toMatchObject({
      sourceFacilityId: "AL-001",
      facilityName: "North, Plant",
      latitude: 33.5,
      longitude: -86.8,
      filingYear: "2025(Tier2)",
      coordinateSource: "E-Plan reported coordinates",
      manned: "yes",
      hasDocuments: false,
    });
  });

  it("deduplicates Facility IDs while flagging invalid coordinates", () => {
    const rows = parseCsv([
      "Facility ID,Facility Name,Latitude,Longitude,State",
      "AL-001,First,33,-86,AL",
      "AL-001,Updated,91,-86,AL",
      "AL-002,,not-a-coordinate,-86,AL",
    ].join("\n"));
    const result = normalizeTier2Facilities(rows);
    expect(result.report).toMatchObject({ uniqueFacilities: 2, duplicateFacilityIds: 1, invalidCoordinates: 2, missingFacilityNames: 1 });
    expect(result.records.find((record) => record.sourceFacilityId === "AL-001")).toMatchObject({
      facilityName: "Updated",
      latitude: null,
      longitude: null,
      coordinateSource: null,
    });
  });

  it("validates map bounds", () => {
    expect(validateMapBounds({ west: "-87", east: "-86", south: "33", north: "34" }))
      .toEqual({ west: -87, east: -86, south: 33, north: 34 });
    expect(validateMapBounds({ west: "-87", east: "-86", south: "35", north: "34" })).toBeNull();
  });

  it("parses the separated E-Plan chemical export by Facility ID", () => {
    const rows = parseCsv([
      "Facility ID,CASNumber,ChemicalName,MaxDailyQty,AvgDailyQty,MaxAmountInLargestContainer,EHS,Solid,Liquid,Gas,Storage/Pressure/Temperature Types/Location/Max Amount",
      "AL-001,68476346,Diesel Fuel,\"12,410\",\"12,410\",\"12,410\",,F,T,F,Above ground tank",
    ].join("\n"));
    const result = normalizeTier2Details(rows, [{ id: "facility-1", sourceFacilityId: "AL-001" }]);
    expect(result.report).toMatchObject({ matchedFacilities: 1, unmatchedFacilities: 0, chemicalsFound: 1 });
    expect(result.chemicals[0]).toMatchObject({
      facilityId: "facility-1",
      sourceFacilityId: "AL-001",
      chemicalName: "Diesel Fuel",
      casNumber: "68476346",
      maximumQuantity: "12,410",
      averageDailyQuantity: "12,410",
      maximumAmountLargestContainer: "12,410",
      physicalState: "Liquid",
    });
  });
});

describe("Tier II facility API", () => {
  let app: typeof import("../src/app.js").default;

  beforeAll(async () => {
    const dbPath = path.join(mkdtempSync(path.join(tmpdir(), "hazmat-tier2-test-")), "test.db");
    process.env.SQLITE_PATH = dbPath;
    const dbModule = await import("../src/db.js");
    const importer = await import("../src/tier2/importer.js");
    const raw = dbModule.getRawConnection();
    raw.exec(`
      CREATE TABLE npg_records (id TEXT PRIMARY KEY, name TEXT NOT NULL, synonyms TEXT NOT NULL DEFAULT '[]', cas TEXT, rtecs TEXT, formula TEXT, exposure_limits TEXT NOT NULL DEFAULT '{}', physical TEXT NOT NULL DEFAULT '{}', health TEXT NOT NULL DEFAULT '{}', ppe TEXT NOT NULL DEFAULT '{}', reactivity TEXT NOT NULL DEFAULT '{}', sources TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE UNIQUE INDEX uq_npg_cas ON npg_records(cas);
      CREATE TABLE data_sources (key TEXT PRIMARY KEY, edition TEXT, license TEXT, record_count INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE tier2_facilities (id TEXT PRIMARY KEY, source_facility_id TEXT NOT NULL, state_facility_id TEXT, facility_name TEXT, company_name TEXT, street TEXT, city TEXT, county TEXT, state TEXT, zip TEXT, latitude REAL, longitude REAL, coordinate_source TEXT, filing_year TEXT, filing_type TEXT, maximum_occupants INTEGER, manned TEXT NOT NULL DEFAULT 'unknown', sic_code TEXT, naics_code TEXT, last_modified_date TEXT, first_submit_date TEXT, de_registration_date TEXT, has_documents INTEGER, facility_note TEXT, source_system TEXT NOT NULL, imported_at TEXT NOT NULL, UNIQUE(source_system, source_facility_id));
      CREATE INDEX idx_tier2_facilities_coordinates ON tier2_facilities(latitude, longitude);
      CREATE INDEX idx_tier2_facilities_state ON tier2_facilities(state);
      CREATE TABLE tier2_chemicals (id TEXT PRIMARY KEY, facility_id TEXT, source_facility_id TEXT NOT NULL, chemical_name TEXT, cas_number TEXT, ehs_status TEXT, maximum_quantity TEXT, average_daily_quantity TEXT, maximum_amount_largest_container TEXT, physical_state TEXT, hazard_flags TEXT, storage_information TEXT, source_system TEXT NOT NULL, imported_at TEXT NOT NULL);
      CREATE TABLE tier2_facility_contacts (id TEXT PRIMARY KEY, facility_id TEXT, source_facility_id TEXT NOT NULL, contact_type TEXT, name TEXT, email TEXT, phone_24_hour TEXT, work_phone TEXT, source_system TEXT NOT NULL, imported_at TEXT NOT NULL);
    `);
    raw.close();
    const rows = importer.parseCsv([
      "Facility ID,Facility Name,Company Name,Latitude,Longitude,Street,City,County,State,Zip,Filing Year,NAICS Code,Manned(Y/N)",
      "AL-API-1,API Plant,API Co,33.5,-86.8,1 Main St,Birmingham,Jefferson,AL,35203,2025,325199,Y",
      "AL-API-2,Outside Plant,Other Co,35,-86.8,2 Main St,Other City,Other,AL,35000,2025,325199,N",
    ].join("\n"));
    const normalized = importer.normalizeTier2Facilities(rows);
    const db = dbModule.getDb();
    await importTier2Facilities(db, normalized.records);
    db.insert(schema.tier2Chemicals).values(Array.from({ length: 10 }, (_, index) => ({
      id: `chemical-${index}`,
      facilityId: normalized.records[0].id,
      sourceFacilityId: "AL-API-1",
      chemicalName: `Chemical ${index + 1}`,
      ehsStatus: index < 3 ? "Yes" : "No",
      sourceSystem: "E-Plan Tier II",
      importedAt: "2026-10-01T00:00:00.000Z",
    }))).run();
    db.insert(schema.tier2FacilityContacts).values([
      { id: "contact-1", facilityId: normalized.records[0].id, sourceFacilityId: "AL-API-1", name: "Responder One", contactType: "Emergency Contact", phone24Hour: "555-0101", sourceSystem: "E-Plan Tier II", importedAt: "2026-10-01T00:00:00.000Z" },
      { id: "contact-2", facilityId: normalized.records[0].id, sourceFacilityId: "AL-API-1", name: "Responder Two", contactType: "Owner / Operator", email: "two@example.test", sourceSystem: "E-Plan Tier II", importedAt: "2026-10-01T00:00:00.000Z" },
    ]).run();
    ({ default: app } = await import("../src/app.js"));
  }, 30_000);

  it("returns only facilities within map bounds and excludes contact fields", async () => {
    const response = await app.request("/api/tier2/facilities?west=-87&east=-86&south=33&north=34");
    expect(response.status).toBe(200);
    const body = await response.json() as { facilities: Array<Record<string, unknown>> };
    expect(body.facilities).toHaveLength(1);
    expect(body.facilities[0]).toMatchObject({ sourceFacilityId: "AL-API-1", naicsCode: "325199", street: "1 Main St", city: "Birmingham", state: "AL", zip: "35203", chemicalCount: 10, ehsCount: 3, contactCount: 2 });
    expect(JSON.stringify(body)).not.toMatch(/email|phone|24-hour/i);
  });

  it("returns the facility detail with all chemicals and contacts joined to one facility", async () => {
    const response = await app.request("/api/tier2/facilities/e-plan-tier-ii:AL-API-1");
    expect(response.status).toBe(200);
    const body = await response.json() as { facility: Record<string, unknown>; chemicals: unknown[]; contacts: unknown[] };
    expect(body.facility).toMatchObject({ sourceFacilityId: "AL-API-1", chemicalCount: 10, ehsCount: 3, contactCount: 2 });
    expect(body.chemicals).toHaveLength(10);
    expect(body.contacts).toHaveLength(2);
  });
});
