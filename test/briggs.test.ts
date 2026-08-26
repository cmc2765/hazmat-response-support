import { describe, expect, it } from "vitest";
import { pickRoughness } from "@/lib/model";
import type { StabilityClass } from "@/lib/schema";

describe("Briggs dispersion coefficients", () => {
  it("matches the EPA open-country equations at 1,000 metres", () => {
    const expected: Record<StabilityClass, [number, number]> = {
      A: [0.22 * 1000 / Math.sqrt(1.1), 200],
      B: [0.16 * 1000 / Math.sqrt(1.1), 120],
      C: [0.11 * 1000 / Math.sqrt(1.1), 0.08 * 1000 / Math.sqrt(1.2)],
      D: [0.08 * 1000 / Math.sqrt(1.1), 0.06 * 1000 / Math.sqrt(2.5)],
      E: [0.06 * 1000 / Math.sqrt(1.1), 0.03 * 1000 / 1.3],
      F: [0.04 * 1000 / Math.sqrt(1.1), 0.016 * 1000 / 1.3],
    };
    for (const stability of ["A", "B", "C", "D", "E", "F"] as const) {
      const [sigmaY, sigmaZ] = expected[stability];
      const selected = pickRoughness(stability, "rural");
      expect(selected.sigmaY(1000)).toBeCloseTo(sigmaY, 10);
      expect(selected.sigmaZ(1000)).toBeCloseTo(sigmaZ, 10);
    }
  });

  it("matches the EPA urban equations and grouped stability classes", () => {
    const urbanA = pickRoughness("A", "urban");
    const urbanB = pickRoughness("B", "urban");
    const urbanE = pickRoughness("E", "urban");
    const urbanF = pickRoughness("F", "urban");
    expect(urbanA.sigmaY(1000)).toBeCloseTo(0.32 * 1000 / Math.sqrt(1.4), 10);
    expect(urbanA.sigmaZ(1000)).toBeCloseTo(0.24 * 1000 * Math.sqrt(2), 10);
    expect(urbanB.sigmaY(1000)).toBeCloseTo(urbanA.sigmaY(1000), 10);
    expect(urbanB.sigmaZ(1000)).toBeCloseTo(urbanA.sigmaZ(1000), 10);
    expect(urbanE.sigmaY(1000)).toBeCloseTo(urbanF.sigmaY(1000), 10);
    expect(urbanE.sigmaZ(1000)).toBeCloseTo(urbanF.sigmaZ(1000), 10);
  });

  it("does not collapse lateral and vertical dispersion into one curve", () => {
    for (const surface of ["rural", "urban"] as const) {
      for (const stability of ["A", "B", "C", "D", "E", "F"] as const) {
        const selected = pickRoughness(stability, surface);
        expect(selected.sigmaY(1000)).not.toBeCloseTo(selected.sigmaZ(1000), 6);
      }
    }
  });
});
