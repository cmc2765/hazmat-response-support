// Drizzle ORM schema — SQLite.
// Defines all tables for the Hazmat Response Support backend.

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Chemicals (CAMEO + ERG + custom) ────────────────────────────────────
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

export type ChemicalRow = typeof chemicals.$inferSelect;
export type NpgRow = typeof npgRecords.$inferSelect;
export type ErgRow = typeof ergTable1.$inferSelect;
export type ThresholdRow = typeof thresholds.$inferSelect;
export type FacilityRow = typeof facilities.$inferSelect;
export type FacilityChemicalRow = typeof facilityChemicals.$inferSelect;
export type DataSourceRow = typeof dataSources.$inferSelect;
export type SyncStateRow = typeof syncState.$inferSelect;