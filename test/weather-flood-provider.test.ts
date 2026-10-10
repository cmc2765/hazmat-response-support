import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeNwpsStageflow, queryNwpsHealth, queryWeatherFlood } from "../server/src/weather/providers.js";
import { majorFloodStageflowPayload, normalGaugePayload, normalStageflowPayload, observedOnlyStageflowPayload, outOfServiceGaugePayload } from "./fixtures/nwps-responses.js";

describe("weather flood provider normalization", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes NWPS primary/secondary stageflow data into gauge details", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/nwps/v1/gauges?") ) {
        return new Response(JSON.stringify(normalGaugePayload), { status: 200 });
      }
      if (url.includes("/stageflow")) {
        return new Response(JSON.stringify(normalStageflowPayload), { status: 200 });
      }
      if (url.includes("waterdata.usgs.gov")) return new Response(JSON.stringify({ features: [] }), { status: 200 });
      throw new Error(`Unexpected provider URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await queryWeatherFlood({ west: -97, south: 40, east: -96, north: 42 });

    expect(result.status).toBe("connected");
    expect(result.gauges[0]).toMatchObject({
      id: "NORMAL1",
      name: "Normal River",
      stageFt: 9.2,
      flowCfs: 1200,
      forecastCrestFt: 15.6,
      observedAt: "2026-10-09T12:00:00Z",
      dataStatus: "LIVE",
    });
    expect(result.gauges[0].observed).toMatchObject({ stageFt: 9.2, flowCfs: 1200 });
    expect(result.gauges[0].forecast).toMatchObject({ stageFt: 12.4, crestStageFt: 15.6, crestAt: "2026-10-10T06:00:00Z" });
    expect(result.gauges[0].flood).toMatchObject({ actionStageFt: 7, minorStageFt: 10, moderateStageFt: 14, majorStageFt: 18, currentCategory: "action", forecastCategory: "moderate" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("srid=EPSG_4326");
  });

  it("marks a gauge observed-only when NWPS has no forecast series", () => {
    const gauge = normalizeNwpsStageflow({ id: "OBS1", name: "Observed River", lat: 41, lon: -96, usgsId: null, thresholds: { actionStageFt: 7, minorStageFt: 10, moderateStageFt: 14, majorStageFt: 18 }, currentCategory: null, forecastCategory: null, trend: null }, observedOnlyStageflowPayload);
    expect(gauge.dataStatus).toBe("OBSERVED ONLY");
    expect(gauge.forecast.stageFt).toBeNull();
    expect(gauge.forecastSource).toBeNull();
  });

  it("uses official thresholds for major current and forecast categories", () => {
    const gauge = normalizeNwpsStageflow({ id: "MAJOR1", name: "Major River", lat: 42, lon: -97, usgsId: null, thresholds: { actionStageFt: 7, minorStageFt: 10, moderateStageFt: 14, majorStageFt: 18 }, currentCategory: null, forecastCategory: null, trend: null }, majorFloodStageflowPayload);
    expect(gauge.flood.currentCategory).toBe("major");
    expect(gauge.flood.forecastCategory).toBe("major");
    expect(gauge.flood.majorStageFt).toBe(18);
  });

  it("reports an out-of-service gauge as unavailable data instead of throwing", () => {
    const gauge = normalizeNwpsStageflow({ id: "OFFLINE1", name: "Offline Gauge", lat: 43, lon: -98, usgsId: null, thresholds: { actionStageFt: null, minorStageFt: null, moderateStageFt: null, majorStageFt: null }, currentCategory: null, forecastCategory: null, trend: null }, null);
    expect(outOfServiceGaugePayload.gauges[0].status).toBe("out-of-service");
    expect(gauge.dataStatus).toBe("GAUGE DATA UNAVAILABLE");
    expect(gauge.observed.stageFt).toBeNull();
  });

  it("keeps USGS observations visible when NWPS returns an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("api.water.noaa.gov")) return new Response("upstream failure", { status: 500 });
      if (url.includes("waterdata.usgs.gov")) return new Response(JSON.stringify({ features: [{ geometry: { type: "Point", coordinates: [-95, 40] }, properties: { monitoring_location_id: "USGS1", parameter_code: "00065", value: 11.2, time: "2026-10-09T12:00:00Z", name: "USGS River" } }] }), { status: 200 });
      throw new Error(`Unexpected provider URL: ${url}`);
    }));
    const result = await queryWeatherFlood({ west: -95, south: 39, east: -94, north: 41 });
    expect(result.status).toBe("degraded");
    expect(result.nwpsHealth.state).toBe("UNAVAILABLE");
    expect(result.gauges[0]).toMatchObject({ id: "USGS1", source: "USGS Water Data", dataStatus: "OBSERVED ONLY", stageFt: 11.2 });
  });

  it("reports provider 500 and timeout health states without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("upstream failure", { status: 500 })));
    expect((await queryNwpsHealth(undefined, true)).state).toBe("UNAVAILABLE");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("timeout", "AbortError"); }));
    expect((await queryNwpsHealth(undefined, true)).state).toBe("UNAVAILABLE");
  });
});
