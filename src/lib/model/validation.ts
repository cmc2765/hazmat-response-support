import { runPlume } from "./plume";
import type { PlumeInputs, StabilityClass, ThresholdBand } from "@/lib/schema";

export const PLUME_VALIDATION_PLACEHOLDER_WARNING =
  "Do not use this case for validation until published expected distances and source references are added.";

export type PlumeValidationCategory =
  | "ammonia-railcar-release"
  | "chlorine-cylinder-release"
  | "continuous-release"
  | "puff-release";

export interface PlumeValidationCase {
  id: string;
  category: PlumeValidationCategory;
  chemical: {
    id: string | null;
    name: string | null;
    molecularWeight: number | null;
  };
  release: {
    type: "continuous" | "puff";
    containerType: string | null;
    releaseRateKgPerSec: number | null;
    totalMassKg: number | null;
    durationSec: number | null;
  };
  weather: {
    windSpeedMps: number | null;
    windDirectionDeg: number | null;
    temperatureC: number | null;
  };
  stabilityClass: StabilityClass | null;
  surfaceRoughness: "urban" | "rural" | null;
  threshold: {
    kind: ThresholdBand["kind"] | null;
    level: 1 | 2 | 3 | null;
    valuePpm: number | null;
  };
  expectedDistanceM: number | null;
  expectedDistanceRelation?: "exact" | "minimum";
  comparisonCompatibility?: "direct" | "requires-model-mapping";
  expectedSource: string | null;
  toleranceFraction: number;
  warning?: string;
}

export interface PlumeValidationCaseResult {
  id: string;
  category: PlumeValidationCategory;
  status: "skipped" | "passed" | "failed";
  expectedDistanceM: number | null;
  expectedSource: string | null;
  toleranceFraction: number;
  actualDistanceM: number | null;
  differenceFraction: number | null;
  message: string;
}

export interface PlumeValidationSummary {
  totalValidationCases: number;
  runnableValidationCases: number;
  skippedCases: number;
  passedCases: number;
  failedCases: number;
  validationStatus: "validated" | "not-independently-validated";
}

function isPositiveNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function getPlumeValidationCaseBlockers(validationCase: PlumeValidationCase): string[] {
  const blockers: string[] = [];
  if (!validationCase.chemical.id) blockers.push("chemical id");
  if (!validationCase.chemical.name) blockers.push("chemical name");
  if (!isPositiveNumber(validationCase.chemical.molecularWeight)) blockers.push("molecular weight");
  if (!validationCase.release.containerType) blockers.push("container type");
  if (validationCase.release.type === "continuous" && !isPositiveNumber(validationCase.release.releaseRateKgPerSec)) {
    blockers.push("release rate");
  }
  if (validationCase.release.type === "puff" && !isPositiveNumber(validationCase.release.totalMassKg)) {
    blockers.push("total released mass");
  }
  if (!isPositiveNumber(validationCase.weather.windSpeedMps)) blockers.push("wind speed");
  if (validationCase.weather.windDirectionDeg === null || !Number.isFinite(validationCase.weather.windDirectionDeg)) {
    blockers.push("wind direction");
  }
  if (validationCase.weather.temperatureC === null || !Number.isFinite(validationCase.weather.temperatureC)) {
    blockers.push("temperature");
  }
  if (!validationCase.stabilityClass) blockers.push("stability class");
  if (!validationCase.surfaceRoughness) blockers.push("surface roughness");
  if (!validationCase.threshold.kind) blockers.push("threshold kind");
  if (!validationCase.threshold.level) blockers.push("threshold level");
  if (!isPositiveNumber(validationCase.threshold.valuePpm)) blockers.push("threshold value");
  if (!isPositiveNumber(validationCase.expectedDistanceM)) blockers.push("published expected distance");
  if (!validationCase.expectedSource?.trim()) blockers.push("published source reference");
  if (validationCase.comparisonCompatibility === "requires-model-mapping") {
    blockers.push("documented model/input compatibility mapping");
  }
  if (!isPositiveNumber(validationCase.toleranceFraction)) blockers.push("tolerance");
  return blockers;
}

