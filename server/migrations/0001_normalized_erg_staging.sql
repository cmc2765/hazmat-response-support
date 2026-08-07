-- STAGING ONLY: normalized ERG schema for import validation and coverage work.
-- This migration intentionally does not alter, rename, copy into, or replace erg_table_1.
-- Production ERG reads must remain on the current flat schema until normalized imports
-- have complete provenance, coverage, migration, and regression validation.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS erg_norm_source (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  citation TEXT NOT NULL,
  license TEXT,
  source_url TEXT,
  retrieved_at TEXT
);

CREATE TABLE IF NOT EXISTS erg_norm_revision (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES erg_norm_source(id),
  revision_label TEXT NOT NULL,
  published_at TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  checksum TEXT
);

CREATE TABLE IF NOT EXISTS erg_norm_guidebook (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL,
  edition TEXT NOT NULL,
  title TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  source_id TEXT NOT NULL REFERENCES erg_norm_source(id),
  revision_id TEXT NOT NULL REFERENCES erg_norm_revision(id),
  UNIQUE(country_code, edition)
);

CREATE TABLE IF NOT EXISTS erg_norm_material (
  id TEXT PRIMARY KEY,
  preferred_name TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES erg_norm_source(id),
  revision_id TEXT NOT NULL REFERENCES erg_norm_revision(id)
);

CREATE TABLE IF NOT EXISTS erg_norm_un_na_identifier (
  id TEXT PRIMARY KEY,
  identifier_type TEXT NOT NULL CHECK(identifier_type IN ('UN', 'NA')),
  identifier_value TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'USA',
  source_id TEXT NOT NULL REFERENCES erg_norm_source(id),
  revision_id TEXT NOT NULL REFERENCES erg_norm_revision(id),
  UNIQUE(identifier_type, identifier_value, country_code)
);

CREATE TABLE IF NOT EXISTS erg_norm_material_identifier (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES erg_norm_material(id),
  un_na_identifier_id TEXT NOT NULL REFERENCES erg_norm_un_na_identifier(id),
  shipping_name TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  source_id TEXT NOT NULL REFERENCES erg_norm_source(id),
  revision_id TEXT NOT NULL REFERENCES erg_norm_revision(id),
  UNIQUE(material_id, un_na_identifier_id, shipping_name)
);

CREATE TABLE IF NOT EXISTS erg_norm_guide (
  id TEXT PRIMARY KEY,
  guidebook_id TEXT NOT NULL REFERENCES erg_norm_guidebook(id),
  guide_number TEXT NOT NULL,
  title TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES erg_norm_source(id),
  revision_id TEXT NOT NULL REFERENCES erg_norm_revision(id),
  UNIQUE(guidebook_id, guide_number)
);

CREATE TABLE IF NOT EXISTS erg_norm_container (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  source_id TEXT NOT NULL REFERENCES erg_norm_source(id),
  revision_id TEXT NOT NULL REFERENCES erg_norm_revision(id)
);

CREATE TABLE IF NOT EXISTS erg_norm_wind_band (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  minimum_speed_mph REAL,
  maximum_speed_mph REAL,
  source_id TEXT NOT NULL REFERENCES erg_norm_source(id),
  revision_id TEXT NOT NULL REFERENCES erg_norm_revision(id)
);

CREATE TABLE IF NOT EXISTS erg_norm_table_1 (
  id TEXT PRIMARY KEY,
  material_identifier_id TEXT NOT NULL REFERENCES erg_norm_material_identifier(id),
  guide_id TEXT NOT NULL REFERENCES erg_norm_guide(id),
  spill_size TEXT NOT NULL CHECK(spill_size IN ('small', 'large')),
  period TEXT NOT NULL CHECK(period IN ('day', 'night')),
  initial_isolation_ft REAL NOT NULL,
  protective_action_mi REAL NOT NULL,
  tih INTEGER NOT NULL DEFAULT 0,
  source_id TEXT NOT NULL REFERENCES erg_norm_source(id),
  revision_id TEXT NOT NULL REFERENCES erg_norm_revision(id),
  UNIQUE(material_identifier_id, spill_size, period, revision_id)
);

CREATE TABLE IF NOT EXISTS erg_norm_table_2 (
  id TEXT PRIMARY KEY,
  material_identifier_id TEXT NOT NULL REFERENCES erg_norm_material_identifier(id),
  toxic_gas_produced TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES erg_norm_source(id),
  revision_id TEXT NOT NULL REFERENCES erg_norm_revision(id),
  UNIQUE(material_identifier_id, toxic_gas_produced, revision_id)
);

CREATE TABLE IF NOT EXISTS erg_norm_table_3 (
  id TEXT PRIMARY KEY,
  material_identifier_id TEXT NOT NULL REFERENCES erg_norm_material_identifier(id),
  container_id TEXT NOT NULL REFERENCES erg_norm_container(id),
  wind_band_id TEXT NOT NULL REFERENCES erg_norm_wind_band(id),
  period TEXT NOT NULL CHECK(period IN ('day', 'night')),
  initial_isolation_ft REAL NOT NULL,
  protective_action_mi REAL NOT NULL,
  source_id TEXT NOT NULL REFERENCES erg_norm_source(id),
  revision_id TEXT NOT NULL REFERENCES erg_norm_revision(id),
  UNIQUE(material_identifier_id, container_id, wind_band_id, period, revision_id)
);

CREATE INDEX IF NOT EXISTS idx_erg_norm_material_identifier_material
  ON erg_norm_material_identifier(material_id);
CREATE INDEX IF NOT EXISTS idx_erg_norm_material_identifier_un_na
  ON erg_norm_material_identifier(un_na_identifier_id);
CREATE INDEX IF NOT EXISTS idx_erg_norm_table_1_identifier
  ON erg_norm_table_1(material_identifier_id);
CREATE INDEX IF NOT EXISTS idx_erg_norm_table_3_identifier
  ON erg_norm_table_3(material_identifier_id);
