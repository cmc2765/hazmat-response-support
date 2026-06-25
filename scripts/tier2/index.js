#!/usr/bin/env node
// Tier II → JSON pipeline stub.
// Real impl (M4) scrapes EPA Tier II Submit, state SERC/LEPC portals,
// and erplan.net; normalizes into the Facility schema.

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "..", "public", "data", "tier2.json");
if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });

writeFileSync(outPath, JSON.stringify({ version: "0.0.0-stub", facilities: [] }, null, 2));
console.log(`[tier2] wrote ${outPath}`);
