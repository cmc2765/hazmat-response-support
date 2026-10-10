import type { MapBounds } from "../wildfire/types.js";

type CacheEntry<T> = { fetchedAt: number; value: T };
type WindPoint = {
  lat: number;
  lon: number;
  forecast: Array<{ validAt: string; windFromDeg: number | null; windSpeedMph: number | null; gustMph: number | null; source: string }>;
};

export type WeatherWindResponse = {
  source: "Open-Meteo";
  retrievedAt: string;
  points: WindPoint[];
};

export type FloodProviderHealthState = "UNTESTED" | "CONNECTED" | "DEGRADED" | "UNAVAILABLE";

export type FloodProviderHealth = {
  provider: "NOAA NWPS";
  state: FloodProviderHealthState;
  checkedAt: string | null;
  message: string;
};

export type FloodObserved = {
  stageFt: number | null;
  flowCfs: number | null;
  observedAt: string | null;
};

export type FloodForecast = {
  stageFt: number | null;
  flowCfs: number | null;
  validAt: string | null;
  crestStageFt: number | null;
  crestAt: string | null;
};

export type FloodThresholds = {
  actionStageFt: number | null;
  minorStageFt: number | null;
  moderateStageFt: number | null;
  majorStageFt: number | null;
};

export type FloodGauge = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  stageFt: number | null;
  flowCfs: number | null;
  floodStageFt: number | null;
  forecastCrestFt: number | null;
  category: string | null;
  trend: string | null;
  observedAt: string | null;
  source: string;
  forecastSource: string | null;
  observed: FloodObserved;
  forecast: FloodForecast;
  flood: FloodThresholds & { currentCategory: string | null; forecastCategory: string | null };
  dataStatus: "LIVE" | "OBSERVED ONLY" | "GAUGE DATA UNAVAILABLE";
};

export type WeatherFloodResponse = {
  gauges: FloodGauge[];
  sources: string[];
  retrievedAt: string;
  status?: "connected" | "degraded" | "unavailable" | "no-data";
  nwpsHealth: FloodProviderHealth;
};

const windCache = new Map<string, CacheEntry<WeatherWindResponse>>();
const floodCache = new Map<string, CacheEntry<WeatherFloodResponse>>();
const nwpsGaugeCache = new Map<string, CacheEntry<NwpsGaugeMetadata[]>>();
const nwpsStageflowCache = new Map<string, CacheEntry<Record<string, unknown>>>();
let nwpsHealth: FloodProviderHealth = { provider: "NOAA NWPS", state: "UNTESTED", checkedAt: null, message: "LIVE VERIFICATION PENDING" };
const WIND_CACHE_MS = 10 * 60 * 1000;
const FLOOD_CACHE_MS = 10 * 60 * 1000;
const NWPS_METADATA_CACHE_MS = 45 * 60 * 1000;
const NWPS_STAGEFLOW_CACHE_MS = 10 * 60 * 1000;
const NWPS_HEALTH_CACHE_MS = 5 * 60 * 1000;
const NWPS_REQUEST_TIMEOUT_MS = 10 * 1000;
const MAX_DETAIL_GAUGES = 24;
const NWPS_BASE_URL = "https://api.water.noaa.gov/nwps/v1";

export type NwpsGaugeMetadata = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  usgsId: string | null;
  thresholds: FloodThresholds;
  currentCategory: string | null;
  forecastCategory: string | null;
  trend: string | null;
};

function cacheKey(bounds: MapBounds) {
  return [bounds.west, bounds.south, bounds.east, bounds.north].map((value) => value.toFixed(2)).join(",");
}

async function getJson(url: string, signal?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NWPS_REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "HazScope Weather Intelligence" } });
    if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
    return response.json() as Promise<Record<string, unknown>>;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

async function getNwpsJson(url: string, signal?: AbortSignal) {
  const pathname = new URL(url).pathname;
  console.info(`[NWPS] request ${pathname}`);
  try {
    const value = await getJson(url, signal);
    console.info(`[NWPS] status 200 ${pathname}`);
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.match(/Provider request failed \((\d+)\)/)?.[1];
    console.warn(`[NWPS] ${status ? `status ${status}` : message.toLowerCase().includes("abort") ? "timeout" : "response normalization error"} ${pathname}`);
    throw error;
  }
}

