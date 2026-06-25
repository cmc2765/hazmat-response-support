import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { integrationRegistry } from "@/integrations/registry";
import type { IntegrationConfig } from "@/lib/schema";

interface FormState {
  baseUrl: string;
  appId: string;
  secretKey: string;
  iv: string;
  pollIntervalSec: number;
  label: string;
}

const DEFAULT_FORM: FormState = {
  baseUrl: "https://safety-suite.lan:8443",
  appId: "",
  secretKey: "",
  iv: "",
  pollIntervalSec: 60,
  label: "Safety Suite (LAN)",
};

export function SensorsPage() {
  const readings = useLiveQuery(
    () => db.readings.orderBy("ts").reverse().limit(50).toArray(),
    [],
    [],
  );
  const observations = useLiveQuery(
    () => db.observations.orderBy("ts").reverse().limit(20).toArray(),
    [],
    [],
  );
  const integrations = useLiveQuery(
    () => db.integrations.toArray(),
    [],
    [],
  );

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const ssExisting = (integrations ?? []).find((i) => i.kind === "rae:safety-suite");

  const save = async () => {
    if (!form.appId || !form.secretKey || !form.iv) {
      setSavedMsg("appid, secretKey, and iv are required.");
      return;
    }
    const id = ssExisting?.id ?? crypto.randomUUID();
    const cfg: IntegrationConfig = {
      id,
      kind: "rae:safety-suite",
      label: form.label,
      enabled: true,
      url: form.baseUrl,
      appId: form.appId,
      pollIntervalSec: form.pollIntervalSec,
      lastSeenTs: ssExisting?.lastSeenTs,
      lastError: ssExisting?.lastError,
      createdAt: ssExisting?.createdAt ?? new Date().toISOString(),
    };
    await db.integrations.put(cfg);
    const { putSecret } = await import("@/integrations/security");
    await putSecret({
      integrationId: id,
      kind: "rae:safety-suite",
      appId: form.appId,
      secretKey: form.secretKey,
      iv: form.iv,
      createdAt: new Date().toISOString(),
    });
    integrationRegistry.upsert(integrationRegistry.fromConfig(cfg));
    setSavedMsg(`Saved. Connect via M7 dispatcher.`);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Sensors</h1>
      <p className="text-sm text-slate-400">
        Live readings from Honeywell Safety Suite (LAN), online weather, and CWS microServer.
        Real-time websocket + signed REST land in M7.
      </p>

      <section className="card space-y-3">
        <h2 className="font-semibold">Safety Suite (LAN) configuration</h2>
        <p className="text-xs text-slate-400">
          Credentials live in IndexedDB. Base URL is the Safety Suite server on your network.
          See <code>docs/honeywell-safety-suite-sdk.md</code> for the API surface.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm">Label</span>
            <input
              type="text"
              className="tap-target mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-sm">Base URL</span>
            <input
              type="text"
              className="tap-target mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2"
              value={form.baseUrl}
              onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-sm">appid</span>
            <input
              type="text"
              className="tap-target mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2 font-mono"
              value={form.appId}
              onChange={(e) => setForm((f) => ({ ...f, appId: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-sm">secretKey (base64)</span>
            <input
              type="password"
              autoComplete="off"
              className="tap-target mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2 font-mono"
              value={form.secretKey}
              onChange={(e) => setForm((f) => ({ ...f, secretKey: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-sm">AES IV</span>
            <input
              type="password"
              autoComplete="off"
              className="tap-target mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2 font-mono"
              value={form.iv}
              onChange={(e) => setForm((f) => ({ ...f, iv: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-sm">Historical poll (sec)</span>
            <input
              type="number"
              min={60}
              step={30}
              className="tap-target mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2"
              value={form.pollIntervalSec}
              onChange={(e) =>
                setForm((f) => ({ ...f, pollIntervalSec: Math.max(60, Number(e.target.value)) }))
              }
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="btn-primary" onClick={save}>
            Save
          </button>
          {savedMsg && <span className="text-xs text-slate-400">{savedMsg}</span>}
          {ssExisting?.lastError && (
            <span className="text-xs text-red-400">{ssExisting.lastError}</span>
          )}
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Weather observations</h2>
        {observations.length === 0 ? (
          <p className="text-sm text-slate-400">No observations yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {observations.map((o) => (
              <li key={`${o.source}-${o.ts}`} className="flex justify-between">
                <span className="text-slate-300">{o.source}</span>
                <span className="font-mono text-slate-400">
                  {o.windSpeedMps?.toFixed(1) ?? "—"} m/s @ {o.windDirDeg ?? "—"}°
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">RAE readings</h2>
        {readings.length === 0 ? (
          <p className="text-sm text-slate-400">No readings yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {readings.map((r) => (
              <li key={`${r.source}-${r.monitorId}-${r.ts}`}>
                <div className="flex justify-between">
                  <span className="text-slate-300">{r.monitorId}</span>
                  <span className="text-xs text-slate-500">{new Date(r.ts).toLocaleString()}</span>
                </div>
                <div className="text-xs text-slate-400">
                  {r.sensors.map((s) => `${s.gasName} ${s.value}${s.unit}`).join(", ")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
