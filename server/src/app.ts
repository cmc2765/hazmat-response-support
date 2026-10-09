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
import type { Context } from "hono";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import { asc, eq, inArray, or, sql } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, PDFTextField } from "pdf-lib";
import { getDb } from "./db.js";
import * as schema from "./schema.js";
import { NIOSH_IDENTITY_STATUS, queryChemicalProfile, searchCompanionChemicals } from "./chemical-companion.js";
import { reviewedSourceLinksForMaster } from "./chemical-companion/reviewed-source-links.js";
import { runPlume } from "../../src/lib/model/plume.js";
import { PlumeInputs } from "../../src/lib/schema/plume.js";
import { aeglThresholdBands, selectVerifiedAeglEndpoint } from "../../src/lib/model/plume-endpoints.js";
import { determinePlumeStatus } from "../../src/lib/model/plume-status.js";
import { PLUME_MODEL_MODES, plumeModelModeLabel } from "../../src/lib/model/plumeModelModes.js";
import { selectPlumeModelFamily } from "../../src/lib/model/plumeModelSelector.js";
import { validatePlumeWeather } from "../../src/lib/model/plumeWeatherValidation.js";
import { validateSourceStrength } from "../../src/lib/model/sourceStrengthValidation.js";
import { ERG_TABLE_1, getErgAdditionalTables, getErgContainerDistances } from "../../src/data/erg.js";
import { molecularWeightOf } from "../../src/data/molecular-weight.js";
import { searchStarterHazards } from "../../src/lib/hazard-id/hazardSearch.js";
import { starterHazardProfile } from "../../src/lib/hazard-id/hazardProfileAdapter.js";
import type { HazardIdLane } from "../../src/lib/hazard-id/hazardTypes.js";
import { lookupCriticalInfrastructure, type ThreatZoneFeature } from "./critical-infrastructure.js";
import { findTier2FacilitiesInBounds, TIER2_SOURCE_SYSTEM, validateMapBounds } from "./tier2/importer.js";
import { tier2ChildCounts } from "./tier2/verify-links.js";
import { queryFirms } from "./wildfire/firms.js";
import { queryHms } from "./wildfire/hms.js";
import { queryWfigs } from "./wildfire/wfigs.js";
import { parseMapBounds } from "./wildfire/types.js";
import { queryWeatherFlood, queryWeatherWind } from "./weather/providers.js";

const planningModelMode = PLUME_MODEL_MODES.HAZMATIQ_PLANNING_ESTIMATE;
const ergModelMode = PLUME_MODEL_MODES.ERG_ISOLATION_PROTECTIVE_ACTION_OVERLAY;

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

type CanonicalChemicalRow = typeof schema.chemicals.$inferSelect;

