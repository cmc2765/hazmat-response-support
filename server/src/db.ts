// SQLite database connection — zero-config local dev.
// The DB is a single file at ./local.db (or SQLITE_PATH).
// Back up by copying the file. No server process needed.

import dotenv from "dotenv";
dotenv.config();

import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema.js";

const SQLITE_PATH = process.env.SQLITE_PATH ?? "./local.db";

export type DbClient = ReturnType<typeof drizzle<typeof schema>>;

let _client: DbClient | null = null;

export function getDb(): DbClient {
  if (_client) return _client;

  const conn = new Database(SQLITE_PATH);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  _client = drizzle(conn, { schema });
  console.log(`[db] SQLite at ${SQLITE_PATH}`);
  return _client;
}

export function getRawConnection(): Database.Database {
  // Used by init-sqlite.ts for raw DDL.
  return new Database(SQLITE_PATH);
}