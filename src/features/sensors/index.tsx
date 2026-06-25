import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { parseSafetySuiteCsv } from "@/integrations/rae/safety-suite/adapter";

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

  const [importMsg, setImportMsg] = useState<string | null>(null);

  const importCsv = async (file: File) => {
    const text = await file.text();
    const rows = parseSafetySuiteCsv(text, "manual-import");
    if (rows.length === 0) {
      setImportMsg("No valid rows found in CSV.");
      return;
    }
    await db.readings.bulkPut(rows);
    setImportMsg(`Imported ${rows.length} readings.`);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Sensors</h1>

      <section className="card space-y-2">
        <h2 className="font-semibold">Live integrations</h2>
        <p className="text-sm text-slate-300">
          Live connections to Safety Suite (LAN), online weather, and Columbia Weather Systems microServer
          are configured but live dispatch is coming next. In the meantime:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
          <li>Import Safety Suite CSV exports for offline review.</li>
          <li>Weather observations are auto-pulled by the plume form (NWS / Open-Meteo).</li>
          <li>Configure integrations in Settings for future live use.</li>
        </ul>
        <label className="btn cursor-pointer self-start">
          Import Safety Suite CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importCsv(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
        {importMsg && <p className="text-xs text-slate-400">{importMsg}</p>}
      </section>

      {integrations && integrations.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-semibold">Configured integrations</h2>
          <ul className="text-sm space-y-1">
            {integrations.map((i) => (
              <li key={i.id} className="flex items-center justify-between">
                <span className="font-mono text-slate-300">{i.kind}</span>
                <span className="text-xs text-slate-400">{i.label} · {i.url ?? "no URL"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card space-y-2">
        <h2 className="font-semibold">Weather observations</h2>
        {observations.length === 0 ? (
          <p className="text-sm text-slate-400">No observations yet — open the Plume page to fetch.</p>
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
        <h2 className="font-semibold">Imported readings</h2>
        {readings.length === 0 ? (
          <p className="text-sm text-slate-400">No readings imported yet.</p>
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
