export type CriticalFacilityCategory =
  | "hospital"
  | "healthcare"
  | "school"
  | "fire_station"
  | "ems"
  | "nursing_home"
  | "critical_facility";

export type FacilityDataStatus = "available" | "stale" | "unavailable" | "error";

export interface ThreatZoneGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
}

export interface ThreatZoneFeature {
  type: "Feature";
  id?: string | number;
  properties?: Record<string, unknown>;
  geometry: ThreatZoneGeometry;
}

export interface CriticalFacility {
  id: string;
  name: string;
  category: CriticalFacilityCategory;
  latitude: number;
  longitude: number;
  source: string;
  sourceUpdatedAt: string | null;
  retrievedAt: string;
  metadata: Record<string, unknown>;
}

export interface ThreatZoneFacilityResult {
  id: string;
  label: string;
  threatRank: number;
  colorName: string;
  facilityCounts: Record<CriticalFacilityCategory, number>;
  facilities: CriticalFacility[];
}

export interface FacilitySourceStatus {
  id: string;
  label: string;
  source: string;
  status: FacilityDataStatus;
  candidateCount: number;
  facilityCount: number;
  sourceUpdatedAt: string | null;
  retrievedAt: string | null;
  sourceCatalogUrl?: string;
  usageNote?: string;
  error?: string;
}

export interface ThreatZoneFacilityLookup {
  status: FacilityDataStatus;
  generatedAt: string;
  queryEnvelope: { west: number; south: number; east: number; north: number };
  zones: ThreatZoneFacilityResult[];
  affectedFacilities: Array<CriticalFacility & { zone: string; zoneLabel: string; threatRank: number }>;
  sourceStatuses: FacilitySourceStatus[];
  errors: string[];
}

type FacilitySource = {
  id: string;
  label: string;
  source: string;
  queryUrl: string;
  sourceCatalogUrl?: string;
  usageNote?: string;
  category: CriticalFacilityCategory | "medical_facility";
};

type ArcgisFeature = {
  attributes?: Record<string, unknown>;
  geometry?: { x?: unknown; y?: unknown; [key: string]: unknown };
};

const HIFLD_ASSETS = "https://services9.arcgis.com/FF3qnCUixr5w9JQi/ArcGIS/rest/services/US_HIFLD_Assets/FeatureServer";
const FACILITY_SOURCES: FacilitySource[] = [
  {
    id: "nces-schools-current",
    label: "NCES EDGE School Characteristics - Current",
    source: "NCES EDGE 2024-2025 CCD school locations",
    queryUrl: "https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services/School_Characteristics_Current/FeatureServer/1/query",
    sourceCatalogUrl: "https://nces.ed.gov/programs/edge/Geographic/SchoolLocations",
    usageNote: "Geocoded school points used for HazScope point-in-polygon analysis; source locations require operational verification.",
    category: "school",
  },
  {
    id: "hifld-hospitals",
    label: "HIFLD Hospitals",
    source: "HIFLD Open GP Public Health Hospitals",
    queryUrl: "https://services.arcgis.com/XG15cJAlne2vxtgt/ArcGIS/rest/services/Hospitals_hifld/FeatureServer/0/query",
    category: "hospital",
  },
  {
    id: "hifld-medical-facilities",
    label: "HIFLD Medical Facilities",
    source: "HIFLD Critical Assets - Medical Facilities",
    queryUrl: `${HIFLD_ASSETS}/2/query`,
    category: "medical_facility",
  },
  {
    id: "hifld-fire-stations",
    label: "HIFLD Fire Stations",
    source: "HIFLD Critical Assets - Fire Stations",
    queryUrl: `${HIFLD_ASSETS}/3/query`,
    category: "fire_station",
  },
  {
    id: "hifld-critical-assets",
    label: "HIFLD Critical Assets",
    source: "HIFLD Critical Assets - State EOCs and Local Law Enforcement",
    queryUrl: `${HIFLD_ASSETS}/0/query`,
    category: "critical_facility",
  },
  {
    id: "hifld-law-enforcement",
    label: "HIFLD Local Law Enforcement",
    source: "HIFLD Critical Assets - Local Law Enforcement",
    queryUrl: `${HIFLD_ASSETS}/1/query`,
    category: "critical_facility",
  },
];

