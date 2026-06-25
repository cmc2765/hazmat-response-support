#!/usr/bin/env node
// Scripts entrypoint: runs all data pipelines in sequence.
// Real implementations land in M1 / M2b / M4.

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const steps = [
  ["erg",   join(root, "erg", "index.js")],
  ["cameo", join(root, "cameo", "index.js")],
  ["niosh", join(root, "niosh", "index.js")],
  ["tier2", join(root, "tier2", "index.js")],
];

let failed = 0;
for (const [name, script] of steps) {
  console.log(`\n[data] running ${name}`);
  const res = spawnSync("node", [script], { stdio: "inherit" });
  if (res.status !== 0) {
    console.error(`[data] ${name} failed (exit ${res.status})`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`[data] ${failed} pipeline(s) failed`);
  process.exit(1);
}
console.log("\n[data] all pipelines complete");
