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
  releaseHeightM: z.number().default(0),
  windSpeedMps: z.number().nonnegative(),
  windDirDeg: z.number().min(0).max(360),
  stabilityClass: StabilityClass,
  surfaceRoughness: z.enum(["urban", "rural"]).default("rural"),
  tempC: z.number(),
  rh: z.number().min(0).max(100).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
export type PlumeInputs = z.infer<typeof PlumeInputs>;

export const ThresholdBand = z.object({
  kind: z.enum(["AEGL", "ERPG", "TEEL"]),
  level: z.number().int().min(0).max(3),
  valuePpm: z.number().nonnegative(),
  label: z.string(),
});
export type ThresholdBand = z.infer<typeof ThresholdBand>;

export const Isopleth = z.object({
  thresholdKind: z.enum(["AEGL", "ERPG", "TEEL"]),
  thresholdLevel: z.number().int().min(0).max(3),
  polygon: z.array(z.tuple([z.number(), z.number()])),
  maxDownwindM: z.number().nonnegative(),
  maxCrosswindM: z.number().nonnegative(),
});
export type Isopleth = z.infer<typeof Isopleth>;

export const CenterlinePoint = z.object({
  distanceM: z.number().nonnegative(),
  concentrationPpm: z.number().nonnegative(),
});
export type CenterlinePoint = z.infer<typeof CenterlinePoint>;

export const PlumeResult = z.object({
  modelVersion: z.string(),
  inputs: PlumeInputs,
  isopleths: z.array(Isopleth),
  centerline: z.array(CenterlinePoint),
  thresholdsUsed: z.array(ThresholdBand),
  computedAt: z.string(),
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
