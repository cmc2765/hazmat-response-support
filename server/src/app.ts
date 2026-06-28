// Hono REST API for the Hazmat Response Support backend.
//
// Routes:
//   GET  /api/manifest            → data version + source metadata
//   GET  /api/chemicals           → list (with ?q= search and ?class= filter)
//   GET  /api/chemicals/:id       → single chemical
//   GET  /api/npg                 → list
//   GET  /api/npg/:id             → single NPG record
//   GET  /api/erg                 → ERG Table 1 entries
//   GET  /api/erg/:un             → ERG entry by UN number
//   GET  /api/thresholds          → all thresholds (or ?chemicalId=)
//   GET  /api/facilities          → list (with ?q= search)
//   GET  /api/facilities/:id      → single facility with chemicals
//   GET  /api/sync/:clientId      → delta since last sync (manifest + changed rows)
//
// Run: npm run dev  (starts on http://localhost:3000)

import { Hono } from "hono";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./db.js";
import * as schema from "./schema.js";
import { runPlume } from "../../src/lib/model/plume.js";
import { PlumeInputs } from "../../src/lib/schema/plume.js";
import type { ThresholdBand } from "../../src/lib/schema/plume.js";

const app = new Hono();
app.use(logger());
app.use("/*", serveStatic({ root: "./public" }));

// ─── Manifest ───────────────────────────────────────────────────────────
app.get("/api/manifest", async (c) => {
  const db = getDb();
  const rows = await db.select().from(schema.dataSources);
  const version = new Date().toISOString().slice(0, 10);
  return c.json({
    version,
    generatedAt: new Date().toISOString(),
    sources: Object.fromEntries(
      rows.map((r) => [r.key, { edition: r.edition, license: r.license, recordCount: r.recordCount }]),
    ),
  });
});

// ─── Chemicals ──────────────────────────────────────────────────────────
app.get("/api/chemicals", async (c) => {
  const db = getDb();
  const q = c.req.query("q");
  const hazClass = c.req.query("class");
  const rows = await db.select().from(schema.chemicals).limit(500);
  const filtered = rows.filter((r) => {
    const hazardClass = JSON.parse(r.hazardClass as unknown as string) as string[];
    if (hazClass && !hazardClass.includes(hazClass)) return false;
    if (!q) return true;
    const n = q.toLowerCase();
    const synonyms = JSON.parse(r.synonyms as unknown as string) as string[];
    const unList = (r.un ? JSON.parse(r.un as unknown as string) as string[] | null : null) ?? [];
    const casList = (r.cas ? JSON.parse(r.cas as unknown as string) as string[] | null : null) ?? [];
    return (
      r.name.toLowerCase().includes(n) ||
      synonyms.some((s) => s.toLowerCase().includes(n)) ||
      unList.some((u) => u.includes(q)) ||
      casList.some((u) => u.includes(q))
    );
  });
  return c.json({ chemicals: filtered });
});

app.get("/api/chemicals/:id", async (c) => {
  const db = getDb();
  const id = c.req.param("id");
  const rows = await db.select().from(schema.chemicals).where(eq(schema.chemicals.id, id));
  if (rows.length === 0) return c.json({ error: "not found" }, 404);
  return c.json(rows[0]);
});

// ─── NPG ────────────────────────────────────────────────────────────────
app.get("/api/npg", async (c) => {
  const db = getDb();
  const rows = await db.select().from(schema.npgRecords).limit(500);
  return c.json({ records: rows });
});

app.get("/api/npg/:id", async (c) => {
  const db = getDb();
  const id = c.req.param("id");
  const rows = await db.select().from(schema.npgRecords).where(eq(schema.npgRecords.id, id));
  if (rows.length === 0) return c.json({ error: "not found" }, 404);
  return c.json(rows[0]);
});

// ─── ERG ────────────────────────────────────────────────────────────────
app.get("/api/erg", async (c) => {
  const db = getDb();
  const rows = await db.select().from(schema.ergTable1);
  return c.json({ entries: rows });
});

