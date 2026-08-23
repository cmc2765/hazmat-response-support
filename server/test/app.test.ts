import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Hono } from "hono";

let app: Hono;

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

  it("returns ERG isolation data on explicit request even when AEGL is available", async () => {
    const res = await app.request("/api/plume/availability?chemicalId=10&ergSpillSize=large&ergPeriod=night&ergOnly=true");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      mode: "erg-protective-action",
      ergOverlay: { un: "1005", spillSize: "large", period: "night" },
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
