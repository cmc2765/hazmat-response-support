import { useEffect, useState } from "react";
import { registerSW } from "@/workers/register";
import { startIntegrations } from "@/integrations";
import { ensureDataLoadedWithSync } from "@/lib/sync";
import { App } from "./App";

interface SeedStatus {
  state: "loading" | "ready" | "error";
  detail?: string;
  source?: "bundled" | "synced" | "cached";
  version?: string;
}

export function Bootstrap() {
  const [seed, setSeed] = useState<SeedStatus>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await ensureDataLoadedWithSync();
        if (cancelled) return;
        setSeed({ state: "ready", source: result.source, version: result.version });
        void startIntegrations();
        registerSW();
      } catch (err) {
        if (!cancelled) setSeed({ state: "error", detail: err instanceof Error ? err.message : String(err) });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (seed.state === "loading") {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-slate-200">
        <div className="card max-w-sm text-center">
          <p className="text-lg font-semibold">Loading hazmat data…</p>
          <p className="mt-1 text-xs text-slate-400">Trying server sync, falling back to bundled data.</p>
        </div>
      </div>
    );
  }

  if (seed.state === "error") {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-slate-200">
        <div className="card max-w-md space-y-2 border-red-700">
          <p className="text-lg font-semibold text-red-400">Data load failed</p>
          <p className="text-sm text-slate-300">{seed.detail}</p>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <App dataVersion={seed.version} dataSource={seed.source} />;
}