import type { IntegrationConfig, Observation } from "@/lib/schema";
import { BaseIntegration } from "../base";
import { type WeatherIntegration } from "../types";
import { logIntegrationError, safeFetchJson } from "../http";

interface OpenMeteoResponse {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m?: number;
    surface_pressure?: number;
    cloud_cover?: number;
  };
}

export interface OpenMeteoOptions {
  baseUrl?: string;
}

export class OpenMeteoAdapter extends BaseIntegration<Observation> implements WeatherIntegration {
  constructor(private opts: OpenMeteoOptions = {}) {
    super("weather:open-meteo");
  }

  async connect(cfg: IntegrationConfig): Promise<void> {
    await super.connect(cfg);
  }

  async fetchByLatLng(lat: number, lng: number): Promise<Observation | null> {
    if (!this.cfg) return null;
    const base = this.opts.baseUrl ?? "https://api.open-meteo.com/v1";
    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lng.toFixed(4),
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
        "surface_pressure",
        "cloud_cover",
      ].join(","),
      wind_speed_unit: "ms",
    });
    try {
      const r = await safeFetchJson<OpenMeteoResponse>({
        url: `${base}/forecast?${params.toString()}`,
        integrationId: this.cfg.id,
      });
      const c = r.current;
      return {
        source: `weather:open-meteo:${this.cfg.id}`,
        ts: c.time,
        lat,
        lng,
        windSpeedMps: c.wind_speed_10m,
        windDirDeg: c.wind_direction_10m,
        gustMps: c.wind_gusts_10m,
        tempC: c.temperature_2m,
        rh: c.relative_humidity_2m,
        pressureHpa: c.surface_pressure,
        cloudCoverPct: c.cloud_cover,
        providerMetadata: {},
      };
    } catch (err) {
      this.setError(err instanceof Error ? err.message : String(err));
      logIntegrationError(this.cfg, err);
      return null;
    }
  }
}
