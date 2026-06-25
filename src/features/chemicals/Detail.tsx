import { useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { lookupErg } from "@/data/erg";
import { getThresholds } from "@/data/thresholds";
import { lookupNpgByChemicalId } from "@/data/npg";
import { PLUME_DISCLAIMER } from "@/lib/model";

type Tab = "overview" | "ppe" | "isolation" | "reactivity" | "niosh" | "erg";

export function ChemicalDetailPage({ id }: { id: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const chemical = useLiveQuery(() => db.chemicals.get(id), [id]);
  const npg = useLiveQuery(() => db.npg.get(id), [id]);

  if (!chemical) {
    return (
      <div className="card text-sm text-slate-400">
        Chemical <code>{id}</code> not found.{" "}
        <Link to="/search" className="text-amber-400 hover:underline">Back to search</Link>
      </div>
    );
  }

  const thresholds = getThresholds(chemical.id);
  const erg = (chemical.un ?? []).map((u) => lookupErg(u)).find(Boolean);
  const npgData = npg ?? lookupNpgByChemicalId(chemical.id);

  return (
    <div className="space-y-4">
      <Link to="/search" className="text-xs text-slate-400 hover:underline">← Back to search</Link>

      <header className="card space-y-2">
        <h1 className="text-2xl font-bold">{chemical.name}</h1>
        <div className="text-sm text-slate-300">
          {chemical.synonyms.join(" · ")}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          {chemical.un?.length ? <span className="badge">UN {chemical.un.join(", ")}</span> : null}
          {chemical.cas?.length ? <span className="badge">CAS {chemical.cas.join(", ")}</span> : null}
          {chemical.ergGuide && <span className="badge">ERG {chemical.ergGuide}</span>}
          {chemical.hazardClass.map((h) => <span key={h} className="badge">Class {h}</span>)}
          {chemical.placard && <span className="badge border-amber-500 text-amber-300">{chemical.placard}</span>}
        </div>
        <div className="flex gap-2 pt-2">
          <Link to={`/plume?chemical=${chemical.id}`} className="btn-primary">Run plume model</Link>
          {chemical.sdsUrl && (
            <a href={chemical.sdsUrl} target="_blank" rel="noreferrer" className="btn">CAMEO record</a>
          )}
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto" aria-label="Detail tabs">
        {([
          ["overview", "Overview"],
          ["ppe", "PPE"],
          ["isolation", "Isolation"],
          ["reactivity", "Reactivity"],
          ["niosh", "NIOSH"],
          ["erg", "ERG distances"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            type="button"
            className={`tap-target whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
              tab === t ? "bg-slate-700 text-slate-100" : "text-slate-400 hover:bg-slate-800"
            }`}
            onClick={() => setTab(t)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <section className="card space-y-3">
          <h2 className="font-semibold">Hazards</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
            {chemical.reactivity.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          {chemical.firstAid.length > 0 && (
            <>
              <h2 className="font-semibold pt-2">First aid</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
                {chemical.firstAid.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </>
          )}
          {thresholds && (
            <>
              <h2 className="font-semibold pt-2">Acute exposure thresholds (1-hr)</h2>
              <div className="grid gap-2 sm:grid-cols-3">
                <ThresholdCard label="AEGL-1 / 2 / 3" values={[thresholds.aegl?.["1"], thresholds.aegl?.["2"], thresholds.aegl?.["3"]]} unit="ppm" />
                <ThresholdCard label="ERPG-1 / 2 / 3" values={[thresholds.erpg?.["1"], thresholds.erpg?.["2"], thresholds.erpg?.["3"]]} unit="ppm" />
                <ThresholdCard label="TEEL-0 / 1 / 2 / 3" values={[thresholds.teel?.["0"], thresholds.teel?.["1"], thresholds.teel?.["2"], thresholds.teel?.["3"]]} unit="ppm" />
              </div>
            </>
          )}
        </section>
      )}

      {tab === "ppe" && (
        <section className="card space-y-2">
          <h2 className="font-semibold">Recommended PPE</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
            {chemical.ppe.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </section>
      )}

      {tab === "isolation" && (
        <section className="card space-y-3">
          <h2 className="font-semibold">Initial isolation & protective action</h2>
          <p className="text-sm text-slate-200">{chemical.isolation.initial ?? "—"}</p>
          <p className="text-sm text-slate-200">{chemical.isolation.protective ?? "—"}</p>
          <p className="text-xs text-slate-400">
            Use the ERG distances tab for the full Table 1 day/night × small/large matrix. Run a plume model for site-specific downwind concentrations.
          </p>
        </section>
      )}

      {tab === "reactivity" && (
        <section className="card space-y-3">
          <h2 className="font-semibold">Reactivity</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
            {chemical.reactivity.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          <h3 className="font-semibold pt-2">Incompatibilities</h3>
          <div className="flex flex-wrap gap-1">
            {chemical.incompatibilities.map((s) => <span key={s} className="badge border-red-500 text-red-300">{s}</span>)}
          </div>
          <p className="text-xs text-slate-400">
            Avoid applying water to water-reactives unless explicitly recommended in the chemical&apos;s specific guide.
          </p>
        </section>
      )}

      {tab === "niosh" && (
        <section className="card space-y-2">
          {npgData ? (
            <>
              <h2 className="font-semibold">NIOSH Pocket Guide</h2>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <Term label="REL" value={npgData.exposureLimits.rel ?? "—"} />
                <Term label="PEL" value={npgData.exposureLimits.pel ?? "—"} />
                <Term label="IDLH" value={npgData.exposureLimits.idlh ?? "—"} />
                <Term label="Formula" value={npgData.formula ?? "—"} />
              </dl>
              <h3 className="font-semibold pt-2">Symptoms / target organs</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
                {npgData.health.symptoms.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
              <div className="text-xs text-slate-400">
                Target organs: {npgData.health.targetOrgans.join(", ") || "—"}
              </div>
              <h3 className="font-semibold pt-2">First aid</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
                {npgData.health.firstAid.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
              <h3 className="font-semibold pt-2">Respirator selection</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
                {npgData.health.respiratorSelection.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </>
          ) : (
            <p className="text-sm text-slate-400">No NIOSH record bundled for this chemical.</p>
          )}
        </section>
      )}

      {tab === "erg" && (
        <section className="card space-y-3">
          <h2 className="font-semibold">ERG Table 1 distances</h2>
          {erg ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs text-slate-400">
                  <tr>
                    <th className="px-2 py-1 text-left">Size</th>
                    <th className="px-2 py-1 text-left">Daytime</th>
                    <th className="px-2 py-1 text-left">Nighttime</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-800">
                    <td className="px-2 py-1 font-semibold">Small</td>
                    <td className="px-2 py-1">
                      Init. isolation: {erg.smallInitialDayFt} ft<br />
                      Protective: {erg.smallProtectiveDayMi} mi
                    </td>
                    <td className="px-2 py-1">
                      Init. isolation: {erg.smallInitialNightFt} ft<br />
                      Protective: {erg.smallProtectiveNightMi} mi
                    </td>
                  </tr>
                  <tr className="border-t border-slate-800">
                    <td className="px-2 py-1 font-semibold">Large</td>
                    <td className="px-2 py-1">
                      Init. isolation: {erg.largeInitialDayFt} ft<br />
                      Protective: {erg.largeProtectiveDayMi} mi
                    </td>
                    <td className="px-2 py-1">
                      Init. isolation: {erg.largeInitialNightFt} ft<br />
                      Protective: {erg.largeProtectiveNightMi} mi
                    </td>
                  </tr>
                </tbody>
              </table>
              {erg.isWaterReactive && (
                <p className="pt-3 text-xs text-amber-300">
                  Water-reactive (Table 3). Runoff control: avoid water contact; dike for recovery.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No ERG Table 1 entry for this chemical in the bundled subset.</p>
          )}
          <p className="text-xs text-slate-400">
            Distances are from ERG 2024 Table 1 — verify against the printed ERG before field use.
          </p>
        </section>
      )}

      <p className="text-xs text-slate-500">{PLUME_DISCLAIMER}</p>
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

function ThresholdCard({ label, values, unit }: { label: string; values: Array<number | undefined>; unit: string }) {
  return (
    <div className="card space-y-1 text-sm">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="font-mono">
        {values.map((v, i) => (
          <span key={i} className="mr-2">
            {i > 0 && <span className="text-slate-500"> / </span>}
            {v ?? "—"}
          </span>
        ))}
        <span className="text-xs text-slate-400"> {unit}</span>
      </div>
    </div>
  );
}
