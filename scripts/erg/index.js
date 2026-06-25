#!/usr/bin/env node
// ERG 2024 → JSON pipeline stub.
// Real implementation (M1) downloads the public-domain PHMSA ERG PDF,
// extracts Table 1 / Table 3 / Guides, validates with Zod, and writes
// public/data/erg.json.gz.

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Chemical } from "../shared/schemas.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "..", "public", "data", "erg.json");

if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });

// Placeholder: emit an empty validated array. Real parser lives in M1.
const sample = [];
for (const rec of sample) Chemical.parse(rec);

writeFileSync(outPath, JSON.stringify({ version: "0.0.0-stub", chemicals: [] }, null, 2));
console.log(`[erg] wrote ${outPath}`);
