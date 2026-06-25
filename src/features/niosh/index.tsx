import { useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export function NioshPage() {
  const records = useLiveQuery(() => db.npg.orderBy("name").toArray(), [], []);
  const [q, setQ] = useState("");

  const filtered = (records ?? []).filter((r) => {
    if (!q) return true;
    const n = q.toLowerCase();
    return (
      r.name.toLowerCase().includes(n) ||
      r.synonyms.some((s) => s.toLowerCase().includes(n)) ||
      (r.cas ?? "").includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">NIOSH Pocket Guide</h1>
      <p className="text-sm text-slate-400">{records?.length ?? 0} records loaded.</p>
      <input
        type="search"
        placeholder="Name, synonym, or CAS"
        className="tap-target w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="space-y-2">
        {filtered.map((r) => (
          <li key={r.id} className="card">
            <Link to={`/npg/${r.id}`} className="block hover:opacity-90">
              <div className="font-semibold">{r.name}</div>
              <div className="text-xs text-slate-400">
                CAS {r.cas || "—"} · REL {r.exposureLimits.rel || "—"} · PEL {r.exposureLimits.pel || "—"} · IDLH {r.exposureLimits.idlh || "—"}
              </div>
            </Link>
          </li>
        ))}
        {filtered.length === 0 && <li className="card text-sm text-slate-400">No matches.</li>}
      </ul>
    </div>
  );
}
