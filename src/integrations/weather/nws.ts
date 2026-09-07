import type { IntegrationConfig, Observation } from "@/lib/schema";
import { BaseIntegration } from "../base";
import { type WeatherIntegration } from "../types";
import { logIntegrationError, safeFetchJson } from "../http";

const NWS_USER_AGENT = "hazmat-response-support/0.1 (contact: ops@mcintyrehouse.com)";

interface NwsPointResponse {
  properties: { forecast: string; forecastHourly: string; gridId: string; gridX: number; gridY: number };
}

interface NwsStationsResponse {
  features: Array<{
    properties: { stationIdentifier: string };
  }>;
}

interface NwsObservationResponse {
  properties: {
    timestamp: string;
    temperature: { value: number | null };
    relativeHumidity: { value: number | null };
    windSpeed: { value: number | null; unitCode?: string };
    windDirection: { value: number | null };
    windGust: { value: number | null; unitCode?: string };
    cloudCover: { value: number | null };
    barometricPressure: { value: number | null };
  };
}

export function nwsWindSpeedToMps(measurement: { value: number | null; unitCode?: string }): number | undefined {
  if (measurement.value === null || !Number.isFinite(measurement.value)) return undefined;
  const unit = String(measurement.unitCode || "wmoUnit:m_s-1").toLowerCase();
  if (unit.includes("km_h")) return measurement.value / 3.6;
  if (unit.includes("mi_h")) return measurement.value * 0.44704;
  if (/\b(?:kt|knot)/.test(unit)) return measurement.value * 0.514444;
  return measurement.value;
}

export interface NwsOptions {
  baseUrl?: string;
}

export class NwsAdapter extends BaseIntegration<Observation> implements WeatherIntegration {
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private opts: NwsOptions = {}) {
    super("weather:nws");
  }

  async connect(cfg: IntegrationConfig): Promise<void> {
    await super.connect(cfg);
    const intervalMs = Math.max(60_000, cfg.pollIntervalSec * 1000);
    this.startPolling(intervalMs);
  }

  async disconnect(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    await super.disconnect();
  }

  private startPolling(intervalMs: number): void {
    const tick = async () => {
      if (!this.cfg) return;
      const lat = this.cfg.pollIntervalSec;
      const point = (this.cfg as unknown as { _lat?: number })._lat;
      void lat;
      if (typeof point !== "number") return;
    };
    void tick;
    this.pollTimer = setInterval(tick, intervalMs);
  }

  async fetchByLatLng(lat: number, lng: number): Promise<Observation | null> {
    if (!this.cfg) return null;
    const base = this.opts.baseUrl ?? "https://api.weather.gov";
    try {
      const point = await safeFetchJson<NwsPointResponse>(
        { url: `${base}/points/${lat.toFixed(4)},${lng.toFixed(4)}`, integrationId: this.cfg.id },
        NWS_USER_AGENT,
      );
      const stations = await safeFetchJson<NwsStationsResponse>(
        {
          url: `${base}/gridpoints/${point.properties.gridId}/${point.properties.gridX},${point.properties.gridY}/stations`,
          integrationId: this.cfg.id,
        },
        NWS_USER_AGENT,
      );
      const stationId = stations.features[0]?.properties.stationIdentifier;
      if (!stationId) return null;
      const obs = await safeFetchJson<NwsObservationResponse>(
        {
          url: `${base}/stations/${stationId}/observations/latest`,
          integrationId: this.cfg.id,
        },
        NWS_USER_AGENT,
      );
      const p = obs.properties;
      return {
        source: `weather:nws:${this.cfg.id}`,
        ts: p.timestamp,
        lat,
        lng,
        windSpeedMps: nwsWindSpeedToMps(p.windSpeed),
        windDirDeg: p.windDirection.value ?? undefined,
        gustMps: nwsWindSpeedToMps(p.windGust),
        tempC: p.temperature.value ?? undefined,
        rh: p.relativeHumidity.value ?? undefined,
        pressureHpa: p.barometricPressure.value ? p.barometricPressure.value / 100 : undefined,
        cloudCoverPct: p.cloudCover.value !== null ? p.cloudCover.value : undefined,
        providerMetadata: { stationId, gridId: point.properties.gridId },
      };
    } catch (err) {
      this.setError(err instanceof Error ? err.message : String(err));
      logIntegrationError(this.cfg, err);
      return null;
    }
  }
}
