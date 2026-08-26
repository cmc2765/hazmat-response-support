import type { PlumeCalculationEvidence, PlumeInputs, PlumeResult, ThresholdBand } from "@/lib/schema";
import { mgM3ToPpm, ppmToMgM3 } from "@/lib/schema";
import { pickRoughness } from "./briggs";
import {
  BASELINE_PLUME_MODEL_METADATA,
  MODEL_VERSION,
  PLUME_DISCLAIMER,
  PLUME_FORMULA_REFERENCE,
  PLUME_MODEL_LIMITATIONS,
  PLUME_MODEL_NAME,
} from "./constants";

export interface RunPlumeOptions {
  thresholds: ThresholdBand[];
  calculationEvidence?: PlumeCalculationEvidence;
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

function solveDownwindThresholdCrossing(
  concentrationKgM3: (x: number) => number,
  targetMgM3: number,
  insideX: number,
  outsideX: number,
): number {
  const targetKgM3 = targetMgM3 / 1e6;
  let low = insideX;
  let high = outsideX;
  // Bisection changes only contour precision, not the underlying dispersion
  // equation. Forty iterations is comfortably below map-coordinate precision.
  for (let iteration = 0; iteration < 40; iteration++) {
    const middle = (low + high) / 2;
    if (concentrationKgM3(middle) >= targetKgM3) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
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
  const calculationEvidence = opts.calculationEvidence;
  if (calculationEvidence) {
    const evidencedFields = new Set(calculationEvidence.sourceData
      .filter((record) => record.approved === true)
      .flatMap((record) => record.fields.filter((field) => field in record.values)));
    const missingEvidence = requiredEvidence.filter((field) => !evidencedFields.has(field));
    if (missingEvidence.length) throw new Error(`Missing approved plume source records for: ${missingEvidence.join(", ")}`);
  }
  if (!Number.isFinite(mw) || mw! <= 0) throw new Error("Molecular weight is required and must be positive; no default may be inferred.");
  if (!Number.isFinite(inputs.windSpeedMps) || inputs.windSpeedMps <= 0) throw new Error("A positive wind speed is required.");
  if (!Number.isFinite(inputs.windDirDeg) || inputs.windDirDeg < 0 || inputs.windDirDeg > 360) throw new Error("Wind direction must be between 0 and 360 degrees.");
  if (!Number.isFinite(inputs.releaseHeightM) || inputs.releaseHeightM < 0) throw new Error("Release height must be zero or greater.");
  if (!Number.isFinite(inputs.tempC) || inputs.tempC <= -273.15) throw new Error("Air temperature must be above absolute zero.");
  if (!Number.isFinite(maxRange) || maxRange <= 0) throw new Error("Computational range must be positive.");
  if (isPlume && (!Number.isFinite(Q) || Q! <= 0)) throw new Error("A positive release rate is required for a continuous plume; no default may be inferred.");
  if (!isPlume && (!Number.isFinite(M) || M! <= 0)) throw new Error("A positive total mass is required for a puff; no default may be inferred.");
  if (!isPlume && (!Number.isFinite(inputs.durationSec) || inputs.durationSec! <= 0)) throw new Error("A positive evaluation time is required for a puff; no default may be inferred.");
  if (!opts.thresholds.length) throw new Error("At least one approved exposure threshold is required; no default may be inferred.");
  if (opts.thresholds.some((threshold) => !Number.isFinite(threshold.valuePpm) || threshold.valuePpm <= 0)) {
    throw new Error("Every exposure threshold must be a positive finite concentration.");
  }
  const calculatedInputValues: Record<string, unknown> = {
    ...inputs,
    molecularWeight: mw,
    thresholds: opts.thresholds,
    ...(isPlume ? { releaseRateKgPerSec: Q } : { totalMassKg: M }),
  };
  if (calculationEvidence) {
    const mismatchedEvidence = requiredEvidence.filter((field) => !calculationEvidence.sourceData.some((record) =>
      record.approved === true
      && record.fields.includes(field)
      && JSON.stringify(record.values[field]) === JSON.stringify(calculatedInputValues[field])));
    if (mismatchedEvidence.length) {
      throw new Error(`Plume inputs do not match approved source records for: ${mismatchedEvidence.join(", ")}`);
    }
  }
  const puffSigmaY = isPlume
    ? undefined
    : Math.max(pickRoughness(inputs.stabilityClass, inputs.surfaceRoughness).sigmaY(Math.max(inputs.windSpeedMps, 0.1) * inputs.durationSec!), 1e-3);
  const targetMgM3ByKind = new Map<string, number>();
  for (const b of opts.thresholds) {
    targetMgM3ByKind.set(`${b.kind}-${b.level}`, ppmToMgM3(b.valuePpm, mw!, inputs.tempC));
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
      concentrationPpm: Number(mgM3ToPpm(c * 1e6, mw!, inputs.tempC).toFixed(4)),
    });
  }