const FACILITY_CATEGORIES: CriticalFacilityCategory[] = [
  "hospital",
  "healthcare",
  "school",
  "fire_station",
  "ems",
  "nursing_home",
  "critical_facility",
];
const FRESH_CACHE_MS = 5 * 60 * 1000;
const STALE_CACHE_MS = 30 * 60 * 1000;
const sourceCache = new Map<string, { fetchedAt: number; facilities: CriticalFacility[] }>();

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function textValue(attributes: Record<string, unknown>, names: string[]): string {
  const entries = Object.entries(attributes);
  for (const name of names) {
    const match = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
    const value = match?.[1];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function facilityCategory(source: FacilitySource, attributes: Record<string, unknown>): CriticalFacilityCategory {
  const type = `${textValue(attributes, ["FacilityType", "Type", "AssetType"])} ${textValue(attributes, ["Name", "FacilityName"])}.`.toLowerCase();
  if (source.category === "critical_facility") {
    if (/ems|ambulance|emergency medical|rescue squad/.test(type)) return "ems";
    if (/fire station|fire department/.test(type)) return "fire_station";
    return "critical_facility";
  }
  if (source.category !== "medical_facility") return source.category;
  if (/nursing|skilled nursing|assisted living/.test(type)) return "nursing_home";
  if (/ems|ambulance|emergency medical|rescue squad/.test(type)) return "ems";
  if (/hospital|medical center/.test(type)) return "hospital";
  return "healthcare";
}

function normalizeArcgisFeature(source: FacilitySource, feature: ArcgisFeature, fetchedAt: string): CriticalFacility | null {
  const attributes = feature.attributes || {};
  const longitude = finiteNumber(feature.geometry?.x ?? attributes.LONCOD ?? attributes.longitude ?? attributes.LONGITUDE);
  const latitude = finiteNumber(feature.geometry?.y ?? attributes.LATCOD ?? attributes.latitude ?? attributes.LATITUDE);
  if (longitude === null || latitude === null || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return null;
  const rawId = textValue(attributes, ["NCESSCH", "GlobalID", "OBJECTID", "ID"]) || `${latitude}:${longitude}`;
  const name = textValue(attributes, ["SCH_NAME", "NAME", "Name", "FACILITYNAME", "LEA_NAME"]) || `${source.label} ${rawId}`;
  const category = facilityCategory(source, attributes);
  return {
    id: `${source.id}:${rawId}`,
    name,
    category,
    latitude,
    longitude,
    source: source.source,
    sourceUpdatedAt: null,
    retrievedAt: fetchedAt,
    metadata: {
      sourceId: source.id,
      sourceRecordId: rawId,
      address: textValue(attributes, ["ADDRESS", "LSTREET1"]),
      city: textValue(attributes, ["CITY", "LCITY"]),
      state: textValue(attributes, ["STATE", "LSTATE", "STATE_ABB"]),
      facilityType: textValue(attributes, ["FacilityType", "SCHOOL_LEVEL", "Type", "AssetType"]),
    },
  };
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(5));
}

function facilityDedupeKey(facility: CriticalFacility): string {
  return [
    facility.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    roundCoordinate(facility.latitude),
    roundCoordinate(facility.longitude),
  ].join("|");
}

function preferFacility(current: CriticalFacility, candidate: CriticalFacility): CriticalFacility {
  if (current.category === "healthcare" && candidate.category === "hospital") return candidate;
  if (current.category === "healthcare" && candidate.category === "nursing_home") return candidate;
  return current;
}

function dedupeFacilities(facilities: CriticalFacility[]): CriticalFacility[] {
  const byKey = new Map<string, CriticalFacility>();
  for (const facility of facilities) {
    const key = facilityDedupeKey(facility);
    byKey.set(key, byKey.has(key) ? preferFacility(byKey.get(key)!, facility) : facility);
  }
  return [...byKey.values()];
}

function coordinatesFromGeometry(geometry: ThreatZoneGeometry): number[][] {
  const coordinates: number[][] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value) && typeof value[0] === "number" && typeof value[1] === "number") {
      coordinates.push([value[0], value[1]]);
      return;
    }
    if (Array.isArray(value)) value.forEach(visit);
  };
  visit(geometry.coordinates);
  return coordinates;
}

function zoneEnvelope(zones: ThreatZoneFeature[]): { west: number; south: number; east: number; north: number } | null {
  const coordinates = zones.flatMap((zone) => coordinatesFromGeometry(zone.geometry));
  if (!coordinates.length) return null;
  const envelope = coordinates.reduce((bounds, [longitude, latitude]) => ({
    west: Math.min(bounds.west, longitude),
    south: Math.min(bounds.south, latitude),
    east: Math.max(bounds.east, longitude),
    north: Math.max(bounds.north, latitude),
  }), { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity });
  return Object.values(envelope).every(Number.isFinite) ? envelope : null;
}

