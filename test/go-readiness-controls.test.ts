import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ERG_TABLE_1 } from "@/data/erg";
import { IncidentExportV1 } from "@/lib/schema";
import {
  evaluateCacheFreshness,
  evaluateCertificationTargets,
  evaluateFlatErgRelease,
  evaluatePublicReleaseSecurity,
  evaluateSafetyGuidance,
  PUBLIC_RELEASE_SECURITY_CONTROLS,
  validateProvenanceManifest,
  type CertificationTarget,
  type ProvenanceManifest,
} from "@/lib/readiness";

const provenance = JSON.parse(readFileSync(
  new URL("../data/source-provenance-manifest.json", import.meta.url), "utf8",
)) as ProvenanceManifest;
const certification = JSON.parse(readFileSync(
  new URL("../data/go-readiness-certification.json", import.meta.url), "utf8",
)) as { targets: CertificationTarget[] };
const ergGuides = JSON.parse(readFileSync(
  new URL("../server/public/data/erg-guides-2024.json", import.meta.url), "utf8",
)) as { guides: Record<string, unknown> };

describe("GO-readiness fail-closed controls", () => {
  it("registers all safety-critical provenance domains without claiming approval", () => {
    const report = validateProvenanceManifest(provenance);
    expect(report.valid).toBe(true);
    expect(report.releaseReady).toBe(false);
    expect(report.blockers).toContain("chemical-companion-sqlite requires sourceCitation.");
  });

  it("keeps the flat ERG path structurally checked and blocks an unapproved cutover", () => {
    const report = evaluateFlatErgRelease(
      ERG_TABLE_1,
      new Set(Object.keys(ergGuides.guides)),
      { sourceReconciled: false, normalizedCutoverApproved: false },
    );
    expect(report.errors).toEqual([]);
    expect(report.structurallyValid).toBe(true);
    expect(report.releaseReady).toBe(false);
    expect(report.blockers.join(" ")).toContain("retain the flat production path");
  });

  it("blocks PPE and suit recommendations without chemical-specific manufacturer evidence", () => {
    const report = evaluateSafetyGuidance({
      id: "example-suit",
      kind: "suit-compatibility",
      sourceId: "manufacturer",
      sourceRevision: null,
      sourceLocator: null,
      chemicalId: "chlorine",
      chemicalForm: "gas",
      manufacturer: null,
      productOrMaterial: null,
      domainReviewer: null,
      reviewedAt: null,
      reviewState: "requires-review",
      hasConflictingEvidence: false,
    });
    expect(report.recommendationAllowed).toBe(false);
    expect(report.blockers).toContain("manufacturer is required for suit compatibility.");
  });

  it("blocks unreviewed medical and protective-action outputs", () => {
    for (const kind of ["medical", "protective-action"] as const) {
      expect(evaluateSafetyGuidance({
        id: kind,
        kind,
        sourceId: "imported-source",
        sourceRevision: "unverified",
        sourceLocator: "record:1",
        chemicalId: "chemical:1",
        chemicalForm: "unknown",
        domainReviewer: null,
        reviewedAt: null,
        reviewState: "requires-review",
        hasConflictingEvidence: false,
      }).recommendationAllowed).toBe(false);
    }
  });

  it("validates a versioned export and rejects missing measurement units", () => {
    const source = { sourceId: "source:1", revision: "rev:1", checksum: null, locator: "record:1" };
    const measurement = { value: 1, unit: "m/s", status: "Manual Entry" as const, source: null };
    const fixture = {
      schemaVersion: "1.0.0",
      exportId: "export:1",
      generatedAt: "2026-08-07T00:00:00.000Z",
      incident: {
        id: "incident:1", openedAt: "2026-08-07T00:00:00.000Z", closedAt: null,
        actorId: "actor:1", deviceId: "device:1", revision: 1,
        classification: "operational-sensitive", retentionPolicyId: "policy:pending",
      },
      chemical: {
        chemicalId: "chemical:1", name: "Example", cas: null, unNa: null, ergGuide: null,
        status: "Imported Source", source,
      },
      weather: {
        observedAt: null, status: "Needs Verification", windSpeed: measurement,
        windDirection: { ...measurement, unit: "degree" }, temperature: { ...measurement, unit: "degC" },
      },
      plume: null,
      guidance: [],
      auditHistory: [{
        sequence: 1, at: "2026-08-07T00:00:00.000Z", actorId: "actor:1", deviceId: "device:1",
        action: "created", previousRevision: 0, resultingRevision: 1,
      }],
      disclaimers: ["Decision support only."],
      attachments: [],
      reportsMappings: [],
    };
    expect(IncidentExportV1.safeParse(fixture).success).toBe(true);
    expect(IncidentExportV1.safeParse({
      ...fixture,
      weather: { ...fixture.weather, windSpeed: { ...measurement, unit: "" } },
    }).success).toBe(false);
  });

  it("keeps public release blocked until every security control has approved evidence", () => {
    const report = evaluatePublicReleaseSecurity(PUBLIC_RELEASE_SECURITY_CONTROLS.map((control) => ({
      control, status: "not-tested" as const, evidence: [], approvedBy: null, approvedAt: null,
    })));
    expect(report.releaseReady).toBe(false);
    expect(report.blockers).toHaveLength(PUBLIC_RELEASE_SECURITY_CONTROLS.length);
  });

  it("never treats unknown, stale, expired, or checksum-failed cache data as verified", () => {
    const base = {
      sourceId: "weather:1", sourceRevision: "rev:1", retrievedAt: "2026-08-07T00:00:00.000Z",
      observedAt: "2026-08-07T00:00:00.000Z", currentForMs: 60_000, recentForMs: 120_000,
      expiresAfterMs: 180_000, checksumVerified: true,
    };
    expect(evaluateCacheFreshness(base, new Date("2026-08-07T00:00:30.000Z"))).toEqual({ freshness: "Current", usableAsVerified: true });
    expect(evaluateCacheFreshness({ ...base, observedAt: null }, new Date())).toEqual({ freshness: "Unknown", usableAsVerified: false });
    expect(evaluateCacheFreshness(base, new Date("2026-08-07T00:02:30.000Z")).usableAsVerified).toBe(false);
    expect(evaluateCacheFreshness(base, new Date("2026-08-07T00:04:00.000Z"))).toEqual({ freshness: "Expired", usableAsVerified: false });
    expect(evaluateCacheFreshness({ ...base, checksumVerified: false }, new Date("2026-08-07T00:00:30.000Z")).usableAsVerified).toBe(false);
  });

  it("records all integration, viewport, accessibility, offline, and conflict targets as blocked until evidenced", () => {
    const required = certification.targets.map((target) => target.id);
    const report = evaluateCertificationTargets(required, certification.targets);
    expect(required).toHaveLength(13);
    expect(report.releaseReady).toBe(false);
    expect(report.blockers).toHaveLength(13);
  });
});