function parsedStringList(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(String).map((item) => item.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function parsedSourceNames(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => typeof item === "string" ? item : String(item?.source ?? ""))
      .map((item) => item.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function resolveCanonicalChemical(
  chemicalRows: CanonicalChemicalRow[],
  companionCas: string,
  companionUn: string,
): CanonicalChemicalRow | null {
  const casMatches = chemicalRows.filter((row) => parsedStringList(row.cas).includes(companionCas));
  if (casMatches.length === 1) return casMatches[0];
  const normalizedUn = companionUn.replace(/^(?:UN|NA)\s*/i, "").trim();
  if (normalizedUn) {
    const transportMatch = casMatches.find((row) => parsedStringList(row.un).includes(normalizedUn)
      || parsedStringList(row.na).includes(normalizedUn));
    if (transportMatch) return transportMatch;
  }
  return null;
}

function plumeBlockedFields(display = "Cannot Plot — Missing Required Data") {
  return {
    modelMode: PLUME_MODEL_MODES.BLOCKED_MISSING_REQUIRED_DATA,
    modelModeLabel: display,
    confidenceLevel: "Insufficient Data",
  };
}

const app = new Hono();
app.use(logger());
const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = path.join(serverDirectory, "public");
const publicIndexPath = path.join(publicDirectory, "index.html");
const serveHazardIdWorkspace = async (c: Context) =>
  c.html(await readFile(publicIndexPath, "utf8"));
app.get("/hazard-id", serveHazardIdWorkspace);
app.get("/chemical-id", serveHazardIdWorkspace);
app.use("/*", serveStatic({ root: publicDirectory }));

function backendEnvironment(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

function enabledEnvironment(...names: string[]) {
  return /^(1|true|yes|on)$/i.test(backendEnvironment(...names));
}

function radarProviderConfiguration() {
  const configured = backendEnvironment("ENABLE_RAINVIEWER_RADAR", "VITE_ENABLE_RAINVIEWER_RADAR");
  // RainViewer supplies the animated visual frame stack used by the Weather
  // workspace. Keep an explicit environment opt-out for deployments that
  // require the official NOAA fallback only.
  const rainViewerEnabled = configured ? enabledEnvironment("ENABLE_RAINVIEWER_RADAR", "VITE_ENABLE_RAINVIEWER_RADAR") : true;
  return { rainViewerEnabled };
}

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

function incidentChemicalProfile(incident: Record<string, unknown>) {
  const profile = incident.chemicalProfile;
  return profile && typeof profile === "object" && !Array.isArray(profile)
    ? (profile as Record<string, unknown>)
    : {};
}

function profileSection(profile: Record<string, unknown>, key: string) {
  const section = profile[key];
  return section && typeof section === "object" && !Array.isArray(section)
    ? (section as Record<string, unknown>)
    : {};
}

function profileText(value: unknown, limit = 1400): string {
  const unavailable = /^(not available|not established|n\/a)$/i;
  const values = Array.isArray(value)
    ? value.flatMap((item) => profileText(item, limit)).filter(Boolean)
    : value && typeof value === "object"
      ? Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
          const text = profileText(item, limit);
          return text ? `${key.replace(/([a-z])([A-Z0-9])/g, "$1 $2")}: ${text}` : [];
        })
      : [textValue(value)].filter((text) => text && !unavailable.test(text));
  return values.join("; ").slice(0, limit);
}

function chemicalIdentityForIcs(incident: Record<string, unknown>) {
  const profile = incidentChemicalProfile(incident);
  const header = profileSection(profile, "header");
  return [
    header.name || incident.chemicalName,
    header.cas && `CAS ${profileText(header.cas)}`,
    header.un && `UN/NA ${profileText(header.un)}`,
    header.ergGuide && `ERG ${profileText(header.ergGuide)}`,
    header.idlh && `IDLH ${profileText(header.idlh)}`,
    header.hazard,
  ].map((value) => profileText(value)).filter(Boolean).join(" · ");
}

function chemicalSafetyForIcs(incident: Record<string, unknown>) {
  const profile = incidentChemicalProfile(incident);
  const exposure = profileSection(profile, "exposures");
  const reactivity = profileSection(profile, "reactivity");
  const fire = profileSection(profile, "fire");
  const isolation = profileSection(profile, "isolationErg");
  return [
    chemicalIdentityForIcs(incident),
    profileText(exposure.symptoms) && `Symptoms: ${profileText(exposure.symptoms, 400)}`,
    profileText(reactivity.incompatibilities) && `Incompatibilities: ${profileText(reactivity.incompatibilities, 400)}`,
    profileText(fire.firefightingPrecautions) && `Fire: ${profileText(fire.firefightingPrecautions, 400)}`,
    profileText(isolation.protectiveActionDistance) && `Isolation/PAD: ${profileText(isolation.protectiveActionDistance, 400)}`,
  ].filter(Boolean).join("\n").slice(0, 1800);
}

function chemicalMitigationsForIcs(incident: Record<string, unknown>) {
  const profile = incidentChemicalProfile(incident);
  const ppe = profileSection(profile, "ppeRespiratory");
  const decon = profileSection(profile, "decon");
  const medical = profileSection(profile, "medical");
  return [
    profileText(ppe.bestMatch) && `PPE best match: ${profileText(ppe.bestMatch)}`,
    profileText(ppe.respiratorRecommendations) && `Respiratory: ${profileText(ppe.respiratorRecommendations, 450)}`,
    profileText(decon.preferredMethod) && `Decon: ${profileText(decon.preferredMethod, 350)}`,
    profileText(decon.patientVictimDecon) && `Patient decon: ${profileText(decon.patientVictimDecon, 500)}`,
    profileText(decon.runoffContainment) && `Runoff: ${profileText(decon.runoffContainment, 300)}`,
    profileText(medical.firstAid) && `First aid: ${profileText(medical.firstAid, 450)}`,
  ].filter(Boolean).join("\n").slice(0, 1800);
}

function automaticIcsValue(fieldName: string, incident: Record<string, unknown>) {
  const normalized = fieldName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const profile = incidentChemicalProfile(incident);
  const properties = profileSection(profile, "properties");
  const exposures = profileSection(profile, "exposures");
  const detectors = profileSection(profile, "detectors");
  const medical = profileSection(profile, "medical");
  if (/^(1)?incidentname\d*$/.test(normalized)) return textValue(incident.incidentName);
  if (/^(2)?incidentnumber\d*$/.test(normalized)) return textValue(incident.incidentNumber);
  if (normalized === "datefrom") return textValue(incident.startDate);
  if (normalized === "timefrom") return textValue(incident.startTime);
  if (normalized === "dateto") return textValue(incident.completedDate);
  if (normalized === "timeto") return textValue(incident.completedTime);
  if (normalized === "incidentobjectives" || normalized.includes("objectives")) return textValue(incident.objectives);
  if (normalized === "commandstructure" || normalized.includes("commandstructure")) return textValue(incident.commandStructure);
  if (normalized === "communications" || normalized.includes("communicationsplan")) return textValue(incident.communications);
  if (normalized === "medicalplan" || normalized.includes("medicalplan")) return textValue(incident.medicalPlan);
  if (normalized === "stagingresources" || normalized.includes("staging") || normalized.includes("resourceassignment")) return textValue(incident.stagingResources);
  if (normalized.includes("incidentlocation")) {
    return [incident.facilityName, incident.address, incident.city, incident.state, incident.zip]
      .map(textValue)
      .filter(Boolean)
      .join(", ");
  }
  if (normalized === "weather" || normalized.includes("weatherconcerns")) {
    return [
      incident.weather,
      incident.windSpeed && `Wind ${textValue(incident.windSpeed)} mph`,
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
      chemicalIdentityForIcs(incident),
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
      chemicalSafetyForIcs(incident),
      incidentContainerSummary(incident, true),
      incident.address,
      incident.weather,
    ]
      .map(textValue)
      .filter(Boolean)
      .join(" · ");
  }
  if (normalized.startsWith("3safetymessage")) {
    return chemicalMitigationsForIcs(incident) || chemicalSafetyForIcs(incident);
  }
  if (normalized === "idlhrow1") return profileText(exposures.idlh || incident.idlh);
  if (normalized === "physstaterow1") return profileText(properties.physicalState);
  if (normalized === "fprow1") return profileText(properties.flashPoint);
  if (normalized === "itrow1") return profileText(properties.ignitionTemperature);
  if (normalized === "vprow1") return profileText(properties.vaporPressure);
  if (normalized === "vdrow1") return profileText(properties.vaporDensity);
  if (normalized === "sgrow1") return profileText(properties.specificGravity);
  if (normalized === "lelrow1") return profileText(properties.lelUel).split("/")[0]?.trim() || "";
  if (normalized === "uelrow1") return profileText(properties.lelUel).split("/")[1]?.trim() || "";
  if (normalized === "20lelinstruments") return profileText(detectors.lelMeterRelevance || detectors.items, 700);
  if (normalized === "22toxicityppminstruments") return profileText(detectors.items, 700);
  if (normalized === "specialmedicalemergencyprocedures") {
    return [profileText(medical.firstAid), profileText(medical.treatmentNotes), profileText(medical.antidotes)]
      .filter(Boolean).join("\n").slice(0, 1800);
  }
  if (/^6hazardsrisksrow1$/.test(normalized)) return chemicalSafetyForIcs(incident);
  if (/^7mitigationsrow1$/.test(normalized)) return chemicalMitigationsForIcs(incident);
  if (normalized === "33emergencyprocedures") {
    return [chemicalSafetyForIcs(incident), chemicalMitigationsForIcs(incident)].filter(Boolean).join("\n").slice(0, 1800);
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
app.get("/api/hazards/search", (c) => {
  const lane = c.req.query("lane") as HazardIdLane | undefined;
  const query = c.req.query("q") ?? "";
  if (lane !== "CBRNE_CWA" && lane !== "RADIOLOGICAL") {
    return c.json({ error: "lane must be CBRNE_CWA or RADIOLOGICAL", results: [] }, 400);
  }
  return c.json({ lane, results: searchStarterHazards(lane, query) });
});

app.get("/api/hazards/:lane/:id/profile", (c) => {
  const lane = c.req.param("lane") as HazardIdLane;
  if (lane !== "CBRNE_CWA" && lane !== "RADIOLOGICAL") {
    return c.json({ error: "Chemical profiles use the existing Chemical Companion endpoint" }, 400);
  }
  const profile = starterHazardProfile(lane, c.req.param("id"));
  return profile ? c.json(profile) : c.json({ error: "not found" }, 404);
});

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

app.get("/api/chemicals/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ chemicals: [] });
  return c.json({ chemicals: searchCompanionChemicals(q) });
});

app.get("/api/chemicals/:id/profile", async (c) => {
  c.header("Cache-Control", "no-store");
  const id = c.req.param("id");
  if (!/^\d+$/.test(id)) return c.json({ error: "ChemicalID must be a positive integer" }, 400);
  const profile = queryChemicalProfile(id);
  if (!profile) return c.json({ error: "not found" }, 404);
  const ergTable1 = ERG_TABLE_1.find((entry) =>
    entry.un === profile.header.un
    && entry.guide.replace(/P$/i, "") === profile.header.ergGuide.replace(/P$/i, ""),
  );
  const ergTable2 = ergTable1 ? getErgAdditionalTables(ergTable1) : [];
  const ergTable3 = getErgContainerDistances(profile.header.un);
  const reviewedLinks = reviewedSourceLinksForMaster(Number(id)).map((link) => ({
    ...link,
    sourceVersion: link.sourceName === "ERG" ? "2024 repository dataset" : "Reviewed local source link",
  }));
  const nioshLink = profile.niosh?.status === NIOSH_IDENTITY_STATUS.VERIFIED_NIOSH
    && profile.niosh.sourceRecordId
    ? {
      sourceName: "NIOSH",
      sourceRecordId: profile.niosh.sourceRecordId,
      sourceIdentifierType: "CAS",
      sourceIdentifierValue: profile.niosh.sourceCas,
      matchBasis: "Canonical CAS number",
      reviewStatus: "verified",
      sourceVersion: "Bundled NIOSH Pocket Guide-derived dataset (Lucas et al., 2024)",
    }
    : null;
  const sourceLinks: Array<Record<string, unknown>> = [
    ...reviewedLinks,
    ...(nioshLink ? [nioshLink] : []),
  ];
  if (!sourceLinks.some((link) => link.sourceName === "ERG")) {
    sourceLinks.push({
      sourceName: "ERG",
      sourceRecordId: profile.header.un || null,
      sourceIdentifierType: "UN/NA",
      sourceIdentifierValue: profile.header.un || null,
      matchBasis: "Chemical Companion master record fields",
      reviewStatus: ergTable1 ? "source-displayed" : "needs review",
      sourceVersion: "2024 repository dataset",
    });
  }
  return c.json({
    id,
    selectedChemicalId: Number(id),
    masterRecord: {
      sourceName: "Chemical Companion",
      sourceRecordId: id,
      sourceStatus: "Imported Source",
      reviewStatus: "master-record",
    },
    sourceLinks,
    ...profile,
    isolationErg: {
      ...profile.isolationErg,
      ergTable1: ergTable1 ? [ergTable1] : [],
      ergTable2,
      ergTable3,
    },
  });
});

app.get("/api/chemicals/:id", async (c) => {
  const id = c.req.param("id");
  const profile = queryChemicalProfile(id);
  if (profile) {
    return c.json({
      id,
      selectedChemicalId: Number(id),
      ChemicalID: Number(id),
      ChemicalName: profile.header.name,
      name: profile.header.name,
      cas: profile.header.cas,
      un: profile.header.un,
      ergGuide: profile.header.ergGuide,
      hazardClass: [profile.header.hazard],
    });
  }

  const db = getDb();
  const rows = await db.select().from(schema.chemicals).where(eq(schema.chemicals.id, id));
  if (rows.length === 0) return c.json({ error: "not found" }, 404);
  return c.json(rows[0]);
});

// ─── NPG ────────────────────────────────────────────────────────────────
app.get("/api/npg", async (c) => {
  const db = getDb();
  const rawLimit = c.req.query("limit");
  const rawOffset = c.req.query("offset");
  const limit = rawLimit == null ? 100 : Number(rawLimit);
  const offset = rawOffset == null ? 0 : Number(rawOffset);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    return c.json({ error: "limit must be an integer from 1 to 500" }, 400);
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    return c.json({ error: "offset must be a non-negative integer" }, 400);
  }

  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(schema.npgRecords);
  const records = await db.select().from(schema.npgRecords)
    .orderBy(asc(schema.npgRecords.id))
    .limit(limit)
    .offset(offset);
  return c.json({
    records,
    total,
    count: records.length,
    offset,
    limit,
    hasMore: offset + records.length < total,
  });
});

app.get("/api/npg/:id", async (c) => {
  const id = c.req.param("id");
  if (/^\d+$/.test(id)) return c.json({ error: "NPG source record IDs are separate from Chemical Companion IDs" }, 404);
  const db = getDb();
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
  return c.json({ ...row, additionalTables: getErgAdditionalTables({
    ...row,
    smallProtectiveDayMi: Number(row.smallProtectiveDayMi),
    largeProtectiveDayMi: Number(row.largeProtectiveDayMi),
    smallProtectiveNightMi: Number(row.smallProtectiveNightMi),
    largeProtectiveNightMi: Number(row.largeProtectiveNightMi),
    isWaterReactive: Boolean(row.isWaterReactive),
    tih: Boolean(row.tih),
    waterReactiveName: row.waterReactiveName || undefined,
  }), containerSpecificDistances: getErgContainerDistances(row.un) });
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
app.get("/api/plume/availability", async (c) => {
  const masterChemicalId = c.req.query("chemicalId")?.trim() || "";
  const companionProfile = /^\d+$/.test(masterChemicalId)
    ? queryChemicalProfile(masterChemicalId)
    : null;
  const companionCas = companionProfile?.header.cas?.trim() || "";
  if (!companionProfile || !companionCas) {
    return c.json({
      error: "Chemical-specific plume guidance requires a verified Chemical Companion master link and CAS number.",
      display: "No Current Data Exists",
      modelMode: PLUME_MODEL_MODES.NO_CURRENT_DATA_EXISTS,
      modelModeLabel: plumeModelModeLabel(PLUME_MODEL_MODES.NO_CURRENT_DATA_EXISTS),
    }, 422);
  }

  const db = getDb();
  const chemicalRows = await db.select().from(schema.chemicals);
  const canonicalChemical = resolveCanonicalChemical(
    chemicalRows,
    companionCas,
    companionProfile.header.un?.trim() || "",
  );
  if (!canonicalChemical) {
    return c.json({
      error: "Chemical Companion record has no verified canonical chemical/CAS link for plume modeling.",
      display: "No Current Data Exists",
      modelMode: PLUME_MODEL_MODES.NO_CURRENT_DATA_EXISTS,
      modelModeLabel: plumeModelModeLabel(PLUME_MODEL_MODES.NO_CURRENT_DATA_EXISTS),
    }, 422);
  }

  const requestedDurationValue = Number(c.req.query("endpointDurationMinutes"));
  const requestedDuration = ([10, 30, 60, 240, 480] as const)
    .find((duration) => duration === requestedDurationValue) ?? 60;
  const canonicalUns = parsedStringList(canonicalChemical.un);
  const ergRows = (await Promise.all(canonicalUns.map((un) =>
    db.select().from(schema.ergTable1).where(eq(schema.ergTable1.un, un))))).flat();
  const canonicalGuide = String(canonicalChemical.ergGuide || "").replace(/P$/i, "");
  const ergRow = ergRows.find((row) => row.guide.replace(/P$/i, "") === canonicalGuide)
    ?? ergRows[0];
  const endpoint = selectVerifiedAeglEndpoint(canonicalChemical.id, companionCas, requestedDuration, masterChemicalId);
  if (endpoint) {
    const sources = parsedSourceNames(canonicalChemical.sources);
    return c.json({
      mode: "aegl-plume",
      display: "AEGL / LOC Plume Model",
      modelMode: planningModelMode,
      modelModeLabel: plumeModelModeLabel(planningModelMode),
      endpointStatus: "Source-backed AEGL / LOC endpoint available; complete release and weather inputs are required.",
      masterChemicalId,
      chemicalIdentity: {
        chemicalName: companionProfile.header.name,
        casNumber: companionCas,
        sourceStatus: "Verified Chemical Companion Master Record",
      },
      endpoint,
      ergAvailability: ergRow ? { status: "Found", un: ergRow.un, guide: ergRow.guide } : { status: "Missing" },
      sourceLinks: {
        chemicalCompanion: { status: "Verified", recordId: masterChemicalId },
        aegl: { status: "Verified", source: endpoint.endpointSource, sourceUrl: endpoint.sourceUrlOrCitationKey },
        cameo: { status: sources.some((source) => /CAMEO/i.test(source)) ? "Verified" : "Missing", sourceUrl: canonicalChemical.sdsUrl },
        erg: ergRow ? { status: "Verified", un: ergRow.un, guide: ergRow.guide } : { status: "Missing" },
      },
    });
  }

  if (ergRow) {
    const spillSize = c.req.query("ergSpillSize") === "small" ? "small" : "large";
    const period = c.req.query("ergPeriod") === "day" ? "day" : "night";
    const initialIsolationFt = Number(ergRow[`${spillSize}Initial${period === "day" ? "Day" : "Night"}Ft`]);
    const protectiveActionMi = Number(ergRow[`${spillSize}Protective${period === "day" ? "Day" : "Night"}Mi`]);
    if (initialIsolationFt > 0 || protectiveActionMi > 0) {
      return c.json({
        mode: "erg-protective-action",
        display: "ERG Initial Isolation / Protective Action Overlay",
        modelMode: ergModelMode,
        modelModeLabel: plumeModelModeLabel(ergModelMode),
        endpointStatus: "AEGL / LOC unavailable; using bundled ERG distances that require current-PHMSA verification.",
        plumeStatus: "ERG Protective Action Guide",
        modelStatus: "Not a modeled plume",
        validationStatus: "Bundled ERG 2024 data — row-level source reconciliation required",
        masterChemicalId,
        chemicalIdentity: {
          chemicalName: companionProfile.header.name,
          casNumber: companionCas,
          sourceStatus: "Verified Chemical Companion Master Record",
        },
        ergOverlay: {
          un: ergRow.un,
          guide: ergRow.guide,
          materialName: ergRow.name,
          spillSize,
          period,
          initialIsolationFt,
          protectiveActionMi,
          source: "PHMSA Emergency Response Guidebook 2024 Table 1",
          sourceUrl: "https://www.phmsa.dot.gov/training/hazmat/erg/emergency-response-guidebook-erg",
          provenanceStatus: "Requires row-level verification against the current PHMSA ERG",
          limitations: [
            "This is an ERG initial-isolation/protective-action guide overlay, not a dispersion model or toxic concentration contour.",
            "Verify the UN/NA identification, spill size, day/night condition, wind direction, current ERG, field observations, monitoring, agency SOPs, and Incident Command.",
          ],
        },
      });
    }
  }

  return c.json({
    mode: "no-distance-data",
    error: "No Current Data Exists. Establish isolation using agency SOPs, field observations, monitoring, and Incident Command.",
    display: "No Current Data Exists",
    modelMode: PLUME_MODEL_MODES.NO_CURRENT_DATA_EXISTS,
    modelModeLabel: plumeModelModeLabel(PLUME_MODEL_MODES.NO_CURRENT_DATA_EXISTS),
    endpointStatus: "No approved AEGL / LOC or ERG distance data is available.",
  });
});

app.post("/api/plume/run", async (c) => {
  const db = getDb();
  const body = await c.req.json().catch(() => null);
  const parsed = PlumeInputs.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid plume inputs", issues: parsed.error.issues, ...plumeBlockedFields() }, 400);
  }
  const bodyRecord = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const validatedModeRequested = bodyRecord.modelMode === "validated-operational"
    || bodyRecord.validated === true
    || bodyRecord.validationStatus === "Independently validated";
  if (validatedModeRequested) {
    return c.json({
      error: "Cannot mark plume output as independently validated. Published comparison cases, formula documentation, validation tolerances, and limitations are required.",
      display: "No Current Data Exists",
      ...plumeBlockedFields(),
    }, 400);
  }
  if (Object.hasOwn(bodyRecord, "calculationEvidence")) {
    return c.json({
      error: "Calculation evidence is server-controlled and cannot be supplied by a client.",
      ...plumeBlockedFields(),
    }, 400);
  }
  const inputs = parsed.data;

  // A numeric Chemical Companion master ID is required. Transportation-only
  // identifiers and canonical slugs cannot independently establish identity.
  const masterChemicalId = inputs.chemicalId;
  const companionProfile = /^\d+$/.test(masterChemicalId)
    ? queryChemicalProfile(masterChemicalId)
    : null;
  const companionCas = companionProfile?.header.cas?.trim() || "";
  if (!companionProfile || !companionCas) {
    return c.json({
      error: "Chemical-specific plume guidance requires a verified Chemical Companion master link and CAS number.",
      display: "No Current Data Exists",
      modelMode: PLUME_MODEL_MODES.NO_CURRENT_DATA_EXISTS,
      modelModeLabel: plumeModelModeLabel(PLUME_MODEL_MODES.NO_CURRENT_DATA_EXISTS),
      confidenceLevel: "Insufficient Data",
      plumeStatus: determinePlumeStatus({ hasChemicalLink: false, hasAeglEndpoint: false, hasWeather: true, hasReleaseInputs: true }),
    }, 422);
  }

  const chemicalRows = await db.select().from(schema.chemicals);
  const canonicalChemical = resolveCanonicalChemical(
    chemicalRows,
    companionCas,
    companionProfile.header.un?.trim() || "",
  );
  if (!canonicalChemical) {
    return c.json({
      error: "Chemical Companion record has no verified canonical chemical/CAS link for plume modeling.",
      display: "No Current Data Exists",
      modelMode: PLUME_MODEL_MODES.NO_CURRENT_DATA_EXISTS,
      modelModeLabel: plumeModelModeLabel(PLUME_MODEL_MODES.NO_CURRENT_DATA_EXISTS),
      confidenceLevel: "Insufficient Data",
      plumeStatus: determinePlumeStatus({ hasChemicalLink: false, hasAeglEndpoint: false, hasWeather: true, hasReleaseInputs: true }),
    }, 422);
  }

  const endpoint = selectVerifiedAeglEndpoint(
    canonicalChemical.id,
    companionCas,
    inputs.endpointDurationMinutes ?? 60,
    masterChemicalId,
  );
  if (!endpoint) {
    const canonicalUns = (() => {
      try {
        return JSON.parse(String(canonicalChemical.un || "[]")) as string[];
      } catch {
        return [];
      }
    })();
    const ergRows = (await Promise.all(canonicalUns.map((un) =>
      db.select().from(schema.ergTable1).where(eq(schema.ergTable1.un, un))))).flat();
    const canonicalGuide = String(canonicalChemical.ergGuide || "").replace(/P$/i, "");
    const ergRow = ergRows.find((row) => row.guide.replace(/P$/i, "") === canonicalGuide)
      ?? ergRows[0];
    if (ergRow) {
      const spillSize = bodyRecord.ergSpillSize === "small" ? "small" : "large";
      const period = bodyRecord.ergPeriod === "day" ? "day" : "night";
      const initialIsolationFt = Number(ergRow[`${spillSize}Initial${period === "day" ? "Day" : "Night"}Ft`]);
      const protectiveActionMi = Number(ergRow[`${spillSize}Protective${period === "day" ? "Day" : "Night"}Mi`]);
      if (initialIsolationFt > 0 || protectiveActionMi > 0) {
        return c.json({
          id: `erg-overlay-${masterChemicalId}-${Date.now()}`,
          generatedAt: new Date().toISOString(),
          mode: "erg-protective-action",
          display: "ERG Initial Isolation / Protective Action Overlay",
          modelMode: ergModelMode,
          modelModeLabel: plumeModelModeLabel(ergModelMode),
          confidenceLevel: "ERG Protective Action Guide",
          endpointStatus: "AEGL / LOC unavailable; using bundled ERG distances that require current-PHMSA verification.",
          plumeStatus: "ERG Protective Action Guide",
          modelStatus: "Not a modeled plume",
          validationStatus: "Bundled ERG 2024 data — row-level source reconciliation required",
          masterChemicalId,
          releaseScenario: "ERG source-distance lookup; no dispersion source term calculated",
          inputs: {
            chemicalId: canonicalChemical.id,
            windDirDeg: inputs.windDirDeg,
            lat: inputs.lat,
            lng: inputs.lng,
          },
          chemicalIdentity: {
            chemicalName: companionProfile.header.name,
            casNumber: companionCas,
            sourceStatus: "Verified Chemical Companion Master Record",
          },
          chemical: {
            masterChemicalId,
            canonicalChemicalId: canonicalChemical.id,
            chemicalName: companionProfile.header.name,
            casNumber: companionCas,
            identityStatus: "Verified Chemical Companion Master Record",
          },
          sourceStrength: {
            status: "No Current Data Exists",
            sourceStrengthValue: null,
            sourceStrengthUnits: "No Current Data Exists",
            sourceStrengthMethod: "No dispersion calculation — bundled ERG distance lookup requiring current-source verification",
            missingInputs: [],
            sourceStrengthLimitations: ["ERG distances are not calculated from operator-entered source strength."],
          },
          weather: {
            status: Number.isFinite(inputs.windDirDeg) ? "Requires Review" : "Missing Required Inputs",
            freshness: "Time Unknown",
            windDirectionDeg: inputs.windDirDeg,
            usableForPlanning: Number.isFinite(inputs.windDirDeg),
            eligibleForValidatedModel: false,
            limitations: ["ERG overlay orientation uses wind direction; verify current conditions."],
          },
          endpoint: {
            endpointType: "ERG 2024 initial isolation / protective action",
            endpointSource: "PHMSA Emergency Response Guidebook 2024 Table 1",
            endpointStatus: "AEGL / LOC unavailable; bundled ERG distances require current-PHMSA verification.",
          },
          terrain: { status: "Not applied to ERG distance overlay", terrainAppliedToDispersion: false },
          ergOverlay: {
            un: ergRow.un,
            guide: ergRow.guide,
            materialName: ergRow.name,
            spillSize,
            period,
            initialIsolationFt,
            protectiveActionMi,
            source: "PHMSA Emergency Response Guidebook 2024 Table 1",
            sourceUrl: "https://www.phmsa.dot.gov/training/hazmat/erg/emergency-response-guidebook-erg",
            provenanceStatus: "Requires row-level verification against the current PHMSA ERG",
            limitations: [
              "This is an ERG initial-isolation/protective-action guide overlay, not a dispersion model or toxic concentration contour.",
              "Verify the UN/NA identification, spill size, day/night condition, wind direction, current ERG, field observations, monitoring, agency SOPs, and Incident Command.",
            ],
          },
          isopleths: [],
          threatZones: [],
          zones: [],
          mapOverlay: null,
          validation: { validationStatus: "Not a modeled plume", alohaComparisonCasesPassed: false },
          textSummary: `${companionProfile.header.name}: ERG isolation/protective-action overlay displayed because no verified AEGL/LOC endpoint is available. This rectangle is not a concentration plume.`,
          assumptions: [`Operator selected ${spillSize} spill and ${period} condition.`],
          fieldVerificationRequirements: [
            "Verify chemical and UN/NA identity.", "Verify spill size and day/night condition.",
            "Verify wind direction and establish boundaries with field monitoring and Incident Command.",
          ],
          disclaimers: [
            "This is an ERG protective-action guide overlay, not a toxic concentration contour.",
            "Verify with the current ERG, field observations, monitoring, agency SOPs, and Incident Command.",
          ],
        });
      }
    }
    return c.json({
      mode: "no-distance-data",
      error: "No Current Data Exists. Establish isolation using agency SOPs, field observations, monitoring, and Incident Command.",
      display: "No Current Data Exists",
      modelMode: PLUME_MODEL_MODES.NO_CURRENT_DATA_EXISTS,
      modelModeLabel: plumeModelModeLabel(PLUME_MODEL_MODES.NO_CURRENT_DATA_EXISTS),
      confidenceLevel: "Insufficient Data",
      endpointStatus: "No approved AEGL / LOC or ERG distance data is available.",
      plumeStatus: determinePlumeStatus({ hasChemicalLink: true, hasAeglEndpoint: false, hasWeather: true, hasReleaseInputs: true }),
    }, 422);
  }

  if (!Number.isFinite(inputs.lat) || !Number.isFinite(inputs.lng)) {
    return c.json({
      error: "Cannot plot plume without a valid incident or planning location.",
      display: "Cannot Plot — Missing Required Location Data",
      plumeStatus: "Blocked Missing Location",
      ...plumeBlockedFields("Cannot Plot — Missing Required Location Data"),
    }, 422);
  }

  inputs.chemicalId = canonicalChemical.id;
  // Molecular weight is chemical identity data, not an operator override.
  const canonicalMolecularWeight = canonicalChemical.molecularWeight
    ? Number(canonicalChemical.molecularWeight)
    : molecularWeightOf(canonicalChemical.id);
  if (!canonicalMolecularWeight || !Number.isFinite(canonicalMolecularWeight)) {
    return c.json({
      error: "No reviewed molecular weight is available for this chemical.",
      display: "No Current Data Exists",
      ...plumeBlockedFields(),
    }, 422);
  }
  inputs.molecularWeight = canonicalMolecularWeight;

  const thresholds = aeglThresholdBands(endpoint);
  const weather = validatePlumeWeather({
    windSpeedMps: inputs.windSpeedMps,
    windDirectionDeg: inputs.windDirDeg,
    source: typeof bodyRecord.weatherSource === "string" ? bodyRecord.weatherSource : null,
    sourceMode: typeof bodyRecord.weatherSourceMode === "string" ? bodyRecord.weatherSourceMode : null,
    observationTime: typeof bodyRecord.weatherObservationTime === "string" ? bodyRecord.weatherObservationTime : null,
  });
  if (!weather.usableForPlanning) {
    return c.json({
      error: "Cannot plot plume without identified, time-valid weather data and valid wind inputs.",
      display: "Cannot Plot — Missing Required Weather Data",
      weather,
      plumeStatus: determinePlumeStatus({ hasChemicalLink: true, hasAeglEndpoint: true, hasWeather: false, hasReleaseInputs: true }),
      ...plumeBlockedFields("Cannot Plot — Missing Required Weather Data"),
    }, 422);
  }
  const sourceStrength = validateSourceStrength({
    chemicalId: masterChemicalId,
    releaseKind: inputs.releaseKind,
    sourceType: typeof bodyRecord.sourceType === "string" ? bodyRecord.sourceType : null,
    containerType: typeof bodyRecord.containerType === "string" ? bodyRecord.containerType : inputs.containerType,
    containerCapacity: bodyRecord.containerCapacity as string | number | null,
    releaseRateKgPerSec: inputs.releaseRateKgPerSec,
    totalMassKg: inputs.totalMassKg,
    releaseDurationSec: numericValue(bodyRecord.releaseDurationSec),
    evaluationTimeSec: inputs.durationSec,
    phase: typeof bodyRecord.releasePhase === "string" ? bodyRecord.releasePhase : null,
    pressureCondition: typeof bodyRecord.pressureCondition === "string" ? bodyRecord.pressureCondition : null,
    latitude: inputs.lat,
    longitude: inputs.lng,
    weatherAvailable: weather.usableForPlanning,
  });
  const vaporDensityAir = numericValue(companionProfile.properties.vaporDensity);
  const modelSelection = selectPlumeModelFamily({
    releaseKind: inputs.releaseKind,
    sourceType: typeof bodyRecord.sourceType === "string" ? bodyRecord.sourceType : null,
    vaporDensityAir,
  });

  try {
    const result = runPlume(inputs, { thresholds });
    const confidenceLevel = weather.status === "Requires Review" || modelSelection.status === "Requires Review"
      ? "Requires Review"
      : "Planning Only";
    const assumptions = [...new Set([
      ...modelSelection.assumptions,
      "Chemical identity and AEGL endpoint are linked by exact Chemical Companion master record and CAS number.",
      "Constant wind, stability, and roughness are applied across the displayed footprint.",
      "Terrain elevation, buildings, chemical reactions, deposition, and topographic channeling are not calculated.",
    ])];
    const limitations = [...new Set([
      ...result.limitations,
      ...modelSelection.limitations,
      ...sourceStrength.sourceStrengthLimitations,
      ...weather.limitations,
    ])];
    const fieldVerificationRequirements = [
      "Confirm chemical identity, CAS number, release phase, container, and source strength.",
      "Verify wind speed, wind direction, observation source, and observation time at the incident.",
      "Use field monitoring to establish and continuously reassess actual hot, warm, and cold zone boundaries.",
      "Do not use this output alone to downgrade PPE or authorize offensive tactics.",
    ];
    return c.json({
      ...result,
      id: `plume-${masterChemicalId}-${Date.parse(result.computedAt)}`,
      generatedAt: result.computedAt,
      mode: "aegl-plume",
      modelMode: planningModelMode,
      modelModeLabel: plumeModelModeLabel(planningModelMode),
      modelFamily: modelSelection.modelFamily,
      releaseScenario: sourceStrength.releaseScenario,
      chemical: {
        masterChemicalId,
        canonicalChemicalId: canonicalChemical.id,
        chemicalName: companionProfile.header.name,
        casNumber: companionCas,
        identityStatus: "Verified Chemical Companion Master Record",
      },
      sourceStrength,
      weather,
      terrain: {
        status: "Flat-ground assumption",
        elevationM: numericValue(bodyRecord.terrainElevationM),
        terrainAppliedToDispersion: false,
        surfaceRoughness: inputs.surfaceRoughness,
        limitations: ["Elevation and topographic effects are recorded when available but are not applied to dispersion."],
      },
      threatZones: result.isopleths,
      zones: result.isopleths,
      mapOverlay: null,
      validation: {
        validationStatus: "Not independently validated",
        alohaComparisonCasesPassed: false,
        officialAlohaReferenceAvailable: false,
        regressionStatus: "Run automated regression tests before release",
      },
      confidenceLevel,
      assumptions,
      limitations,
      fieldVerificationRequirements,
      disclaimers: [result.disclaimer, "Planning estimate only; verify with official modeling, field monitoring, agency SOPs, and Incident Command."],
      liveMonitoring: {
        configured: false,
        behavior: "Recalculate after a material weather-input change; preserve prior result with timestamps.",
        autoApplyTacticalChanges: false,
      },
      plumeStatus: determinePlumeStatus({
        hasChemicalLink: true,
        hasAeglEndpoint: true,
        hasWeather: true,
        hasReleaseInputs: true,
        validationCasesPassed: false,
      }),
      masterChemicalId,
      chemicalIdentity: {
        chemicalName: companionProfile.header.name,
        casNumber: companionCas,
        sourceStatus: "Verified Chemical Companion Master Record",
      },
      endpoint,
      textSummary: `${companionProfile.header.name} (${companionCas}) — ${sourceStrength.releaseScenario}; ${modelSelection.modelFamily}; EPA AEGL ${endpoint.selectedDurationMinutes}-minute endpoints. Output: ${plumeModelModeLabel(planningModelMode)} (${confidenceLevel}). Verify source strength and weather, and use field monitoring to establish actual boundaries.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "plume calculation blocked";
    const missingRelease = /release rate|total mass|evaluation time/i.test(message);
    return c.json({
      error: message,
      display: "No Current Data Exists",
      ...plumeBlockedFields(),
      plumeStatus: missingRelease
        ? determinePlumeStatus({ hasChemicalLink: true, hasAeglEndpoint: true, hasWeather: true, hasReleaseInputs: false })
        : "Not Independently Validated",
    }, 422);
  }
});

// The optional Tactical 3D renderer receives its browser key from deployment
// configuration; no provider credential is embedded in the static UI bundle.
app.get("/api/map/config", (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({
    googleMapsTileApiKey: process.env.GOOGLE_MAPS_TILE_API_KEY?.trim() ?? "",
  });
});

function wildfireBounds(c: Context) {
  return parseMapBounds({
    west: c.req.query("west"),
    south: c.req.query("south"),
    east: c.req.query("east"),
    north: c.req.query("north"),
  });
}

// Wildfire feeds are proxied server-side so the FIRMS MAP_KEY never reaches browser code.
app.get("/api/wildfire/firms", async (c) => {
  const bounds = wildfireBounds(c);
  if (!bounds) return c.json({ error: "valid west, south, east, and north bounds are required" }, 400);
  const hours = Number(c.req.query("hours") || "24");
  c.header("Cache-Control", "no-store");
  return c.json(await queryFirms(bounds, hours));
});

app.get("/api/wildfire/perimeters", async (c) => {
  const bounds = wildfireBounds(c);
  if (!bounds) return c.json({ error: "valid west, south, east, and north bounds are required" }, 400);
  c.header("Cache-Control", "no-store");
  return c.json(await queryWfigs(bounds));
});

app.get("/api/wildfire/smoke", async (c) => {
  const bounds = wildfireBounds(c);
  if (!bounds) return c.json({ error: "valid west, south, east, and north bounds are required" }, 400);
  c.header("Cache-Control", "no-store");
  return c.json(await queryHms(bounds));
});

app.get("/api/wildfire/status", async (c) => {
  const bounds = wildfireBounds(c);
  if (!bounds) return c.json({ error: "valid west, south, east, and north bounds are required" }, 400);
  c.header("Cache-Control", "no-store");
  const [firms, perimeters, smoke] = await Promise.all([
    queryFirms(bounds),
    queryWfigs(bounds),
    queryHms(bounds),
  ]);
  return c.json({ firms, perimeters, smoke });
});

// Live Map exposes one visual primary and one official fallback.
app.get("/api/radar/providers", (c) => {
  const config = radarProviderConfiguration();
  c.header("Cache-Control", "no-store");
  return c.json({
    defaultProviderId: config.rainViewerEnabled
      ? "RAINVIEWER_VISUAL_PROTOTYPE"
      : "NOAA_MRMS_OFFICIAL_FALLBACK",
    providers: {
      NOAA_MRMS_OFFICIAL_FALLBACK: { status: "Official Fallback", configured: true },
      RAINVIEWER_VISUAL_PROTOTYPE: {
        status: config.rainViewerEnabled ? "Visual Prototype" : "Disabled",
        configured: config.rainViewerEnabled,
      },
    },
  });
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
      "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,visibility,dew_point_2m",
    hourly:
      "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    forecast_days: "2",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    timeformat: "unixtime",
  }).toString();

  const getJson = async (url: string, headers?: Record<string, string>, signal?: AbortSignal) => {
    const response = await fetch(url, { headers, signal });
    if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
    return response.json() as Promise<Record<string, unknown>>;
  };
  const fetchNws = async (signal: AbortSignal) => {
    const headers = { "User-Agent": "HazMatIQ/0.1 (weather support)" };
    const points = await getJson(
      `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
      headers,
      signal,
    );
    const pointProperties = points.properties as Record<string, unknown> | undefined;
    const stationUrl = pointProperties?.observationStations;
    if (typeof stationUrl !== "string") throw new Error("NWS station lookup unavailable");
    const stations = await getJson(stationUrl, headers, signal);
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
          signal,
        );
        const values = observation.properties as Record<string, { value?: unknown }> | undefined;
        const temperature = values?.temperature?.value;
        const relativeHumidity = values?.relativeHumidity?.value;
        const windSpeed = values?.windSpeed?.value;
        const windDirection = values?.windDirection?.value;
        const isComplete =
          typeof temperature === "number" &&
          Number.isFinite(temperature) &&
          typeof relativeHumidity === "number" &&
          Number.isFinite(relativeHumidity) &&
          typeof windSpeed === "number" &&
          Number.isFinite(windSpeed) &&
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

  const openMeteoController = new AbortController();
  const nwsController = new AbortController();
  const openMeteoTimeout = setTimeout(() => openMeteoController.abort(), 8000);
  const nwsTimeout = setTimeout(() => nwsController.abort(), 8000);
  const [openMeteoResult, nwsResult] = await Promise.allSettled([
    getJson(openMeteoUrl.toString(), undefined, openMeteoController.signal),
    fetchNws(nwsController.signal),
  ]);
  clearTimeout(openMeteoTimeout);
  clearTimeout(nwsTimeout);
  const openMeteo = openMeteoResult.status === "fulfilled" ? openMeteoResult.value : null;
  const nws = nwsResult.status === "fulfilled" ? nwsResult.value : null;
  if (!openMeteo && !nws) return c.json({ error: "live weather feeds unavailable" }, 502);
  c.header("Cache-Control", "no-store");
  return c.json({ openMeteo, nws });
});

// NWS active alerts are kept separate from current observations so the
// Weather Intelligence workspace can remain location-driven and incident-free.
app.get("/api/weather/alerts", async (c) => {
  const lat = Number(c.req.query("lat"));
  const lon = Number(c.req.query("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
    return c.json({ error: "valid lat and lon are required" }, 400);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const headers = { "User-Agent": "HazMatIQ/0.1 (weather support)" };
    const getJson = async (url: string) => {
      const response = await fetch(url, { headers, signal: controller.signal });
      if (!response.ok) throw new Error(`NWS alerts request failed (${response.status})`);
      return response.json() as Promise<{ features?: unknown[]; properties?: Record<string, unknown> }>;
    };
    const pointPayload = await getJson(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`);
    let features = Array.isArray(pointPayload.features) ? pointPayload.features : [];
    // The point query can omit a newly issued zone alert while the NWS point
    // metadata is still catching up. Query the forecast zone as a narrow,
    // location-relevant fallback before reporting a clear status.
    if (!features.length) {
      try {
        const point = await getJson(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
        const properties = point.properties || {};
        const zone = typeof properties.forecastZone === "string" ? properties.forecastZone.split("/").pop() : "";
        if (zone) {
          const zonePayload = await getJson(`https://api.weather.gov/alerts/active?zone=${encodeURIComponent(zone)}`);
          features = Array.isArray(zonePayload.features) ? zonePayload.features : [];
        }
      } catch {
        // Keep the successful point response and its transparent empty result.
      }
    }
    const uniqueFeatures = [...new Map(features.map((feature, index) => {
      const item = feature as { id?: string };
      return [item.id || `nws-alert-${index}`, feature] as const;
    })).values()];
    c.header("Cache-Control", "no-store");
    return c.json({ source: "NWS / NOAA", location: { lat, lon }, features: uniqueFeatures, status: "connected", retrievedAt: new Date().toISOString() });
  } catch {
    return c.json({ source: "NWS", features: [], status: "unavailable" }, 502);
  } finally {
    clearTimeout(timeout);
  }
});

function weatherLayerBounds(c: Context) {
  return parseMapBounds({
    west: c.req.query("west"),
    south: c.req.query("south"),
    east: c.req.query("east"),
    north: c.req.query("north"),
  });
}

function boundedWeatherLayer(bounds: ReturnType<typeof weatherLayerBounds>) {
  return bounds && bounds.east - bounds.west <= 24 && bounds.north - bounds.south <= 18 ? bounds : null;
}

app.get("/api/weather/wind", async (c) => {
  const bounds = boundedWeatherLayer(weatherLayerBounds(c));
  const zoom = Number(c.req.query("zoom"));
  if (!bounds) return c.json({ error: "zoom in to load detailed wind vectors" }, 422);
  if (Number.isFinite(zoom) && zoom < 6) return c.json({ error: "zoom in to load detailed wind vectors" }, 422);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    c.header("Cache-Control", "public, max-age=300");
    return c.json(await queryWeatherWind(bounds, controller.signal));
  } catch {
    return c.json({ source: "Open-Meteo", points: [], status: "unavailable", retrievedAt: new Date().toISOString() }, 502);
  } finally {
    clearTimeout(timeout);
  }
});

app.get("/api/hydrology/flood", async (c) => {
  const bounds = boundedWeatherLayer(weatherLayerBounds(c));
  const zoom = Number(c.req.query("zoom"));
  if (!bounds) return c.json({ error: "zoom in to load nearby flood gauges" }, 422);
  if (Number.isFinite(zoom) && zoom < 7) return c.json({ error: "zoom in to load nearby flood gauges" }, 422);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    c.header("Cache-Control", "public, max-age=300");
    return c.json(await queryWeatherFlood(bounds, controller.signal));
  } catch {
    return c.json({ gauges: [], sources: ["NOAA NWPS unavailable", "USGS unavailable"], status: "unavailable", retrievedAt: new Date().toISOString() }, 502);
  } finally {
    clearTimeout(timeout);
  }
});

// ─── Facilities ─────────────────────────────────────────────────────────
function tier2FacilityMapFields(
  row: schema.Tier2FacilityRow,
  counts: { chemicalCount: number; ehsCount: number; contactCount: number } = { chemicalCount: 0, ehsCount: 0, contactCount: 0 },
) {
  return {
    id: row.id,
    sourceFacilityId: row.sourceFacilityId,
    stateFacilityId: row.stateFacilityId,
    facilityName: row.facilityName,
    companyName: row.companyName,
    street: row.street,
    city: row.city,
    county: row.county,
    state: row.state,
    zip: row.zip,
    latitude: row.latitude,
    longitude: row.longitude,
    coordinateSource: row.coordinateSource,
    filingYear: row.filingYear,
    filingType: row.filingType,
    maximumOccupants: row.maximumOccupants,
    manned: row.manned,
    sicCode: row.sicCode,
    naicsCode: row.naicsCode,
    sourceSystem: row.sourceSystem,
    chemicalCount: counts.chemicalCount,
    ehsCount: counts.ehsCount,
    contactCount: counts.contactCount,
  };
}

app.get("/api/tier2/facilities", async (c) => {
  const requestedBounds = {
    west: c.req.query("west"),
    east: c.req.query("east"),
    south: c.req.query("south"),
    north: c.req.query("north"),
  };
  if (Object.values(requestedBounds).some((value) => value == null)) {
    return c.json({ error: "west, east, south, and north map bounds are required" }, 400);
  }
  const bounds = validateMapBounds(requestedBounds);
  if (!bounds) return c.json({ error: "invalid map bounds" }, 400);
  const db = getDb();
  const rows = await findTier2FacilitiesInBounds(db, bounds);
  const sourceFacilityIds = rows.map((row) => row.sourceFacilityId);
  const chemicals = sourceFacilityIds.length
    ? await db.select().from(schema.tier2Chemicals).where(inArray(schema.tier2Chemicals.sourceFacilityId, sourceFacilityIds))
    : [];
  const contacts = sourceFacilityIds.length
    ? await db.select().from(schema.tier2FacilityContacts).where(inArray(schema.tier2FacilityContacts.sourceFacilityId, sourceFacilityIds))
    : [];
  return c.json({
    facilities: rows.map((row) => tier2FacilityMapFields(row, tier2ChildCounts(row, chemicals, contacts))),
    bounds,
    sourceSystem: TIER2_SOURCE_SYSTEM,
  });
});

app.get("/api/tier2/facilities/:id", async (c) => {
  const db = getDb();
  const rows = await db.select().from(schema.tier2Facilities).where(eq(schema.tier2Facilities.id, c.req.param("id")));
  if (!rows.length) return c.json({ error: "not found" }, 404);
  const chemicals = await db.select({
    id: schema.tier2Chemicals.id,
    chemicalName: schema.tier2Chemicals.chemicalName,
    casNumber: schema.tier2Chemicals.casNumber,
    ehsStatus: schema.tier2Chemicals.ehsStatus,
    maximumQuantity: schema.tier2Chemicals.maximumQuantity,
    averageDailyQuantity: schema.tier2Chemicals.averageDailyQuantity,
    maximumAmountLargestContainer: schema.tier2Chemicals.maximumAmountLargestContainer,
    physicalState: schema.tier2Chemicals.physicalState,
    hazardFlags: schema.tier2Chemicals.hazardFlags,
    storageInformation: schema.tier2Chemicals.storageInformation,
  }).from(schema.tier2Chemicals).where(or(
    eq(schema.tier2Chemicals.facilityId, rows[0].id),
    eq(schema.tier2Chemicals.sourceFacilityId, rows[0].sourceFacilityId),
  ));
  const contacts = await db.select({
    id: schema.tier2FacilityContacts.id,
    contactType: schema.tier2FacilityContacts.contactType,
    name: schema.tier2FacilityContacts.name,
    email: schema.tier2FacilityContacts.email,
    phone24Hour: schema.tier2FacilityContacts.phone24Hour,
    workPhone: schema.tier2FacilityContacts.workPhone,
  }).from(schema.tier2FacilityContacts).where(or(
    eq(schema.tier2FacilityContacts.facilityId, rows[0].id),
    eq(schema.tier2FacilityContacts.sourceFacilityId, rows[0].sourceFacilityId),
  ));
  return c.json({
    facility: {
      ...tier2FacilityMapFields(rows[0], { chemicalCount: chemicals.length, ehsCount: chemicals.filter((chemical) => /^(y|yes|true|1)$/i.test(chemical.ehsStatus?.trim() ?? "")).length, contactCount: contacts.length }),
      lastModifiedDate: rows[0].lastModifiedDate,
      firstSubmitDate: rows[0].firstSubmitDate,
      deRegistrationDate: rows[0].deRegistrationDate,
      hasDocuments: rows[0].hasDocuments,
      facilityNote: rows[0].facilityNote,
    },
    chemicals,
    contacts,
  });
});

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

app.post("/api/threat-zones/facilities", async (c) => {
  const body = await c.req.json().catch(() => null) as { zones?: unknown } | null;
  const zones = Array.isArray(body?.zones)
    ? body.zones as ThreatZoneFeature[]
    : Array.isArray((body?.zones as { features?: unknown[] } | undefined)?.features)
      ? (body?.zones as { features: ThreatZoneFeature[] }).features
      : [];
  if (!zones.length || zones.some((zone) => zone?.type !== "Feature" || !zone.geometry)) {
    return c.json({ error: "threat-zone polygon geometry is required", status: "error" }, 400);
  }
  try {
    const result = await lookupCriticalInfrastructure(zones);
    return c.json(result, result.status === "error" ? 502 : 200);
  } catch (error) {
    return c.json({
      status: "error",
      error: error instanceof Error ? error.message : "Threat-zone facility lookup failed",
    }, 502);
  }
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
