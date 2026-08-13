import type { PlumeCalculationEvidence, PlumeInputs, PlumeResult, ThresholdBand } from "@/lib/schema";
import { mgM3ToPpm, ppmToMgM3 } from "@/lib/schema";
import { pickRoughness } from "./briggs";
import {
  MODEL_VERSION,
  PLUME_DISCLAIMER,
  PLUME_FORMULA_REFERENCE,
  PLUME_MODEL_LIMITATIONS,
  PLUME_MODEL_NAME,
} from "./constants";

export interface RunPlumeOptions {
  thresholds: ThresholdBand[];
  calculationEvidence: PlumeCalculationEvidence;
  saturatedConcentrationPpm?: number;
  emissionRateKgPerSec?: number;
  totalMassKg?: number;
  maxRangeM?: number;
  molecularWeight?: number;
}

const TWO_PI = 2 * Math.PI;
const SQRT_2PI_LN2 = Math.sqrt(2 * Math.log(2));

/**
 * Returns concentration in kg/m³ at (x, y, z) for a continuous point source.
 * For ppm conversion use mgM3ToPpm with molecular weight and temperature.
 */
export function gaussianPlumeC(
  inputs: PlumeInputs,
  x: number,
  y: number,
  z: number,
  emissionRateKgPerSec: number,
): number {
  if (x <= 0) return 0;
  const u = Math.max(inputs.windSpeedMps, 0.1);
  const { sigmaY, sigmaZ } = pickRoughness(inputs.stabilityClass, inputs.surfaceRoughness);
  const sy = Math.max(sigmaY(x), 1e-3);
  const sz = Math.max(sigmaZ(x), 1e-3);
  const expY = Math.exp(-(y * y) / (2 * sy * sy));
  const expZ = Math.exp(-((z - inputs.releaseHeightM) ** 2) / (2 * sz * sz));
  const expGround = Math.exp(-((z + inputs.releaseHeightM) ** 2) / (2 * sz * sz));
  return (emissionRateKgPerSec / (u * sy * sz * TWO_PI)) * expY * (expZ + expGround);
}

export function gaussianPuffC(
  inputs: PlumeInputs,
  x: number,
  y: number,
  z: number,
  totalMassKg: number,
  t: number,
): number {
  if (t <= 0) return 0;
  const u = Math.max(inputs.windSpeedMps, 0.1);
  const { sigmaY, sigmaZ } = pickRoughness(inputs.stabilityClass, inputs.surfaceRoughness);
  const travelDistance = u * t;
  const sx = Math.max(sigmaY(travelDistance), 1e-3);
  const sy = Math.max(sigmaY(travelDistance), 1e-3);
  const sz = Math.max(sigmaZ(travelDistance), 1e-3);
  const expX = Math.exp(-((x - u * t) ** 2) / (2 * sx * sx));
  const expY = Math.exp(-(y * y) / (2 * sy * sy));
  const expZ = Math.exp(-((z - inputs.releaseHeightM) ** 2) / (2 * sz * sz));
  const expGround = Math.exp(-((z + inputs.releaseHeightM) ** 2) / (2 * sz * sz));
  return (totalMassKg / Math.pow(TWO_PI, 1.5) / (sx * sy * sz)) * expX * expY * (expZ + expGround);
}

function yAtThreshold(
  inputs: PlumeInputs,
  x: number,
  c0KgM3: number,
  targetMgM3: number,
  fixedSigmaY?: number,
): number {
  if (c0KgM3 * 1e6 < targetMgM3) return 0;
  const { sigmaY } = pickRoughness(inputs.stabilityClass, inputs.surfaceRoughness);
  const sy = fixedSigmaY ?? Math.max(sigmaY(x), 1e-3);
  return sy * Math.sqrt(-2 * Math.log((targetMgM3 / 1e6) / c0KgM3));
}

