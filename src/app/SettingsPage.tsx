import { useEffect, useState } from "react";
import { DATA_VERSION } from "@/lib/seed";
import { syncFromServer, getLastSyncVersion } from "@/lib/sync";

interface DataManifest {
  version: string;
  sources: Record<string, { license?: string; path?: string }>;
}

export function SettingsPage() {
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [manifest, setManifest] = useState<DataManifest | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(getLastSyncVersion());

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    fetch("/data/manifest.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => setManifest(m))
      .catch(() => setManifest(null));
  }, []);

  const doSync = async () => {
    setSyncMsg("Syncing…");
    const result = await syncFromServer();
    if (result.ok) {
      setLastSync(result.version);
      setSyncMsg(`Synced ${result.counts.chemicals} chemicals, ${result.counts.npg} NPG, ${result.counts.facilities} facilities from server (v${result.version}).`);
    } else {
      setSyncMsg(`Sync failed: ${result.reason}. Using bundled data.`);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="card space-y-2">
        <h2 className="font-semibold">Status</h2>
        <p className="text-sm text-slate-300">
          Network: <span className={online ? "text-green-400" : "text-red-400"}>{online ? "online" : "offline"}</span>
        </p>
        <p className="text-sm text-slate-300">
          Bundled data version: <span className="font-mono">{DATA_VERSION}</span>
        </p>
        <p className="text-sm text-slate-300">
          Last server sync: <span className="font-mono">{lastSync ?? "never"}</span>
        </p>
        <button type="button" className="btn-primary" onClick={doSync}>Sync from server now</button>
        {syncMsg && <p className="text-xs text-slate-400">{syncMsg}</p>}
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Integrations</h2>
        <p className="text-sm text-slate-300">
          Live dispatch is not wired yet. Configuration is stored locally so when M7 ships the dispatcher
          picks up where we left off.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-400">
          <li>Honeywell Safety Suite (LAN) — CSV import works today.</li>
          <li>Online weather (NWS / Open-Meteo) — pull weather from the Plume page.</li>
          <li>Columbia Weather Systems microServer — coming next.</li>
        </ul>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Data sources</h2>
        {manifest ? (
          <ul className="space-y-1 text-sm text-slate-300">
            {Object.entries(manifest.sources).map(([key, info]) => (
              <li key={key}>
                <span className="font-mono">{key}</span>
                <span className="ml-2 text-xs text-slate-400">{info.license ?? ""}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">Manifest unavailable.</p>
        )}
      </section>
    </div>
  );
}
