import type { IntegrationConfig, Reading } from "@/lib/schema";
import { BaseIntegration } from "../../base";
import { type SensorIntegration } from "../../types";
import { logIntegrationError, safeFetchText } from "../../http";
import { getSecret } from "../../security";
import {
  ENDPOINTS,
  buildRequestEnvelope,
  decryptResponseJson,
  signRequest,
  type SafetySuiteCryptoKeys,
  type SafetySuiteRequest,
} from "./crypto";

export interface SafetySuiteAdapterOptions {
  baseUrl: string;
}

export interface SafetySuiteSite {
  siteId: number;
  name: string;
  city?: string;
  country?: string;
  province?: string;
  center?: string;
  zip?: string;
  address1?: string;
}

export interface SafetySuiteDevice {
  id: number;
  isOnline?: number;
  serialNumber?: string;
  name?: string;
  brand?: string;
  model?: string;
  location?: string;
  gps?: { lat?: number; lng?: number };
  battery?: number;
  type?: number;
  status?: number;
  sensorList?: Array<{
    name?: string;
    unit?: string;
    val?: number;
    decimalPoint?: number;
    detectionMode?: number;
  }>;
}

export interface SafetySuiteRtReading {
  data?: Array<{
    decimalPoint?: number;
    detectionMode?: number;
    name?: string;
    unit?: string;
    val?: number;
  }>;
  online?: number;
  deviceId?: number;
  time?: number;
  gps?: { lat?: number; lng?: number };
}

export interface SafetySuiteRtMessage {
  data?: {
    events?: Array<{
      deviceId?: number;
      eventCode?: number;
      time?: number;
      startFlag?: number;
      type?: number;
    }>;
    reading?: SafetySuiteRtReading[];
    workerId?: number;
    gps?: { lat?: number; lng?: number };
    time?: number;
    online?: number;
  };
  msgType?: string;
  flag?: number;
  msgId?: string;
}

export class SafetySuiteAdapter extends BaseIntegration<Reading> implements SensorIntegration {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private subTimer: ReturnType<typeof setInterval> | null = null;
  private serialByDevice: Map<number, string> = new Map();
  private cryptoKeys: SafetySuiteCryptoKeys | null = null;

  constructor(private opts: SafetySuiteAdapterOptions) {
    super("rae:safety-suite");
  }

  async connect(cfg: IntegrationConfig): Promise<void> {
    await super.connect(cfg);
    const secret = await getSecret(cfg.id);
    if (!secret?.appId || !secret?.secretKey || !secret?.iv) {
      this.setError(
        "Safety Suite credentials missing. Configure appid, secretKey, and AES IV in Settings.",
      );
      return;
    }
    this.cryptoKeys = {
      appId: secret.appId,
      secretKeyBase64: secret.secretKey,
      iv: secret.iv,
    };
    try {
      await this.refreshDeviceMap(cfg);
      this.startWebSocket();
      this.startHistoricalPolling(cfg, Math.max(60, cfg.pollIntervalSec) * 1000);
    } catch (err) {
      this.setError(err instanceof Error ? err.message : String(err));
      logIntegrationError(cfg, err);
    }
  }

