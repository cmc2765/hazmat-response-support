import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import maplibregl, { type Map as MLMap, type LngLatLike } from "maplibre-gl";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { runPlume } from "@/lib/model";
import type { PlumeInputs, ThresholdBand } from "@/lib/schema";
import { THRESHOLDS, getThresholds } from "@/data/thresholds";
import { molecularWeightOf } from "@/data/molecular-weight";
import { PLUME_DISCLAIMER, MODEL_VERSION } from "@/lib/model";
import { NwsAdapter, OpenMeteoAdapter } from "@/integrations";
import { pushObservation } from "@/integrations/dispatcher";
import "maplibre-gl/dist/maplibre-gl.css";

const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

function defaultInputs(chemicalId?: string): PlumeInputs {
  return {
    chemicalId: chemicalId ?? "ammonia",
    releaseKind: "plume",
    releaseRateKgPerSec: 1,
    durationSec: 600,
    releaseHeightM: 0,
    windSpeedMps: 3,
    windDirDeg: 270,
    stabilityClass: "D",
    surfaceRoughness: "rural",
    tempC: 20,
  };
}

export function PlumePage() {
  const [params] = useSearchParams();
  const initialChemicalId = params.get("chemical") ?? "ammonia";
  const chemical = useLiveQuery(
    () => db.chemicals.get(initialChemicalId),
    [initialChemicalId],
  );

  const [origin, setOrigin] = useState<LngLatLike>([-97.7431, 30.2672]); // Austin, TX
  const [originSet, setOriginSet] = useState(false);
  const [inputs, setInputs] = useState<PlumeInputs>(defaultInputs(initialChemicalId));
  const [results, setResults] = useState<ReturnType<typeof runPlume> | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [weatherMsg, setWeatherMsg] = useState<string | null>(null);

  const mapRef = useRef<MLMap | null>(null);
  const mapEl = useRef<HTMLDivElement | null>(null);

  const thresholds = useMemo<ThresholdBand[]>(() => {
    const set = getThresholds(inputs.chemicalId);
    if (!set) return [];
    const out: ThresholdBand[] = [];
    if (set.aegl) out.push({ kind: "AEGL", level: 1, valuePpm: set.aegl["1"], label: "AEGL-1" });
    if (set.erpg) out.push({ kind: "ERPG", level: 2, valuePpm: set.erpg["2"], label: "ERPG-2" });
    if (set.teel) out.push({ kind: "TEEL", level: 3, valuePpm: set.teel["3"], label: "TEEL-3" });
    if (out.length === 0) return [];
    return out;
  }, [inputs.chemicalId]);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapEl.current,
      style: OPENFREEMAP_STYLE,
      center: [-97.7431, 30.2672],
      zoom: 11,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-left");
    map.on("click", (e) => {
      setOrigin([e.lngLat.lng, e.lngLat.lat]);
      setOriginSet(true);
    });
    map.on("load", () => setMapReady(true));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    setInputs((p) => (p.chemicalId === initialChemicalId ? p : { ...p, chemicalId: initialChemicalId }));
  }, [initialChemicalId]);

  const update = <K extends keyof PlumeInputs>(k: K, v: PlumeInputs[K]) =>
    setInputs((p) => ({ ...p, [k]: v }));

  const compute = () => {
    if (thresholds.length === 0) {
      setResults(null);
      return;
    }
    const mw = molecularWeightOf(inputs.chemicalId) ?? inputs.molecularWeight ?? 30;
    setResults(
      runPlume({ ...inputs, molecularWeight: mw }, {
        thresholds,
        emissionRateKgPerSec: inputs.releaseRateKgPerSec ?? 1,
        saturatedConcentrationPpm: 100,
        molecularWeight: mw,
      }),
    );
  };

  const fetchWeather = async () => {
    const [lng, lat] = origin as [number, number];
    const cfgId = "weather:nws:" + Date.now();
    const cfg = {
      id: cfgId,
      kind: "weather:nws" as const,
      label: "NWS pull",
      enabled: true,
      pollIntervalSec: 60,
      createdAt: new Date().toISOString(),
    };
    const nws = new NwsAdapter();
    await nws.connect(cfg);
    let obs = await nws.fetchByLatLng(lat, lng);
    if (!obs) {
      const om = new OpenMeteoAdapter();
      await om.connect(cfg);
      obs = await om.fetchByLatLng(lat, lng);
    }
    if (!obs) {
      setWeatherMsg("No weather observation available (offline or unsupported region).");
      return;
    }
    await pushObservation(obs);
    setInputs((p) => ({
      ...p,
      windSpeedMps: obs.windSpeedMps ?? p.windSpeedMps,
      windDirDeg: obs.windDirDeg ?? p.windDirDeg,
      tempC: obs.tempC ?? p.tempC,
      rh: obs.rh ?? p.rh,
    }));
    setWeatherMsg(
      `Pulled weather from ${obs.source} at ${new Date(obs.ts).toLocaleTimeString()}.`,
    );
  };

  // Draw the source + isopleth polygons when results change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const srcId = "plume-origin";
    const lblId = "plume-origin-label";
    const cleanup: string[] = [srcId, lblId];

    if (!map.getSource(srcId)) {
      map.addSource(srcId, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: srcId,
        type: "circle",
        source: srcId,
        paint: {
          "circle-radius": 8,
          "circle-color": "#f59e0b",
          "circle-stroke-color": "#0f172a",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: lblId,
        type: "symbol",
        source: srcId,
        layout: {
          "text-field": ["get", "label"],
          "text-size": 12,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#0f172a",
          "text-halo-color": "#fbbf24",
          "text-halo-width": 1.5,
        },
      });
    }

    if (!results) {
      (map.getSource(srcId) as maplibregl.GeoJSONSource).setData({
        type: "FeatureCollection",
        features: [
          { type: "Feature", geometry: { type: "Point", coordinates: origin as [number, number] }, properties: { label: "Release" } },
        ],
      });
      for (const id of cleanup) {
        if (map.getLayer(`${id}-band`)) map.removeLayer(`${id}-band`);
        if (map.getSource(`${id}-band`)) map.removeSource(`${id}-band`);
      }
      return;
    }

    const rad = (deg: number) => (deg * Math.PI) / 180;
    const originLng = (origin as [number, number])[0];
    const originLat = (origin as [number, number])[1];

    const features: GeoJSON.Feature[] = [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: origin as [number, number] },
        properties: { label: "Release" },
      },
    ];

    results.isopleths.forEach((iso, idx) => {
      const layerId = `${srcId}-band-${iso.thresholdKind}-${iso.thresholdLevel}`;
      const color =
        iso.thresholdKind === "AEGL" ? "#dc2626" :
        iso.thresholdKind === "ERPG" ? "#f59e0b" :
        "#3b82f6";
      const opacity = 0.45 - idx * 0.08;

      const rotated: Array<[number, number]> = iso.polygon.map(([x, y]) => {
        const d = Math.sqrt(x * x + y * y);
        const bearing = Math.atan2(y, x);
        const angle = bearing - rad(inputs.windDirDeg) + Math.PI / 2;
        const dx = d * Math.cos(angle);
        const dy = d * Math.sin(angle);
        return meterOffsetToLngLat(originLng, originLat, dx, dy);
      });

      features.push({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [rotated] },
        properties: { label: `${iso.thresholdKind}-${iso.thresholdLevel}` },
      });

      if (!map.getSource(layerId)) {
        map.addSource(layerId, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: layerId,
          type: "fill",
          source: layerId,
          paint: { "fill-color": color, "fill-opacity": opacity },
        });
        map.addLayer({
          id: `${layerId}-outline`,
          type: "line",
          source: layerId,
          paint: { "line-color": color, "line-width": 1.5, "line-opacity": 0.9 },
        });
      }
      (map.getSource(layerId) as maplibregl.GeoJSONSource).setData({
        type: "FeatureCollection",
        features: [features[features.length - 1]],
      });
      cleanup.push(layerId, `${layerId}-outline`);
    });

    (map.getSource(srcId) as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: features.slice(0, 1),
    });

    return () => {
      for (const id of cleanup) {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
      }
    };
  }, [results, mapReady, inputs.windDirDeg, origin]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Plume</h1>
        <span className="text-xs text-slate-400">click the map to set the release origin</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="card overflow-hidden p-0">
          <div ref={mapEl} className="h-[60vh] min-h-[420px] w-full" aria-label="Plume map" />
        </div>

        <aside className="space-y-3">
          <section className="card space-y-2">
            <h2 className="font-semibold">Release</h2>
            <label className="block text-sm">
              Chemical
              <select
                className="tap-target mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2"
                value={inputs.chemicalId}
                onChange={(e) => update("chemicalId", e.target.value)}
              >
                {Array.from(new Set([initialChemicalId, ...THRESHOLDS.map((t) => t.chemicalId)])).map((id) => {
                  const c = chemical && chemical.id === id ? chemical.name : id;
                  return <option key={id} value={id}>{c}</option>;
                })}
              </select>
            </label>
            {chemical && (
              <p className="text-xs text-slate-400">
                <Link to={`/chemical/${chemical.id}`} className="hover:underline">View chemical detail</Link>
              </p>
            )}
            <label className="block text-sm">
              Release kind
              <select
                className="tap-target mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2"
                value={inputs.releaseKind}
                onChange={(e) => update("releaseKind", e.target.value as PlumeInputs["releaseKind"])}
              >
                <option value="plume">Continuous plume</option>
                <option value="puff">Instantaneous puff</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                Rate (kg/s)
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  className="tap-target mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2"
                  value={inputs.releaseRateKgPerSec ?? ""}
                  onChange={(e) => update("releaseRateKgPerSec", Number(e.target.value))}
                />
              </label>
              <label className="block text-sm">
                Duration (s)
                <input
                  type="number"
                  min={0}
                  step={10}
                  className="tap-target mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2"
                  value={inputs.durationSec ?? ""}
                  onChange={(e) => update("durationSec", Number(e.target.value))}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                Wind (m/s)
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  className="tap-target mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2"
                  value={inputs.windSpeedMps}
                  onChange={(e) => update("windSpeedMps", Number(e.target.value))}
                />
              </label>
              <label className="block text-sm">
                Wind dir (°)
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
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                Stability (A–F)
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
              <label className="block text-sm">
                Surface
                <select
                  className="tap-target mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2"
                  value={inputs.surfaceRoughness}
                  onChange={(e) => update("surfaceRoughness", e.target.value as PlumeInputs["surfaceRoughness"])}
                >
                  <option value="rural">Rural</option>
                  <option value="urban">Urban</option>
                </select>
              </label>
            </div>
            <button type="button" className="btn-primary w-full" onClick={compute}>
              Run model
            </button>
            <button type="button" className="btn w-full" onClick={fetchWeather}>
              Pull weather for map origin
            </button>
            {weatherMsg && <p className="text-xs text-slate-400">{weatherMsg}</p>}
            <p className="text-xs text-slate-400">
              Origin: {originSet ? "user-set" : "default (Austin, TX)"}. Click anywhere on the map to move it.
            </p>
          </section>

          {results && (
            <section className="card space-y-2">
              <h2 className="font-semibold">Result</h2>
              <ul className="text-sm text-slate-200 space-y-1">
                {results.isopleths.map((iso, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="font-mono">
                      {iso.thresholdKind}-{iso.thresholdLevel}
                    </span>
                    <span className="text-xs text-slate-400">
                      {Math.round(iso.maxDownwindM)} m downwind · {Math.round(iso.maxCrosswindM)} m crosswind
                    </span>
                  </li>
                ))}
              </ul>
              <div className="text-xs text-slate-400">
                Model v{MODEL_VERSION} · computed {new Date(results.computedAt).toLocaleTimeString()}
              </div>
            </section>
          )}

          {thresholds.length === 0 && (
            <p className="card text-xs text-amber-300">
              No AEGL/ERPG/TEEL thresholds published for this chemical in the bundled subset.
            </p>
          )}
        </aside>
      </div>

      <p className="text-xs text-slate-500">{PLUME_DISCLAIMER}</p>
    </div>
  );
}

const METERS_PER_DEG_LAT = 111_320;
function meterOffsetToLngLat(lng: number, lat: number, dx: number, dy: number): [number, number] {
  const dLat = dy / METERS_PER_DEG_LAT;
  const dLng = dx / (METERS_PER_DEG_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 1e-6));
  return [lng + dLng, lat + dLat];
}
