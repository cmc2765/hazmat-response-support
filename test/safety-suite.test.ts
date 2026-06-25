import { describe, expect, it } from "vitest";
import { normalize, parseSafetySuiteCsv } from "@/integrations/rae/safety-suite/adapter";

describe("safety-suite normalize", () => {
  it("returns null on missing fields", () => {
    expect(normalize({}, "x")).toBeNull();
    expect(normalize({ monitorId: "m1" }, "x")).toBeNull();
    expect(normalize({ monitorId: "m1", sensors: [] }, "x")).toBeNull();
  });

  it("emits a Reading with normalized sensors", () => {
    const r = normalize(
      {
        ts: "2025-01-01T00:00:00.000Z",
        monitorId: "M-1",
        model: "AreaRAE",
        lat: 40,
        lng: -75,
        battery: 80,
        runTime: 3600,
        sensors: [
          { gas: "CO", unit: "ppm", value: 12, alarm: "none" },
          { gas: "LEL", unit: "%", value: 1, alarm: "low" },
        ],
      },
      "instance-1",
    );
    expect(r).not.toBeNull();
    expect(r?.monitorId).toBe("M-1");
    expect(r?.sensors).toHaveLength(2);
    expect(r?.source).toBe("rae:safety-suite:instance-1");
  });
});

describe("parseSafetySuiteCsv", () => {
  it("returns empty for header-only", () => {
    expect(parseSafetySuiteCsv("ts,monitorid,CO_ppm", "x")).toEqual([]);
  });

  it("parses a simple CSV row", () => {
    const csv = [
      "ts,monitorid,CO_ppm,LEL_%",
      "2025-01-01T00:00:00Z,M-1,12,5",
    ].join("\n");
    const out = parseSafetySuiteCsv(csv, "instance-1");
    expect(out).toHaveLength(1);
    expect(out[0].monitorId).toBe("M-1");
    expect(out[0].sensors).toEqual([
      { gasName: "CO", unit: "ppm", value: 12, alarm: "none" },
      { gasName: "LEL", unit: "%", value: 5, alarm: "none" },
    ]);
  });
});