function grid(bounds: MapBounds) {
  const columns = 8;
  const rows = 8;
  const points: Array<{ lat: number; lon: number }> = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      points.push({
        lat: bounds.south + ((row + 0.5) / rows) * (bounds.north - bounds.south),
        lon: bounds.west + ((column + 0.5) / columns) * (bounds.east - bounds.west),
      });
    }
  }
  return points;
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function queryWeatherWind(bounds: MapBounds, signal?: AbortSignal): Promise<WeatherWindResponse> {
  const key = cacheKey(bounds);
  const cached = windCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < WIND_CACHE_MS) return cached.value;
  const points = grid(bounds);
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: points.map((point) => point.lat.toFixed(4)).join(","),
    longitude: points.map((point) => point.lon.toFixed(4)).join(","),
    hourly: "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    forecast_hours: "7",
    wind_speed_unit: "mph",
    timeformat: "unixtime",
    timezone: "UTC",
  }).toString();
  const payload = await getJson(url.toString(), signal);
  const responses = Array.isArray(payload) ? payload : [payload];
  const normalized: WindPoint[] = responses.map((item, index) => {
    const hourly = (item as Record<string, unknown>).hourly as Record<string, unknown> | undefined;
    const times = Array.isArray(hourly?.time) ? hourly.time : [];
    const speeds = Array.isArray(hourly?.wind_speed_10m) ? hourly.wind_speed_10m : [];
    const directions = Array.isArray(hourly?.wind_direction_10m) ? hourly.wind_direction_10m : [];
    const gusts = Array.isArray(hourly?.wind_gusts_10m) ? hourly.wind_gusts_10m : [];
    const point = points[index];
    return {
      lat: numberOrNull((item as Record<string, unknown>).latitude) ?? point.lat,
      lon: numberOrNull((item as Record<string, unknown>).longitude) ?? point.lon,
      forecast: times.map((time, hour) => ({
        validAt: new Date(Number(time) * 1000).toISOString(),
        windFromDeg: numberOrNull(directions[hour]),
        windSpeedMph: numberOrNull(speeds[hour]),
        gustMph: numberOrNull(gusts[hour]),
        source: "Open-Meteo",
      })),
    };
  });
  const value = { source: "Open-Meteo", retrievedAt: new Date().toISOString(), points: normalized } as WeatherWindResponse;
  windCache.set(key, { fetchedAt: Date.now(), value });
  return value;
}

function firstArray(value: unknown): Array<Record<string, unknown>> {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"));
  const record = value as Record<string, unknown>;
  for (const key of ["gauges", "features", "data", "items"]) {
    const result = firstArray(record[key]);
    if (result.length) return result;
  }
  return [];
}

function recursiveNumber(value: unknown, keys: string[]): number | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const found = numberOrNull(record[key]);
    if (found !== null) return found;
  }
  for (const child of Object.values(record)) {
    const found = recursiveNumber(child, keys);
    if (found !== null) return found;
  }
  return null;
}

function recursiveString(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) if (typeof record[key] === "string" && record[key]) return record[key] as string;
  for (const child of Object.values(record)) {
    const found = recursiveString(child, keys);
    if (found) return found;
  }
  return null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function seriesRows(value: unknown): Array<Record<string, unknown>> {
  const record = objectValue(value);
  const data = record.data;
  if (Array.isArray(data)) return data.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"));
  if (Array.isArray(value)) return value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"));
  return [];
}

function seriesTime(row: Record<string, unknown> | null | undefined): string | null {
  const time = row?.validTime ?? row?.validAt ?? row?.time ?? row?.observedAt;
  if (typeof time === "string" && time) return time;
  if (typeof time === "number" && Number.isFinite(time)) return new Date(time > 10_000_000_000 ? time : time * 1000).toISOString();
  return null;
}

