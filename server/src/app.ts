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
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, PDFTextField } from "pdf-lib";
import { getDb } from "./db.js";
import * as schema from "./schema.js";
import { runPlume } from "../../src/lib/model/plume.js";
import { PlumeInputs } from "../../src/lib/schema/plume.js";
import type { ThresholdBand } from "../../src/lib/schema/plume.js";

const app = new Hono();
app.use(logger());
app.use("/*", serveStatic({ root: "./public" }));

const icsFormDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/ics-forms",
);
const icsForms = [
  ["201", "ICS 201 Incident Briefing", "ics-201.pdf"],
  ["202", "ICS 202 Incident Objectives", "ics-202.pdf"],
  ["203", "ICS 203 Organization Assignment List", "ics-203.pdf"],
  ["204", "ICS 204 Assignment List", "ics-204.pdf"],
  ["205", "ICS 205 Communications Plan", "ics-205.pdf"],
  ["205A", "ICS 205A Communications List", "ics-205a.pdf"],
  ["206", "ICS 206 Medical Plan", "ics-206.pdf"],
  ["208", "ICS 208 Safety Message / Plan", "ics-208.pdf"],
  ["208HM", "ICS 208HM Site Safety and Control Plan", "ics-208hm.pdf"],
  ["209", "ICS 209 Incident Status Summary", "ics-209.pdf"],
  ["214", "ICS 214 Activity Log", "ics-214.pdf"],
  ["215", "ICS 215 Operational Planning Worksheet", "ics-215.pdf"],
  ["215A", "ICS 215A IAP Safety Analysis", "ics-215a.pdf"],
] as const;

function getIcsForm(formId: string) {
  return icsForms.find(([id]) => id.toLowerCase() === formId.toLowerCase());
}

function textValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function incidentContainerSummary(incident: Record<string, unknown>, detailed = false) {
  const size = [incident.containerSize, incident.containerSizeUnit]
    .map(textValue)
    .filter(Boolean)
    .join(" ");
  const pressure = [incident.containerPressure, incident.containerPressureUnit]
    .map(textValue)
    .filter(Boolean)
    .join(" ");
  const parts = [
    textValue(incident.containerType),
    size && `Size ${size}`,
    incident.containerFillLevel && `Fill ${textValue(incident.containerFillLevel)}%`,
    pressure && `Pressure ${pressure}`,
  ];
  if (detailed) {
    parts.push(
      !size && incident.containerCapacity
        ? `Capacity ${textValue(incident.containerCapacity)}`
        : "",
      incident.containerPressureProfile
        ? `Pressure profile ${textValue(incident.containerPressureProfile)}`
        : "",
      incident.containerPayloadNotes ? `Payload ${textValue(incident.containerPayloadNotes)}` : "",
      incident.containerModelSource
        ? `Source type ${textValue(incident.containerModelSource)}`
        : "",
      incident.containerCfrReference
        ? `Specification ${textValue(incident.containerCfrReference)}`
        : "",
    );
  }
  return parts.map(textValue).filter(Boolean).join(" · ");
}

function automaticIcsValue(fieldName: string, incident: Record<string, unknown>) {
  const normalized = fieldName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (/^(1)?incidentname\d*$/.test(normalized)) return textValue(incident.incidentName);
  if (/^(2)?incidentnumber\d*$/.test(normalized)) return textValue(incident.incidentNumber);
  if (normalized === "datefrom") return textValue(incident.startDate);
  if (normalized === "timefrom") return textValue(incident.startTime);
  if (normalized === "dateto") return textValue(incident.completedDate);
  if (normalized === "timeto") return textValue(incident.completedTime);
  if (normalized.includes("incidentlocation")) {
    return [incident.facilityName, incident.address, incident.city, incident.state, incident.zip]
      .map(textValue)
      .filter(Boolean)
      .join(", ");
  }
  if (normalized === "weather" || normalized.includes("weatherconcerns")) {
    return [
      incident.weather,
      incident.windSpeed && `Wind ${textValue(incident.windSpeed)}`,
      incident.windDirection,
    ]
      .map(textValue)
      .filter(Boolean)
      .join(" · ");
  }
  if (/^containertyperow1$/.test(normalized)) {
    return incidentContainerSummary(incident, true);
  }
  if (normalized.includes("primarymaterialsorhazards") || /^19materialrow1$/.test(normalized)) {
    return [
      incident.chemicalName,
      incident.unNumber && `UN/NA ${textValue(incident.unNumber)}`,
      incident.quantity,
      incidentContainerSummary(incident),
    ]
      .map(textValue)
      .filter(Boolean)
      .join(" · ");
  }
  if (normalized.startsWith("5situationsummary")) {
    return [
      incident.notes,
      incident.chemicalName,
      incidentContainerSummary(incident, true),
      incident.address,
      incident.weather,
    ]
      .map(textValue)
      .filter(Boolean)
      .join(" · ");
  }
  if (normalized.startsWith("3safetymessage")) {
    const ppe = (incident.ppeSummary as { items?: unknown[] } | undefined)?.items;
    return Array.isArray(ppe) ? ppe.map(textValue).filter(Boolean).join("\n") : "";
  }
  return "";
}