  async disconnect(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.subTimer) clearInterval(this.subTimer);
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }
    this.pollTimer = this.pingTimer = this.subTimer = null;
    this.ws = null;
    this.cryptoKeys = null;
    this.serialByDevice.clear();
    await super.disconnect();
  }

  private async callSigned<T>(cfg: IntegrationConfig, uri: string, data: unknown): Promise<T | null> {
    if (!this.cryptoKeys) return null;
    const sign = await signRequest({
      appId: this.cryptoKeys.appId,
      uri,
      data,
      random: Math.floor(Math.random() * 0xfffffff),
      secretKeyBase64: this.cryptoKeys.secretKeyBase64,
      iv: this.cryptoKeys.iv,
    });
    const envelope = buildRequestEnvelope({
      appId: this.cryptoKeys.appId,
      uri,
      data,
      sign,
    });
    const body = JSON.stringify(envelope satisfies SafetySuiteRequest);
    const cipherText = await safeFetchText({
      url: `${this.opts.baseUrl}${uri}`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      integrationId: cfg.id,
    });
    return decryptResponseJson<T>(cipherText.trim(), this.cryptoKeys);
  }

  private async refreshDeviceMap(cfg: IntegrationConfig): Promise<void> {
    const resp = await this.callSigned<{ rtData?: { deviceList?: SafetySuiteDevice[] } }>(
      cfg,
      ENDPOINTS.deviceList,
      { isOnline: null },
    );
    const list = resp?.rtData?.deviceList ?? [];
    this.serialByDevice.clear();
    for (const d of list) {
      if (typeof d.id === "number" && typeof d.serialNumber === "string") {
        this.serialByDevice.set(d.id, d.serialNumber);
      }
    }
  }

  private async startHistoricalPolling(_cfg: IntegrationConfig, intervalMs: number): Promise<void> {
    const tick = async () => {
      if (!this.cfg) return;
      try {
        const end = Date.now();
        const start = end - intervalMs;
        const resp = await this.callSigned<{
          rtData?: {
            deviceData?: Array<{
              serialNo?: string;
              deviceId?: number;
              time?: number;
              data?: Array<{
                name?: string;
                unit?: string;
                val?: number;
                decimalPoint?: number;
                detectionMode?: number;
              }>;
              gps?: { lat?: number; lng?: number };
            }>;
          };
        }>(this.cfg, ENDPOINTS.hisDeviceData, {
          startTime: start,
          endTime: end,
          pageNo: 1,
          pageSize: 1000,
        });
        for (const d of resp?.rtData?.deviceData ?? []) {
          const reading = normalizeHistorical(d, this.cfg.id);
          if (reading) this.emit(reading);
        }
      } catch (err) {
        this.setError(err instanceof Error ? err.message : String(err));
        logIntegrationError(this.cfg, err);
      }
    };
    void tick();
    this.pollTimer = setInterval(tick, intervalMs);
  }

  private startWebSocket(): void {
    if (typeof WebSocket === "undefined") return;
    const url = this.opts.baseUrl.replace(/^http/i, "ws") + ENDPOINTS.ws;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      this.setError(err instanceof Error ? err.message : String(err));
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      void this.sendSubscribe();
      this.startTimers();
    };
    ws.onmessage = (ev) => {
      void this.handleMessage(typeof ev.data === "string" ? ev.data : "");
    };
    ws.onerror = () => this.setError("Safety Suite websocket error");
    ws.onclose = () => {
      this.clearTimers();
      if (this._status === "ok" || this._status === "connecting") {
        this.setError("Safety Suite websocket closed");
      }
    };
  }

  private startTimers(): void {
    this.pingTimer = setInterval(() => this.sendPing(), 75_000);
    this.subTimer = setInterval(() => void this.sendSubscribe(), 60_000);
  }

  private clearTimers(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.subTimer) clearInterval(this.subTimer);
    this.pingTimer = this.subTimer = null;
  }

  private async sendPing(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify({ msgType: "ping", sndTime: Date.now() }));
    } catch {
      // ignore
    }
  }

  private async sendSubscribe(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (!this.cryptoKeys) return;
    try {
      const envelope = {
        data: [{ type: 1, id: null, subDataType: [1, 2, 3] }],
        flag: 1,
        msgId: cryptoRandomId(),
        msgType: "subscribeRtData",
        sign: await signRequest({
          appId: this.cryptoKeys.appId,
          uri: "subscribeRtData",
          data: {},
          random: Math.floor(Math.random() * 0xfffffff),
          secretKeyBase64: this.cryptoKeys.secretKeyBase64,
          iv: this.cryptoKeys.iv,
        }),
        sndTime: Date.now(),
      };
      this.ws.send(JSON.stringify(envelope));
    } catch (err) {
      this.setError(err instanceof Error ? err.message : String(err));
    }
  }

  private async handleMessage(raw: string): Promise<void> {
    if (!raw) return;
    let msg: SafetySuiteRtMessage;
    try {
      msg = JSON.parse(raw) as SafetySuiteRtMessage;
    } catch {
      return;
    }
    if (!msg.data?.reading) return;
    for (const r of msg.data.reading) {
      const reading = normalizeRt(r, msg, this.serialByDevice, this.cfg?.id ?? "unknown");
      if (reading) this.emit(reading);
    }
  }
}

export function normalizeHistorical(
  raw: {
    serialNo?: string;
    deviceId?: number;
    time?: number;
    data?: Array<{ name?: string; unit?: string; val?: number; decimalPoint?: number; detectionMode?: number }>;
    gps?: { lat?: number; lng?: number };
  },
  instanceId: string,
): Reading | null {
  if (!raw.serialNo || !Array.isArray(raw.data) || raw.data.length === 0) return null;
  const sensors: Reading["sensors"] = raw.data
    .filter((s) => s.name && s.unit !== undefined && typeof s.val === "number")
    .map((s) => ({
      gasName: String(s.name),
      unit: String(s.unit),
      value: scaleValue(s.val as number, s.decimalPoint),
      alarm: s.detectionMode === 255 ? ("high" as const) : ("none" as const),
    }));
  if (sensors.length === 0) return null;
  return {
    source: `rae:safety-suite:${instanceId}:historical`,
    ts: raw.time ? new Date(raw.time).toISOString() : new Date().toISOString(),
    monitorId: raw.serialNo,
    model: undefined,
    lat: raw.gps?.lat,
    lng: raw.gps?.lng,
    batteryPct: undefined,
    runTimeSec: undefined,
    sensors,
  };
}

export function normalizeRt(
  raw: SafetySuiteRtReading,
  msg: SafetySuiteRtMessage,
  serialByDevice: Map<number, string>,
  instanceId: string,
): Reading | null {
  if (!raw.deviceId || !Array.isArray(raw.data) || raw.data.length === 0) return null;
  const sensors: Reading["sensors"] = raw.data
    .filter((s) => s.name && s.unit !== undefined && typeof s.val === "number")
    .map((s) => ({
      gasName: String(s.name),
      unit: String(s.unit),
      value: scaleValue(s.val as number, s.decimalPoint),
      alarm: s.detectionMode === 255 ? ("high" as const) : ("none" as const),
    }));
  if (sensors.length === 0) return null;
  const monitorId =
    serialByDevice.get(raw.deviceId) ?? `device-${raw.deviceId}`;
  return {
    source: `rae:safety-suite:${instanceId}:rt`,
    ts: raw.time ? new Date(raw.time).toISOString() : new Date(msg.data?.time ?? Date.now()).toISOString(),
    monitorId,
    lat: raw.gps?.lat ?? msg.data?.gps?.lat,
    lng: raw.gps?.lng ?? msg.data?.gps?.lng,
    sensors,
  };
}

function scaleValue(val: number, decimalPoint: number | undefined): number {
  if (typeof decimalPoint !== "number" || decimalPoint <= 0) return val;
  return Number((val / Math.pow(10, decimalPoint)).toFixed(decimalPoint));
}

function cryptoRandomId(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
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
