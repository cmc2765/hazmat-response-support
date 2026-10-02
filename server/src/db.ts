// SQLite database connection — zero-config local dev.
// The DB is a single file at ./local.db (or SQLITE_PATH).
// Back up by copying the file. No server process needed.

import dotenv from "dotenv";
dotenv.config();

import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema.js";
import { reconcileNpgProjection } from "./npg-projection.js";

const SQLITE_PATH = process.env.SQLITE_PATH ?? "./local.db";

export type DbClient = ReturnType<typeof drizzle<typeof schema>>;

let _client: DbClient | null = null;

export function getDb(): DbClient {
  if (_client) return _client;

  const conn = new Database(SQLITE_PATH);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.exec(`
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      report TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
    CREATE TABLE IF NOT EXISTS tier2_facilities (
      id TEXT PRIMARY KEY,
      source_facility_id TEXT NOT NULL,
      state_facility_id TEXT,
      facility_name TEXT,
      company_name TEXT,
      street TEXT,
      city TEXT,
      county TEXT,
      state TEXT,
      zip TEXT,
      latitude REAL,
      longitude REAL,
      coordinate_source TEXT,
      filing_year TEXT,
      filing_type TEXT,
      maximum_occupants INTEGER,
      manned TEXT NOT NULL DEFAULT 'unknown',
      sic_code TEXT,
      naics_code TEXT,
      last_modified_date TEXT,
      first_submit_date TEXT,
      de_registration_date TEXT,
      has_documents INTEGER,
      facility_note TEXT,
      source_system TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      UNIQUE(source_system, source_facility_id)
    );
    CREATE INDEX IF NOT EXISTS idx_tier2_facilities_coordinates ON tier2_facilities(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_tier2_facilities_state ON tier2_facilities(state);
    CREATE TABLE IF NOT EXISTS tier2_chemicals (
      id TEXT PRIMARY KEY,
      facility_id TEXT REFERENCES tier2_facilities(id) ON DELETE CASCADE,
      source_facility_id TEXT NOT NULL,
      chemical_name TEXT,
      cas_number TEXT,
      ehs_status TEXT,
      maximum_quantity TEXT,
      average_daily_quantity TEXT,
      maximum_amount_largest_container TEXT,
      physical_state TEXT,
      hazard_flags TEXT,
      storage_information TEXT,
      source_system TEXT NOT NULL,
      imported_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tier2_facility_contacts (
      id TEXT PRIMARY KEY,
      facility_id TEXT REFERENCES tier2_facilities(id) ON DELETE CASCADE,
      source_facility_id TEXT NOT NULL,
      contact_type TEXT,
      name TEXT,
      email TEXT,
      phone_24_hour TEXT,
      work_phone TEXT,
      source_system TEXT NOT NULL,
      imported_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tier2_contacts_facility ON tier2_facility_contacts(facility_id);
    CREATE INDEX IF NOT EXISTS idx_tier2_contacts_source_facility ON tier2_facility_contacts(source_facility_id);
    CREATE INDEX IF NOT EXISTS idx_tier2_chemicals_source_facility ON tier2_chemicals(source_facility_id);
  `);
  const chemicalColumns = conn.prepare("PRAGMA table_info(tier2_chemicals)").all() as Array<{ name: string }>;
  if (!chemicalColumns.some((column) => column.name === "facility_id")) {
    conn.exec("ALTER TABLE tier2_chemicals ADD COLUMN facility_id TEXT REFERENCES tier2_facilities(id) ON DELETE CASCADE");
  }
  const chemicalColumnMigrations: Array<[string, string]> = [
    ["average_daily_quantity", "TEXT"],
    ["maximum_amount_largest_container", "TEXT"],
    ["hazard_flags", "TEXT"],
  ];
  for (const [column, type] of chemicalColumnMigrations) {
    const columns = conn.prepare("PRAGMA table_info(tier2_chemicals)").all() as Array<{ name: string }>;
    if (!columns.some((entry) => entry.name === column)) conn.exec(`ALTER TABLE tier2_chemicals ADD COLUMN ${column} ${type}`);
  }
  conn.exec("CREATE INDEX IF NOT EXISTS idx_tier2_chemicals_facility ON tier2_chemicals(facility_id)");
  conn.exec(`
    UPDATE tier2_chemicals
    SET facility_id = (
      SELECT facilities.id
      FROM tier2_facilities AS facilities
      WHERE facilities.source_facility_id = tier2_chemicals.source_facility_id
        AND facilities.source_system = tier2_chemicals.source_system
      LIMIT 1
    )
    WHERE facility_id IS NULL;
  `);
  _client = drizzle(conn, { schema });
  const count = reconcileNpgProjection(_client);
  console.log(`[db] npg projection reconciled: ${count} records`);
  console.log(`[db] SQLite at ${SQLITE_PATH}`);
  return _client;
}

export function getRawConnection(): Database.Database {
  // Used by init-sqlite.ts for raw DDL.
  return new Database(SQLITE_PATH);
}