async function loadIcsPdf(formId: string) {
  const definition = getIcsForm(formId);
  if (!definition) return null;
  const pdf = await PDFDocument.load(await readFile(path.join(icsFormDirectory, definition[2])));
  return { definition, pdf };
}

// ─── Manifest ───────────────────────────────────────────────────────────
app.get("/api/manifest", async (c) => {
  const db = getDb();
  const rows = await db.select().from(schema.dataSources);
  const version = new Date().toISOString().slice(0, 10);
  return c.json({
    version,
    generatedAt: new Date().toISOString(),
    sources: Object.fromEntries(
      rows.map((r) => [
        r.key,
        { edition: r.edition, license: r.license, recordCount: r.recordCount },
      ]),
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
    const unList = (r.un ? (JSON.parse(r.un as unknown as string) as string[] | null) : null) ?? [];
    const casList =
      (r.cas ? (JSON.parse(r.cas as unknown as string) as string[] | null) : null) ?? [];
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
    const chemRows = await db
      .select()
      .from(schema.chemicals)
      .where(eq(schema.chemicals.id, inputs.chemicalId));
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

// Proxy live weather so browser CORS rules cannot block plume inputs.
app.get("/api/weather/current", async (c) => {
  const lat = Number(c.req.query("lat"));
  const lon = Number(c.req.query("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon))
    return c.json({ error: "valid lat and lon are required" }, 400);

  const openMeteoUrl = new URL("https://api.open-meteo.com/v1/forecast");
  openMeteoUrl.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
  }).toString();

  const getJson = async (url: string, headers?: Record<string, string>) => {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
    return response.json() as Promise<Record<string, unknown>>;
  };
  const fetchNws = async () => {
    const headers = { "User-Agent": "HazMatIQ/0.1 (weather support)" };
    const points = await getJson(
      `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
      headers,
    );
    const pointProperties = points.properties as Record<string, unknown> | undefined;
    const stationUrl = pointProperties?.observationStations;
    if (typeof stationUrl !== "string") throw new Error("NWS station lookup unavailable");
    const stations = await getJson(stationUrl, headers);
    const features = stations.features as
      | Array<{ properties?: Record<string, unknown> }>
      | undefined;
    for (const feature of features?.slice(0, 8) ?? []) {
      const station = feature.properties;
      const stationId = station?.stationIdentifier;
      if (typeof stationId !== "string") continue;
      try {
        const observation = await getJson(
          `https://api.weather.gov/stations/${encodeURIComponent(stationId)}/observations/latest`,
          headers,
        );
        const values = observation.properties as Record<string, { value?: unknown }> | undefined;
        const temperature = values?.temperature?.value;
        const windSpeed = values?.windSpeed?.value;
        const windDirection = values?.windDirection?.value;
        const isComplete =
          typeof temperature === "number" &&
          Number.isFinite(temperature) &&
          typeof windSpeed === "number" &&
          Number.isFinite(windSpeed) &&
          windSpeed > 0 &&
          typeof windDirection === "number" &&
          Number.isFinite(windDirection);
        if (isComplete)
          return { office: pointProperties?.gridId, station, observation: observation.properties };
      } catch {
        // Try the next-nearest reporting station.
      }
    }
    throw new Error("No nearby NWS station has complete plume weather data");
  };

  const [openMeteoResult, nwsResult] = await Promise.allSettled([
    getJson(openMeteoUrl.toString()),
    fetchNws(),
  ]);
  const openMeteo = openMeteoResult.status === "fulfilled" ? openMeteoResult.value : null;
  const nws = nwsResult.status === "fulfilled" ? nwsResult.value : null;
  if (!openMeteo && !nws) return c.json({ error: "live weather feeds unavailable" }, 502);
  c.header("Cache-Control", "no-store");
  return c.json({ openMeteo, nws });
});

// ─── Facilities ─────────────────────────────────────────────────────────
app.get("/api/facilities", async (c) => {
  const db = getDb();
  const q = c.req.query("q");
  const rows = await db.select().from(schema.facilities);
  const filtered = q
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q.toLowerCase()) ||
          r.address.toLowerCase().includes(q.toLowerCase()),
      )
    : rows;
  return c.json({ facilities: filtered });
});

app.get("/api/facilities/:id", async (c) => {
  const db = getDb();
  const id = c.req.param("id");
  const facilityRows = await db
    .select()
    .from(schema.facilities)
    .where(eq(schema.facilities.id, id));
  if (facilityRows.length === 0) return c.json({ error: "not found" }, 404);
  const chemRows = await db
    .select()
    .from(schema.facilityChemicals)
    .where(eq(schema.facilityChemicals.facilityId, id));
  return c.json({ ...facilityRows[0], chemicals: chemRows });
});

// ─── Incident-owned FEMA ICS form drafts ──────────────────────────────
app.get("/api/ics-forms", (c) =>
  c.json({
    forms: icsForms.map(([id, title]) => ({ id, title })),
  }),
);

app.post("/api/ics-forms/:formId/prepare", async (c) => {
  const loaded = await loadIcsPdf(c.req.param("formId"));
  if (!loaded) return c.json({ error: "ICS form not found" }, 404);
  const incident = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!incident || typeof incident !== "object")
    return c.json({ error: "incident is required" }, 400);
  const savedFields =
    (incident.icsForms as Record<string, { fields?: Record<string, unknown> }> | undefined)?.[
      loaded.definition[0]
    ]?.fields || {};
  const fields = loaded.pdf
    .getForm()
    .getFields()
    .filter((field): field is PDFTextField => field instanceof PDFTextField)
    .map((field) => {
      const saved = textValue(savedFields[field.getName()]);
      const automatic = automaticIcsValue(field.getName(), incident);
      return {
        name: field.getName(),
        value: saved || automatic,
        source: saved ? "manual" : automatic ? "automatic" : "blank",
        multiline: field.isMultiline(),
      };
    });
  return c.json({ id: loaded.definition[0], title: loaded.definition[1], fields });
});

