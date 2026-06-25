import { z } from "zod";

export const WeatherSource = z.enum([
  "weather:nws",
  "weather:open-meteo",
  "cws",
]);
export type WeatherSource = z.infer<typeof WeatherSource>;

export const Observation = z.object({
  source: z.string(),
  ts: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  windSpeedMps: z.number().nonnegative().optional(),
  windDirDeg: z.number().min(0).max(360).optional(),
  gustMps: z.number().nonnegative().optional(),
  tempC: z.number().optional(),
  rh: z.number().min(0).max(100).optional(),
  pressureHpa: z.number().optional(),
  cloudCoverPct: z.number().min(0).max(100).optional(),
  providerMetadata: z.record(z.string(), z.unknown()).default({}),
});
export type Observation = z.infer<typeof Observation>;

export const SensorReading = z.object({
  gasName: z.string(),
  unit: z.string(),
  value: z.number(),
  alarm: z.enum(["none", "low", "high", "twa", "stel"]).default("none"),
});
export type SensorReading = z.infer<typeof SensorReading>;

export const Reading = z.object({
  source: z.string(),
  ts: z.string(),
  monitorId: z.string(),
  model: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  batteryPct: z.number().min(0).max(100).optional(),
  runTimeSec: z.number().int().nonnegative().optional(),
  sensors: z.array(SensorReading),
});
export type Reading = z.infer<typeof Reading>;

export const IntegrationConfig = z.object({
  id: z.string(),
  kind: z.enum([
    "rae:safety-suite",
    "weather:nws",
    "weather:open-meteo",
    "weather:cws",
  ]),
  label: z.string(),
  enabled: z.boolean().default(true),
  url: z.string().optional(),
  apiKey: z.string().optional(),
  appId: z.string().optional(),
  pollIntervalSec: z.number().int().positive().default(60),
  lastSeenTs: z.string().optional(),
  lastError: z.string().optional(),
  createdAt: z.string(),
});
export type IntegrationConfig = z.infer<typeof IntegrationConfig>;
