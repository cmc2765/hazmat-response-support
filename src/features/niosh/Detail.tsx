import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export function NPGDetailPage({ id }: { id: string }) {
  const record = useLiveQuery(() => db.npg.get(id), [id]);
  if (!record) {
    return (
      <div className="card text-sm text-slate-400">
        Record <code>{id}</code> not found.{" "}
        <Link to="/niosh" className="text-amber-400 hover:underline">Back to NIOSH</Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Link to="/niosh" className="text-xs text-slate-400 hover:underline">← Back to NIOSH</Link>
      <header className="card space-y-2">
        <h1 className="text-2xl font-bold">{record.name}</h1>
        <div className="text-sm text-slate-300">{record.synonyms.join(" · ") || "—"}</div>
        <div className="flex flex-wrap gap-2 text-xs">
          {record.cas && <span className="badge">CAS {record.cas}</span>}
          {record.rtecs && <span className="badge">RTECS {record.rtecs}</span>}
          {record.formula && <span className="badge">{record.formula}</span>}
        </div>
        <Link to={`/chemical/${record.id}`} className="btn self-start">View chemical detail</Link>
      </header>

      <section className="card space-y-2">
        <h2 className="font-semibold">Exposure limits</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <Term label="REL (NIOSH)" value={record.exposureLimits.rel ?? "—"} />
          <Term label="PEL (OSHA)" value={record.exposureLimits.pel ?? "—"} />
          <Term label="IDLH" value={record.exposureLimits.idlh ?? "—"} />
        </dl>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Physical properties</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Term label="MW" value={record.physical.mw ?? "—"} />
          <Term label="MP" value={record.physical.mp ?? "—"} />
          <Term label="BP" value={record.physical.bp ?? "—"} />
          <Term label="Vapor pressure" value={record.physical.vpMmHg ?? "—"} />
          <Term label="Specific gravity" value={record.physical.sg ?? "—"} />
          <Term label="Flash point" value={record.physical.flPt ?? "—"} />
          <Term label="LEL" value={record.physical.lel ?? "—"} />
          <Term label="UEL" value={record.physical.uel ?? "—"} />
        </dl>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Health</h2>
        <h3 className="text-sm font-semibold text-slate-300">Symptoms</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
          {record.health.symptoms.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
        <p className="text-xs text-slate-400">Target organs: {record.health.targetOrgans.join(", ") || "—"}</p>
        <h3 className="text-sm font-semibold text-slate-300 pt-2">First aid</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
          {record.health.firstAid.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
        <h3 className="text-sm font-semibold text-slate-300 pt-2">Respirator selection</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
          {record.health.respiratorSelection.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">PPE</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <Term label="Skin" value={record.ppe.skin.join(", ") || "—"} />
          <Term label="Eye" value={record.ppe.eye.join(", ") || "—"} />
          <Term label="Respiratory" value={record.ppe.respiratory.join(", ") || "—"} />
        </dl>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Reactivity</h2>
        {record.reactivity.waterReactive && (
          <p className="text-sm font-semibold text-amber-300">Water-reactive.</p>
        )}
        <div className="flex flex-wrap gap-1">
          {record.reactivity.incompatibilities.map((s) => <span key={s} className="badge border-red-500 text-red-300">{s}</span>)}
        </div>
      </section>
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
