import type { IntegrationConfig, Reading } from "@/lib/schema";
import { BaseIntegration } from "../../base";
import { type SensorIntegration } from "../../types";
import { logIntegrationError, safeFetchJson } from "../../http";
import { getSecret } from "../../security";

export interface SafetySuiteRawEvent {
  ts?: string;
  monitorId?: string;
  model?: string;
  lat?: number;
  lng?: number;
  battery?: number;
  runTime?: number;
  sensors?: Array<{
    gas?: string;
    unit?: string;
    value?: number;
    alarm?: Reading["sensors"][number]["alarm"];
  }>;
}

export interface SafetySuiteAdapterOptions {
  endpoint: string;
}

export class SafetySuiteAdapter extends BaseIntegration<Reading> implements SensorIntegration {
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private opts: SafetySuiteAdapterOptions) {
    super("rae:safety-suite");
  }

  async connect(cfg: IntegrationConfig): Promise<void> {
    await super.connect(cfg);
    const secret = await getSecret(cfg.id);
    if (!this.opts.endpoint && !cfg.url) {
      this.setError("Safety Suite endpoint URL not configured");
      return;
    }
    const url = cfg.url ?? this.opts.endpoint;
    const intervalMs = Math.max(1000, cfg.pollIntervalSec * 1000);
    this.startPolling(url, secret?.username, secret?.password, intervalMs);
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
        const raw = await safeFetchJson<SafetySuiteRawEvent | SafetySuiteRawEvent[]>({
          url,
          method: "GET",
          integrationId: this.cfg.id,
          auth: { username, password },
        });
        const events = Array.isArray(raw) ? raw : [raw];
        for (const e of events) {
          const reading = normalize(e, this.cfg.id);
          if (reading) this.emit(reading);
        }
      } catch (err) {
        this.setError(err instanceof Error ? err.message : String(err));
        if (this.cfg) logIntegrationError(this.cfg, err);
      }
    };
    void tick();
    this.pollTimer = setInterval(tick, intervalMs);
  }
}

export function normalize(raw: SafetySuiteRawEvent, instanceId: string): Reading | null {
  if (!raw.monitorId || !Array.isArray(raw.sensors)) return null;
  const sensors = raw.sensors
    .filter((s) => s.gas && s.unit !== undefined && typeof s.value === "number")
    .map((s) => ({
      gasName: String(s.gas),
      unit: String(s.unit),
      value: Number(s.value),
      alarm: s.alarm ?? "none",
    }));
  if (sensors.length === 0) return null;
  return {
    source: `rae:safety-suite:${instanceId}`,
    ts: raw.ts ?? new Date().toISOString(),
    monitorId: raw.monitorId,
    model: raw.model,
    lat: raw.lat,
    lng: raw.lng,
    batteryPct: raw.battery,
    runTimeSec: raw.runTime,
    sensors,
  };
}

export function parseSafetySuiteCsv(csvText: string, instanceId: string): Reading[] {
  const out: Reading[] = [];
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return out;
  const headerRaw = lines[0].split(",").map((h) => h.trim());
  const headerLower = headerRaw.map((h) => h.toLowerCase());
  const idx = (name: string) => headerLower.indexOf(name);
  const tsIdx = idx("ts") >= 0 ? idx("ts") : idx("timestamp");
  const monIdx = idx("monitorid") >= 0 ? idx("monitorid") : idx("monitor");
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const ts = cols[tsIdx];
    const monitorId = cols[monIdx];
    if (!ts || !monitorId) continue;
    const sensors: Reading["sensors"] = [];
    for (let j = 0; j < headerRaw.length; j++) {
      const key = headerLower[j];
      if (["ts", "timestamp", "monitorid", "monitor", "model", "lat", "lng", "battery", "runtime"].includes(key)) continue;
      const v = Number(cols[j]);
      if (!Number.isFinite(v)) continue;
      const [gasName, unit] = headerRaw[j].split("_");
      if (!gasName || !unit) continue;
      sensors.push({ gasName, unit, value: v, alarm: "none" });
    }
    if (sensors.length === 0) continue;
    out.push({
      source: `rae:safety-suite:${instanceId}:csv`,
      ts: new Date(ts).toISOString(),
      monitorId,
      sensors,
    });
  }
  return out;
}
