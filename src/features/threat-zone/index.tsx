import { useState } from "react";
import { estimateThreatZone, type ThreatZoneEstimate } from "@/lib/calc";
import { PLUME_DISCLAIMER } from "@/lib/model";

export function ThreatZonePage() {
  const [un, setUn] = useState("1005");
  const [isLarge, setIsLarge] = useState(false);
  const [isDay, setIsDay] = useState(true);
  const [windMph, setWindMph] = useState(5);
  const [result, setResult] = useState<ThreatZoneEstimate | null>(null);

  const compute = () => {
    const r = estimateThreatZone(
      {
        un,
        name: "Sample",
        guide: "117",
        smallInitialIsoFt: 150,
        smallProtectiveFt: 0.2,
        largeInitialIsoFt: 500,
        largeProtectiveFt: 1.0,
        day: isDay,
      } as never,
      { un, isLarge, isDay, windMph },
    );
    setResult(r);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Threat Zone</h1>
      <p className="text-sm text-slate-400">
        ERG Table 1 / Table 3 protective-action distances. UI skeleton (M2a).
      </p>

      <div className="card space-y-3">
        <label className="block">
          <span className="text-sm">UN/NA number</span>
          <input
            type="text"
            inputMode="numeric"
            className="tap-target mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2"
            value={un}
            onChange={(e) => setUn(e.target.value)}
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            className={`btn flex-1 ${!isLarge ? "bg-amber-500 text-slate-950" : ""}`}
            onClick={() => setIsLarge(false)}
          >
            Small
          </button>
          <button
            type="button"
            className={`btn flex-1 ${isLarge ? "bg-amber-500 text-slate-950" : ""}`}
            onClick={() => setIsLarge(true)}
          >
            Large
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`btn flex-1 ${isDay ? "bg-amber-500 text-slate-950" : ""}`}
            onClick={() => setIsDay(true)}
          >
            Day
          </button>
          <button
            type="button"
            className={`btn flex-1 ${!isDay ? "bg-amber-500 text-slate-950" : ""}`}
            onClick={() => setIsDay(false)}
          >
            Night
          </button>
        </div>
        <label className="block">
          <span className="text-sm">Wind (mph)</span>
          <input
            type="number"
            min={0}
            className="tap-target mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2"
            value={windMph}
            onChange={(e) => setWindMph(Number(e.target.value))}
          />
        </label>
        <button type="button" className="btn-primary w-full" onClick={compute}>
          Compute
        </button>
      </div>

      {result && (
        <div className="card space-y-2">
          <div className="text-sm text-slate-300">
            Initial isolation: <span className="font-mono">{result.initialIsolationFt} ft</span>
          </div>
          <div className="text-sm text-slate-300">
            Protective action: <span className="font-mono">{result.protectiveActionFt} mi</span>
          </div>
          <ul className="list-disc pl-5 text-xs text-slate-400">
            {result.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-500">{PLUME_DISCLAIMER}</p>
    </div>
  );
}
