export const WEATHER_SOURCES = [
  "Columbia Weather Station",
  "NWS",
  "Open-Meteo",
  "Manual Entry",
  "No Current Data Exists",
] as const;

export type WeatherSource = typeof WEATHER_SOURCES[number];

export const WEATHER_STATUSES = [
  "Current",
  "Recent",
  "Stale",
  "Expired",
  "Manual",
  "Location Required",
  "Unavailable",
  "No Current Data Exists",
] as const;

export type WeatherStatus = typeof WEATHER_STATUSES[number];

export type WeatherSnapshot = {
  source: WeatherSource;
  status: WeatherStatus;
  observationTime?: string;
  fetchedAt?: string;
  locationLabel?: string;
  coordinates?: { lat: number; lon: number };
  stationId?: string;
  stationName?: string;
  temperatureF?: number;
  humidityPercent?: number;
  windSpeedMph?: number;
  windDirectionDegrees?: number;
  windDirectionCardinal?: string;
  windGustMph?: number;
  pressureMb?: number;
  cloudCover?: string;
  raw?: unknown;
  warnings: string[];
};

export function weatherStatusFromObservation(
  observationTime?: string,
  now: string | Date = new Date(),
): WeatherStatus {
  if (!observationTime) return "Unavailable";
  const observed = Date.parse(observationTime);
  const current = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(observed) || !Number.isFinite(current)) return "Unavailable";
  const ageMinutes = (current - observed) / 60_000;
  if (ageMinutes < 0) return "Unavailable";
  if (ageMinutes <= 10) return "Current";
  if (ageMinutes <= 30) return "Recent";
  if (ageMinutes <= 60) return "Stale";
  return "Expired";
}