function pointOnSegment(point: [number, number], start: number[], end: number[]): boolean {
  const [x, y] = point;
  const cross = (x - start[0]) * (end[1] - start[1]) - (y - start[1]) * (end[0] - start[0]);
  if (Math.abs(cross) > 1e-10) return false;
  return x >= Math.min(start[0], end[0]) - 1e-10 && x <= Math.max(start[0], end[0]) + 1e-10
    && y >= Math.min(start[1], end[1]) - 1e-10 && y <= Math.max(start[1], end[1]) + 1e-10;
}

export function pointInRing(point: [number, number], ring: number[][]): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const current = ring[index];
    const prior = ring[previous];
    if (pointOnSegment(point, prior, current)) return true;
    const intersects = (current[1] > point[1]) !== (prior[1] > point[1])
      && point[0] < ((prior[0] - current[0]) * (point[1] - current[1])) / (prior[1] - current[1]) + current[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInGeometry(point: [number, number], geometry: ThreatZoneGeometry): boolean {
  if (geometry.type === "Polygon") {
    const rings = Array.isArray(geometry.coordinates) ? geometry.coordinates as number[][][] : [];
    return Boolean(rings[0] && pointInRing(point, rings[0]) && !rings.slice(1).some((hole) => pointInRing(point, hole)));
  }
  const polygons = Array.isArray(geometry.coordinates) ? geometry.coordinates as number[][][][] : [];
  return polygons.some((polygon) => Boolean(polygon[0] && pointInRing(point, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(point, hole))));
}

function emptyFacilityCounts(): Record<CriticalFacilityCategory, number> {
  return Object.fromEntries(FACILITY_CATEGORIES.map((category) => [category, 0])) as Record<CriticalFacilityCategory, number>;
}

export function classifyFacilitiesByThreatZone(zones: ThreatZoneFeature[], facilities: CriticalFacility[]): {
  zones: ThreatZoneFacilityResult[];
  affectedFacilities: Array<CriticalFacility & { zone: string; zoneLabel: string; threatRank: number }>;
} {
  const orderedZones = zones
    .map((zone, index) => ({ zone, index, threatRank: finiteNumber(zone.properties?.threatRank) ?? 1 }))
    .sort((left, right) => right.threatRank - left.threatRank || left.index - right.index);
  const zoneResults: ThreatZoneFacilityResult[] = zones.map((zone, index) => ({
    id: String(zone.properties?.zoneId ?? zone.id ?? `zone-${index}`),
    label: String(zone.properties?.label ?? zone.properties?.colorName ?? `Zone ${index + 1}`),
    threatRank: finiteNumber(zone.properties?.threatRank) ?? 1,
    colorName: String(zone.properties?.colorName ?? "zone"),
    facilityCounts: emptyFacilityCounts(),
    facilities: [],
  }));
  const affectedFacilities: Array<CriticalFacility & { zone: string; zoneLabel: string; threatRank: number }> = [];
  for (const facility of dedupeFacilities(facilities)) {
    const match = orderedZones.find(({ zone }) => pointInGeometry([facility.longitude, facility.latitude], zone.geometry));
    if (!match) continue;
    const zoneIndex = zones.indexOf(match.zone);
    const zoneResult = zoneResults[zoneIndex];
    zoneResult.facilities.push(facility);
    zoneResult.facilityCounts[facility.category] += 1;
    affectedFacilities.push({
      ...facility,
      zone: zoneResult.id,
      zoneLabel: zoneResult.label,
      threatRank: zoneResult.threatRank,
    });
  }
  return { zones: zoneResults, affectedFacilities };
}

function sourceCacheKey(source: FacilitySource, envelope: { west: number; south: number; east: number; north: number }): string {
  return `${source.id}:${[envelope.west, envelope.south, envelope.east, envelope.north].map((value) => value.toFixed(5)).join(",")}`;
}

async function querySource(
  source: FacilitySource,
  envelope: { west: number; south: number; east: number; north: number },
  fetchImpl: typeof globalThis.fetch,
): Promise<{ facilities: CriticalFacility[]; status: "available" | "stale"; candidateCount: number; sourceUpdatedAt: string | null; retrievedAt: string; error?: string }> {
  const key = sourceCacheKey(source, envelope);
  const now = Date.now();
  const cached = sourceCache.get(key);
  if (cached && now - cached.fetchedAt <= FRESH_CACHE_MS) {
    return {
      facilities: cached.facilities,
      status: "available",
      candidateCount: cached.facilities.length,
      sourceUpdatedAt: null,
      retrievedAt: new Date(cached.fetchedAt).toISOString(),
    };
  }
  const params = new URLSearchParams({
    f: "json",
    where: "1=1",
    geometry: JSON.stringify({ xmin: envelope.west, ymin: envelope.south, xmax: envelope.east, ymax: envelope.north, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: "2000",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetchImpl(`${source.queryUrl}?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as { error?: { message?: string }; features?: ArcgisFeature[]; exceededTransferLimit?: boolean };
    if (payload.error) throw new Error(payload.error.message || "ArcGIS query failed");
    const fetchedAt = new Date().toISOString();
    const facilities = dedupeFacilities((payload.features || []).map((feature) => normalizeArcgisFeature(source, feature, fetchedAt)).filter((facility): facility is CriticalFacility => Boolean(facility)));
    sourceCache.set(key, { fetchedAt: now, facilities });
    return { facilities, status: "available", candidateCount: payload.features?.length || 0, sourceUpdatedAt: null, retrievedAt: fetchedAt };
  } catch (error) {
    if (cached && now - cached.fetchedAt <= STALE_CACHE_MS) {
      return {
        facilities: cached.facilities,
        status: "stale",
        candidateCount: cached.facilities.length,
        sourceUpdatedAt: null,
        retrievedAt: new Date(cached.fetchedAt).toISOString(),
        error: error instanceof Error ? error.message : "Facility source unavailable",
      };
    }
    throw new Error(`${source.label}: ${error instanceof Error ? error.message : "Facility source unavailable"}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function lookupCriticalInfrastructure(
  zones: ThreatZoneFeature[],
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<ThreatZoneFacilityLookup> {
  const generatedAt = new Date().toISOString();
  const envelope = zoneEnvelope(zones);
  if (!envelope) throw new Error("Threat-zone geometry is required for facility lookup");
  const results = await Promise.all(FACILITY_SOURCES.map(async (source) => {
    try {
      const result = await querySource(source, envelope, fetchImpl);
      return {
        source,
        result,
        status: {
          id: source.id,
          label: source.label,
          source: source.source,
          status: result.status,
          candidateCount: result.candidateCount,
          facilityCount: result.facilities.length,
          sourceUpdatedAt: result.sourceUpdatedAt,
          retrievedAt: result.retrievedAt,
          ...(source.sourceCatalogUrl ? { sourceCatalogUrl: source.sourceCatalogUrl } : {}),
          ...(source.usageNote ? { usageNote: source.usageNote } : {}),
          ...(result.error ? { error: result.error } : {}),
        } satisfies FacilitySourceStatus,
      };
    } catch (error) {
      return {
        source,
        result: null,
        status: {
          id: source.id,
          label: source.label,
          source: source.source,
          status: "unavailable" as const,
          candidateCount: 0,
          facilityCount: 0,
          sourceUpdatedAt: null,
          retrievedAt: null,
          ...(source.sourceCatalogUrl ? { sourceCatalogUrl: source.sourceCatalogUrl } : {}),
          ...(source.usageNote ? { usageNote: source.usageNote } : {}),
          error: error instanceof Error ? error.message : "Facility source unavailable",
        } satisfies FacilitySourceStatus,
      };
    }
  }));
  const facilities = dedupeFacilities(results.flatMap((entry) => entry.result?.facilities || []));
  const classified = classifyFacilitiesByThreatZone(zones, facilities);
  const sourceStatuses = results.map((entry) => entry.status);
  const errors = sourceStatuses.filter((status) => status.error).map((status) => status.error!);
  const availableCount = sourceStatuses.filter((status) => status.status === "available").length;
  const staleCount = sourceStatuses.filter((status) => status.status === "stale").length;
  const status: FacilityDataStatus = availableCount === FACILITY_SOURCES.length
    ? "available"
    : availableCount + staleCount > 0
      ? "stale"
      : "error";
  if (process.env.NODE_ENV !== "production") {
    console.info("[threat-zone] facility lookup", {
      envelope,
      candidateCounts: Object.fromEntries(sourceStatuses.map((source) => [source.id, source.candidateCount])),
      matchedByZone: classified.zones.map((zone) => ({ id: zone.id, count: zone.facilities.length })),
      errors,
    });
  }
  return { status, generatedAt, queryEnvelope: envelope, ...classified, sourceStatuses, errors };
}

export function clearCriticalInfrastructureCache(): void {
  sourceCache.clear();
}
