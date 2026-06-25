import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export function FacilitiesPage() {
  const facilities = useLiveQuery(() => db.facilities.toArray(), [], []);
  const [q, setQ] = useState("");

  const filtered = (facilities ?? []).filter((f) => {
    if (!q) return true;
    return f.name.toLowerCase().includes(q.toLowerCase()) ||
      f.address.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Facilities (Tier II)</h1>
      <p className="text-sm text-slate-400">
        {facilities?.length ?? 0} facilities loaded. Scrapers ship in M4.
      </p>
      <input
        type="search"
        placeholder="Search by name or address"
        className="tap-target w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="space-y-2">
        {filtered.slice(0, 50).map((f) => (
          <li key={f.id} className="card">
            <div className="font-semibold">{f.name}</div>
            <div className="text-xs text-slate-400">{f.address}</div>
            <div className="mt-1 text-xs text-slate-500">
              {f.chemicals.length} chemicals · {f.ehsFlag ? "EHS" : "non-EHS"} · {f.lastUpdated}
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="card text-sm text-slate-400">No facilities loaded yet (M4).</li>
        )}
      </ul>
    </div>
  );
}
