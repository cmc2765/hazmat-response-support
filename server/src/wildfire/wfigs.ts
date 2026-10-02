import { arcgisGeometryToGeoJson, arcgisQueryUrl, dedupeWildfireFeatures } from "./arcgis.js";
import { cacheResult, fetchWithTimeout, readFresh, readStale, type CachedValue } from "./cache.js";
import { splitBounds, type MapBounds, type WildfireFeature, type WildfireResult } from "./types.js";

export const WFIGS_SOURCE = "NIFC / WFIGS";
export const WFIGS_SERVICE_URL = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer";
export const WFIGS_QUERY_URL = `${WFIGS_SERVICE_URL}/0/query`;
const cache = new Map<string, CachedValue<FirePerimeter[]>>();

export interface FirePerimeter extends WildfireFeature {
  properties: {
    incidentName: string | null;
    acres: number | null;
    updatedAt: string | null;
    source: typeof WFIGS_SOURCE;
    [key: string]: unknown;
  };
}

const field = (attributes: Record<string, unknown>, names: string[]) => names.map((name) => attributes[name]).find((value) => value !== undefined && value !== null && value !== "");

export function normalizeWfigsFeature(feature: { attributes?: Record<string, unknown>; geometry?: { rings?: number[][][] } }): FirePerimeter | null {
  const attributes = feature.attributes || {};
  const geometry = arcgisGeometryToGeoJson(feature.geometry);
  if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) return null;
  const sourceId = field(attributes, ["IRWINID", "IrwinID", "IncidentID", "OBJECTID", "objectid"]);
  if (sourceId === undefined) return null;
  const incidentName = field(attributes, ["IncidentName", "poly_IncidentName", "incidentName"]);
  const acresValue = field(attributes, ["GISAcres", "CurrentAcres", "acres", "Acres"]);
  const updatedValue = field(attributes, ["ModifiedOnDate", "ModifiedOn", "DateCurrent", "updatedAt"]);
  return {
    id: String(sourceId),
    geometry,
    properties: {
      ...attributes,
      incidentName: incidentName == null ? null : String(incidentName),
      acres: Number.isFinite(Number(acresValue)) ? Number(acresValue) : null,
      updatedAt: updatedValue == null ? null : String(updatedValue),
      source: WFIGS_SOURCE,
    },
    source: WFIGS_SOURCE,
  };
}

function emptyOrError(status: WildfireResult<FirePerimeter>["status"], features: FirePerimeter[], retrievedAt: string | null, error?: string): WildfireResult<FirePerimeter> {
  return {
    status,
    source: WFIGS_SOURCE,
    sourceUrl: WFIGS_SERVICE_URL,
    sourceUse: "Current interagency fire perimeter polygons; distinct from NASA FIRMS thermal detections.",
    retrievedAt,
    features,
    count: features.length,
    ...(error ? { error } : {}),
  };
}

export async function queryWfigs(bounds: MapBounds, fetchImpl: typeof globalThis.fetch = globalThis.fetch): Promise<WildfireResult<FirePerimeter>> {
  const cacheKey = [bounds.west, bounds.south, bounds.east, bounds.north].map((value) => value.toFixed(3)).join(",");
  const fresh = readFresh(cache, cacheKey);
  if (fresh) return emptyOrError("CONNECTED", fresh.value, new Date(fresh.fetchedAt).toISOString());
  try {
    const features: FirePerimeter[] = [];
    for (const section of splitBounds(bounds)) {
      const response = await fetchWithTimeout(fetchImpl, arcgisQueryUrl(WFIGS_QUERY_URL, section));
      if (!response.ok) throw new Error(`WFIGS HTTP ${response.status}`);
      const payload = await response.json() as { error?: { message?: string }; features?: Array<{ attributes?: Record<string, unknown>; geometry?: { rings?: number[][][] } }> };
      if (payload.error) throw new Error(payload.error.message || "WFIGS query failed");
      features.push(...(payload.features || []).map(normalizeWfigsFeature).filter((feature): feature is FirePerimeter => Boolean(feature)));
    }
    const unique = dedupeWildfireFeatures(features);
    cacheResult(cache, cacheKey, unique);
    return emptyOrError("CONNECTED", unique, new Date().toISOString());
  } catch (error) {
    const stale = readStale(cache, cacheKey);
    const message = error instanceof Error ? error.message : "WFIGS unavailable";
    if (stale) return emptyOrError("STALE", stale.value, new Date(stale.fetchedAt).toISOString(), message);
    return emptyOrError("ERROR", [], null, message);
  }
}
