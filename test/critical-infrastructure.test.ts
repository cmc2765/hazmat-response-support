import { beforeEach, describe, expect, it } from "vitest";
import {
  classifyFacilitiesByThreatZone,
  clearCriticalInfrastructureCache,
  lookupCriticalInfrastructure,
  pointInGeometry,
  type CriticalFacility,
  type ThreatZoneFeature,
} from "../server/src/critical-infrastructure.js";

const redZone: ThreatZoneFeature = {
  type: "Feature",
  properties: { zoneId: "red", label: "AEGL-3", threatRank: 3, colorName: "red" },
  geometry: { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] },
};

const orangeZone: ThreatZoneFeature = {
  type: "Feature",
  properties: { zoneId: "orange", label: "AEGL-2", threatRank: 2, colorName: "orange" },
  geometry: { type: "Polygon", coordinates: [[[-1, -1], [11, -1], [11, 11], [-1, 11], [-1, -1]]] },
};

function facility(overrides: Partial<CriticalFacility>): CriticalFacility {
  return {
    id: "facility-1",
    name: "Test Facility",
    category: "critical_facility",
    latitude: 50,
    longitude: 50,
    source: "test",
    sourceUpdatedAt: "2026-10-01T00:00:00.000Z",
    retrievedAt: "2026-10-01T00:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

describe("critical infrastructure threat-zone classification", () => {
  beforeEach(() => clearCriticalInfrastructureCache());

  it("uses true point-in-polygon geometry and keeps points outside out", () => {
    expect(pointInGeometry([5, 5], redZone.geometry)).toBe(true);
    expect(pointInGeometry([15, 5], redZone.geometry)).toBe(false);
    const result = classifyFacilitiesByThreatZone([redZone], [
      facility({ id: "inside", name: "Inside", latitude: 5, longitude: 5 }),
      facility({ id: "outside", name: "Outside", latitude: 5, longitude: 15 }),
    ]);
    expect(result.zones[0].facilities.map(({ id }) => id)).toEqual(["inside"]);
  });

  it("recognizes hospital and school categories", () => {
    const result = classifyFacilitiesByThreatZone([redZone], [
      facility({ id: "hospital", name: "Hospital", category: "hospital", latitude: 5, longitude: 5 }),
      facility({ id: "school", name: "School", category: "school", latitude: 6, longitude: 6 }),
    ]);
    expect(result.zones[0].facilityCounts).toMatchObject({ hospital: 1, school: 1 });
  });

  it("deduplicates facilities and assigns overlapping matches to the highest-severity zone", () => {
    const hospital = facility({ id: "hospital", name: "Regional Hospital", category: "hospital", latitude: 5, longitude: 5 });
    const result = classifyFacilitiesByThreatZone([orangeZone, redZone], [hospital, { ...hospital, id: "duplicate-from-second-source" }]);
    expect(result.affectedFacilities).toHaveLength(1);
    expect(result.affectedFacilities[0].zone).toBe("red");
    expect(result.zones.find((zone) => zone.id === "red")?.facilityCounts.hospital).toBe(1);
    expect(result.zones.find((zone) => zone.id === "orange")?.facilityCounts.hospital).toBe(0);
  });

  it("returns zero for a successful empty query", async () => {
    const fetchEmpty = async () => new Response(JSON.stringify({ features: [] }), { status: 200 });
    const result = await lookupCriticalInfrastructure([redZone], fetchEmpty);
    expect(result.status).toBe("available");
    expect(result.affectedFacilities).toEqual([]);
    expect(result.zones[0].facilityCounts).toEqual({
      hospital: 0,
      healthcare: 0,
      school: 0,
      fire_station: 0,
      ems: 0,
      nursing_home: 0,
      critical_facility: 0,
    });
  });

  it("normalizes NCES school and HIFLD hospital records from ArcGIS responses", async () => {
    const fetchSources = async (input: string | URL | Request) => {
      const url = String(input);
      const features = url.includes("School_Characteristics_Current")
        ? [{ attributes: { NCESSCH: "school-1", SCH_NAME: "NCES School", LATCOD: 5, LONCOD: 5 } }]
        : url.includes("Hospitals_hifld")
          ? [{ attributes: { OBJECTID: 7, NAME: "HIFLD Hospital" }, geometry: { x: 6, y: 6 } }]
          : [];
      return new Response(JSON.stringify({ features }), { status: 200 });
    };
    const result = await lookupCriticalInfrastructure([redZone], fetchSources);
    expect(result.status).toBe("available");
    expect(result.zones[0].facilityCounts).toMatchObject({ hospital: 1, school: 1 });
    expect(result.zones[0].facilities.map(({ source }) => source)).toEqual(expect.arrayContaining([
      "NCES EDGE 2024-2025 CCD school locations",
      "HIFLD Open GP Public Health Hospitals",
    ]));
  });

  it("does not return a false zero when every upstream service fails", async () => {
    const fetchFailure = async () => { throw new Error("upstream offline"); };
    const result = await lookupCriticalInfrastructure([redZone], fetchFailure);
    expect(result.status).toBe("error");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.sourceStatuses.every((source) => source.status === "unavailable")).toBe(true);
    expect(result.zones[0].facilities).toEqual([]);
  });
});
