import { cacheResult, fetchWithTimeout, readFresh, readStale, type CachedValue } from "./cache.js";
import { boundsContainPoint, splitBounds, type MapBounds, type WildfireFeature, type WildfireResult } from "./types.js";

export const FIRMS_SOURCE = "NASA FIRMS";
export const FIRMS_WEB_SERVICES_URL = "https://firms.modaps.eosdis.nasa.gov/web-services";
export const FIRMS_REFRESH_INTERVAL_MINUTES = 15;
const FIRMS_ENDPOINT = "https://firms.modaps.eosdis.nasa.gov/usfs/api/area/csv";
export const FIRMS_SENSORS = ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"] as const;
const cache = new Map<string, CachedValue<FirmsDetection[]>>();

export interface FirmsDetection extends WildfireFeature {
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    latitude: number;
    longitude: number;
    detectedAt: string | null;
    satellite: string | null;
    instrument: string | null;
    confidence: string | number | null;
    frp: number | null;
    dayNight: string | null;
    source: typeof FIRMS_SOURCE;
    [key: string]: unknown;
  };
}

function csvRows(csv: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += character;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const header = rows.shift()?.map((value) => value.trim()) || [];
  return rows.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index]?.trim() || ""])));
}

function numberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function detectedAt(row: Record<string, string>): string | null {
  if (!row.acq_date) return null;
  const time = String(row.acq_time || "0000").replace(/\D/g, "").padStart(4, "0").slice(0, 4);
  const date = new Date(`${row.acq_date}T${time.slice(0, 2)}:${time.slice(2, 4)}:00Z`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeSatellite(value: unknown): string | null {
  const satellite = String(value ?? "").trim().toUpperCase().replace(/[ _]/g, "-");
  if (/^(?:N|NOAA-?)20$/.test(satellite)) return "NOAA-20";
  if (/^(?:N|NOAA-?)21$/.test(satellite)) return "NOAA-21";
  return satellite || null;
}

export function normalizeFirmsRow(row: Record<string, string>): FirmsDetection | null {
  const latitude = numberOrNull(row.latitude);
  const longitude = numberOrNull(row.longitude);
  if (latitude === null || longitude === null) return null;
  const satellite = normalizeSatellite(row.satellite);
  const id = [satellite || "VIIRS", row.acq_date, row.acq_time, latitude.toFixed(5), longitude.toFixed(5)].join(":");
  return {
    id,
    geometry: { type: "Point", coordinates: [longitude, latitude] },
    properties: {
      latitude,
      longitude,
      detectedAt: detectedAt(row),
      satellite,
      instrument: row.instrument || null,
      confidence: row.confidence || row.confidence_category || null,
      frp: numberOrNull(row.frp),
      dayNight: row.daynight || row.day_night || null,
      source: FIRMS_SOURCE,
      brightTi4: numberOrNull(row.bright_ti4),
      scan: numberOrNull(row.scan),
      track: numberOrNull(row.track),
    },
    source: FIRMS_SOURCE,
  };
}

export function normalizeFirmsCsv(csv: string): FirmsDetection[] {
  return csvRows(csv).map(normalizeFirmsRow).filter((feature): feature is FirmsDetection => Boolean(feature));
}

function withinHours(feature: FirmsDetection, bounds: MapBounds, hours: number): boolean {
  const { latitude, longitude, detectedAt } = feature.properties;
  if (!boundsContainPoint(bounds, longitude, latitude)) return false;
  if (!detectedAt) return true;
  return Date.now() - new Date(detectedAt).getTime() <= hours * 60 * 60 * 1000;
}

function result(status: WildfireResult<FirmsDetection>["status"], features: FirmsDetection[], retrievedAt: string | null, error?: string): WildfireResult<FirmsDetection> {
  return {
    status,
    source: FIRMS_SOURCE,
    sourceUrl: FIRMS_WEB_SERVICES_URL,
    sourceUse: "NOAA-20 and NOAA-21 VIIRS thermal active-fire detections; distinct from fire perimeter polygons.",
    refreshIntervalMinutes: FIRMS_REFRESH_INTERVAL_MINUTES,
    retrievedAt,
    features,
    count: features.length,
    ...(error ? { error } : {}),
  };
}

export async function queryFirms(
  bounds: MapBounds,
  hours = 24,
  mapKey = process.env.NASA_FIRMS_MAP_KEY?.trim() || "",
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<WildfireResult<FirmsDetection>> {
  if (!mapKey) return result("NOT CONFIGURED", [], null, "NASA_FIRMS_MAP_KEY is not configured");
  const boundedHours = Math.min(120, Math.max(1, Number(hours) || 24));
  const dayRange = Math.min(5, Math.max(1, Math.ceil(boundedHours / 24)));
  const cacheKey = `${mapKey}:${bounds.west.toFixed(3)},${bounds.south.toFixed(3)},${bounds.east.toFixed(3)},${bounds.north.toFixed(3)}:${boundedHours}`;
  const fresh = readFresh(cache, cacheKey);
  if (fresh) return result("CONNECTED", fresh.value, new Date(fresh.fetchedAt).toISOString());

  try {
    const all: FirmsDetection[] = [];
    const failures: string[] = [];
    for (const section of splitBounds(bounds)) {
      const area = `${section.west},${section.south},${section.east},${section.north}`;
      for (const sensor of FIRMS_SENSORS) {
        const url = `${FIRMS_ENDPOINT}/${encodeURIComponent(mapKey)}/${sensor}/${area}/${dayRange}`;
        try {
          const response = await fetchWithTimeout(fetchImpl, url);
          if (!response.ok) throw new Error(`NASA FIRMS HTTP ${response.status}`);
          const text = await response.text();
          if (/^\s*(error|invalid|unauthorized)/i.test(text)) throw new Error("NASA FIRMS returned an error response");
          all.push(...normalizeFirmsCsv(text));
        } catch (error) {
          failures.push(`${sensor}: ${error instanceof Error ? error.message : "request failed"}`);
        }
      }
    }
    if (!all.length && failures.length === splitBounds(bounds).length * FIRMS_SENSORS.length) {
      throw new Error(failures.join("; "));
    }
    const unique = [...new Map(all.map((feature) => [feature.id, feature])).values()]
      .filter((feature) => withinHours(feature, bounds, boundedHours));
    const retrievedAt = new Date().toISOString();
    cacheResult(cache, cacheKey, unique);
    return result("CONNECTED", unique, retrievedAt, failures.length ? `Partial NASA FIRMS response: ${failures.join("; ")}` : undefined);
  } catch (error) {
    const stale = readStale(cache, cacheKey);
    const message = error instanceof Error ? error.message : "NASA FIRMS unavailable";
    if (stale) return result("STALE", stale.value, new Date(stale.fetchedAt).toISOString(), message);
    return result("ERROR", [], null, message);
  }
}