app.post("/api/ics-forms/:formId/pdf", async (c) => {
  const loaded = await loadIcsPdf(c.req.param("formId"));
  if (!loaded) return c.json({ error: "ICS form not found" }, 404);
  const incident = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!incident || typeof incident !== "object")
    return c.json({ error: "incident is required" }, 400);
  const savedFields =
    (incident.icsForms as Record<string, { fields?: Record<string, unknown> }> | undefined)?.[
      loaded.definition[0]
    ]?.fields || {};
  for (const field of loaded.pdf.getForm().getFields()) {
    if (!(field instanceof PDFTextField)) continue;
    const value =
      textValue(savedFields[field.getName()]) || automaticIcsValue(field.getName(), incident);
    if (value) field.setText(value);
  }
  const bytes = await loaded.pdf.save();
  const safeName =
    `${textValue(incident.incidentName) || "incident"}-${loaded.definition[0]}`.replace(
      /[^a-z0-9-]+/gi,
      "-",
    );
  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `inline; filename="${safeName}.pdf"`);
  const body = new Uint8Array(bytes.byteLength);
  body.set(bytes);
  return c.body(body);
});

// ─── Durable incident reports ──────────────────────────────────────────
app.get("/api/incidents", async (c) => {
  const rows = await getDb().select().from(schema.incidents);
  const incidents = rows.flatMap((row) => {
    try {
      return [{ ...JSON.parse(row.report), incidentId: row.id, status: row.status }];
    } catch {
      return [];
    }
  });
  return c.json({ incidents });
});

app.post("/api/incidents", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { incidents?: unknown[] } | null;
  if (!body || !Array.isArray(body.incidents))
    return c.json({ error: "incidents must be an array" }, 400);

  const incidents = body.incidents.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>).incidentId === "string",
  );
  for (const incident of incidents) {
    const id = incident.incidentId as string;
    const status = typeof incident.status === "string" ? incident.status : "Completed";
    await getDb()
      .insert(schema.incidents)
      .values({ id, status, report: JSON.stringify(incident) })
      .onConflictDoUpdate({
        target: schema.incidents.id,
        set: { status, report: JSON.stringify(incident), updatedAt: sql`(datetime('now'))` },
      });
  }
  return c.json({ saved: incidents.length });
});

// ─── Sync (delta since last sync) ───────────────────────────────────────
app.get("/api/sync/:clientId", async (c) => {
  const db = getDb();
  const clientId = c.req.param("clientId");
  const _since = c.req.query("since"); // ISO timestamp (reserved for future delta sync)
  void _since;

  // Update sync state
  await db
    .insert(schema.syncState)
    .values({ clientId })
    .onConflictDoUpdate({
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
      key: r.key,
      edition: r.edition,
      license: r.license,
      recordCount: r.recordCount,
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
