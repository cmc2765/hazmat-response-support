// SQLite schema init — creates all tables for local dev.
// Run with: npm run db:init-sqlite
// Creates the database file if it doesn't exist.

import { getRawConnection } from "./db.js";

const db = getRawConnection();
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS chemicals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  synonyms TEXT NOT NULL DEFAULT '[]',
  cas TEXT,
  un TEXT,
  na TEXT,
  hazard_class TEXT NOT NULL DEFAULT '[]',
  packing_group TEXT,
  erg_guide TEXT,
  placard TEXT,
  ppe TEXT NOT NULL DEFAULT '[]',
  isolation TEXT NOT NULL DEFAULT '{}',
  first_aid TEXT NOT NULL DEFAULT '[]',
  reactivity TEXT NOT NULL DEFAULT '[]',
  incompatibilities TEXT NOT NULL DEFAULT '[]',
  sds_url TEXT,
  sources TEXT NOT NULL DEFAULT '[]',
  molecular_weight TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chemicals_name ON chemicals(name);
CREATE INDEX IF NOT EXISTS idx_chemicals_cas ON chemicals(cas);
CREATE INDEX IF NOT EXISTS idx_chemicals_un ON chemicals(un);
CREATE INDEX IF NOT EXISTS idx_chemicals_erg ON chemicals(erg_guide);

CREATE TABLE IF NOT EXISTS npg_records (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  synonyms TEXT NOT NULL DEFAULT '[]',
  cas TEXT,
  rtecs TEXT,
  formula TEXT,
  exposure_limits TEXT NOT NULL DEFAULT '{}',
  physical TEXT NOT NULL DEFAULT '{}',
  health TEXT NOT NULL DEFAULT '{}',
  ppe TEXT NOT NULL DEFAULT '{}',
  reactivity TEXT NOT NULL DEFAULT '{}',
  sources TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_npg_name ON npg_records(name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_npg_cas ON npg_records(cas);

CREATE TABLE IF NOT EXISTS erg_table_1 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  un TEXT NOT NULL,
  name TEXT NOT NULL,
  guide TEXT NOT NULL,
  small_initial_day_ft INTEGER NOT NULL,
  small_protective_day_mi TEXT NOT NULL,
  large_initial_day_ft INTEGER NOT NULL,
  large_protective_day_mi TEXT NOT NULL,
  small_initial_night_ft INTEGER NOT NULL,
  small_protective_night_mi TEXT NOT NULL,
  large_initial_night_ft INTEGER NOT NULL,
  large_protective_night_mi TEXT NOT NULL,
  is_water_reactive INTEGER NOT NULL DEFAULT 0,
  water_reactive_name TEXT,
  tih INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_erg_un ON erg_table_1(un);
CREATE INDEX IF NOT EXISTS idx_erg_guide ON erg_table_1(guide);

CREATE TABLE IF NOT EXISTS thresholds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chemical_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  level INTEGER NOT NULL,
  value_ppm TEXT NOT NULL,
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_thresholds_chem ON thresholds(chemical_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_thresholds_chem_kind_level ON thresholds(chemical_id, kind, level);

CREATE TABLE IF NOT EXISTS facilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat TEXT,
  lng TEXT,
  dunn TEXT,
  ehs_flag INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  last_updated TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_facilities_name ON facilities(name);
CREATE INDEX IF NOT EXISTS idx_facilities_dunn ON facilities(dunn);

CREATE TABLE IF NOT EXISTS facility_chemicals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  facility_id TEXT NOT NULL,
  chemical_id TEXT NOT NULL,
  max_daily_amount_value TEXT NOT NULL,
  max_daily_amount_unit TEXT NOT NULL,
  container TEXT,
  conditions TEXT,
  last_reported_year INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fc_facility ON facility_chemicals(facility_id);
CREATE INDEX IF NOT EXISTS idx_fc_chemical ON facility_chemicals(chemical_id);

CREATE TABLE IF NOT EXISTS data_sources (
  key TEXT PRIMARY KEY,
  edition TEXT,
  license TEXT,
  record_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_state (
  client_id TEXT PRIMARY KEY,
  last_sync_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_data_version TEXT
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  report TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
`);

console.log("[init-sqlite] tables created");
db.close();
process.exit(0);
