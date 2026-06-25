import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Sensors</h1>
      <p className="text-sm text-slate-400">
        Live readings from Honeywell Safety Suite (LAN), online weather, and CWS microServer.
        Connectors ship in M7.
      </p>

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
