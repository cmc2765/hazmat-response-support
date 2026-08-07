// Drizzle ORM schema — SQLite.
// Defines all tables for the Hazmat Response Support backend.

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Legacy application source-layer cache (not the identity master) ─────
export const chemicals = sqliteTable(
  "chemicals",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    synonyms: text("synonyms").notNull().default("'[]'"),
    cas: text("cas"),
    un: text("un"),
    na: text("na"),
    hazardClass: text("hazard_class").notNull().default("'[]'"),
    packingGroup: text("packing_group"),
    ergGuide: text("erg_guide"),
    placard: text("placard"),
    ppe: text("ppe").notNull().default("'[]'"),
    isolation: text("isolation").notNull().default("'{}'"),
    firstAid: text("first_aid").notNull().default("'[]'"),
    reactivity: text("reactivity").notNull().default("'[]'"),
    incompatibilities: text("incompatibilities").notNull().default("'[]'"),
    sdsUrl: text("sds_url"),
    sources: text("sources").notNull().default("'[]'"),
    molecularWeight: text("molecular_weight"),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    nameIdx: index("idx_chemicals_name").on(t.name),
    casIdx: index("idx_chemicals_cas").on(t.cas),
    unIdx: index("idx_chemicals_un").on(t.un),
    ergIdx: index("idx_chemicals_erg").on(t.ergGuide),
  }),
);

// Chemical Companion is the master identity store. These operational tables retain
// source-layer records and reviewed links without copying them into the master table.
export const transportationIdentifiers = sqliteTable(
  "transportation_identifier",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    identifierType: text("identifier_type").notNull(),
    identifierValue: text("identifier_value").notNull(),
    normalizedIdentifierValue: text("normalized_identifier_value").notNull(),
    properShippingName: text("proper_shipping_name"),
    hazardClass: text("hazard_class"),
    packingGroup: text("packing_group"),
    ergGuide: text("erg_guide"),
    source: text("source").notNull(),
    sourceRecordId: text("source_record_id").notNull(),
    sourceStatus: text("source_status").notNull(),
    reviewStatus: text("review_status").notNull().default("requires_review"),
    notes: text("notes"),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    identifierIdx: index("idx_transport_identifier_value").on(t.normalizedIdentifierValue),
    sourceRecordIdx: uniqueIndex("uq_transport_source_record").on(t.source, t.sourceRecordId),
  }),
);

export const chemicalTransportLinks = sqliteTable(
  "chemical_transport_link",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    masterChemicalId: integer("master_chemical_id").notNull(),
    transportationIdentifierId: integer("transportation_identifier_id").notNull(),
    linkType: text("link_type").notNull(),
    confidence: text("confidence"),
    reviewStatus: text("review_status").notNull().default("requires_review"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: text("reviewed_at"),
    notes: text("notes"),
  },
  (t) => ({
    masterIdx: index("idx_transport_link_master").on(t.masterChemicalId),
    transportIdx: index("idx_transport_link_identifier").on(t.transportationIdentifierId),
    linkIdx: uniqueIndex("uq_chemical_transport_link").on(t.masterChemicalId, t.transportationIdentifierId),
  }),
);

export const chemicalSourceLinks = sqliteTable(
  "chemical_source_link",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    masterChemicalId: integer("master_chemical_id").notNull(),
    sourceName: text("source_name").notNull(),
    sourceRecordId: text("source_record_id").notNull(),
    sourceIdentifierType: text("source_identifier_type"),
    sourceIdentifierValue: text("source_identifier_value"),
    matchBasis: text("match_basis").notNull(),
    confidence: text("confidence"),
    reviewStatus: text("review_status").notNull().default("requires_review"),
    sourceVersion: text("source_version"),
    importedAt: text("imported_at").notNull().default(sql`(datetime('now'))`),
    notes: text("notes"),
  },
  (t) => ({
    masterIdx: index("idx_source_link_master").on(t.masterChemicalId),
    sourceIdx: uniqueIndex("uq_chemical_source_link").on(t.masterChemicalId, t.sourceName, t.sourceRecordId),
  }),
);

export const chemicalSourceFacts = sqliteTable(
  "chemical_source_fact",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    masterChemicalId: integer("master_chemical_id").notNull(),
    sourceName: text("source_name").notNull(),
    sourceRecordId: text("source_record_id").notNull(),
    factCategory: text("fact_category").notNull(),
    factName: text("fact_name").notNull(),
    factValue: text("fact_value").notNull(),
    factUnits: text("fact_units"),
    sourceStatus: text("source_status").notNull(),
    sourceVersion: text("source_version"),
    limitations: text("limitations"),
    importedAt: text("imported_at").notNull().default(sql`(datetime('now'))`),
    notes: text("notes"),
  },
  (t) => ({
    masterIdx: index("idx_source_fact_master").on(t.masterChemicalId),
    categoryIdx: index("idx_source_fact_category").on(t.factCategory),
  }),
);

