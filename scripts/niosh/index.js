#!/usr/bin/env node
// NIOSH Pocket Guide → JSON pipeline stub. Real impl lives in M2b.

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "..", "public", "data", "niosh-npg.json");
if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });

writeFileSync(outPath, JSON.stringify({ version: "0.0.0-stub", records: [] }, null, 2));
console.log(`[niosh] wrote ${outPath}`);
