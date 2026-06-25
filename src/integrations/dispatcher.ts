// Integration dispatcher: connects configured integrations and streams
// readings/observations into Dexie. One per app instance.

import type { Reading, Observation, IntegrationConfig } from "@/lib/schema";
import { db } from "@/lib/db";
import { SafetySuiteAdapter, registerSignRequestFn, sha256SignRequest } from "@/integrations/rae/safety-suite";
import { integrationRegistry } from "@/integrations/registry";
import { logIntegrationError } from "@/integrations/http";

let started = false;
const adapters: Map<string, SafetySuiteAdapter> = new Map();

export async function startIntegrations(): Promise<void> {
  if (started) return;
  started = true;
  registerSignRequestFn(sha256SignRequest);

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      void stopIntegrations();
    });
  }

  const cfgs = await db.integrations.toArray();
  for (const cfg of cfgs) {
    if (!cfg.enabled) continue;
    await startIntegration(cfg);
  }
}

export async function startIntegration(cfg: IntegrationConfig): Promise<void> {
  if (cfg.kind !== "rae:safety-suite") return;
  if (adapters.has(cfg.id)) return;
  if (!cfg.url) {
    integrationRegistry.upsert({ ...integrationRegistry.fromConfig(cfg), status: "error", lastError: "Missing base URL" });
    return;
  }
  const adapter = new SafetySuiteAdapter({ baseUrl: cfg.url });
  integrationRegistry.upsert({ ...integrationRegistry.fromConfig(cfg), status: "connecting" });
  adapter.subscribe((reading) => {
    void db.readings.put(reading);
  });
  try {
    await adapter.connect(cfg);
    integrationRegistry.upsert({
      ...integrationRegistry.fromConfig(cfg),
      status: adapter.status(),
      lastSeenTs: adapter.lastSeen()?.toISOString() ?? null,
    });
    adapters.set(cfg.id, adapter);
    await db.integrations.update(cfg.id, {
      lastSeenTs: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    integrationRegistry.upsert({ ...integrationRegistry.fromConfig(cfg), status: "error", lastError: message });
    logIntegrationError(cfg, err);
    await db.integrations.update(cfg.id, { lastError: message });
  }
}

export async function stopIntegration(id: string): Promise<void> {
  const adapter = adapters.get(id);
  if (!adapter) return;
  await adapter.disconnect();
  adapters.delete(id);
  integrationRegistry.upsert({ id, kind: "rae:safety-suite", label: "", status: "idle", lastSeenTs: null });
}

export async function stopIntegrations(): Promise<void> {
  for (const [id, adapter] of adapters) {
    try {
      await adapter.disconnect();
    } catch (err) {
      console.warn("[integrations] stop failed", id, err);
    }
  }
  adapters.clear();
}

export async function pushObservation(o: Observation): Promise<void> {
  await db.observations.put(o);
}

export async function importReadings(readings: Reading[]): Promise<number> {
  if (readings.length === 0) return 0;
  await db.readings.bulkPut(readings);
  return readings.length;
}