// ─── NIOSH Pocket Guide records ──────────────────────────────────────────
export const npgRecords = sqliteTable(
  "npg_records",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    synonyms: text("synonyms").notNull().default("'[]'"),
    cas: text("cas"),
    rtecs: text("rtecs"),
    formula: text("formula"),
    exposureLimits: text("exposure_limits").notNull().default("'{}'"),
    physical: text("physical").notNull().default("'{}'"),
    health: text("health").notNull().default("'{}'"),
    ppe: text("ppe").notNull().default("'{}'"),
    reactivity: text("reactivity").notNull().default("'{}'"),
    sources: text("sources").notNull().default("'[]'"),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    nameIdx: index("idx_npg_name").on(t.name),
    casIdx: uniqueIndex("uq_npg_cas").on(t.cas),
  }),
);

// ─── ERG 2024 Table 1 distances ──────────────────────────────────────────
export const ergTable1 = sqliteTable(
  "erg_table_1",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    un: text("un").notNull(),
    name: text("name").notNull(),
    guide: text("guide").notNull(),
    smallInitialDayFt: integer("small_initial_day_ft").notNull(),
    smallProtectiveDayMi: text("small_protective_day_mi").notNull(),
    largeInitialDayFt: integer("large_initial_day_ft").notNull(),
    largeProtectiveDayMi: text("large_protective_day_mi").notNull(),
    smallInitialNightFt: integer("small_initial_night_ft").notNull(),
    smallProtectiveNightMi: text("small_protective_night_mi").notNull(),
    largeInitialNightFt: integer("large_initial_night_ft").notNull(),
    largeProtectiveNightMi: text("large_protective_night_mi").notNull(),
    isWaterReactive: integer("is_water_reactive").notNull().default(0),
    waterReactiveName: text("water_reactive_name"),
    tih: integer("tih").notNull().default(0),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    unIdx: index("idx_erg_un").on(t.un),
    guideIdx: index("idx_erg_guide").on(t.guide),
  }),
);

// ─── AEGL / ERPG / TEEL thresholds ───────────────────────────────────────
export const thresholds = sqliteTable(
  "thresholds",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chemicalId: text("chemical_id").notNull(),
    kind: text("kind").notNull(),
    level: integer("level").notNull(),
    valuePpm: text("value_ppm").notNull(),
    notes: text("notes"),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    chemIdx: index("idx_thresholds_chem").on(t.chemicalId),
    kindLevelIdx: uniqueIndex("uq_thresholds_chem_kind_level").on(t.chemicalId, t.kind, t.level),
  }),
);

// ─── Facilities (Tier II) ────────────────────────────────────────────────
export const facilities = sqliteTable(
  "facilities",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    address: text("address").notNull(),
    lat: text("lat"),
    lng: text("lng"),
    dunn: text("dunn"),
    ehsFlag: integer("ehs_flag").notNull().default(0),
    source: text("source").notNull(),
    lastUpdated: text("last_updated").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    nameIdx: index("idx_facilities_name").on(t.name),
    dunnIdx: index("idx_facilities_dunn").on(t.dunn),
  }),
);

// ─── Facility ↔ Chemical inventory ───────────────────────────────────────
export const facilityChemicals = sqliteTable(
  "facility_chemicals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    facilityId: text("facility_id").notNull(),
    chemicalId: text("chemical_id").notNull(),
    maxDailyAmountValue: text("max_daily_amount_value").notNull(),
    maxDailyAmountUnit: text("max_daily_amount_unit").notNull(),
    container: text("container"),
    conditions: text("conditions"),
    lastReportedYear: integer("last_reported_year").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    facilityIdx: index("idx_fc_facility").on(t.facilityId),
    chemicalIdx: index("idx_fc_chemical").on(t.chemicalId),
  }),
);

// ─── Data sources manifest ───────────────────────────────────────────────
export const dataSources = sqliteTable(
  "data_sources",
  {
    key: text("key").primaryKey(),
    edition: text("edition"),
    license: text("license"),
    recordCount: integer("record_count").notNull().default(0),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
);

// ─── Sync state ──────────────────────────────────────────────────────────
export const syncState = sqliteTable(
  "sync_state",
  {
    clientId: text("client_id").primaryKey(),
    lastSyncAt: text("last_sync_at").notNull().default(sql`(datetime('now'))`),
    lastDataVersion: text("last_data_version"),
  },
);

// ─── Incident reports ───────────────────────────────────────────────────
export const incidents = sqliteTable(
  "incidents",
  {
    id: text("id").primaryKey(),
    status: text("status").notNull(),
    report: text("report").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ statusIdx: index("idx_incidents_status").on(t.status) }),
);

export type ChemicalRow = typeof chemicals.$inferSelect;
export type TransportationIdentifierRow = typeof transportationIdentifiers.$inferSelect;
export type ChemicalTransportLinkRow = typeof chemicalTransportLinks.$inferSelect;
export type ChemicalSourceLinkRow = typeof chemicalSourceLinks.$inferSelect;
export type ChemicalSourceFactRow = typeof chemicalSourceFacts.$inferSelect;
export type NpgRow = typeof npgRecords.$inferSelect;
export type ErgRow = typeof ergTable1.$inferSelect;
export type ThresholdRow = typeof thresholds.$inferSelect;
export type FacilityRow = typeof facilities.$inferSelect;
export type FacilityChemicalRow = typeof facilityChemicals.$inferSelect;
export type DataSourceRow = typeof dataSources.$inferSelect;
export type SyncStateRow = typeof syncState.$inferSelect;
export type IncidentRow = typeof incidents.$inferSelect;