export function runPlumeValidationCase(validationCase: PlumeValidationCase): PlumeValidationCaseResult {
  const blockers = getPlumeValidationCaseBlockers(validationCase);
  if (blockers.length) {
    return {
      id: validationCase.id,
      category: validationCase.category,
      status: "skipped",
      expectedDistanceM: validationCase.expectedDistanceM,
      expectedSource: validationCase.expectedSource,
      toleranceFraction: validationCase.toleranceFraction,
      actualDistanceM: null,
      differenceFraction: null,
      message: `${validationCase.expectedSource && validationCase.expectedDistanceM
        ? "Published comparison evidence is registered but is not directly runnable."
        : PLUME_VALIDATION_PLACEHOLDER_WARNING} Missing: ${blockers.join(", ")}.`,
    };
  }

  // The blocker check above guarantees these nullable fixture fields are complete.
  const chemicalId = validationCase.chemical.id!;
  const molecularWeight = validationCase.chemical.molecularWeight!;
  const windSpeedMps = validationCase.weather.windSpeedMps!;
  const windDirectionDeg = validationCase.weather.windDirectionDeg!;
  const temperatureC = validationCase.weather.temperatureC!;
  const stabilityClass = validationCase.stabilityClass!;
  const surfaceRoughness = validationCase.surfaceRoughness!;
  const thresholdKind = validationCase.threshold.kind!;
  const thresholdLevel = validationCase.threshold.level!;
  const thresholdValuePpm = validationCase.threshold.valuePpm!;
  const expectedDistanceM = validationCase.expectedDistanceM!;
  const releaseRateKgPerSec = validationCase.release.releaseRateKgPerSec!;
  const totalMassKg = validationCase.release.totalMassKg!;

  const inputs: PlumeInputs = {
    chemicalId,
    releaseKind: validationCase.release.type === "continuous" ? "plume" : "puff",
    releaseHeightM: 0,
    windSpeedMps,
    windDirDeg: windDirectionDeg,
    stabilityClass,
    surfaceRoughness,
    tempC: temperatureC,
    molecularWeight,
    ...(validationCase.release.durationSec === null ? {} : { durationSec: validationCase.release.durationSec }),
    ...(validationCase.release.type === "continuous"
      ? { releaseRateKgPerSec }
      : { totalMassKg }),
  };
  const threshold: ThresholdBand = {
    kind: thresholdKind,
    level: thresholdLevel,
    valuePpm: thresholdValuePpm,
    label: `${thresholdKind}-${thresholdLevel}`,
  };
  const result = runPlume(inputs, {
    thresholds: [threshold],
    molecularWeight,
    ...(validationCase.release.type === "continuous"
      ? { emissionRateKgPerSec: releaseRateKgPerSec }
      : { totalMassKg }),
  });
  const actualDistanceM = result.isopleths[0]?.maxDownwindM ?? 0;
  const differenceFraction = Math.abs(actualDistanceM - expectedDistanceM)
    / expectedDistanceM;
  const expectedDistanceRelation = validationCase.expectedDistanceRelation ?? "exact";
  const status = expectedDistanceRelation === "minimum"
    ? (actualDistanceM >= expectedDistanceM * (1 - validationCase.toleranceFraction) ? "passed" : "failed")
    : (differenceFraction <= validationCase.toleranceFraction ? "passed" : "failed");
  return {
    id: validationCase.id,
    category: validationCase.category,
    status,
    expectedDistanceM,
    expectedSource: validationCase.expectedSource,
    toleranceFraction: validationCase.toleranceFraction,
    actualDistanceM,
    differenceFraction,
    message: status === "passed"
      ? `Actual modeled distance satisfies the published ${expectedDistanceRelation} distance within the configured screening tolerance.`
      : `Actual modeled distance does not satisfy the published ${expectedDistanceRelation} distance within the configured screening tolerance.`,
  };
}

export function summarizePlumeValidation(results: PlumeValidationCaseResult[]): PlumeValidationSummary {
  const skippedCases = results.filter((result) => result.status === "skipped").length;
  const passedCases = results.filter((result) => result.status === "passed").length;
  const failedCases = results.filter((result) => result.status === "failed").length;
  const runnableValidationCases = passedCases + failedCases;
  return {
    totalValidationCases: results.length,
    runnableValidationCases,
    skippedCases,
    passedCases,
    failedCases,
    validationStatus: runnableValidationCases > 0 && skippedCases === 0 && failedCases === 0
      ? "validated"
      : "not-independently-validated",
  };
}

export function validatePlumeCases(validationCases: PlumeValidationCase[]): {
  results: PlumeValidationCaseResult[];
  summary: PlumeValidationSummary;
} {
  const results = validationCases.map(runPlumeValidationCase);
  return { results, summary: summarizePlumeValidation(results) };
}
