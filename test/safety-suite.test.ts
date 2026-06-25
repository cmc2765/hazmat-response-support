import { describe, expect, it } from "vitest";
import {
  normalizeHistorical,
  normalizeRt,
  parseSafetySuiteCsv,
} from "@/integrations/rae/safety-suite/adapter";

describe("safety-suite normalizeHistorical", () => {
  it("returns null on missing fields", () => {
    expect(normalizeHistorical({}, "x")).toBeNull();
    expect(normalizeHistorical({ serialNo: "M1" }, "x")).toBeNull();
    expect(normalizeHistorical({ serialNo: "M1", data: [] }, "x")).toBeNull();
  });

  it("emits a Reading with decimalPoint scaling", () => {
    const r = normalizeHistorical(
      {
        serialNo: "M03A10000067",
        deviceId: 1704,
        time: 1612337283570,
        data: [
          { name: "LEL", unit: "%LEL", val: 0, decimalPoint: 0, detectionMode: 0 },
          { name: "CO", unit: "ppm", val: 12, decimalPoint: 0, detectionMode: 0 },
          { name: "H2S", unit: "ppm", val: 5, decimalPoint: 1, detectionMode: 0 },
        ],
        gps: { lat: 31.196919, lng: 121.609875 },
      },
      "instance-1",
    );
    expect(r).not.toBeNull();
    expect(r?.monitorId).toBe("M03A10000067");
    expect(r?.sensors).toHaveLength(3);
    expect(r?.sensors[2]).toEqual({ gasName: "H2S", unit: "ppm", value: 0.5, alarm: "none" });
    expect(r?.lat).toBeCloseTo(31.196919);
  });

  it("flags detectionMode 255 as high alarm", () => {
    const r = normalizeHistorical(
      {
        serialNo: "M1",
        time: 1612337283570,
        data: [{ name: "CO", unit: "ppm", val: 50, decimalPoint: 0, detectionMode: 255 }],
      },
      "instance-1",
    );
    expect(r?.sensors[0].alarm).toBe("high");
  });
});

describe("safety-suite normalizeRt", () => {
  it("uses deviceId→serialNumber lookup when available", () => {
    const r = normalizeRt(
      {
        deviceId: 1704,
        time: 1593919910376,
        gps: { lng: 123, lat: 345 },
        data: [{ name: "CO", unit: "ppm", val: 0, decimalPoint: 0, detectionMode: 0 }],
      },
      { data: { time: 1593919910376, reading: [] } },
      new Map([[1704, "M03A10000067"]]),
      "instance-1",
    );
    expect(r?.monitorId).toBe("M03A10000067");
    expect(r?.lat).toBe(345);
    expect(r?.lng).toBe(123);
  });

  it("falls back to device-{id} when serial is unknown", () => {
    const r = normalizeRt(
      {
        deviceId: 999,
        time: 1593919910376,
        data: [{ name: "CO", unit: "ppm", val: 1, decimalPoint: 0, detectionMode: 0 }],
      },
      { data: {} },
      new Map(),
      "instance-1",
    );
    expect(r?.monitorId).toBe("device-999");
  });

  it("uses outer msg.data.gps when reading has none", () => {
    const r = normalizeRt(
      {
        deviceId: 1,
        time: 1,
        data: [{ name: "CO", unit: "ppm", val: 1, decimalPoint: 0, detectionMode: 0 }],
      },
      { data: { gps: { lat: 11, lng: 22 } } },
      new Map(),
      "instance-1",
    );
    expect(r?.lat).toBe(11);
    expect(r?.lng).toBe(22);
  });

  it("returns null on missing deviceId or empty sensors", () => {
    expect(
      normalizeRt({ data: [] }, { data: {} }, new Map(), "x"),
    ).toBeNull();
  });
});

describe("parseSafetySuiteCsv", () => {
  it("returns empty for header-only", () => {
    expect(parseSafetySuiteCsv("ts,monitorid,CO_ppm", "x")).toEqual([]);
  });

  it("parses a simple CSV row preserving case", () => {
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
