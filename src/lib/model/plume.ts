import type { PlumeInputs, PlumeResult, ThresholdBand } from "@/lib/schema";
import { pickRoughness } from "./briggs";
import { MODEL_VERSION, PLUME_DISCLAIMER } from "./constants";

export interface RunPlumeOptions {
  thresholds: ThresholdBand[];
  emissionRateKgPerSec?: number;
  saturatedConcentrationPpm?: number;
}

const TWO_PI = 2 * Math.PI;

export function gaussianPlumeC(
  inputs: PlumeInputs,
  x: number,
  y: number,
  z: number,
  Q: number,
): number {
  if (x <= 0) return 0;
  const u = Math.max(inputs.windSpeedMps, 0.1);
  const { sigmaY, sigmaZ } = pickRoughness(inputs.stabilityClass, inputs.surfaceRoughness);
  const sy = Math.max(sigmaY(x), 1e-3);
  const sz = Math.max(sigmaZ(x), 1e-3);
  const expY = Math.exp(-(y * y) / (2 * sy * sy));
  const expZ = Math.exp(-((z - inputs.releaseHeightM) ** 2) / (2 * sz * sz));
  const expGround = Math.exp(-((z + inputs.releaseHeightM) ** 2) / (2 * sz * sz));
  return (Q / (u * sy * sz * TWO_PI)) * expY * (expZ + expGround);
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
  const sx = u * t;
  const sy = Math.max(sigmaY(sx), 1e-3);
  const sz = Math.max(sigmaZ(sx), 1e-3);
  const expX = Math.exp(-((x - u * t) ** 2) / (2 * sx * sx));
  const expY = Math.exp(-(y * y) / (2 * sy * sy));
  const expZ = Math.exp(-((z - inputs.releaseHeightM) ** 2) / (2 * sz * sz));
  return (totalMassKg / Math.pow(TWO_PI, 1.5) / (sx * sy * sz)) * expX * expY * expZ;
}

export function runPlume(inputs: PlumeInputs, opts: RunPlumeOptions): PlumeResult {
  const computedAt = new Date().toISOString();
  const isPlume = inputs.releaseKind === "plume";
  const Q = opts.emissionRateKgPerSec ?? 1;
  const M = inputs.totalMassKg ?? 1;

  const maxX = 5000;
  const samples = 60;
  const centerline: PlumeResult["centerline"] = [];
  for (let i = 1; i <= samples; i++) {
    const x = (i / samples) * maxX;
    const c = isPlume
      ? gaussianPlumeC(inputs, x, 0, 0, Q)
      : gaussianPuffC(inputs, x, 0, 0, M, inputs.durationSec ?? 60);
    centerline.push({ distanceM: Math.round(x), concentrationPpm: Number(c.toFixed(4)) });
  }

  const isopleths = opts.thresholds.map((t) => ({
    thresholdKind: t.kind,
    thresholdLevel: t.level,
    polygon: buildPolygon(inputs, t, isPlume ? Q : M, isPlume),
    maxDownwindM: 0,
    maxCrosswindM: 0,
  }));

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

function buildPolygon(
  inputs: PlumeInputs,
  band: ThresholdBand,
  Q: number,
  isPlume: boolean,
): Array<[number, number]> {
  const target = band.valuePpm;
  const points: Array<[number, number]> = [];
  const stepX = 50;
  for (let x = stepX; x <= 5000; x += stepX) {
    const c0 = isPlume ? gaussianPlueAt(inputs, x, 0, 0, Q) : 0;
    if (c0 < target) continue;
    const { sigmaY } = pickRoughness(inputs.stabilityClass, inputs.surfaceRoughness);
    const sy = Math.max(sigmaY(x), 1e-3);
    const y = sy * Math.sqrt(-2 * Math.log(target / c0));
    if (Number.isFinite(y)) {
      points.push([x, y]);
      points.unshift([x, -y]);
    }
  }
  return points;
}

function gaussianPlueAt(inputs: PlumeInputs, x: number, y: number, z: number, Q: number): number {
  return gaussianPlumeC(inputs, x, y, z, Q);
}
