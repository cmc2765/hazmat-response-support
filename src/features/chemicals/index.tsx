import { useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export function ChemicalsPage() {
  const chemicals = useLiveQuery(() => db.chemicals.orderBy("name").toArray(), [], []);
  const [q, setQ] = useState("");
  const [hazClass, setHazClass] = useState<string>("");

  const filtered = (chemicals ?? []).filter((c) => {
    if (hazClass && !c.hazardClass.includes(hazClass)) return false;
    if (!q) return true;
    const n = q.toLowerCase();
    return (
      c.name.toLowerCase().includes(n) ||
      c.synonyms.some((s) => s.toLowerCase().includes(n)) ||
      (c.un ?? []).some((u) => u.includes(q)) ||
      (c.na ?? []).some((u) => u.includes(q)) ||
      (c.cas ?? []).some((u) => u.includes(q))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">Search chemicals</h1>
        <span className="text-xs text-slate-400">{filtered.length} of {chemicals?.length ?? 0} shown</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
        <input
          type="search"
          placeholder="Name, synonym, UN/NA, or CAS"
          className="tap-target rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="tap-target rounded-md border border-slate-700 bg-slate-900 px-4 py-2"
          value={hazClass}
          onChange={(e) => setHazClass(e.target.value)}
        >
          <option value="">All hazard classes</option>
          <option value="2.3">2.3 — Toxic gas</option>
          <option value="2.1">2.1 — Flammable gas</option>
          <option value="3">3 — Flammable liquid</option>
          <option value="4.3">4.3 — Water-reactive</option>
          <option value="5.1">5.1 — Oxidizer</option>
          <option value="6.1">6.1 — Toxic</option>
          <option value="8">8 — Corrosive</option>
        </select>
      </div>

      <ul className="space-y-2">
        {filtered.map((c) => (
          <li key={c.id} className="card">
            <Link to={`/chemical/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 hover:opacity-90">
              <div>
                <div className="text-base font-semibold">{c.name}</div>
                <div className="text-xs text-slate-400">
                  UN {c.un?.join(", ") || "—"} · CAS {c.cas?.join(", ") || "—"} · Class {c.hazardClass.join(", ") || "—"}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {c.ergGuide && <span className="badge">ERG {c.ergGuide}</span>}
                {c.hazardClass.includes("2.3") && <span className="badge border-red-500 text-red-300">Toxic</span>}
                {c.hazardClass.includes("4.3") && <span className="badge border-amber-500 text-amber-300">Water-reactive</span>}
                {c.hazardClass.includes("3") && <span className="badge border-orange-500 text-orange-300">Flammable</span>}
              </div>
            </Link>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="card text-sm text-slate-400">No matches.</li>
        )}
      </ul>
    </div>
  );
}
