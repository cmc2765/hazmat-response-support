import { z } from "zod";

export const StabilityClass = z.enum(["A", "B", "C", "D", "E", "F"]);
export type StabilityClass = z.infer<typeof StabilityClass>;

export const ReleaseKind = z.enum(["puff", "plume"]);
export type ReleaseKind = z.infer<typeof ReleaseKind>;

export const PlumeInputs = z.object({
  chemicalId: z.string(),
  releaseKind: ReleaseKind,
  containerType: z.string().optional(),
  totalMassKg: z.number().positive().optional(),
  releaseRateKgPerSec: z.number().positive().optional(),
  durationSec: z.number().positive().optional(),
  releaseHeightM: z.number().nonnegative().default(0),
  windSpeedMps: z.number().positive(),
  windDirDeg: z.number().min(0).max(360),
  stabilityClass: StabilityClass,
  surfaceRoughness: z.enum(["urban", "rural"]).default("rural"),
  tempC: z.number().gt(-273.15),
  rh: z.number().min(0).max(100).optional(),
  molecularWeight: z.number().positive().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  endpointDurationMinutes: z.union([
    z.literal(10), z.literal(30), z.literal(60), z.literal(240), z.literal(480),
  ]).optional(),
});
export type PlumeInputs = z.infer<typeof PlumeInputs>;

export const PlumeSourceRecord = z.object({
  sourceName: z.string().min(1),
  sourceRecordId: z.string().min(1),
  fields: z.array(z.string().min(1)).min(1),
  values: z.record(z.unknown()),
  approved: z.literal(true),
  sourceVersion: z.string().min(1).optional(),
  sourceLocator: z.string().min(1).optional(),
}).superRefine((record, context) => {
  for (const field of record.fields) {
    if (!(field in record.values)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["values", field], message: "source value is required" });
    }
  }
});
export type PlumeSourceRecord = z.infer<typeof PlumeSourceRecord>;

export const PlumeCalculationEvidence = z.object({
  modelName: z.string().min(1),
  formulaReference: z.string().min(1),
  sourceData: z.array(PlumeSourceRecord).min(1),
  limitations: z.array(z.string().min(1)).min(1),
});
export type PlumeCalculationEvidence = z.infer<typeof PlumeCalculationEvidence>;

export const BaselinePlumeModelMetadata = z.object({
  modelName: z.literal("HazMatIQ Baseline Plume Planning Model"),
  modelStatus: z.literal("Planning Estimate"),
  validationStatus: z.literal("Not independently validated"),
  formulaStatus: z.literal("Existing application plume calculation"),
  formulaReference: z.string().min(1),
  limitations: z.array(z.string().min(1)).min(1),
});
export type BaselinePlumeModelMetadata = z.infer<typeof BaselinePlumeModelMetadata>;

export const ThresholdBand = z.object({
  kind: z.enum(["AEGL", "ERPG", "TEEL"]),
  level: z.number().int().min(0).max(3),
  valuePpm: z.number().positive(),
  label: z.string(),
  durationMinutes: z.number().positive().optional(),
  source: z.string().min(1).optional(),
});
export type ThresholdBand = z.infer<typeof ThresholdBand>;

export const ThresholdBandMgM3 = z.object({
  kind: z.enum(["AEGL", "ERPG", "TEEL"]),
  level: z.number().int().min(0).max(3),
  valueMgM3: z.number().positive(),
  label: z.string(),
});
export type ThresholdBandMgM3 = z.infer<typeof ThresholdBandMgM3>;

export function ppmToMgM3(ppm: number, molecularWeight: number, tempC = 25): number {
  const TK = tempC + 273.15;
  const M = molecularWeight;
  return (ppm * M * 101.325) / (8.314 * TK);
}

export function mgM3ToPpm(mgm3: number, molecularWeight: number, tempC = 25): number {
  const TK = tempC + 273.15;
  const M = molecularWeight;
  return (mgm3 * 8.314 * TK) / (M * 101.325);
}

export const Isopleth = z.object({
  thresholdKind: z.enum(["AEGL", "ERPG", "TEEL"]),
  thresholdLevel: z.number().int().min(0).max(3),
  polygon: z.array(z.tuple([z.number(), z.number()])),
  maxDownwindM: z.number().nonnegative(),
  maxCrosswindM: z.number().nonnegative(),
  rangeTruncated: z.boolean(),
});
export type Isopleth = z.infer<typeof Isopleth>;

export const CenterlinePoint = z.object({
  distanceM: z.number().nonnegative(),
  concentrationPpm: z.number().nonnegative(),
});
export type CenterlinePoint = z.infer<typeof CenterlinePoint>;

export const PlumeResult = z.object({
  status: z.literal("Calculated estimate"),
  modelVersion: z.string(),
  modelName: z.string(),
  modelStatus: z.literal("Planning Estimate"),
  validationStatus: z.literal("Not independently validated"),
  validated: z.literal(false),
  inputs: PlumeInputs,
  isopleths: z.array(Isopleth),
  centerline: z.array(CenterlinePoint),
  thresholdsUsed: z.array(ThresholdBand),
  computationalRangeM: z.number().positive(),
  samplingIntervalM: z.number().positive(),
  computedAt: z.string(),
  modelMetadata: BaselinePlumeModelMetadata,
  calculation: PlumeCalculationEvidence.optional(),
  limitations: z.array(z.string().min(1)).min(1),
  disclaimer: z.string(),
});
export type PlumeResult = z.infer<typeof PlumeResult>;

export const PlumeRun = z.object({
  id: z.string(),
  incidentId: z.string().optional(),
  inputs: PlumeInputs,
  result: PlumeResult,
  createdAt: z.string(),
});
export type PlumeRun = z.infer<typeof PlumeRun>;
