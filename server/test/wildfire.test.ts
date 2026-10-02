import { describe, expect, it } from "vitest";
import { FIRMS_REFRESH_INTERVAL_MINUTES, FIRMS_SENSORS, FIRMS_WEB_SERVICES_URL, normalizeFirmsRow, normalizeFirmsCsv, queryFirms } from "../src/wildfire/firms.js";
import { normalizeHmsFeature } from "../src/wildfire/hms.js";
import { WFIGS_SERVICE_URL, normalizeWfigsFeature, queryWfigs } from "../src/wildfire/wfigs.js";
import { parseMapBounds } from "../src/wildfire/types.js";

const bounds = { west: -87, south: 33, east: -86, north: 34 };

describe("wildfire source normalization", () => {
  it("keeps FIRMS detections and WFIGS perimeters source-distinct", async () => {
    expect(FIRMS_SENSORS).toEqual(["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"]);
    expect(FIRMS_WEB_SERVICES_URL).toContain("firms.modaps.eosdis.nasa.gov/web-services");
    expect(FIRMS_REFRESH_INTERVAL_MINUTES).toBe(15);
    expect(WFIGS_SERVICE_URL).toContain("WFIGS_Interagency_Perimeters_Current/FeatureServer");
    const firms = await queryFirms(bounds, 24, "source-key", async () => new Response("latitude,longitude,satellite\n", { status: 200 }));
    const wfigs = await queryWfigs(bounds, async () => new Response(JSON.stringify({ features: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    expect(firms.sourceUse).toContain("thermal active-fire detections");
    expect(wfigs.sourceUse).toContain("perimeter polygons");
  });

  it("normalizes NOAA-20 and NOAA-21 FIRMS detections", () => {
    const base = { latitude: "33.25", longitude: "-86.75", acq_date: "2026-10-02", acq_time: "1205", instrument: "VIIRS", confidence: "n", frp: "12.4", daynight: "D" };
    expect(normalizeFirmsRow({ ...base, satellite: "N20" })?.properties).toMatchObject({ satellite: "NOAA-20", frp: 12.4, dayNight: "D" });
    expect(normalizeFirmsRow({ ...base, satellite: "N21" })?.properties.satellite).toBe("NOAA-21");
  });

  it("normalizes an empty successful FIRMS response", () => {
    expect(normalizeFirmsCsv("latitude,longitude,satellite\n")).toEqual([]);
  });

  it("normalizes WFIGS perimeter geometry and fields", () => {
    const feature = normalizeWfigsFeature({
      attributes: { OBJECTID: 42, IncidentName: "Test Fire", CurrentAcres: 1250, ModifiedOn: "2026-10-02T12:00:00Z" },
      geometry: { rings: [[[-86.9, 33.1], [-86.8, 33.1], [-86.8, 33.2], [-86.9, 33.1]]] },
    });
    expect(feature).toMatchObject({ id: "42", geometry: { type: "Polygon" }, properties: { incidentName: "Test Fire", acres: 1250 } });
  });

  it("normalizes HMS density and time fields", () => {
    const feature = normalizeHmsFeature({
      attributes: { FID: 7, Density: "Heavy", Start: "202610021200", End_: "202610021800" },
      geometry: { rings: [[[-86.9, 33.1], [-86.8, 33.1], [-86.8, 33.2], [-86.9, 33.1]]] },
    });
    expect(feature).toMatchObject({ id: "7", properties: { density: "Heavy", startTime: "202610021200", endTime: "202610021800", source: "NOAA HMS" } });
  });
});

describe("wildfire source status and bounded queries", () => {
  it("reports NASA FIRMS as not configured without making a request", async () => {
    let requested = false;
    const result = await queryFirms(bounds, 24, "", async () => { requested = true; return new Response(); });
    expect(result).toMatchObject({ status: "NOT CONFIGURED", source: "NASA FIRMS", count: 0 });
    expect(requested).toBe(false);
  });

  it("reports a successful empty FIRMS query as connected and uses map bounds", async () => {
    const requested: string[] = [];
    const result = await queryFirms({ ...bounds, west: -87.1 }, 24, "test-empty-key", async (url) => {
      requested.push(String(url));
      return new Response("latitude,longitude,satellite\n", { status: 200 });
    });
    expect(result).toMatchObject({ status: "CONNECTED", count: 0 });
    expect(requested).toHaveLength(2);
    expect(requested[0]).toContain("-87.1,33,-86,34");
  });

  it("filters detections to the requested bounds and removes duplicates across sensor requests", async () => {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toISOString().slice(11, 16).replace(":", "");
    const csv = [
      "latitude,longitude,satellite,acq_date,acq_time,instrument,confidence,frp,daynight",
      `33.25,-86.75,N20,${date},${time},VIIRS,n,12.4,D`,
      `35.25,-86.75,N21,${date},${time},VIIRS,h,8.2,D`,
      "",
    ].join("\n");
    const result = await queryFirms(bounds, 24, `filter-test-${Date.now()}`, async () => new Response(csv, { status: 200 }));
    expect(result.status).toBe("CONNECTED");
    expect(result.features).toHaveLength(1);
    expect(result.features[0]?.properties).toMatchObject({ latitude: 33.25, longitude: -86.75, satellite: "NOAA-20" });
  });

  it("reports an upstream FIRMS failure as ERROR when no cached response exists", async () => {
    const result = await queryFirms(bounds, 24, `error-test-${Date.now()}`, async () => new Response("unauthorized", { status: 401 }));
    expect(result).toMatchObject({ status: "ERROR", source: "NASA FIRMS", count: 0 });
  });

  it("returns a WFIGS service failure as ERROR", async () => {
    const result = await queryWfigs({ ...bounds, west: -88 }, async () => new Response("upstream unavailable", { status: 503 }));
    expect(result).toMatchObject({ status: "ERROR", source: "NIFC / WFIGS", count: 0 });
  });

  it("accepts dateline-crossing map bounds", () => {
    expect(parseMapBounds({ west: "170", south: "-10", east: "-170", north: "10" })).toEqual({ west: 170, south: -10, east: -170, north: 10 });
  });
});