  const isopleths = opts.thresholds.map((band) => {
    const target = thresholdTarget(band.kind, band.level);
    const pts: Array<[number, number]> = [];
    let maxY = 0;
    let maxXReached = 0;
    let previousInsideX: number | null = null;
    const centerlineConcentration = (x: number) => isPlume
      ? gaussianPlumeC(inputs, x, 0, 0, Q!)
      : gaussianPuffC(inputs, x, 0, 0, M!, inputs.durationSec!);
    for (let i = 1; i <= xSamples; i++) {
      const x = i * xStep;
      const c0 = centerlineConcentration(x);
      if (c0 * 1e6 < target) {
        if (previousInsideX !== null) {
          const endpointX = solveDownwindThresholdCrossing(centerlineConcentration, target, previousInsideX, x);
          pts.push([endpointX, 0]);
          maxXReached = endpointX;
          break;
        }
        continue;
      }
      const y = yAtThreshold(inputs, x, c0, target, puffSigmaY);
      if (y > maxY) maxY = y;
      maxXReached = Math.max(maxXReached, x);
      pts.push([x, y]);
      previousInsideX = x;
    }
    const polygon = buildClosedPolygon(pts);
    const finalX = xSamples * xStep;
    const finalCenterlineKgM3 = isPlume
      ? gaussianPlumeC(inputs, finalX, 0, 0, Q!)
      : gaussianPuffC(inputs, finalX, 0, 0, M!, inputs.durationSec!);
    return {
      thresholdKind: band.kind,
      thresholdLevel: band.level,
      polygon,
      maxDownwindM: maxXReached,
      maxCrosswindM: maxY,
      rangeTruncated: finalCenterlineKgM3 * 1e6 >= target,
    };
  });

  const rangeTruncated = isopleths.some((isopleth) => isopleth.rangeTruncated);
  const resultLimitations = [
    ...BASELINE_PLUME_MODEL_METADATA.limitations,
    ...(rangeTruncated ? [
      `One or more AEGL isopleths reach the ${maxRange} m computational boundary; the reported distance is a lower bound, not a modeled endpoint.`,
    ] : []),
    `Crosswind widths are sampled every ${Number(xStep.toFixed(3))} m; non-truncated downwind threshold crossings are refined by bisection but must not imply accuracy beyond model assumptions and input quality.`,
  ];

  return {
    status: "Calculated estimate",
    modelVersion: MODEL_VERSION,
    modelName: BASELINE_PLUME_MODEL_METADATA.modelName,
    modelStatus: BASELINE_PLUME_MODEL_METADATA.modelStatus,
    validationStatus: BASELINE_PLUME_MODEL_METADATA.validationStatus,
    validated: false,
    inputs,
    isopleths,
    centerline,
    thresholdsUsed: opts.thresholds,
    computationalRangeM: maxRange,
    samplingIntervalM: xStep,
    computedAt,
    modelMetadata: {
      ...BASELINE_PLUME_MODEL_METADATA,
      limitations: [...BASELINE_PLUME_MODEL_METADATA.limitations],
    },
    ...(calculationEvidence ? {
      calculation: {
        ...calculationEvidence,
        modelName: PLUME_MODEL_NAME,
        formulaReference: PLUME_FORMULA_REFERENCE,
        limitations: [...new Set([...PLUME_MODEL_LIMITATIONS, ...calculationEvidence.limitations])],
      },
    } : {}),
    limitations: resultLimitations,
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