function latestSeriesRow(value: unknown): Record<string, unknown> | null {
  const rows = seriesRows(value);
  return rows.reduce<Record<string, unknown> | null>((latest, row) => {
    if (!latest) return row;
    const latestTime = Date.parse(seriesTime(latest) || "");
    const rowTime = Date.parse(seriesTime(row) || "");
    return Number.isFinite(rowTime) && (!Number.isFinite(latestTime) || rowTime > latestTime) ? row : latest;
  }, null);
}

function maximumSeriesRow(value: unknown, key: string): Record<string, unknown> | null {
  return seriesRows(value).reduce<Record<string, unknown> | null>((maximum, row) => {
    const current = numberOrNull(row[key]);
    const previous = numberOrNull(maximum?.[key]);
    return current !== null && (previous === null || current > previous) ? row : maximum;
  }, null);
}

function flowCfs(value: number | null, units: unknown): number | null {
  if (value === null) return null;
  return /k(?:cfs|ft.?3|ft\^?3\/s)/i.test(String(units ?? "")) ? value * 1000 : value;
}

function floodCategoryThreshold(properties: Record<string, unknown>, category: string): number | null {
  const flood = objectValue(properties.flood ?? properties.floodCategories ?? properties.thresholds);
  const categories = objectValue(flood.categories ?? flood);
  return recursiveNumber(categories[category], ["stage", "primary", "value"]);
}

function thresholdFromProperties(properties: Record<string, unknown>, category: string): number | null {
  const directKeys: Record<string, string[]> = {
    action: ["actionStage", "action_stage", "actionStageFt"],
    minor: ["minorStage", "minor_stage", "minorStageFt", "floodStage", "floodStageFt"],
    moderate: ["moderateStage", "moderate_stage", "moderateStageFt"],
    major: ["majorStage", "major_stage", "majorStageFt"],
  };
  return recursiveNumber(properties, directKeys[category] || []) ?? floodCategoryThreshold(properties, category);
}

function thresholdsForProperties(properties: Record<string, unknown>): FloodThresholds {
  return {
    actionStageFt: thresholdFromProperties(properties, "action"),
    minorStageFt: thresholdFromProperties(properties, "minor"),
    moderateStageFt: thresholdFromProperties(properties, "moderate"),
    majorStageFt: thresholdFromProperties(properties, "major"),
  };
}

function categoryForStage(stageFt: number | null, thresholds: FloodThresholds, suppliedCategory: string | null = null): string | null {
  if (stageFt === null) return suppliedCategory;
  const levels = [
    ["major", thresholds.majorStageFt],
    ["moderate", thresholds.moderateStageFt],
    ["minor", thresholds.minorStageFt],
    ["action", thresholds.actionStageFt],
  ]
    .map(([category, stage]) => ({ category: String(category), stage: stage as number | null }))
    .filter((item): item is { category: string; stage: number } => item.stage !== null)
    .sort((a, b) => b.stage - a.stage);
  return levels.find((item) => stageFt >= item.stage)?.category ?? suppliedCategory;
}

function rowProperties(row: Record<string, unknown>): Record<string, unknown> {
  return row.properties && typeof row.properties === "object" ? row.properties as Record<string, unknown> : row;
}

function rowCoordinates(row: Record<string, unknown>): { lat: number | null; lon: number | null } {
  const properties = rowProperties(row);
  const geometry = objectValue(row.geometry);
  const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
  return {
    lat: numberOrNull(properties.latitude ?? properties.lat ?? coordinates[1]),
    lon: numberOrNull(properties.longitude ?? properties.lon ?? coordinates[0]),
  };
}

function normalizeNwpsMetadata(row: Record<string, unknown>): NwpsGaugeMetadata | null {
  const properties = rowProperties(row);
  const coordinates = rowCoordinates(row);
  const id = String(properties.lid || properties.identifier || properties.gaugeId || properties.id || properties.usgsId || properties.usgs_id || "").trim();
  if (!id || coordinates.lat === null || coordinates.lon === null) return null;
  const thresholds = thresholdsForProperties(properties);
  return {
    id,
    name: String(properties.name || properties.description || properties.label || id),
    lat: coordinates.lat,
    lon: coordinates.lon,
    usgsId: String(properties.usgsId || properties.usgs_id || "").replace(/^USGS-/, "") || null,
    thresholds,
    currentCategory: recursiveString(properties, ["currentCategory", "category", "floodCategory", "forecastStatus"]),
    forecastCategory: recursiveString(properties, ["forecastCategory", "forecastStatus"]),
    trend: recursiveString(properties, ["trend", "tendency"]),
  };
}

