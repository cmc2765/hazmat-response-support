import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export function IncidentsPage() {
  const incidents = useLiveQuery(
    () => db.incidents.orderBy("openedAt").reverse().toArray(),
    [],
    [],
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Incidents</h1>
      <p className="text-sm text-slate-400">
        Local-only incident log. Timeline, actions, exposures, units. Export ships in M5.
      </p>

      <ul className="space-y-2">
        {(incidents ?? []).map((i) => (
          <li key={i.id} className="card">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{i.id}</span>
              <span className="text-xs text-slate-500">
                opened {new Date(i.openedAt).toLocaleString()}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {i.timeline.length} events · {i.actions.length} actions · {i.exposures.length} exposures
            </div>
          </li>
        ))}
        {(incidents ?? []).length === 0 && (
          <li className="card text-sm text-slate-400">No incidents logged yet.</li>
        )}
      </ul>
    </div>
  );
}
