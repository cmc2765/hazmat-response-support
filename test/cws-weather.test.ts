import { describe, expect, it } from "vitest";
import { normalize } from "@/integrations/weather/cws";

describe("CWS weather normalization", () => {
  it("preserves a real station observation timestamp", () => {
    expect(normalize({
      ts: "2026-08-17T18:00:00Z",
      windSpeedMps: 2.5,
      windDirDeg: 247.3,
      tempC: 24,
    }, "station-1")).toMatchObject({
      source: "cws:station-1",
      ts: "2026-08-17T18:00:00Z",
      windSpeedMps: 2.5,
      windDirDeg: 247.3,
    });
  });

  it("rejects missing or invalid station time instead of fabricating freshness", () => {
    expect(normalize({ windSpeedMps: 2.5, windDirDeg: 247.3 }, "station-1")).toBeNull();
    expect(normalize({ ts: "not-a-time", windSpeedMps: 2.5, windDirDeg: 247.3 }, "station-1")).toBeNull();
  });
});
