import { describe, expect, it } from "vitest";
import { runPlume } from "@/lib/model";
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
};

const thresholds: ThresholdBand[] = [
  { kind: "AEGL", level: 1, valuePpm: 1, label: "AEGL-1" },
  { kind: "AEGL", level: 2, valuePpm: 5, label: "AEGL-2" },
];

describe("runPlume", () => {
  it("produces a stable centerline sample set", () => {
    const r = runPlume(inputs, { thresholds, emissionRateKgPerSec: 1 });
    expect(r.centerline.length).toBeGreaterThan(0);
    expect(r.centerline[0].distanceM).toBeGreaterThan(0);
    expect(r.disclaimer.toLowerCase()).toContain("aloha");
  });

  it("includes isopleths for each threshold", () => {
    const r = runPlume(inputs, { thresholds, emissionRateKgPerSec: 1 });
    expect(r.isopleths).toHaveLength(thresholds.length);
    expect(r.thresholdsUsed).toHaveLength(thresholds.length);
  });

  it("is deterministic for identical inputs", () => {
    const a = runPlume(inputs, { thresholds, emissionRateKgPerSec: 1 });
    const b = runPlume(inputs, { thresholds, emissionRateKgPerSec: 1 });
    expect(a.centerline).toEqual(b.centerline);
  });
});
