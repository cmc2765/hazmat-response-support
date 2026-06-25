#!/usr/bin/env node
// CAMEO Chemicals → JSON pipeline stub. Real impl lives in M1.

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "..", "public", "data", "cameo.json");
if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });

writeFileSync(outPath, JSON.stringify({ version: "0.0.0-stub", chemicals: [] }, null, 2));
console.log(`[cameo] wrote ${outPath}`);
