// Seed the SQLite DB from the bundled TS data.
// Idempotent: upserts every row. Run with: npm run db:seed

import { getDb } from "./db.js";
import * as schema from "./schema.js";
import { eq, sql } from "drizzle-orm";
import { ALL_CHEMICALS } from "../../src/data/all-chemicals.js";
import { NPG } from "../../src/data/npg.js";
import { FACILITIES } from "../../src/data/facilities.js";
import { THRESHOLDS } from "../../src/data/thresholds.js";
import { ERG_TABLE_1 } from "../../src/data/erg.js";
import { MOLECULAR_WEIGHTS } from "../../src/data/molecular-weight.js";

const db = getDb();

async function seed() {
  console.log("[seed] starting…");

  // ─── Chemicals ────────────────────────────────────────────────────────
  for (const c of ALL_CHEMICALS) {
    const mw = MOLECULAR_WEIGHTS[c.id] ? String(MOLECULAR_WEIGHTS[c.id]) : null;
    await db.insert(schema.chemicals).values({
      id: c.id, name: c.name, synonyms: JSON.stringify(c.synonyms ?? []),
      cas: JSON.stringify(c.cas ?? null), un: JSON.stringify(c.un ?? null),
      na: JSON.stringify(c.na ?? null), hazardClass: JSON.stringify(c.hazardClass ?? []),
      packingGroup: JSON.stringify(c.packingGroup ?? null), ergGuide: c.ergGuide ?? null,
      placard: c.placard ?? null, ppe: JSON.stringify(c.ppe ?? []),
      isolation: JSON.stringify(c.isolation ?? {}), firstAid: JSON.stringify(c.firstAid ?? []),
      reactivity: JSON.stringify(c.reactivity ?? []), incompatibilities: JSON.stringify(c.incompatibilities ?? []),
      sdsUrl: c.sdsUrl ?? null, sources: JSON.stringify(c.sources ?? []),
      molecularWeight: mw,
    }).onConflictDoUpdate({
      target: schema.chemicals.id,
      set: { name: c.name, updatedAt: sql`(datetime('now'))` },
    });
  }
  console.log(`[seed] chemicals: ${ALL_CHEMICALS.length} upserted`);

  // ─── NPG ──────────────────────────────────────────────────────────────
  for (const n of NPG) {
    await db.insert(schema.npgRecords).values({
      id: n.id, name: n.name, synonyms: JSON.stringify(n.synonyms ?? []),
      cas: n.cas ?? null, rtecs: n.rtecs ?? null, formula: n.formula ?? null,
      exposureLimits: JSON.stringify(n.exposureLimits ?? {}),
      physical: JSON.stringify(n.physical ?? {}), health: JSON.stringify(n.health ?? {}),
      ppe: JSON.stringify(n.ppe ?? {}), reactivity: JSON.stringify(n.reactivity ?? {}),
      sources: JSON.stringify(n.sources ?? []),
    }).onConflictDoUpdate({
      target: schema.npgRecords.id,
      set: { name: n.name, updatedAt: sql`(datetime('now'))` },
    });
  }
  console.log(`[seed] npg: ${NPG.length} upserted`);

  // ─── ERG Table 1 — clear + re-insert (auto-increment IDs) ─────────────
  await db.delete(schema.ergTable1);
  for (const e of ERG_TABLE_1) {
    await db.insert(schema.ergTable1).values({
      un: e.un, name: e.name, guide: e.guide,
      smallInitialDayFt: e.smallInitialDayFt,
      smallProtectiveDayMi: String(e.smallProtectiveDayMi),
      largeInitialDayFt: e.largeInitialDayFt,
      largeProtectiveDayMi: String(e.largeProtectiveDayMi),
      smallInitialNightFt: e.smallInitialNightFt ?? 0,
      smallProtectiveNightMi: String(e.smallProtectiveNightMi ?? 0),
      largeInitialNightFt: e.largeInitialNightFt ?? 0,
      largeProtectiveNightMi: String(e.largeProtectiveNightMi ?? 0),
      isWaterReactive: (e.isWaterReactive ?? false) ? 1 : 0,
      waterReactiveName: e.waterReactiveName ?? null,
      tih: (e.tih ?? false) ? 1 : 0,
    });
  }
  console.log(`[seed] erg: ${ERG_TABLE_1.length} inserted`);

  // ─── Thresholds — clear + re-insert ───────────────────────────────────
  await db.delete(schema.thresholds);
  let thCount = 0;
  for (const t of THRESHOLDS) {
    const rows: Array<{ kind: string; level: number; valuePpm: number }> = [];
    if (t.aegl) {
      rows.push({ kind: "AEGL", level: 1, valuePpm: t.aegl["1"] });
      rows.push({ kind: "AEGL", level: 2, valuePpm: t.aegl["2"] });
      rows.push({ kind: "AEGL", level: 3, valuePpm: t.aegl["3"] });
    }
    if (t.erpg) {
      rows.push({ kind: "ERPG", level: 1, valuePpm: t.erpg["1"] });
      rows.push({ kind: "ERPG", level: 2, valuePpm: t.erpg["2"] });
      rows.push({ kind: "ERPG", level: 3, valuePpm: t.erpg["3"] });
    }
    if (t.teel) {
      rows.push({ kind: "TEEL", level: 0, valuePpm: t.teel["0"] });
      rows.push({ kind: "TEEL", level: 1, valuePpm: t.teel["1"] });
      rows.push({ kind: "TEEL", level: 2, valuePpm: t.teel["2"] });
      rows.push({ kind: "TEEL", level: 3, valuePpm: t.teel["3"] });
    }
    for (const r of rows) {
      await db.insert(schema.thresholds).values({
        chemicalId: t.chemicalId, kind: r.kind, level: r.level,
        valuePpm: String(r.valuePpm), notes: t.notes ?? null,
      });
      thCount++;
    }
  }
  console.log(`[seed] thresholds: ${thCount} inserted`);

  // ─── Facilities + facility_chemicals ──────────────────────────────────
  for (const f of FACILITIES) {
    await db.insert(schema.facilities).values({
      id: f.id, name: f.name, address: f.address,
      lat: f.lat != null ? String(f.lat) : null,
      lng: f.lng != null ? String(f.lng) : null,
      dunn: f.dunn ?? null, ehsFlag: f.ehsFlag ? 1 : 0, source: f.source,
      lastUpdated: f.lastUpdated,
    }).onConflictDoUpdate({
      target: schema.facilities.id,
      set: { name: f.name, address: f.address, updatedAt: sql`(datetime('now'))` },
    });
    await db.delete(schema.facilityChemicals).where(eq(schema.facilityChemicals.facilityId, f.id));
    for (const c of f.chemicals) {
      await db.insert(schema.facilityChemicals).values({
        facilityId: f.id, chemicalId: c.chemicalId,
        maxDailyAmountValue: String(c.maxDailyAmount.value),
        maxDailyAmountUnit: c.maxDailyAmount.unit,
        container: c.container ?? null, conditions: c.conditions ?? null,
        lastReportedYear: c.lastReportedYear,
      });
    }
  }
  console.log(`[seed] facilities: ${FACILITIES.length} upserted`);

  // ─── Data sources manifest ────────────────────────────────────────────
  const sources = [
    { key: "erg", edition: "2024", license: "Public Domain (PHMSA)", recordCount: ERG_TABLE_1.length },
    { key: "cameo", edition: "subset-2025-01", license: "Public Domain (NOAA)", recordCount: ALL_CHEMICALS.length },
    { key: "nioshNpg", edition: "2024-10", license: "Public Domain (CDC/NIOSH)", recordCount: NPG.length },
    { key: "tier2", edition: "demo-2024", license: "Public record", recordCount: FACILITIES.length },
    { key: "aeglErpgTeel", edition: "2024", license: "Public domain (EPA, AIHA, DOE)", recordCount: THRESHOLDS.length },
  ];
  for (const s of sources) {
    await db.insert(schema.dataSources).values(s).onConflictDoUpdate({
      target: schema.dataSources.key,
      set: { edition: s.edition, recordCount: s.recordCount, updatedAt: sql`(datetime('now'))` },
    });
  }
  console.log(`[seed] data_sources: ${sources.length} upserted`);

  console.log("[seed] done");
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});