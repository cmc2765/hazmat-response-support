// Run pending Drizzle migrations against SQLite.
// Usage: npm run db:migrate
// For initial setup, use npm run db:init-sqlite instead.

import dotenv from "dotenv";
dotenv.config();

import { getDb } from "./db.js";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const db = getDb();
migrate(db, { migrationsFolder: "./migrations" });
console.log("[migrate] SQLite migrations applied");
process.exit(0);