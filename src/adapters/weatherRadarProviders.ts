export const WEATHER_RADAR_PROVIDER_IDS = [
  "RAINVIEWER_VISUAL_PROTOTYPE",
  "NOAA_MRMS_OFFICIAL_FALLBACK",
] as const;

export type WeatherRadarProviderId = (typeof WEATHER_RADAR_PROVIDER_IDS)[number];

export interface WeatherRadarFrame {
  timestamp: string;
  tiles: string[];
}

export interface WeatherRadarProvider {
  id: WeatherRadarProviderId;
  displayName: string;
  status: "Visual Prototype" | "Disabled" | "Official Fallback";
  providerType: string;
  requiresApiKey: false;
  requiresBackendProxy: false;
  supportsTiles: true;
  supportsAnimation: boolean;
  supportsOpacity: true;
  supportsTimestamps: boolean;
  attribution: string;
  limitations: string[];
  getMetadataUrl(): string;
  getTileUrl(frame?: WeatherRadarFrame): string | null;
  getFrames(): Promise<WeatherRadarFrame[]>;
  getLatestFrame(): Promise<WeatherRadarFrame | null>;
}

const NOAA_SERVICE = "https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity_time/ImageServer";
const RAINVIEWER_METADATA = "https://api.rainviewer.com/public/weather-maps.json";

async function rainViewerFrames(): Promise<WeatherRadarFrame[]> {
  const response = await fetch(RAINVIEWER_METADATA);
  if (!response.ok) throw new Error(`RainViewer metadata unavailable (${response.status}).`);
  const metadata = await response.json() as {
    host?: string;
    radar?: { past?: Array<{ time?: number; path?: string }>; nowcast?: Array<{ time?: number; path?: string }> };
  };
  const host = metadata.host?.replace(/\/$/, "") || "";
  if (!host.startsWith("https://")) throw new Error("RainViewer metadata returned an invalid tile host.");
  return [...(metadata.radar?.past || []), ...(metadata.radar?.nowcast || [])]
    .filter((frame): frame is { time: number; path: string } => Number.isFinite(frame.time) && typeof frame.path === "string" && frame.path.startsWith("/"))
    .map((frame) => ({
      timestamp: new Date(frame.time * 1000).toISOString(),
      tiles: [`${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`],
    }));
}

export function createWeatherRadarProviders(rainViewerEnabled = false): Record<WeatherRadarProviderId, WeatherRadarProvider> {
  const primary: WeatherRadarProvider = {
    id: "RAINVIEWER_VISUAL_PROTOTYPE",
    displayName: "Primary Visual Radar",
    status: rainViewerEnabled ? "Visual Prototype" : "Disabled",
    providerType: "RainViewer Metadata-Driven Raster",
    requiresApiKey: false,
    requiresBackendProxy: false,
    supportsTiles: true,
    supportsAnimation: true,
    supportsOpacity: true,
    supportsTimestamps: true,
    attribution: "RainViewer",
    limitations: ["Situational awareness only. Verify licensing before production use."],
    getMetadataUrl: () => RAINVIEWER_METADATA,
    getTileUrl: (frame) => frame?.tiles[0] || null,
    getFrames: () => rainViewerEnabled ? rainViewerFrames() : Promise.resolve([]),
    async getLatestFrame() {
      return (await this.getFrames()).at(-1) || null;
    },
  };

  const fallback: WeatherRadarProvider = {
    id: "NOAA_MRMS_OFFICIAL_FALLBACK",
    displayName: "NOAA/NWS Official Fallback",
    status: "Official Fallback",
    providerType: "Official MRMS ImageServer Raster",
    requiresApiKey: false,
    requiresBackendProxy: false,
    supportsTiles: true,
    supportsAnimation: false,
    supportsOpacity: true,
    supportsTimestamps: false,
    attribution: "NOAA / National Weather Service",
    limitations: ["Official fallback radar for situational awareness."],
    getMetadataUrl: () => NOAA_SERVICE,
    getTileUrl: () => `${NOAA_SERVICE}/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=1024,1024&format=png32&transparent=true&f=image`,
    getFrames: async () => [],
    getLatestFrame: async () => null,
  };

  return {
    RAINVIEWER_VISUAL_PROTOTYPE: primary,
    NOAA_MRMS_OFFICIAL_FALLBACK: fallback,
  };
}

export function bestAvailableWeatherRadarProvider(rainViewerEnabled = false): WeatherRadarProviderId {
  return rainViewerEnabled ? "RAINVIEWER_VISUAL_PROTOTYPE" : "NOAA_MRMS_OFFICIAL_FALLBACK";
}
