import { arcgisGeometryToGeoJson, arcgisQueryUrl, dedupeWildfireFeatures } from "./arcgis.js";
import { cacheResult, fetchWithTimeout, readFresh, readStale, type CachedValue } from "./cache.js";
import { splitBounds, type MapBounds, type WildfireFeature, type WildfireResult } from "./types.js";

export const HMS_SOURCE = "NOAA HMS";
export const HMS_QUERY_URL = "https://services2.arcgis.com/C8EMgrsFcRFL6LrL/ArcGIS/rest/services/NOAA_Satellite_Smoke_Detection_(v1)/FeatureServer/0/query";
const cache = new Map<string, CachedValue<SmokePlume[]>>();

export interface SmokePlume extends WildfireFeature {
  properties: {
    density: string | null;
    startTime: string | null;
    endTime: string | null;
    source: typeof HMS_SOURCE;
    [key: string]: unknown;
  };
}

const field = (attributes: Record<string, unknown>, names: string[]) => names.map((name) => attributes[name]).find((value) => value !== undefined && value !== null && value !== "");

export function normalizeHmsFeature(feature: { attributes?: Record<string, unknown>; geometry?: { rings?: number[][][] } }): SmokePlume | null {
  const attributes = feature.attributes || {};
  const geometry = arcgisGeometryToGeoJson(feature.geometry);
  if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) return null;
  const sourceId = field(attributes, ["FID", "OBJECTID", "objectid"]);
  if (sourceId === undefined) return null;
  return {
    id: String(sourceId),
    geometry,
    properties: {
      ...attributes,
      density: field(attributes, ["Density", "density"]) == null ? null : String(field(attributes, ["Density", "density"])),
      startTime: field(attributes, ["Start", "startTime"]) == null ? null : String(field(attributes, ["Start", "startTime"])),
      endTime: field(attributes, ["End_", "End", "endTime"]) == null ? null : String(field(attributes, ["End_", "End", "endTime"])),
      source: HMS_SOURCE,
    },
    source: HMS_SOURCE,
  };
}

export async function queryHms(bounds: MapBounds, fetchImpl: typeof globalThis.fetch = globalThis.fetch): Promise<WildfireResult<SmokePlume>> {
  const cacheKey = [bounds.west, bounds.south, bounds.east, bounds.north].map((value) => value.toFixed(3)).join(",");
  const fresh = readFresh(cache, cacheKey);
  if (fresh) return { status: "CONNECTED", source: HMS_SOURCE, retrievedAt: new Date(fresh.fetchedAt).toISOString(), features: fresh.value, count: fresh.value.length };
  try {
    const features: SmokePlume[] = [];
    for (const section of splitBounds(bounds)) {
      const response = await fetchWithTimeout(fetchImpl, arcgisQueryUrl(HMS_QUERY_URL, section, 1000));
      if (!response.ok) throw new Error(`NOAA HMS HTTP ${response.status}`);
      const payload = await response.json() as { error?: { message?: string }; features?: Array<{ attributes?: Record<string, unknown>; geometry?: { rings?: number[][][] } }> };
      if (payload.error) throw new Error(payload.error.message || "NOAA HMS query failed");
      features.push(...(payload.features || []).map(normalizeHmsFeature).filter((feature): feature is SmokePlume => Boolean(feature)));
    }
    const unique = dedupeWildfireFeatures(features);
    cacheResult(cache, cacheKey, unique);
    return { status: "CONNECTED", source: HMS_SOURCE, retrievedAt: new Date().toISOString(), features: unique, count: unique.length };
  } catch (error) {
    const stale = readStale(cache, cacheKey);
    const message = error instanceof Error ? error.message : "NOAA HMS unavailable";
    if (stale) return { status: "STALE", source: HMS_SOURCE, retrievedAt: new Date(stale.fetchedAt).toISOString(), features: stale.value, count: stale.value.length, error: message };
    return { status: "ERROR", source: HMS_SOURCE, retrievedAt: null, features: [], count: 0, error: message };
  }
}
