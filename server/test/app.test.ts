import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { ALL_NPG } from "../../src/data/all-npg.js";
import { NPG } from "../../src/data/npg.js";
import * as schema from "../src/schema.js";

let app: Hono;

function currentManualWeather() {
  return {
    lat: 38.9517,
    lng: -92.3341,
    weatherSourceMode: "manual",
    weatherSource: "Manual Entry",
    weatherObservationTime: new Date().toISOString(),
  };
}

beforeAll(() => {
  const dbPath = path.join(mkdtempSync(path.join(tmpdir(), "hazmat-test-")), "test.db");
  process.env.SQLITE_PATH = dbPath;

  execFileSync("npx", ["tsx", "src/init-sqlite.ts"], {
    cwd: path.resolve(__dirname, ".."),
    env: process.env,
  });
  execFileSync("npx", ["tsx", "src/seed.ts"], {
    cwd: path.resolve(__dirname, ".."),
    env: process.env,
  });
}, 30_000);

describe("API routes", () => {
  it("GET /health", async () => {
    ({ default: app } = await import("../src/app.js"));
    const res = await app.request("/health");
    expect(res.status).toBe(200);
  });

  it("reports radar provider capabilities without exposing credentials", async () => {
    const res = await app.request("/api/radar/providers");
    expect(res.status).toBe(200);
    const body = await res.json() as {
      defaultProviderId: string;
      providers: Record<string, { status: string; configured: boolean }>;
    };
    expect(Object.keys(body.providers).sort()).toEqual([
      "NOAA_MRMS_OFFICIAL_FALLBACK",
      "RAINVIEWER_VISUAL_PROTOTYPE",
    ]);
    expect(body.providers.NOAA_MRMS_OFFICIAL_FALLBACK).toMatchObject({ status: "Official Fallback", configured: true });
    expect(["Disabled", "Visual Prototype"]).toContain(body.providers.RAINVIEWER_VISUAL_PROTOTYPE.status);
    expect(JSON.stringify(body)).not.toMatch(/apiKey|clientSecret|accessToken/i);
  });

  it("GET /api/manifest reports the seeded chemical count", async () => {
    const res = await app.request("/api/manifest");
    const body = (await res.json()) as { sources: { cameo: { recordCount: number } } };
    expect(body.sources.cameo.recordCount).toBeGreaterThan(200);
  });

  it("reconciles the complete canonical NPG projection and manifest", async () => {
    const response = await app.request("/api/npg?limit=200&offset=0");
    expect(response.status).toBe(200);
    const firstPage = await response.json() as {
      records: Array<{ id: string; cas: string | null }>;
      total: number;
      count: number;
      offset: number;
      limit: number;
      hasMore: boolean;
    };
    expect(firstPage).toMatchObject({ total: ALL_NPG.length, count: 200, offset: 0, limit: 200, hasMore: true });

    const records = [...firstPage.records];
    for (let offset = firstPage.count; offset < firstPage.total; offset += firstPage.limit) {
      const pageResponse = await app.request(`/api/npg?limit=${firstPage.limit}&offset=${offset}`);
      expect(pageResponse.status).toBe(200);
      const page = await pageResponse.json() as typeof firstPage;
      records.push(...page.records);
    }

    expect(records).toHaveLength(ALL_NPG.length);
    expect(new Set(records.map((record) => record.id))).toEqual(new Set(ALL_NPG.map((record) => record.id)));
    expect(records.filter((record) => record.cas == null)).toHaveLength(ALL_NPG.filter((record) => !record.cas).length);
    expect(new Set(records.filter((record) => record.cas).map((record) => record.cas)).size)
      .toBe(ALL_NPG.filter((record) => record.cas).length);

    const manifestResponse = await app.request("/api/manifest");
    const manifest = await manifestResponse.json() as { sources: { nioshNpg: { recordCount: number } } };
    expect(manifest.sources.nioshNpg.recordCount).toBe(ALL_NPG.length);
  });

  it("keeps curated and compact-only NPG records addressable by source ID", async () => {
    const compactOnly = ALL_NPG.find((record) => !NPG.some((curated) => curated.id === record.id));
    expect(compactOnly).toBeDefined();

    const compactResponse = await app.request(`/api/npg/${encodeURIComponent(compactOnly!.id)}`);
    expect(compactResponse.status).toBe(200);
    expect(await compactResponse.json()).toMatchObject({ id: compactOnly!.id, cas: compactOnly!.cas ?? null });

    const sulfurDioxideResponse = await app.request("/api/npg/sulfur-dioxide");
    expect(sulfurDioxideResponse.status).toBe(200);
    expect(await sulfurDioxideResponse.json()).toMatchObject({ id: "sulfur-dioxide", name: "Sulfur dioxide", cas: "7446-09-5" });
  });

  it("keeps NPG reconciliation idempotent and isolated from incidents", async () => {
    const incident = {
      incidentId: "npg-reconciliation-incident",
      incidentName: "NPG reconciliation safety check",
      status: "Active",
    };
    const saved = await app.request("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incidents: [incident] }),
    });
    expect(saved.status).toBe(200);

    const { getDb } = await import("../src/db.js");
    const { reconcileNpgProjection } = await import("../src/npg-projection.js");
    const db = getDb();
    await db.insert(schema.npgRecords).values({
      id: "obsolete-npg-test-record",
      name: "Obsolete NPG test record",
      cas: null,
      synonyms: "[]",
      exposureLimits: "{}",
      physical: "{}",
      health: "{}",
      ppe: "{}",
      reactivity: "{}",
      sources: "[]",
    });
    const incidentsBefore = await (await app.request("/api/incidents")).json();
    const projectionBefore = await db.select({ id: schema.npgRecords.id, cas: schema.npgRecords.cas, name: schema.npgRecords.name })
      .from(schema.npgRecords).orderBy(asc(schema.npgRecords.id));

    expect(reconcileNpgProjection(db)).toBe(ALL_NPG.length);
    expect(reconcileNpgProjection(db)).toBe(ALL_NPG.length);

    const projectionAfter = await db.select({ id: schema.npgRecords.id, cas: schema.npgRecords.cas, name: schema.npgRecords.name })
      .from(schema.npgRecords).orderBy(asc(schema.npgRecords.id));
    const completeProjection = await db.select().from(schema.npgRecords);
    const incidentsAfter = await (await app.request("/api/incidents")).json() as { incidents: unknown[] };
    expect(projectionBefore).toHaveLength(ALL_NPG.length + 1);
    expect(new Set(projectionAfter.map((record) => JSON.stringify(record)))).toEqual(new Set(
      ALL_NPG.map((record) => JSON.stringify({ id: record.id, cas: record.cas ?? null, name: record.name })),
    ));
    expect(projectionAfter.some((record) => record.id === "obsolete-npg-test-record")).toBe(false);
    for (const curated of NPG) {
      expect(completeProjection.find((record) => record.id === curated.id)).toMatchObject({
        id: curated.id,
        name: curated.name,
        synonyms: JSON.stringify(curated.synonyms ?? []),
        cas: curated.cas ?? null,
        rtecs: curated.rtecs ?? null,
        formula: curated.formula ?? null,
        exposureLimits: JSON.stringify(curated.exposureLimits ?? {}),
        physical: JSON.stringify(curated.physical ?? {}),
        health: JSON.stringify(curated.health ?? {}),
        ppe: JSON.stringify(curated.ppe ?? {}),
        reactivity: JSON.stringify(curated.reactivity ?? {}),
        sources: JSON.stringify(curated.sources ?? []),
      });
    }
    expect(incidentsAfter).toEqual(incidentsBefore);

    const duplicateCasRows = await db.select({ cas: schema.npgRecords.cas }).from(schema.npgRecords)
      .where(eq(schema.npgRecords.cas, "7446-09-5"));
    expect(duplicateCasRows).toHaveLength(1);
    expect(incidentsAfter.incidents).toContainEqual(expect.objectContaining(incident));
  });

  it("keeps NPG API identifier boundaries and sync completeness", async () => {
    const numericResponse = await app.request("/api/npg/102");
    expect(numericResponse.status).toBe(404);

    const syncResponse = await app.request("/api/sync/npg-reconciliation-client");
    expect(syncResponse.status).toBe(200);
    const sync = await syncResponse.json() as {
      npg: Array<{ id: string }>;
      manifest: Array<{ key: string; recordCount: number }>;
    };
    expect(sync.npg).toHaveLength(ALL_NPG.length);
    expect(sync.manifest.find((source) => source.key === "nioshNpg")?.recordCount).toBe(ALL_NPG.length);
  });

  it("serves Hazard ID and the backward-compatible Chemical ID alias", async () => {
    for (const route of ["/hazard-id", "/chemical-id"]) {
      const response = await app.request(route);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('<h1 class="hazmat-hero-title">HAZARD ID</h1>');
    }
  });

  it("searches hydrated CBRNE and radiological records with review-gated responder facts", async () => {
    const cbrne = await (await app.request("/api/hazards/search?lane=CBRNE_CWA&q=GB")).json() as { results: Array<{ id: string; displayName: string }> };
    expect(cbrne.results[0]).toMatchObject({ id: "sarin-gb", displayName: "Sarin" });
    const radiological = await (await app.request("/api/hazards/search?lane=RADIOLOGICAL&q=Cs-137")).json() as { results: Array<{ id: string; displayName: string }> };
    expect(radiological.results[0]).toMatchObject({ id: "cesium-137", displayName: "Cesium-137" });

    const profile = await (await app.request("/api/hazards/RADIOLOGICAL/cesium-137/profile")).json() as {
      verificationStatus: string;
      isolationStandoffFacts: Array<{ value: unknown; verificationStatus: string }>;
    };
    expect(profile.verificationStatus).toBe("Requires SME Review");
    expect(profile.isolationStandoffFacts[0]).toMatchObject({ verificationStatus: "Requires SME Review" });
    expect(profile.isolationStandoffFacts[0]?.value).toEqual(expect.any(String));
  });

  it("searches Anthrax and renders its source-backed, review-gated Hazard ID profile", async () => {
    const searchResponse = await app.request("/api/hazards/search?lane=CBRNE_CWA&q=Bacillus%20anthracis");
    expect(searchResponse.status).toBe(200);
    const search = await searchResponse.json() as { results: Array<{ id: string; displayName: string; scientificName: string }> };
    expect(search.results[0]).toMatchObject({ id: "anthrax", displayName: "Anthrax", scientificName: "Bacillus anthracis" });

    const profileResponse = await app.request("/api/hazards/CBRNE_CWA/anthrax/profile");
    expect(profileResponse.status).toBe(200);
    const profile = await profileResponse.json() as {
      displayName: string;
      scientificName: string;
      hazardFacts: Array<{ value: unknown; verificationStatus: string }>;
      actionCards: Array<{ title: string }>;
    };
    expect(profile).toMatchObject({ displayName: "Anthrax", scientificName: "Bacillus anthracis" });
    expect(profile.hazardFacts[0]).toMatchObject({ verificationStatus: "Requires SME Review" });
    expect(profile.hazardFacts[0]?.value).toEqual(expect.any(String));
    expect(profile.actionCards).toContainEqual(expect.objectContaining({ title: "Identify / Verify Biological Threat" }));
  });

  it("GET /api/chemicals?q=ammonia finds ammonia", async () => {
    const res = await app.request("/api/chemicals?q=ammonia");
    const body = (await res.json()) as { chemicals: Array<{ id: string }> };
    expect(body.chemicals.some((c) => c.id === "ammonia")).toBe(true);
  });

  it("keeps Chemical Companion master identity fields authoritative in profiles", async () => {
    const res = await app.request("/api/chemicals/479/profile?identifier=2312&shippingName=Phenol%2C%20molten");
    expect(res.status).toBe(200);
    const body = await res.json() as {
      masterRecord: { sourceName: string; sourceRecordId: string };
      header: { name: string; un: string; ergGuide: string };
    };
    expect(body.masterRecord).toEqual(expect.objectContaining({
      sourceName: "Chemical Companion",
      sourceRecordId: "479",
    }));
    expect(body.header).toMatchObject({ name: "Phenol", un: "1671", ergGuide: "153" });
  });

  it("hydrates the reviewed HCl profile with NFPA, exposure, response, and source provenance", async () => {
    const res = await app.request("/api/chemicals/56/profile");
    expect(res.status).toBe(200);
    const body = await res.json() as {
      header: { name: string; nfpa704: { health: string; flammability: string; instability: string } };
      properties: { formula: string; physicalState: string; molecularWeight: string; boilingPoint: string; vaporPressure: string };
      exposures: { oshaPel: string; monitoringConcerns: string[] };
      response: { spillOrLeak: string[] };
      sourceLinks: Array<{ sourceName: string; sourceUrl?: string; reviewStatus: string }>;
    };
    expect(body.header).toMatchObject({
      name: "Hydrogen chloride, anhydrous",
      nfpa704: { health: "3", flammability: "1", instability: "1" },
    });
    expect(body.properties).toMatchObject({
      formula: "HCl",
      physicalState: expect.stringMatching(/gas/i),
      molecularWeight: "36.46",
    });
    expect(body.properties.boilingPoint).not.toMatch(/Not available|No Current Data/i);
    expect(body.properties.vaporPressure).not.toMatch(/Not available|No Current Data/i);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(body.exposures.oshaPel).toBe("Ceiling: 5 ppm");
    expect(body.exposures.monitoringConcerns).toContain("AEGL2_60min: 22");
    expect(body.response.spillOrLeak.length).toBeGreaterThan(0);
    expect(body.sourceLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceName: "EPA AEGL", reviewStatus: "approved", sourceUrl: expect.stringContaining("epa.gov") }),
      expect.objectContaining({ sourceName: "CAMEO Chemicals", reviewStatus: "approved", sourceUrl: expect.stringContaining("cameochemicals.noaa.gov") }),
      expect.objectContaining({ sourceName: "ERG", reviewStatus: "approved", sourceUrl: expect.stringContaining("phmsa.dot.gov") }),
    ]));
  });

  it("GET /api/erg/:un returns the Table 1 row matching the requested guide", async () => {
    const res = await app.request("/api/erg/1005?guide=125");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { un: string; guide: string; tih: number };
    expect(body).toMatchObject({ un: "1005", guide: "125", tih: 1 });
  });

  it("GET /api/erg/:un includes Table 2 references without a redundant Table 3 notice", async () => {
    const table2 = await (await app.request("/api/erg/1428?guide=138")).json() as { additionalTables: Array<{ table: number }> };
    expect(table2.additionalTables).toContainEqual(expect.objectContaining({ table: 2 }));

    const table3 = await (await app.request("/api/erg/1017?guide=124")).json() as { additionalTables: Array<{ table: number }> };
    expect(table3.additionalTables).toEqual([]);
  });

  it("GET /api/erg/:un includes container-specific Table 3 distances", async () => {
    const response = await app.request("/api/erg/1005?guide=125");
    const body = await response.json() as { containerSpecificDistances: Array<{ container: string }> };
    expect(body.containerSpecificDistances).toContainEqual(
      expect.objectContaining({ container: "Agricultural nurse tank" }),
    );
  });

  it("POST /api/plume/run returns isopleths for a valid request", async () => {
    const res = await app.request("/api/plume/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chemicalId: "10",
        releaseKind: "plume",
        releaseRateKgPerSec: 1,
        windSpeedMps: 3,
        windDirDeg: 270,
        stabilityClass: "D",
        tempC: 20,
        ...currentManualWeather(),
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      isopleths: unknown[];
      disclaimer: string;
      modelStatus: string;
      validationStatus: string;
      validated: boolean;
      limitations: string[];
      endpoint: { endpointSource: string; selectedDurationMinutes: number; aegl1: number; aegl2: number; aegl3: number };
      plumeStatus: string;
      masterChemicalId: string;
      modelMode: string;
      modelModeLabel: string;
      modelFamily: string;
      sourceStrength: { status: string; sourceStrengthValue: number };
      weather: { freshness: string; usableForPlanning: boolean };
      confidenceLevel: string;
      fieldVerificationRequirements: string[];
      textSummary: string;
    };
    expect(Array.isArray(body.isopleths)).toBe(true);
    expect(body.isopleths.length).toBeGreaterThan(0);
    expect(typeof body.disclaimer).toBe("string");
    expect(body.modelStatus).toBe("Planning Estimate");
    expect(body.validationStatus).toBe("Not independently validated");
    expect(body.validated).toBe(false);
    expect(body.limitations).not.toHaveLength(0);
    expect(body.endpoint).toMatchObject({ endpointSource: "EPA AEGL", selectedDurationMinutes: 60, aegl1: 30, aegl2: 160, aegl3: 1100 });
    expect(body.plumeStatus).toBe("Planning Estimate");
    expect(body.masterChemicalId).toBe("10");
    expect(body.modelMode).toBe("HAZMATIQ_PLANNING_ESTIMATE");
    expect(body.modelModeLabel).toBe("HazMatIQ Planning Estimate");
    expect(body.sourceStrength.sourceStrengthValue).toBe(1);
    expect(body.weather.usableForPlanning).toBe(true);
    expect(body.confidenceLevel).not.toMatch(/validated/i);
    expect(body.fieldVerificationRequirements.join(" ")).toMatch(/field monitoring/i);
    expect(body.textSummary).toMatch(/Ammonia|7664-41-7/i);
  });

  it("POST /api/plume/run plots Hydrazine with its reviewed final EPA AEGL endpoint", async () => {
    const res = await app.request("/api/plume/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chemicalId: "54",
        releaseKind: "plume",
        releaseRateKgPerSec: 1,
        windSpeedMps: 3,
        windDirDeg: 270,
        stabilityClass: "D",
        tempC: 20,
        ...currentManualWeather(),
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      isopleths: unknown[];
      endpoint: { selectedDurationMinutes: number; aegl1: number; aegl2: number; aegl3: number };
      chemicalIdentity: { chemicalName: string; casNumber: string };
      masterChemicalId: string;
    };
    expect(body.isopleths).toHaveLength(3);
    expect(body.endpoint).toMatchObject({ selectedDurationMinutes: 60, aegl1: 0.1, aegl2: 13, aegl3: 35 });
    expect(body.chemicalIdentity).toMatchObject({ chemicalName: "Hydrazine", casNumber: "302-01-2" });
    expect(body.masterChemicalId).toBe("54");
  });

  it("falls back to an ERG protective-action overlay when AEGL is unavailable", async () => {
    const res = await app.request("/api/plume/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chemicalId: "479",
        releaseKind: "plume",
        releaseRateKgPerSec: 1,
        windSpeedMps: 3,
        windDirDeg: 270,
        stabilityClass: "D",
        tempC: 20,
        ...currentManualWeather(),
        ergSpillSize: "large",
        ergPeriod: "night",
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      mode: "erg-protective-action",
      modelStatus: "Not a modeled plume",
      ergOverlay: {
        un: "1671",
        guide: "153",
        spillSize: "large",
        period: "night",
        initialIsolationFt: 150,
        protectiveActionMi: 0.3,
        source: "PHMSA Emergency Response Guidebook 2024 Table 1",
      },
    });
  });

  it("selects ERG fallback mode without requiring plume-only release inputs", async () => {
    const res = await app.request("/api/plume/availability?chemicalId=479&endpointDurationMinutes=60&ergSpillSize=large&ergPeriod=night");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      mode: "erg-protective-action",
      modelStatus: "Not a modeled plume",
      ergOverlay: {
        un: "1671",
        spillSize: "large",
        period: "night",
        initialIsolationFt: 150,
        protectiveActionMi: 0.3,
      },
    });
  });

  it("selects AEGL mode before requiring release and weather inputs", async () => {
    const res = await app.request("/api/plume/availability?chemicalId=54&endpointDurationMinutes=60");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ mode: "aegl-plume" });
  });

  it.each([
    ["10", "Ammonia"],
    ["22", "Chlorine"],
    ["60", "Hydrogen sulfide"],
    ["102", "Sulfur dioxide"],
  ])("defaults supported TIH Chemical Companion record %s (%s) to Planning Plume", async (chemicalId) => {
    const res = await app.request(`/api/plume/availability?chemicalId=${chemicalId}&endpointDurationMinutes=60`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      mode: "aegl-plume",
      modelMode: "HAZMATIQ_PLANNING_ESTIMATE",
    });
  });

  it("makes anhydrous hydrogen chloride Planning Plume eligible through reviewed identity and source links", async () => {
    const res = await app.request("/api/plume/availability?chemicalId=56&endpointDurationMinutes=60");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      mode: "aegl-plume",
      modelMode: "HAZMATIQ_PLANNING_ESTIMATE",
      masterChemicalId: "56",
      chemicalIdentity: { chemicalName: "Hydrogen chloride, anhydrous", casNumber: "7647-01-0" },
      endpoint: {
        endpointSource: "EPA AEGL",
        endpointStatus: "Final",
        selectedDurationMinutes: 60,
        aegl1: 1.8,
        aegl2: 22,
        aegl3: 100,
      },
      ergAvailability: { status: "Found", un: "1050", guide: "125" },
      sourceLinks: {
        chemicalCompanion: { status: "Verified", recordId: "56" },
        aegl: { status: "Verified" },
        cameo: { status: "Verified", sourceUrl: "https://cameochemicals.noaa.gov/chemical/4649" },
        erg: { status: "Verified", un: "1050", guide: "125" },
      },
    });
  });

  it("plots anhydrous hydrogen chloride with complete release and weather inputs", async () => {
    const res = await app.request("/api/plume/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chemicalId: "56",
        releaseKind: "plume",
        releaseRateKgPerSec: 1,
        windSpeedMps: 3,
        windDirDeg: 270,
        stabilityClass: "D",
        tempC: 20,
        ...currentManualWeather(),
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { mode: string; masterChemicalId: string; endpoint: object; isopleths: unknown[] };
    expect(body).toMatchObject({
      mode: "aegl-plume",
      masterChemicalId: "56",
      endpoint: { endpointSource: "EPA AEGL", aegl1: 1.8, aegl2: 22, aegl3: 100 },
    });
    expect(body.isopleths).toHaveLength(3);
  });

  it("uses the canonical molecular weight instead of a caller override", async () => {
    const res = await app.request("/api/plume/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chemicalId: "10",
        releaseKind: "plume",
        releaseRateKgPerSec: 1,
        windSpeedMps: 3,
        windDirDeg: 270,
        stabilityClass: "D",
        tempC: 20,
        molecularWeight: 999,
        ...currentManualWeather(),
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ inputs: { molecularWeight: 17.03 } });
  });

  it("rejects client-asserted calculation evidence", async () => {
    const res = await app.request("/api/plume/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chemicalId: "10",
        releaseKind: "plume",
        releaseRateKgPerSec: 1,
        windSpeedMps: 3,
        windDirDeg: 270,
        stabilityClass: "D",
        tempC: 20,
        calculationEvidence: { approved: true },
        ...currentManualWeather(),
      }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "Calculation evidence is server-controlled and cannot be supplied by a client.",
    });
  });

  it("blocks a plume when weather source or observation time is missing", async () => {
    const res = await app.request("/api/plume/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chemicalId: "10",
        releaseKind: "plume",
        releaseRateKgPerSec: 1,
        windSpeedMps: 3,
        windDirDeg: 270,
        stabilityClass: "D",
        tempC: 20,
        lat: 38.9517,
        lng: -92.3341,
      }),
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      plumeStatus: "Blocked Missing Weather",
      weather: { usableForPlanning: false },
    });
  });

  it("blocks a plume without an incident or planning location", async () => {
    const weather = currentManualWeather();
    const res = await app.request("/api/plume/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chemicalId: "10",
        releaseKind: "plume",
        releaseRateKgPerSec: 1,
        windSpeedMps: 3,
        windDirDeg: 270,
        stabilityClass: "D",
        tempC: 20,
        weatherSourceMode: weather.weatherSourceMode,
        weatherSource: weather.weatherSource,
        weatherObservationTime: weather.weatherObservationTime,
      }),
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      error: "Cannot plot plume without a valid incident or planning location.",
    });
  });

  it("does not transfer the anhydrous-gas AEGL master link to hydrochloric acid solution", async () => {
    const res = await app.request("/api/plume/availability?chemicalId=965&endpointDurationMinutes=60");
    expect(res.status).toBe(200);
    const body = await res.json() as { mode: string; endpoint?: unknown; chemicalIdentity?: { casNumber: string } };
    expect(body.mode).not.toBe("aegl-plume");
    expect(body.endpoint).toBeUndefined();
  });

  it("does not allow ERG to override Planning Plume when AEGL is available", async () => {
    const res = await app.request("/api/plume/availability?chemicalId=10&ergSpillSize=large&ergPeriod=night&ergOnly=true");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      mode: "aegl-plume",
      modelMode: "HAZMATIQ_PLANNING_ESTIMATE",
    });
  });

  it("returns the manual/IC review state when neither AEGL nor ERG distances exist", async () => {
    const res = await app.request("/api/plume/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chemicalId: "693",
        releaseKind: "plume",
        releaseRateKgPerSec: 1,
        windSpeedMps: 3,
        windDirDeg: 270,
        stabilityClass: "D",
        tempC: 20,
      }),
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      mode: "no-distance-data",
      error: "No Current Data Exists. Establish isolation using agency SOPs, field observations, monitoring, and Incident Command.",
      display: "No Current Data Exists",
    });
  });

  it("preflights the manual/IC review state without requiring model inputs", async () => {
    const res = await app.request("/api/plume/availability?chemicalId=693&endpointDurationMinutes=60");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      mode: "no-distance-data",
      error: "No Current Data Exists. Establish isolation using agency SOPs, field observations, monitoring, and Incident Command.",
      display: "No Current Data Exists",
    });
  });

  it("blocks canonical slugs that are not verified Chemical Companion master links", async () => {
    const res = await app.request("/api/plume/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chemicalId: "ammonia",
        releaseKind: "plume",
        releaseRateKgPerSec: 1,
        windSpeedMps: 3,
        windDirDeg: 270,
        stabilityClass: "D",
        tempC: 20,
      }),
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ plumeStatus: "Blocked Missing Chemical Link" });
  });

  it("does not permit an unsupported independently validated claim", async () => {
    const res = await app.request("/api/plume/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chemicalId: "ammonia",
        releaseKind: "plume",
        windSpeedMps: 3,
        windDirDeg: 270,
        stabilityClass: "D",
        tempC: 20,
        validated: true,
      }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: string }).toEqual(expect.objectContaining({
      error: "Cannot mark plume output as independently validated. Published comparison cases, formula documentation, validation tolerances, and limitations are required.",
    }));
  });

  it("POST /api/plume/run rejects invalid inputs", async () => {
    const res = await app.request("/api/plume/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chemicalId: "ammonia" }),
    });
    expect(res.status).toBe(400);
  });

  it("persists completed incident reports", async () => {
    const incident = {
      incidentId: "incident-test-1",
      incidentName: "Warehouse response",
      status: "Completed",
      startedAt: "2026-06-29T20:00:00.000Z",
      completedAt: "2026-06-29T21:00:00.000Z",
    };
    const saved = await app.request("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incidents: [incident] }),
    });
    expect(saved.status).toBe(200);

    const response = await app.request("/api/incidents");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { incidents: (typeof incident)[] };
    expect(body.incidents).toContainEqual(incident);
  });

  it("prepares and generates a populated FEMA ICS form", async () => {
    const incident = {
      incidentId: "incident-pdf-1",
      incidentName: "Warehouse response",
      incidentNumber: "HM-42",
      status: "Active",
      startDate: "7/1/2026",
      startTime: "10:15:00 AM",
      icsForms: { "201": { fields: {} } },
    };
    const prepared = await app.request("/api/ics-forms/201/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(incident),
    });
    expect(prepared.status).toBe(200);
    const preparation = (await prepared.json()) as {
      fields: Array<{ name: string; value: string }>;
    };
    expect(preparation.fields).toContainEqual(
      expect.objectContaining({ name: "Incident Name", value: "Warehouse response" }),
    );

    const pdf = await app.request("/api/ics-forms/201/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(incident),
    });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 4))).toBe("%PDF");
  });

  it("prefills hazmat ICS fields from the incident chemical profile snapshot", async () => {
    const incident = {
      incidentId: "incident-chemical-profile-1",
      incidentName: "Ammonia release",
      chemicalName: "Ammonia (anhydrous)",
      chemicalProfile: {
        header: {
          name: "Ammonia (anhydrous)",
          cas: "7664-41-7",
          un: "1005",
          ergGuide: "125",
          idlh: "300 ppm",
          hazard: "Toxic gas",
        },
        properties: {
          physicalState: "Gas",
          flashPoint: "Not relevant",
          vaporPressure: "7600 mmHg",
          vaporDensity: "0.59",
          specificGravity: "0.6818",
          lelUel: "15 / 28",
        },
        exposures: { idlh: "300 ppm", symptoms: ["Burning", "Difficulty breathing"] },
        ppeRespiratory: { bestMatch: "Kappler — Frontline 500" },
        detectors: { items: ["Ammonia electrochemical sensor"] },
        medical: { firstAid: ["Remove victim from contaminated area"] },
      },
      icsForms: { "208HM": { fields: {} } },
    };
    const response = await app.request("/api/ics-forms/208HM/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(incident),
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { fields: Array<{ name: string; value: string; source: string }> };
    expect(body.fields).toContainEqual(expect.objectContaining({
      name: "19 MaterialRow1",
      value: expect.stringContaining("Ammonia (anhydrous)"),
      source: "automatic",
    }));
    expect(body.fields).toContainEqual(expect.objectContaining({
      name: "IDLHRow1",
      value: "300 ppm",
      source: "automatic",
    }));
    expect(body.fields).toContainEqual(expect.objectContaining({ name: "Phys StateRow1", value: "Gas" }));
    expect(body.fields).toContainEqual(expect.objectContaining({ name: "LELRow1", value: "15" }));
    expect(body.fields).toContainEqual(expect.objectContaining({ name: "UELRow1", value: "28" }));
  });

  it("serves the static UI at /", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("HazMatIQ");
  });
});