function metadataFromPayload(payload: Record<string, unknown>): NwpsGaugeMetadata | null {
  const candidate = objectValue(payload.gauge ?? payload.data ?? payload);
  return normalizeNwpsMetadata(candidate) || firstArray(payload).map(normalizeNwpsMetadata).find((value): value is NwpsGaugeMetadata => value !== null) || null;
}

function setNwpsHealth(state: FloodProviderHealthState, message: string): FloodProviderHealth {
  nwpsHealth = { provider: "NOAA NWPS", state, checkedAt: new Date().toISOString(), message };
  return { ...nwpsHealth };
}

export function getWeatherFloodHealth(): FloodProviderHealth {
  return { ...nwpsHealth };
}

export async function queryNwpsHealth(signal?: AbortSignal, force = false): Promise<FloodProviderHealth> {
  if (!force && nwpsHealth.checkedAt && Date.now() - Date.parse(nwpsHealth.checkedAt) < NWPS_HEALTH_CACHE_MS) {
    console.info("[NWPS] cache hit health");
    return getWeatherFloodHealth();
  }
  try {
    await getNwpsJson(`${NWPS_BASE_URL}/monitor`, signal);
    return setNwpsHealth("CONNECTED", "CONNECTED");
  } catch {
    return setNwpsHealth("UNAVAILABLE", "TEMPORARILY UNAVAILABLE");
  }
}

export async function queryNwpsGaugeMetadata(bounds: MapBounds, signal?: AbortSignal, force = false): Promise<NwpsGaugeMetadata[]> {
  const key = cacheKey(bounds);
  const cached = nwpsGaugeCache.get(key);
  if (!force && cached && Date.now() - cached.fetchedAt < NWPS_METADATA_CACHE_MS) {
    console.info("[NWPS] cache hit gauges");
    return cached.value;
  }
  const nwpsUrl = new URL(`${NWPS_BASE_URL}/gauges`);
  nwpsUrl.search = new URLSearchParams({
    "bbox.xmin": String(bounds.west),
    "bbox.ymin": String(bounds.south),
    "bbox.xmax": String(bounds.east),
    "bbox.ymax": String(bounds.north),
    srid: "EPSG_4326",
    limit: String(MAX_DETAIL_GAUGES),
  }).toString();
  try {
    const rows = firstArray(await getNwpsJson(nwpsUrl.toString(), signal));
    const metadata = rows.map(normalizeNwpsMetadata).filter((value): value is NwpsGaugeMetadata => value !== null).slice(0, MAX_DETAIL_GAUGES);
    nwpsGaugeCache.set(key, { fetchedAt: Date.now(), value: metadata });
    setNwpsHealth("CONNECTED", "CONNECTED");
    return metadata;
  } catch (error) {
    setNwpsHealth("UNAVAILABLE", "TEMPORARILY UNAVAILABLE");
    throw error;
  }
}

export async function queryNwpsGauge(identifier: string, signal?: AbortSignal): Promise<NwpsGaugeMetadata | null> {
  const payload = await getNwpsJson(`${NWPS_BASE_URL}/gauges/${encodeURIComponent(identifier)}`, signal);
  return metadataFromPayload(payload);
}

export async function queryNwpsStageflow(identifier: string, product?: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const key = `${identifier}:${product || "default"}`;
  const cached = nwpsStageflowCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < NWPS_STAGEFLOW_CACHE_MS) { console.info("[NWPS] cache hit stageflow"); return cached.value; }
  const suffix = product ? `/${encodeURIComponent(product)}` : "";
  try {
    const value = await getNwpsJson(`${NWPS_BASE_URL}/gauges/${encodeURIComponent(identifier)}/stageflow${suffix}`, signal);
    nwpsStageflowCache.set(key, { fetchedAt: Date.now(), value });
    return value;
  } catch (error) {
    if (nwpsHealth.state === "CONNECTED") setNwpsHealth("DEGRADED", "SOME GAUGE DATA UNAVAILABLE");
    throw error;
  }
}

