import type { StabilityClass } from "@/lib/schema";

export const BRIGGS_URBAN = {
  A: { a: 0.22, b: 0.0002 },
  B: { a: 0.16, b: 0.0002 },
  C: { a: 0.11, b: 0.0002 },
  D: { a: 0.08, b: 0.0015 },
  E: { a: 0.06, b: 0.0015 },
  F: { a: 0.04, b: 0.0015 },
} as const satisfies Record<StabilityClass, { a: number; b: number }>;

export const BRIGGS_RURAL = {
  A: { a: 0.22, b: 0.0001 },
  B: { a: 0.16, b: 0.0001 },
  C: { a: 0.11, b: 0.0001 },
  D: { a: 0.08, b: 0.0005 },
  E: { a: 0.06, b: 0.0005 },
  F: { a: 0.04, b: 0.0005 },
} as const satisfies Record<StabilityClass, { a: number; b: number }>;

export function pickRoughness(
  cls: StabilityClass,
  surface: "urban" | "rural",
): { sigmaY: (x: number) => number; sigmaZ: (x: number) => number } {
  const params = surface === "urban" ? BRIGGS_URBAN[cls] : BRIGGS_RURAL[cls];
  return {
    sigmaY: (x: number) => params.a * x * Math.pow(1 + params.b * x, -0.5),
    sigmaZ: (x: number) => params.a * x * Math.pow(1 + params.b * x, -0.5),
  };
}
