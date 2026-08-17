import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WEATHER_RADAR_PROVIDER_IDS,
  bestAvailableWeatherRadarProvider,
  createWeatherRadarProviders,
} from "../src/adapters/weatherRadarProviders.js";

afterEach(() => vi.unstubAllGlobals());

describe("lean weather radar providers", () => {
  it("exposes only the active primary and official fallback", () => {
    expect(WEATHER_RADAR_PROVIDER_IDS).toEqual([
      "RAINVIEWER_VISUAL_PROTOTYPE",
      "NOAA_MRMS_OFFICIAL_FALLBACK",
    ]);
    expect(Object.keys(createWeatherRadarProviders(true))).toEqual(WEATHER_RADAR_PROVIDER_IDS);
  });

  it("uses the primary when enabled and NOAA otherwise", () => {
    expect(bestAvailableWeatherRadarProvider(true)).toBe("RAINVIEWER_VISUAL_PROTOTYPE");
    expect(bestAvailableWeatherRadarProvider(false)).toBe("NOAA_MRMS_OFFICIAL_FALLBACK");
  });

  it("uses only real frames returned by primary metadata", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      host: "https://tiles.example/radar",
      radar: {
        past: [{ time: 1_787_142_600, path: "/v2/radar/1787142600" }],
        nowcast: [{ path: "/missing-time" }],
      },
    }), { status: 200 })));
    const frames = await createWeatherRadarProviders(true).RAINVIEWER_VISUAL_PROTOTYPE.getFrames();
    expect(frames).toEqual([{
      timestamp: new Date(1_787_142_600_000).toISOString(),
      tiles: ["https://tiles.example/radar/v2/radar/1787142600/256/{z}/{x}/{y}/2/1_1.png"],
    }]);
  });

  it("does not call primary metadata while disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await createWeatherRadarProviders(false).RAINVIEWER_VISUAL_PROTOTYPE.getFrames()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
