import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

const QUICK_ID_UNS = ["1005", "1017", "1050", "1052", "1076", "1016", "1040", "1093", "1428"];

export function HomePage() {
  const [unInput, setUnInput] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const navigate = useNavigate();

  const counts = useLiveQuery(
    async () => ({
      chemicals: await db.chemicals.count(),
      npg: await db.npg.count(),
      facilities: await db.facilities.count(),
      incidents: await db.incidents.count(),
    }),
    [],
    { chemicals: 0, npg: 0, facilities: 0, incidents: 0 },
  );

  useEffect(() => {
    const raw = localStorage.getItem("recent-searches");
    if (raw) setRecent(JSON.parse(raw) as string[]);
  }, []);

  const lookup = async (q: string) => {
    const s = q.trim();
    if (!s) return;
    const chemical = await db.chemicals
      .filter((c) => c.un?.includes(s) || c.na?.includes(s) || c.cas?.includes(s) || c.name.toLowerCase().includes(s.toLowerCase()))
      .first();
    if (chemical) {
      const next = [chemical.id, ...recent.filter((x) => x !== chemical.id)].slice(0, 6);
      setRecent(next);
      localStorage.setItem("recent-searches", JSON.stringify(next));
      navigate(`/chemical/${chemical.id}`);
      return;
    }
    const facility = await db.facilities.filter((f) => f.name.toLowerCase().includes(s.toLowerCase())).first();
    if (facility) {
      navigate(`/facility/${facility.id}`);
    }
  };

  return (
    <div className="space-y-5">
      <section className="card space-y-3">
        <h1 className="text-xl font-bold">Identify a chemical</h1>
        <p className="text-sm text-slate-400">
          Enter UN/NA, CAS, or name. {counts.chemicals} chemicals, {counts.npg} NIOSH records, {counts.facilities} demo facilities loaded.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(unInput);
          }}
        >
          <input
            type="search"
            inputMode="numeric"
            placeholder="UN/NA number, CAS, or name"
            className="tap-target flex-1 rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100"
            value={unInput}
            onChange={(e) => setUnInput(e.target.value)}
          />
          <button type="submit" className="btn-primary">Identify</button>
        </form>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Quick ID (UN/NA)</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_ID_UNS.map((u) => (
            <button
              key={u}
              type="button"
              className="btn"
              onClick={() => void lookup(u)}
            >
              UN {u}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NavTile to="/search" title="Search" subtitle="By name, UN, CAS" />
        <NavTile to="/plume" title="Plume model" subtitle="AEGL/ERPG/TEEL on map" />
        <NavTile to="/facilities" title="Facilities" subtitle="Tier II demo set" />
        <NavTile to="/incidents" title="Incidents" subtitle={`${counts.incidents} open`} />
      </section>

      {recent.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-semibold">Recent</h2>
          <ul className="space-y-1 text-sm">
            {recent.map((id) => (
              <li key={id}>
                <Link className="text-amber-400 hover:underline" to={`/chemical/${id}`}>
                  {id}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function NavTile({ to, title, subtitle }: { to: string; title: string; subtitle: string }) {
  return (
    <Link to={to} className="card tap-target flex flex-col justify-between hover:border-amber-500">
      <span className="text-lg font-bold">{title}</span>
      <span className="text-xs text-slate-400">{subtitle}</span>
    </Link>
  );
}
