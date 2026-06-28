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

  execFileSync("npx", ["tsx", "src/init-sqlite.ts"], { cwd: path.resolve(__dirname, ".."), env: process.env });
  execFileSync("npx", ["tsx", "src/seed.ts"], { cwd: path.resolve(__dirname, ".."), env: process.env });
}, 30_000);

describe("API routes", () => {
  it("GET /health", async () => {
    ({ default: app } = await import("../src/app.js"));
    const res = await app.request("/health");
    expect(res.status).toBe(200);
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

  it("GET /api/erg/:un returns the Table 1 row matching the requested guide", async () => {
    const res = await app.request("/api/erg/1005?guide=125");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { un: string; guide: string; tih: number };
    expect(body).toMatchObject({ un: "1005", guide: "125", tih: 1 });
  });

  it("POST /api/plume/run returns isopleths for a valid request", async () => {
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
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { isopleths: unknown[]; disclaimer: string };
    expect(Array.isArray(body.isopleths)).toBe(true);
    expect(body.isopleths.length).toBeGreaterThan(0);
    expect(typeof body.disclaimer).toBe("string");
  });

  it("POST /api/plume/run rejects invalid inputs", async () => {
    const res = await app.request("/api/plume/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chemicalId: "ammonia" }),
    });
    expect(res.status).toBe(400);
  });

  it("serves the static UI at /", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("HazMatIQ");
  });
});
