import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export function FacilitiesPage() {
  const facilities = useLiveQuery(() => db.facilities.toArray(), [], []);
  const chemicals = useLiveQuery(() => db.chemicals.toArray(), [], []);

  const chemById = new Map((chemicals ?? []).map((c) => [c.id, c]));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Facilities</h1>
      <p className="text-sm text-slate-400">
        Tier II demo set — replace with live data from EPA + state portals + erplan.net in M4. {facilities?.length ?? 0} facilities.
      </p>
      <ul className="space-y-2">
        {(facilities ?? []).map((f) => (
          <li key={f.id} className="card">
            <Link to={`/facility/${f.id}`} className="block hover:opacity-90">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{f.name}</span>
                {f.ehsFlag && <span className="badge border-red-500 text-red-300">EHS</span>}
              </div>
              <div className="text-xs text-slate-400">{f.address}</div>
              <div className="mt-1 text-xs text-slate-500">
                {f.chemicals.length} chemicals · last reported {f.lastUpdated}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {f.chemicals.slice(0, 5).map((c) => {
                  const chem = chemById.get(c.chemicalId);
                  return chem ? <span key={c.chemicalId} className="badge">{chem.name}</span> : null;
                })}
                {f.chemicals.length > 5 && <span className="badge">+{f.chemicals.length - 5} more</span>}
              </div>
            </Link>
          </li>
        ))}
        {(facilities ?? []).length === 0 && (
          <li className="card text-sm text-slate-400">No facilities loaded.</li>
        )}
      </ul>
    </div>
  );
}
