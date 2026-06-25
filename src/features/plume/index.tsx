import { useState } from "react";
import { runPlume, PLUME_DISCLAIMER, MODEL_VERSION } from "@/lib/model";
import type { PlumeInputs, ThresholdBand } from "@/lib/schema";

const SAMPLE_THRESHOLDS: ThresholdBand[] = [
  { kind: "AEGL", level: 1, valuePpm: 0.5, label: "AEGL-1" },
  { kind: "AEGL", level: 2, valuePpm: 2, label: "AEGL-2" },
  { kind: "AEGL", level: 3, valuePpm: 10, label: "AEGL-3" },
];

export function PlumePage() {
  const [inputs, setInputs] = useState<PlumeInputs>({
    chemicalId: "ammonia",
    releaseKind: "plume",
    totalMassKg: 1000,
    releaseRateKgPerSec: 1,
    durationSec: 600,
    releaseHeightM: 1,
    windSpeedMps: 3,
    windDirDeg: 270,
    stabilityClass: "D",
    surfaceRoughness: "rural",
    tempC: 20,
    rh: 60,
  });
  const [result, setResult] = useState<ReturnType<typeof runPlume> | null>(null);

  const compute = () => {
    setResult(
      runPlume(inputs, {
        thresholds: SAMPLE_THRESHOLDS,
        emissionRateKgPerSec: inputs.releaseRateKgPerSec ?? 1,
        saturatedConcentrationPpm: 100,
      }),
    );
  };

  const update = <K extends keyof PlumeInputs>(k: K, v: PlumeInputs[K]) =>
    setInputs((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Plume</h1>
      <p className="text-sm text-slate-400">
        Gaussian plume + puff model. Map overlay ships in M3.
      </p>

      <div className="card space-y-3">
        <label className="block">
          <span className="text-sm">Chemical ID</span>
          <input
            type="text"
            className="tap-target mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2"
            value={inputs.chemicalId}
            onChange={(e) => update("chemicalId", e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-sm">Wind (m/s)</span>
            <input
              type="number"
              min={0}
              step={0.1}
              className="tap-target mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2"
              value={inputs.windSpeedMps}
              onChange={(e) => update("windSpeedMps", Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="text-sm">Wind dir (°)</span>
            <input
              type="number"
              min={0}
              max={360}
              className="tap-target mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2"
              value={inputs.windDirDeg}
              onChange={(e) => update("windDirDeg", Number(e.target.value))}
            />
          </label>
        </div>
        <label className="block">
          <span className="text-sm">Stability (A–F)</span>
          <select
            className="tap-target mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2"
            value={inputs.stabilityClass}
            onChange={(e) => update("stabilityClass", e.target.value as PlumeInputs["stabilityClass"])}
          >
            {(["A", "B", "C", "D", "E", "F"] as const).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-primary w-full" onClick={compute}>
          Run model
        </button>
      </div>

      {result && (
        <div className="card space-y-2">
          <div className="text-sm text-slate-300">
            Model: <span className="font-mono">{result.modelVersion}</span> · Computed{" "}
            {new Date(result.computedAt).toLocaleString()}
          </div>
          <div className="text-sm">
            {result.centerline.slice(0, 5).map((p) => (
              <div key={p.distanceM}>
                {p.distanceM} m → <span className="font-mono">{p.concentrationPpm} ppm</span>
              </div>
            ))}
            <div className="text-xs text-slate-400">…and {result.centerline.length - 5} more samples</div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500">
        {PLUME_DISCLAIMER} (model v{MODEL_VERSION})
      </p>
    </div>
  );
}