export function runPlume(inputs: PlumeInputs, opts: RunPlumeOptions): PlumeResult {
  const computedAt = new Date().toISOString();
  const isPlume = inputs.releaseKind === "plume";
  const Q = opts.emissionRateKgPerSec ?? inputs.releaseRateKgPerSec;
  const M = opts.totalMassKg ?? inputs.totalMassKg;
  const maxRange = opts.maxRangeM ?? 5000;
  const xSamples = 60;
  const xStep = maxRange / xSamples;
  const mw = opts.molecularWeight ?? inputs.molecularWeight;
  const requiredEvidence = [
    "chemicalId", "releaseKind", "releaseHeightM", "windSpeedMps", "windDirDeg",
    "stabilityClass", "surfaceRoughness", "tempC", "molecularWeight", "thresholds",
    isPlume ? "releaseRateKgPerSec" : "totalMassKg",
    ...(isPlume ? [] : ["durationSec"]),
  ];
  const evidencedFields = new Set(opts.calculationEvidence.sourceData
    .filter((record) => record.approved === true)
    .flatMap((record) => record.fields.filter((field) => field in record.values)));
  const missingEvidence = requiredEvidence.filter((field) => !evidencedFields.has(field));
  if (missingEvidence.length) throw new Error(`Missing approved plume source records for: ${missingEvidence.join(", ")}`);
  if (mw === undefined) throw new Error("Molecular weight is required; no default may be inferred.");
  if (isPlume && Q === undefined) throw new Error("Release rate is required for a continuous plume; no default may be inferred.");
  if (!isPlume && M === undefined) throw new Error("Total mass is required for a puff; no default may be inferred.");
  if (!isPlume && inputs.durationSec === undefined) throw new Error("Evaluation time is required for a puff; no default may be inferred.");
  if (!opts.thresholds.length) throw new Error("At least one approved exposure threshold is required; no default may be inferred.");
  const calculatedInputValues: Record<string, unknown> = {
    ...inputs,
    molecularWeight: mw,
    thresholds: opts.thresholds,
    ...(isPlume ? { releaseRateKgPerSec: Q } : { totalMassKg: M }),
  };
  const mismatchedEvidence = requiredEvidence.filter((field) => !opts.calculationEvidence.sourceData.some((record) =>
    record.approved === true
    && record.fields.includes(field)
    && JSON.stringify(record.values[field]) === JSON.stringify(calculatedInputValues[field])));
  if (mismatchedEvidence.length) {
    throw new Error(`Plume inputs do not match approved source records for: ${mismatchedEvidence.join(", ")}`);
  }
  const puffSigmaY = isPlume
    ? undefined
    : Math.max(pickRoughness(inputs.stabilityClass, inputs.surfaceRoughness).sigmaY(Math.max(inputs.windSpeedMps, 0.1) * inputs.durationSec!), 1e-3);
  const targetMgM3ByKind = new Map<string, number>();
  for (const b of opts.thresholds) {
    targetMgM3ByKind.set(`${b.kind}-${b.level}`, ppmToMgM3(b.valuePpm, mw, inputs.tempC));
  }
  const thresholdTarget = (kind: string, level: number): number => {
    const v = targetMgM3ByKind.get(`${kind}-${level}`);
    if (v !== undefined) return v;
    throw new Error(`No source threshold exists for ${kind}-${level}.`);
  };

  const centerline: PlumeResult["centerline"] = [];
  for (let i = 1; i <= xSamples; i++) {
    const x = i * xStep;
    const c = isPlume
      ? gaussianPlumeC(inputs, x, 0, 0, Q!,)
      : gaussianPuffC(inputs, x, 0, 0, M!, inputs.durationSec!);
    centerline.push({
      distanceM: Math.round(x),
      concentrationPpm: Number(mgM3ToPpm(c * 1e6, mw, inputs.tempC).toFixed(4)),
    });
  }

  const isopleths = opts.thresholds.map((band) => {
    const target = thresholdTarget(band.kind, band.level);
    const pts: Array<[number, number]> = [];
    let maxY = 0;
    let maxXReached = 0;
    for (let i = 1; i <= xSamples; i++) {
      const x = i * xStep;
      const c0 = isPlume ? gaussianPlumeC(inputs, x, 0, 0, Q!) : gaussianPuffC(inputs, x, 0, 0, M!, inputs.durationSec!);
      if (c0 * 1e6 < target) continue;
      const y = yAtThreshold(inputs, x, c0, target, puffSigmaY);
      if (y > maxY) maxY = y;
      maxXReached = Math.max(maxXReached, x);
      pts.push([x, y]);
    }
    const polygon = buildClosedPolygon(pts);
    return {
      thresholdKind: band.kind,
      thresholdLevel: band.level,
      polygon,
      maxDownwindM: maxXReached,
      maxCrosswindM: maxY,
    };
  });

  return {
    status: "Calculated estimate",
    modelVersion: MODEL_VERSION,
    inputs,
    isopleths,
    centerline,
    thresholdsUsed: opts.thresholds,
    computedAt,
    calculation: {
      ...opts.calculationEvidence,
      modelName: PLUME_MODEL_NAME,
      formulaReference: PLUME_FORMULA_REFERENCE,
      limitations: [...new Set([...PLUME_MODEL_LIMITATIONS, ...opts.calculationEvidence.limitations])],
    },
    disclaimer: PLUME_DISCLAIMER,
  };
}

function buildClosedPolygon(upperEdge: Array<[number, number]>): Array<[number, number]> {
  if (upperEdge.length === 0) return [];
  const lowerEdge: Array<[number, number]> = [...upperEdge].reverse().map(([x, y]) => [x, -y]);
  return [...upperEdge, ...lowerEdge];
}

export function isoplethCentroid(
  polygon: Array<[number, number]>,
): [number, number] | null {
  if (polygon.length === 0) return null;
  let sx = 0;
  let sy = 0;
  let sa = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    const cross = x1 * y2 - x2 * y1;
    sa += cross;
    sx += (x1 + x2) * cross;
    sy += (y1 + y2) * cross;
  }
  if (sa === 0) return null;
  return [sx / (3 * sa), sy / (3 * sa)];
}

export const HALF_WIDTH_AT_HALF_MAX = SQRT_2PI_LN2;