app.get("/api/erg/:un", async (c) => {
  const db = getDb();
  const un = c.req.param("un");
  const rows = await db.select().from(schema.ergTable1).where(eq(schema.ergTable1.un, un));
  const guide = c.req.query("guide")?.replace(/P$/i, "");
  const row = guide ? rows.find((entry) => entry.guide.replace(/P$/i, "") === guide) : rows[0];
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

// ─── Thresholds ─────────────────────────────────────────────────────────
app.get("/api/thresholds", async (c) => {
  const db = getDb();
  const chemicalId = c.req.query("chemicalId");
  const rows = chemicalId
    ? await db.select().from(schema.thresholds).where(eq(schema.thresholds.chemicalId, chemicalId))
    : await db.select().from(schema.thresholds);
  return c.json({ thresholds: rows });
});

// ─── Plume model ────────────────────────────────────────────────────────
app.post("/api/plume/run", async (c) => {
  const db = getDb();
  const body = await c.req.json().catch(() => null);
  const parsed = PlumeInputs.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid plume inputs", issues: parsed.error.issues }, 400);
  }
  const inputs = parsed.data;

  if (inputs.molecularWeight === undefined) {
    const chemRows = await db.select().from(schema.chemicals).where(eq(schema.chemicals.id, inputs.chemicalId));
    const mw = chemRows[0]?.molecularWeight;
    if (mw) inputs.molecularWeight = Number(mw);
  }

  const thresholdRows = await db
    .select()
    .from(schema.thresholds)
    .where(eq(schema.thresholds.chemicalId, inputs.chemicalId));
  const thresholds: ThresholdBand[] = thresholdRows.map((r) => ({
    kind: r.kind as ThresholdBand["kind"],
    level: r.level,
    valuePpm: Number(r.valuePpm),
    label: `${r.kind}-${r.level}`,
  }));

  const result = runPlume(inputs, { thresholds });
  return c.json(result);
});

// ─── Facilities ─────────────────────────────────────────────────────────
app.get("/api/facilities", async (c) => {
  const db = getDb();
  const q = c.req.query("q");
  const rows = await db.select().from(schema.facilities);
  const filtered = q
    ? rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()) || r.address.toLowerCase().includes(q.toLowerCase()))
    : rows;
  return c.json({ facilities: filtered });
});

app.get("/api/facilities/:id", async (c) => {
  const db = getDb();
  const id = c.req.param("id");
  const facilityRows = await db.select().from(schema.facilities).where(eq(schema.facilities.id, id));
  if (facilityRows.length === 0) return c.json({ error: "not found" }, 404);
  const chemRows = await db.select().from(schema.facilityChemicals).where(eq(schema.facilityChemicals.facilityId, id));
  return c.json({ ...facilityRows[0], chemicals: chemRows });
});

// ─── Sync (delta since last sync) ───────────────────────────────────────
app.get("/api/sync/:clientId", async (c) => {
  const db = getDb();
  const clientId = c.req.param("clientId");
  const _since = c.req.query("since"); // ISO timestamp (reserved for future delta sync)
  void _since;

  // Update sync state
  await db.insert(schema.syncState).values({ clientId }).onConflictDoUpdate({
    target: schema.syncState.clientId,
    set: { lastSyncAt: sql`(datetime('now'))` },
  });

  const manifest = await db.select().from(schema.dataSources);
  const chemicals = await db.select().from(schema.chemicals);
  const npg = await db.select().from(schema.npgRecords);
  const erg = await db.select().from(schema.ergTable1);
  const thresholds = await db.select().from(schema.thresholds);
  const facilities = await db.select().from(schema.facilities);
  const facilityChemicals = await db.select().from(schema.facilityChemicals);

  return c.json({
    version: new Date().toISOString().slice(0, 10),
    syncedAt: new Date().toISOString(),
    manifest: manifest.map((r) => ({
      key: r.key, edition: r.edition, license: r.license, recordCount: r.recordCount,
    })),
    chemicals,
    npg,
    erg,
    thresholds,
    facilities,
    facilityChemicals,
  });
});

// ─── Health ─────────────────────────────────────────────────────────────
app.get("/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

export default app;
