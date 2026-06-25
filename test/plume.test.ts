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

describe("plume runPlume", () => {
  it("produces a non-empty centerline", () => {
    const r = runPlume(inputs, { thresholds, emissionRateKgPerSec: 1 });
    expect(r.centerline.length).toBeGreaterThan(0);
  });

  it("produces a closed polygon for each threshold", () => {
    const r = runPlume(
      { ...inputs, releaseRateKgPerSec: 10 },
      {
        thresholds,
        emissionRateKgPerSec: 10,
        molecularWeight: 17.03,
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
    const r = runPlume(inputs, { thresholds, emissionRateKgPerSec: 1 });
    const aegl1 = r.isopleths.find((i) => i.thresholdLevel === 1);
    const aegl2 = r.isopleths.find((i) => i.thresholdLevel === 2);
    expect(aegl1).toBeDefined();
    expect(aegl2).toBeDefined();
    expect(aegl1!.maxDownwindM).toBeGreaterThan(aegl2!.maxDownwindM);
  });

  it("puff model also produces polygons", () => {
    const r = runPlume(
      { ...inputs, releaseKind: "puff", durationSec: 60, totalMassKg: 1000 },
      { thresholds, totalMassKg: 1000 },
    );
    expect(r.isopleths.length).toBe(thresholds.length);
  });

  it("disclaimer names ALOHA", () => {
    const r = runPlume(inputs, { thresholds, emissionRateKgPerSec: 1 });
    expect(r.disclaimer.toLowerCase()).toContain("aloha");
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
