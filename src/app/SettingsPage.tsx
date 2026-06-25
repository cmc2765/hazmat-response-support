import { useEffect, useState } from "react";

export function SettingsPage() {
  const [dataVersion, setDataVersion] = useState<string>("unknown");
  const [online, setOnline] = useState<boolean>(navigator.onLine);

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
      .then((m) => setDataVersion(m?.version ?? "missing"))
      .catch(() => setDataVersion("missing"));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <section className="card space-y-2">
        <h2 className="font-semibold">Status</h2>
        <p className="text-sm text-slate-300">
          Network: <span className={online ? "text-green-400" : "text-red-400"}>{online ? "online" : "offline"}</span>
        </p>
        <p className="text-sm text-slate-300">
          Data version: <span className="font-mono">{dataVersion}</span>
        </p>
      </section>
      <section className="card space-y-2">
        <h2 className="font-semibold">Integrations</h2>
        <p className="text-sm text-slate-400">
          Configure Honeywell Safety Suite (LAN), online weather (NWS / Open-Meteo),
          and Columbia Weather Systems microServer in a future milestone.
        </p>
      </section>
    </div>
  );
}
