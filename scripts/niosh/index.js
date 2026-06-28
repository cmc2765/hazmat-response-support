#!/usr/bin/env node
// NIOSH Pocket Guide bulk ingestion.
//
// Source: supplementary data files from Lucas LK, Whittaker C, Bailer AJ. "An interactive
// data visualization tool for occupational exposure limits." J Occup Environ Hyg.
// 2024;21(1):47-57. doi:10.1080/15459624.2023.2267098. CC BY 4.0 — derived from the NIOSH
// Pocket Guide to Chemical Hazards (U.S. Government work, public domain).
//
// Reads scripts/niosh/source/*.xlsx (sm5537 = exposure limits/identifiers, sm5535 = health
// effect flags), joins them by chemical name, and writes src/data/compact-npg.ts.
// Re-run with: npm run data:niosh

import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, "source");
const OUT_PATH = join(__dirname, "..", "..", "src", "data", "compact-npg.ts");

const CAS_PATTERN = /^\d{2,7}-\d{2}-\d$/;

const ENTITY_REPLACEMENTS = [
  [/&alpha;/gi, "alpha"],
  [/&beta;/gi, "beta"],
  [/&amp;/gi, "&"],
  [/&#230;/gi, "ae"],
  [/&#174;/gi, "(R)"],
  [/alpha;/gi, "alpha"],
  [/beta;/gi, "beta"],
  [/α/g, "alpha"],
  [/β/g, "beta"],
];

function decodeEntities(value) {
  let s = String(value ?? "");
  for (const [pattern, replacement] of ENTITY_REPLACEMENTS) {
    s = s.replace(pattern, replacement);
  }
  return s.replace(/\s+/g, " ").trim();
}

const SUBSCRIPT_DIGITS = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9" };

function normalizeFormula(formula) {
  if (!formula) return undefined;
  return String(formula).replace(/[₀-₉]/g, (d) => SUBSCRIPT_DIGITS[d] ?? d);
}

function slugify(name) {
  return decodeEntities(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isBlank(v) {
  return v === undefined || v === null || v === "" || String(v).trim().toUpperCase() === "NA";
}

function cell(row, n) {
  const v = row.getCell(n).value;
  return v === null || v === undefined ? undefined : v;
}

function formatDuration(minutes) {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n % 60 === 0) return `${n / 60}-hr`;
  return `${n}-min`;
}

function formatLimitPart(label, value, units, durationMin) {
  if (isBlank(value)) return undefined;
  const dur = formatDuration(durationMin);
  return `${value} ${units ?? ""}${dur ? ` (${dur} ${label})` : ` ${label}`}`.replace(/\s+/g, " ").trim();
}

function buildLimitString(row, base) {
  // base column numbers for: Value, total, respirable, Units, Duration, CeilingValue, CeilingUnits,
  // CeilingDuration, StelValue, StelUnits, StelDuration, ExcValue, ExcUnits, ExcDuration
  const parts = [
    formatLimitPart("TWA", cell(row, base), cell(row, base + 3), cell(row, base + 4)),
    formatLimitPart("Ceiling", cell(row, base + 5), cell(row, base + 6), cell(row, base + 7)),
    formatLimitPart("STEL", cell(row, base + 8), cell(row, base + 9), cell(row, base + 10)),
    formatLimitPart("Excursion limit", cell(row, base + 11), cell(row, base + 12), cell(row, base + 13)),
  ].filter(Boolean);
  return parts.length ? parts.join("; ") : undefined;
}

function buildIdlh(row) {
  const value = cell(row, 41);
  const units = cell(row, 42);
  const notes = cell(row, 43);
  if (isBlank(value)) return undefined;
  const base = `${value} ${units ?? ""}`.trim();
  return notes && !isBlank(notes) ? `${base} (${notes})` : base;
}

const TARGET_ORGAN_FLAGS = [
  ["Skin", "Skin"],
  ["Skin_sens", "Skin (sensitizer)"],
  ["S_lung", "Lungs"],
  ["Resp_sens", "Respiratory system (sensitizer)"],
  ["Eye", "Eyes"],
  ["Dart", "Reproductive/developmental system"],
  ["Stot_other", "Other systemic effects"],
  ["S_blood", "Blood"],
  ["S_cardiac", "Cardiovascular system"],
  ["S_nervous", "Nervous system"],
  ["S_liver", "Liver"],
];

const HEALTH_FLAG_COLUMNS = {
  Ca: 3, Skin: 4, Skin_sens: 5, S_lung: 6, Resp_sens: 7, Eye: 8, Dart: 9,
  Stot_other: 10, S_blood: 11, S_cardiac: 12, S_nervous: 13, S_liver: 14,
  Acute: 15, Genotoxicity: 16,
};

function isFlagged(row, colName) {
  const v = cell(row, HEALTH_FLAG_COLUMNS[colName]);
  return typeof v === "string" && v.trim().toLowerCase() === "x";
}

async function readSheet(filename) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(join(SRC_DIR, filename));
  return wb.worksheets[0];
}

async function main() {
  const wsLimits = await readSheet("uoeh_a_2267098_sm5537.xlsx");
  const wsHealth = await readSheet("uoeh_a_2267098_sm5535.xlsx");

  const healthByName = new Map();
  wsHealth.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = decodeEntities(cell(row, 1));
    if (name) healthByName.set(name, row);
  });

  const records = [];
  const seenIds = new Set();
  let skipped = 0;

  wsLimits.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rawName = cell(row, 3);
    if (!rawName) {
      skipped++;
      return;
    }
    const name = decodeEntities(rawName);
    const cas = String(cell(row, 5) ?? "").trim();
    const validCas = CAS_PATTERN.test(cas) ? cas : undefined;

    const rel = buildLimitString(row, 8);
    const pel = buildLimitString(row, 25);
    const idlh = buildIdlh(row);

    if (!validCas && !rel && !pel && !idlh) {
      skipped++;
      return; // no usable data at all — pure noise row
    }

    let id = slugify(name);
    if (!id) {
      skipped++;
      return;
    }
    if (seenIds.has(id)) id = `${id}-${cas || rowNumber}`;
    seenIds.add(id);

    const healthRow = healthByName.get(name);
    const targetOrgans = healthRow
      ? TARGET_ORGAN_FLAGS.filter(([col]) => isFlagged(healthRow, col)).map(([, label]) => label)
      : [];
    const symptoms = [];
    if (healthRow) {
      const basis = cell(healthRow, 2);
      if (basis && !isBlank(basis)) symptoms.push(decodeEntities(basis));
      if (isFlagged(healthRow, "Ca")) symptoms.push("Carcinogen");
      if (isFlagged(healthRow, "Acute")) symptoms.push("Acute toxicity");
      if (isFlagged(healthRow, "Genotoxicity")) symptoms.push("Genotoxic");
    }

    const rtecs = cell(row, 6);
    const formula = normalizeFormula(cell(row, 4));
    const mw = cell(row, 44);

    records.push({
      id,
      name,
      synonyms: [],
      cas: validCas,
      rtecs: rtecs && !isBlank(rtecs) ? String(rtecs).trim() : undefined,
      formula,
      exposureLimits: { pel, rel, idlh },
      physical: mw && !isBlank(mw) ? { mw: String(mw) } : undefined,
      health: targetOrgans.length || symptoms.length ? { symptoms, targetOrgans } : undefined,
    });
  });

  // The npg_records table has a UNIQUE index on cas — dedupe before writing. Some
  // collisions are true duplicate rows in the source (drop the extra); others are
  // legitimate alternate names sharing one CAS (e.g. "Rouge" = iron oxide, "Limestone" =
  // "Marble") — keep the more complete record and preserve the other name as a synonym.
  const byCas = new Map();
  const deduped = [];
  for (const r of records) {
    if (!r.cas) {
      deduped.push(r);
      continue;
    }
    const existing = byCas.get(r.cas);
    if (!existing) {
      byCas.set(r.cas, r);
      deduped.push(r);
      continue;
    }
    if (existing.name.toLowerCase() === r.name.toLowerCase()) continue; // true duplicate row
    const existingScore = Object.values(existing.exposureLimits).filter(Boolean).length;
    const newScore = Object.values(r.exposureLimits).filter(Boolean).length;
    const winner = newScore > existingScore ? r : existing;
    const loser = winner === r ? existing : r;
    if (!winner.synonyms.includes(loser.name)) winner.synonyms.push(loser.name);
    if (winner !== existing) {
      // swap in place: the better record replaces the one already pushed to deduped/byCas
      const idx = deduped.indexOf(existing);
      deduped[idx] = winner;
      byCas.set(r.cas, winner);
    }
  }

  const header = `// Generated by scripts/niosh/index.js — do not edit by hand. Re-run: npm run data:niosh
//
// Source: Lucas LK, Whittaker C, Bailer AJ. "An interactive data visualization tool for
// occupational exposure limits." J Occup Environ Hyg. 2024;21(1):47-57.
// doi:10.1080/15459624.2023.2267098. CC BY 4.0. Derived from the NIOSH Pocket Guide to
// Chemical Hazards (U.S. Government work, public domain, 17 USC §105).

export interface CompactNpgRecord {
  id: string;
  name: string;
  synonyms: string[];
  cas?: string;
  rtecs?: string;
  formula?: string;
  exposureLimits?: { pel?: string; rel?: string; idlh?: string };
  physical?: { mw?: string };
  health?: { symptoms: string[]; targetOrgans: string[] };
}

export const COMPACT_NPG: CompactNpgRecord[] = ${JSON.stringify(deduped, null, 2)};
`;

  writeFileSync(OUT_PATH, header);
  console.log(`[niosh] wrote ${deduped.length} records to ${OUT_PATH} (skipped ${skipped} rows with no usable data, ${records.length - deduped.length} CAS collisions resolved)`);
}

main().catch((err) => {
  console.error("[niosh] failed:", err);
  process.exit(1);
});
