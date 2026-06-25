import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { getThresholds } from "@/data/thresholds";
import type { Chemical } from "@/lib/schema";

export function FacilityDetailPage({ id }: { id: string }) {
  const facility = useLiveQuery(() => db.facilities.get(id), [id]);
  const chemMap = useLiveQuery(
    async () => {
      const ids = facility?.chemicals.map((c) => c.chemicalId) ?? [];
      const rows = await db.chemicals.where("id").anyOf(ids).toArray();
      return new Map(rows.map((c) => [c.id, c] as const));
    },
    [facility?.id],
    new Map<string, Chemical>(),
  );

  if (!facility) {
    return (
      <div className="card text-sm text-slate-400">
        Facility <code>{id}</code> not found.{" "}
        <Link to="/facilities" className="text-amber-400 hover:underline">Back to facilities</Link>
      </div>
    );
  }

  const enriched = facility.chemicals
    .map((c) => ({
      facilityChemical: c,
      chem: chemMap.get(c.chemicalId),
      th: getThresholds(c.chemicalId),
    }))
    .sort((a, b) => {
      const rank = (chem: Chemical | undefined): number => {
        if (!chem) return 2;
        if (chem.hazardClass.includes("2.3")) return 0;
        if (chem.hazardClass.includes("4.3")) return 1;
        return 2;
      };
      return rank(a.chem) - rank(b.chem);
    });

  return (
    <div className="space-y-4">
      <Link to="/facilities" className="text-xs text-slate-400 hover:underline">← Back to facilities</Link>

      <header className="card space-y-1">
        <h1 className="text-2xl font-bold">{facility.name}</h1>
        <p className="text-sm text-slate-300">{facility.address}</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {facility.ehsFlag && <span className="badge border-red-500 text-red-300">EHS</span>}
          <span className="badge">DUNS {facility.dunn}</span>
          <span className="badge">Last reported {facility.lastUpdated}</span>
        </div>
      </header>

      <section className="card space-y-3">
        <h2 className="font-semibold">Tier II chemicals</h2>
        <ul className="space-y-2">
          {enriched.map((row, i) => (
            <li key={`${row.facilityChemical.chemicalId}-${i}`} className="rounded-md border border-slate-800 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  {row.chem ? (
                    <Link to={`/chemical/${row.chem.id}`} className="font-semibold hover:underline">{row.chem.name}</Link>
                  ) : (
                    <span className="font-semibold">{row.facilityChemical.chemicalId}</span>
                  )}
                  <div className="text-xs text-slate-400">
                    Max daily: {row.facilityChemical.maxDailyAmount.value.toLocaleString()} {row.facilityChemical.maxDailyAmount.unit} · {row.facilityChemical.container ?? "—"} · {row.facilityChemical.conditions ?? "—"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {row.chem?.hazardClass.map((h) => <span key={h} className="badge">Class {h}</span>)}
                  {row.th?.aegl && <span className="badge border-amber-500 text-amber-300">AEGL</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