function usgsObservation(properties: Record<string, unknown>): { stageFt: number | null; flowCfs: number | null; observedAt: string | null } {
  const parameterCode = String(properties.parameter_code || properties.parameterCode || "");
  const value = numberOrNull(properties.value);
  return {
    stageFt: parameterCode === "00065" ? value : null,
    flowCfs: parameterCode === "00060" ? value : null,
    observedAt: recursiveString(properties, ["time", "observedAt", "dateTime"]),
  };
}

export function normalizeNwpsStageflow(metadata: NwpsGaugeMetadata, stageflow: Record<string, unknown> | null, usgsProperties: Record<string, unknown> | null = null): FloodGauge {
  const observedPayload = objectValue(stageflow?.observed ?? stageflow?.observation ?? stageflow?.observations);
  const forecastPayload = objectValue(stageflow?.forecast ?? stageflow?.prediction ?? stageflow?.predictions);
  const observedRow = latestSeriesRow(observedPayload);
  const forecastRow = seriesRows(forecastPayload).find((row) => numberOrNull(row.primary) !== null || numberOrNull(row.secondary) !== null) || null;
  const crestRow = maximumSeriesRow(forecastPayload, "primary");
  const observedFallback = usgsProperties ? usgsObservation(usgsProperties) : { stageFt: null, flowCfs: null, observedAt: null };
  const observedStage = numberOrNull(observedRow?.primary) ?? observedFallback.stageFt;
  const observedFlow = flowCfs(numberOrNull(observedRow?.secondary), observedPayload.secondaryUnits) ?? observedFallback.flowCfs;
  const forecastStage = numberOrNull(forecastRow?.primary);
  const forecastFlow = flowCfs(numberOrNull(forecastRow?.secondary), forecastPayload.secondaryUnits);
  const currentCategory = categoryForStage(observedStage, metadata.thresholds, metadata.currentCategory);
  const forecastCategory = categoryForStage(numberOrNull(crestRow?.primary), metadata.thresholds, metadata.forecastCategory || currentCategory);
  const hasForecast = forecastStage !== null || forecastFlow !== null || crestRow !== null;
  const hasObserved = observedStage !== null || observedFlow !== null;
  const source = usgsProperties && !stageflow ? "USGS Water Data" : usgsProperties ? "NOAA NWPS / USGS Water Data" : "NOAA NWPS";
  return {
    id: metadata.id,
    name: metadata.name,
    lat: metadata.lat,
    lon: metadata.lon,
    stageFt: observedStage,
    flowCfs: observedFlow,
    floodStageFt: metadata.thresholds.minorStageFt,
    forecastCrestFt: numberOrNull(crestRow?.primary),
    category: currentCategory,
    trend: metadata.trend,
    observedAt: seriesTime(observedRow) || observedFallback.observedAt,
    source,
    forecastSource: hasForecast ? "NOAA NWPS forecast stage/flow" : null,
    observed: { stageFt: observedStage, flowCfs: observedFlow, observedAt: seriesTime(observedRow) || observedFallback.observedAt },
    forecast: { stageFt: forecastStage, flowCfs: forecastFlow, validAt: seriesTime(forecastRow), crestStageFt: numberOrNull(crestRow?.primary), crestAt: seriesTime(crestRow) },
    flood: { ...metadata.thresholds, currentCategory, forecastCategory },
    dataStatus: hasObserved ? (hasForecast ? "LIVE" : "OBSERVED ONLY") : "GAUGE DATA UNAVAILABLE",
  };
}

async function queryUsGauges(bounds: MapBounds, signal?: AbortSignal) {
  const url = new URL("https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items");
  url.search = new URLSearchParams({
    f: "json",
    bbox: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    parameter_code: "00060,00065",
    limit: "250",
  }).toString();
  return getJson(url.toString(), signal);
}

