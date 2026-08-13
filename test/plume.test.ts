import { describe, expect, it } from "vitest";
import { runPlume, isoplethCentroid } from "@/lib/model";
import type { PlumeInputs, ThresholdBand } from "@/lib/schema";

const inputs: PlumeInputs = {
  chemicalId: "ammonia",
  releaseKind: "plume",
  releaseRateKgPerSec: 1,
  durationSec: 600,
  releaseHeightM: 0,
  windSpeedMps: 3,
  windDirDeg: 270,
  stabilityClass: "D",
  surfaceRoughness: "rural",
  tempC: 20,
  molecularWeight: 17.03,
};

const thresholds: ThresholdBand[] = [
  { kind: "AEGL", level: 1, valuePpm: 30, label: "AEGL-1" },
  { kind: "AEGL", level: 2, valuePpm: 160, label: "AEGL-2" },
];

const evidence = (releaseKind: "plume" | "puff", valueOverrides: Record<string, unknown> = {}) => ({
  modelName: "HazMatIQ Gaussian plume/puff screening model",
  formulaReference: "Gaussian plume and puff equations in src/lib/model/plume.ts",
  sourceData: [{
    sourceName: "Test fixture",
    sourceRecordId: `plume-test-${releaseKind}`,
    fields: [
      "chemicalId", "releaseKind", "releaseHeightM", "windSpeedMps", "windDirDeg",
      "stabilityClass", "surfaceRoughness", "tempC", "molecularWeight", "thresholds",
      releaseKind === "plume" ? "releaseRateKgPerSec" : "totalMassKg",
      ...(releaseKind === "puff" ? ["durationSec"] : []),
    ],
    values: {
      ...inputs,
      releaseKind,
      ...(releaseKind === "puff" ? { totalMassKg: 1000, durationSec: 60 } : {}),
      thresholds,
      ...valueOverrides,
    },
    approved: true as const,
  }],
  limitations: ["Synthetic test fixture; not for operational use."],
});

describe("plume runPlume", () => {
  it("produces a non-empty centerline", () => {
    const r = runPlume(inputs, { thresholds, emissionRateKgPerSec: 1, calculationEvidence: evidence("plume") });
    expect(r.centerline.length).toBeGreaterThan(0);
  });

  it("produces a closed polygon for each threshold", () => {
    const r = runPlume(
      { ...inputs, releaseRateKgPerSec: 10 },
      {
        thresholds,
        emissionRateKgPerSec: 10,
        molecularWeight: 17.03,
        calculationEvidence: evidence("plume", { releaseRateKgPerSec: 10 }),
      },
    );
    for (const iso of r.isopleths) {
      expect(iso.polygon.length).toBeGreaterThanOrEqual(4);
      if (iso.polygon.length >= 4) {
        const [x0, y0] = iso.polygon[0];
        const [xn, yn] = iso.polygon[iso.polygon.length - 1];
        expect(xn).toBeCloseTo(x0, 5);
        expect(yn).toBeCloseTo(-y0, 5);
      }
    }
  });

  it("AEGL-1 (low threshold) reaches further downwind than AEGL-2", () => {
    const r = runPlume(inputs, { thresholds, emissionRateKgPerSec: 1, calculationEvidence: evidence("plume") });
    const aegl1 = r.isopleths.find((i) => i.thresholdLevel === 1);
    const aegl2 = r.isopleths.find((i) => i.thresholdLevel === 2);
    expect(aegl1).toBeDefined();
    expect(aegl2).toBeDefined();
    expect(aegl1!.maxDownwindM).toBeGreaterThan(aegl2!.maxDownwindM);
  });

  it("puff model also produces polygons", () => {
    const r = runPlume(
      { ...inputs, releaseKind: "puff", durationSec: 60, totalMassKg: 1000 },
      { thresholds, totalMassKg: 1000, calculationEvidence: evidence("puff") },
    );
    expect(r.isopleths.length).toBe(thresholds.length);
  });

  it("disclaimer names ALOHA", () => {
    const r = runPlume(inputs, { thresholds, emissionRateKgPerSec: 1, calculationEvidence: evidence("plume") });
    expect(r.disclaimer.toLowerCase()).toContain("aloha");
  });

  it("labels outputs as calculated and displays method, sources, and limitations", () => {
    const r = runPlume(inputs, { thresholds, calculationEvidence: evidence("plume") });
    expect(r.status).toBe("Calculated estimate");
    expect(r.calculation.modelName).toBeTruthy();
    expect(r.calculation.formulaReference).toBeTruthy();
    expect(r.calculation.sourceData).not.toHaveLength(0);
    expect(r.calculation.limitations).not.toHaveLength(0);
  });

  it("never substitutes defaults for missing source evidence or molecular weight", () => {
    expect(() => runPlume(inputs, { thresholds } as never)).toThrow();
    expect(() => runPlume(
      { ...inputs, molecularWeight: undefined },
      { thresholds, calculationEvidence: evidence("plume") },
    )).toThrow(/Molecular weight is required/);
    expect(() => runPlume(inputs, {
      thresholds,
      calculationEvidence: evidence("plume", { windSpeedMps: 99 }),
    })).toThrow(/do not match approved source records for: windSpeedMps/);
  });
});

describe("isoplethCentroid", () => {
  it("returns null on empty polygon", () => {
    expect(isoplethCentroid([])).toBeNull();
  });

  it("returns (0,0) for a unit square centered at origin", () => {
    const cx = isoplethCentroid([
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]);
    expect(cx).not.toBeNull();
    expect(cx![0]).toBeCloseTo(0, 6);
    expect(cx![1]).toBeCloseTo(0, 6);
  });
});
