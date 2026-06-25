import type { PlumeInputs, PlumeResult, ThresholdBand } from "@/lib/schema";
import { ppmToMgM3 } from "@/lib/schema";
import { pickRoughness } from "./briggs";
import { MODEL_VERSION, PLUME_DISCLAIMER } from "./constants";

export interface RunPlumeOptions {
  thresholds: ThresholdBand[];
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
 * For ppm conversion use ppmToMgM3 with molecularWeight.
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
  return (emissionRateKgPerSec / (u * u * sy * sz * TWO_PI)) * expY * (expZ + expGround);
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
  const sx = Math.max(u * t, 1e-3);
  const sy = Math.max(sigmaY(sx), 1e-3);
  const sz = Math.max(sigmaZ(sx), 1e-3);
  const expX = Math.exp(-((x - u * t) ** 2) / (2 * sx * sx));
  const expY = Math.exp(-(y * y) / (2 * sy * sy));
  const expZ = Math.exp(-((z - inputs.releaseHeightM) ** 2) / (2 * sz * sz));
  return (totalMassKg / Math.pow(TWO_PI, 1.5) / (sx * sy * sz)) * expX * expY * expZ;
}

function yAtThreshold(
  inputs: PlumeInputs,
  x: number,
  c0KgM3: number,
  targetMgM3: number,
): number {
  if (c0KgM3 * 1e6 < targetMgM3) return 0;
  const { sigmaY } = pickRoughness(inputs.stabilityClass, inputs.surfaceRoughness);
  const sy = Math.max(sigmaY(x), 1e-3);
  return sy * Math.sqrt(-2 * Math.log((targetMgM3 / 1e6) / c0KgM3));
}

export function runPlume(inputs: PlumeInputs, opts: RunPlumeOptions): PlumeResult {
  const computedAt = new Date().toISOString();
  const isPlume = inputs.releaseKind === "plume";
  const Q = opts.emissionRateKgPerSec ?? inputs.releaseRateKgPerSec ?? 1;
  const M = opts.totalMassKg ?? inputs.totalMassKg ?? 1;
  const maxRange = opts.maxRangeM ?? 5000;
  const xSamples = 60;
  const xStep = maxRange / xSamples;
  const mw = opts.molecularWeight ?? inputs.molecularWeight ?? 30;
  const targetMgM3ByKind = new Map<string, number>();
  for (const b of opts.thresholds) {
    targetMgM3ByKind.set(`${b.kind}-${b.level}`, ppmToMgM3(b.valuePpm, mw, inputs.tempC));
  }
  const thresholdTarget = (kind: string, level: number): number => {
    const v = targetMgM3ByKind.get(`${kind}-${level}`);
    if (v !== undefined) return v;
    if (opts.thresholds.length > 0) {
      const fallback = opts.thresholds[0];
      return ppmToMgM3(fallback.valuePpm, mw, inputs.tempC);
    }
    return 1;
  };

  const centerline: PlumeResult["centerline"] = [];
  for (let i = 1; i <= xSamples; i++) {
    const x = i * xStep;
    const c = isPlume
      ? gaussianPlumeC(inputs, x, 0, 0, Q)
      : gaussianPuffC(inputs, x, 0, 0, M, inputs.durationSec ?? 60);
    centerline.push({ distanceM: Math.round(x), concentrationPpm: Number((c * 1e6).toFixed(4)) });
  }

  const isopleths = opts.thresholds.map((band) => {
    const target = thresholdTarget(band.kind, band.level);
    const pts: Array<[number, number]> = [];
    let maxY = 0;
    let maxXReached = 0;
    for (let i = 1; i <= xSamples; i++) {
      const x = i * xStep;
      const c0 = isPlume ? gaussianPlumeC(inputs, x, 0, 0, Q) : gaussianPuffC(inputs, x, 0, 0, M, inputs.durationSec ?? 60);
      if (c0 * 1e6 < target) continue;
      const y = yAtThreshold(inputs, x, c0, target);
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
    modelVersion: MODEL_VERSION,
    inputs,
    isopleths,
    centerline,
    thresholdsUsed: opts.thresholds,
    computedAt,
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