export async function queryWeatherFlood(bounds: MapBounds, signal?: AbortSignal): Promise<WeatherFloodResponse> {
  const key = cacheKey(bounds);
  const cached = floodCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < FLOOD_CACHE_MS) { console.info("[NWPS] cache hit flood response"); return cached.value; }
  const [nwpsResult, usgsResult] = await Promise.allSettled([queryNwpsGaugeMetadata(bounds, signal), queryUsGauges(bounds, signal)]);
  const nwpsMetadata = nwpsResult.status === "fulfilled" ? nwpsResult.value : [];
  const usgsRows = usgsResult.status === "fulfilled" ? firstArray(usgsResult.value) : [];
  if (nwpsResult.status === "rejected") setNwpsHealth("UNAVAILABLE", "TEMPORARILY UNAVAILABLE");
  const usgsById = new Map<string, Record<string, unknown>>();
  for (const row of usgsRows) {
    const properties = rowProperties(row);
    const id = String(properties.monitoring_location_id || properties.monitoring_location || properties.site_no || "").replace(/^USGS-/, "");
    if (id) usgsById.set(id, { ...(usgsById.get(id) || {}), ...properties });
  }
  const stageflowResults = await Promise.all(nwpsMetadata.slice(0, MAX_DETAIL_GAUGES).map(async (metadata) => {
    try { return { metadata, stageflow: await queryNwpsStageflow(metadata.id, undefined, signal) }; }
    catch { return { metadata, stageflow: null }; }
  }));
  const failedStageflows = stageflowResults.filter((result) => result.stageflow === null).length;
  const gauges: FloodGauge[] = stageflowResults.map(({ metadata, stageflow }) => normalizeNwpsStageflow(metadata, stageflow, metadata.usgsId ? usgsById.get(metadata.usgsId) || null : null));
  const knownGaugeIds = new Set(gauges.map((gauge) => gauge.id));
  for (const row of usgsRows) {
    const properties = rowProperties(row);
    const id = String(properties.monitoring_location_id || properties.monitoring_location || properties.site_no || "").replace(/^USGS-/, "");
    const coordinates = rowCoordinates(row);
    if (!id || knownGaugeIds.has(id) || coordinates.lat === null || coordinates.lon === null) continue;
    knownGaugeIds.add(id);
    const observed = usgsObservation(properties);
    gauges.push({
      id,
      name: String(properties.name || properties.station_name || `USGS gauge ${id}`),
      lat: coordinates.lat,
      lon: coordinates.lon,
      stageFt: observed.stageFt,
      flowCfs: observed.flowCfs,
      floodStageFt: null,
      forecastCrestFt: null,
      category: null,
      trend: null,
      observedAt: observed.observedAt,
      source: "USGS Water Data",
      forecastSource: null,
      observed,
      forecast: { stageFt: null, flowCfs: null, validAt: null, crestStageFt: null, crestAt: null },
      flood: { actionStageFt: null, minorStageFt: null, moderateStageFt: null, majorStageFt: null, currentCategory: null, forecastCategory: null },
      dataStatus: observed.stageFt !== null || observed.flowCfs !== null ? "OBSERVED ONLY" : "GAUGE DATA UNAVAILABLE",
    });
  }
  if (nwpsMetadata.length && failedStageflows) setNwpsHealth("DEGRADED", "SOME GAUGE DATA UNAVAILABLE");
  const health = getWeatherFloodHealth();
  const status = gauges.length
    ? health.state === "CONNECTED" && failedStageflows === 0 ? "connected" as const : "degraded" as const
    : health.state === "UNAVAILABLE" ? "unavailable" as const : "no-data" as const;
  const value = { gauges, sources: [nwpsMetadata.length ? "NOAA NWPS" : "NOAA NWPS unavailable", usgsRows.length ? "USGS Water Data" : "USGS unavailable"], status, nwpsHealth: health, retrievedAt: new Date().toISOString() };
  floodCache.set(key, { fetchedAt: Date.now(), value });
  return value;
}
