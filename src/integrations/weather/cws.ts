import type { IntegrationConfig, Observation } from "@/lib/schema";
import { BaseIntegration } from "../base";
import { type WeatherIntegration } from "../types";
import { logIntegrationError, safeFetchJson } from "../http";
import { getSecret } from "../security";

export interface CwsMicroServerOptions {
  endpoint: string;
}

export interface CwsRawPayload {
  ts?: string;
  lat?: number;
  lon?: number;
  windSpeedMps?: number;
  windSpeed?: number;
  windDirDeg?: number;
  windDirection?: number;
  gustMps?: number;
  gust?: number;
  tempC?: number;
  temperatureC?: number;
  rh?: number;
  humidity?: number;
  pressureHpa?: number;
  pressure?: number;
}

export class CwsMicroServerAdapter extends BaseIntegration<Observation> implements WeatherIntegration {
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private opts: CwsMicroServerOptions) {
    super("weather:cws");
  }

  async connect(cfg: IntegrationConfig): Promise<void> {
    await super.connect(cfg);
    const secret = await getSecret(cfg.id);
    const intervalMs = Math.max(1000, cfg.pollIntervalSec * 1000);
    this.startPolling(this.opts.endpoint, secret?.username, secret?.password, intervalMs);
  }

  async disconnect(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    await super.disconnect();
  }

  private startPolling(url: string, username: string | undefined, password: string | undefined, intervalMs: number): void {
    const tick = async () => {
      if (!this.cfg) return;
      try {
        const raw = await safeFetchJson<CwsRawPayload>({
          url,
          integrationId: this.cfg.id,
          auth: { username, password },
        });
        const obs = normalize(raw, this.cfg.id);
        if (obs) this.emit(obs);
      } catch (err) {
        this.setError(err instanceof Error ? err.message : String(err));
        logIntegrationError(this.cfg, err);
      }
    };
    void tick();
    this.pollTimer = setInterval(tick, intervalMs);
  }
}

export function normalize(raw: CwsRawPayload, instanceId: string): Observation | null {
  const windSpeed = raw.windSpeedMps ?? raw.windSpeed;
  const windDir = raw.windDirDeg ?? raw.windDirection;
  if (typeof windSpeed !== "number" || typeof windDir !== "number") return null;
  if (!raw.ts || !Number.isFinite(Date.parse(raw.ts))) return null;
  return {
    source: `cws:${instanceId}`,
    ts: raw.ts,
    lat: raw.lat,
    lng: raw.lon,
    windSpeedMps: windSpeed,
    windDirDeg: windDir,
    gustMps: raw.gustMps ?? raw.gust,
    tempC: raw.tempC ?? raw.temperatureC,
    rh: raw.rh ?? raw.humidity,
    pressureHpa: raw.pressureHpa ?? raw.pressure,
    providerMetadata: {},
  };
}
