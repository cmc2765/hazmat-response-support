-- Chemical Companion remains the master identity database. These tables store source
-- records and reviewed relationships; they do not copy transport names into a master.
CREATE TABLE IF NOT EXISTS transportation_identifier (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier_type TEXT NOT NULL,
  identifier_value TEXT NOT NULL,
  normalized_identifier_value TEXT NOT NULL,
  proper_shipping_name TEXT,
  hazard_class TEXT,
  packing_group TEXT,
  erg_guide TEXT,
  source TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  source_status TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'requires_review',
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_transport_identifier_value
  ON transportation_identifier(normalized_identifier_value);

CREATE TABLE IF NOT EXISTS chemical_transport_link (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  master_chemical_id INTEGER NOT NULL,
  transportation_identifier_id INTEGER NOT NULL,
  link_type TEXT NOT NULL,
  confidence TEXT,
  review_status TEXT NOT NULL DEFAULT 'requires_review',
  reviewed_by TEXT,
  reviewed_at TEXT,
  notes TEXT,
  UNIQUE(master_chemical_id, transportation_identifier_id)
);
CREATE INDEX IF NOT EXISTS idx_transport_link_master ON chemical_transport_link(master_chemical_id);
CREATE INDEX IF NOT EXISTS idx_transport_link_identifier ON chemical_transport_link(transportation_identifier_id);

CREATE TABLE IF NOT EXISTS chemical_source_link (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  master_chemical_id INTEGER NOT NULL,
  source_name TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  source_identifier_type TEXT,
  source_identifier_value TEXT,
  match_basis TEXT NOT NULL,
  confidence TEXT,
  review_status TEXT NOT NULL DEFAULT 'requires_review',
  source_version TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT,
  UNIQUE(master_chemical_id, source_name, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_source_link_master ON chemical_source_link(master_chemical_id);

CREATE TABLE IF NOT EXISTS chemical_source_fact (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  master_chemical_id INTEGER NOT NULL,
  source_name TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  fact_category TEXT NOT NULL,
  fact_name TEXT NOT NULL,
  fact_value TEXT NOT NULL,
  fact_units TEXT,
  source_status TEXT NOT NULL,
  source_version TEXT,
  limitations TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_source_fact_master ON chemical_source_fact(master_chemical_id);
CREATE INDEX IF NOT EXISTS idx_source_fact_category ON chemical_source_fact(fact_category);
