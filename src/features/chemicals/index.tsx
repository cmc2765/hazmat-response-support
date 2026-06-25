import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export function ChemicalsPage() {
  const chemicals = useLiveQuery(() => db.chemicals.toArray(), [], []);
  const [q, setQ] = useState("");

  const filtered = (chemicals ?? []).filter((c) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return (
      c.name.toLowerCase().includes(needle) ||
      c.synonyms.some((s) => s.toLowerCase().includes(needle)) ||
      (c.un ?? []).some((u) => u.includes(needle)) ||
      (c.cas ?? []).some((c2) => c2.includes(needle))
    );
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Chemicals</h1>
      <p className="text-sm text-slate-400">
        ERG 2024 + CAMEO Chemicals data. {chemicals?.length ?? 0} records loaded.
      </p>
      <input
        type="search"
        placeholder="Search by name, UN/NA, or CAS"
        className="tap-target w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="space-y-2">
        {filtered.slice(0, 50).map((c) => (
          <li key={c.id} className="card">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-slate-400">
                  UN {c.un?.join(", ") || "—"} · CAS {c.cas?.join(", ") || "—"}
                </div>
              </div>
              {c.ergGuide ? <span className="badge">ERG {c.ergGuide}</span> : null}
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="card text-sm text-slate-400">No chemicals loaded yet (M1).</li>
        )}
      </ul>
    </div>
  );
}
