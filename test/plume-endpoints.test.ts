import { describe, expect, it } from "vitest";
import { aeglThresholdBands, selectVerifiedAeglEndpoint } from "@/lib/model/plume-endpoints";
import { determinePlumeStatus } from "@/lib/model/plume-status";

describe("verified EPA AEGL endpoint selection", () => {
  it("requires an exact canonical chemical ID and CAS match", () => {
    expect(selectVerifiedAeglEndpoint("ammonia", "7664-41-7", 60)).toMatchObject({
      endpointSource: "EPA AEGL",
      endpointStatus: "Final",
      selectedDurationMinutes: 60,
      aegl1: 30,
      aegl2: 160,
      aegl3: 1100,
      units: "ppm",
    });
    expect(selectVerifiedAeglEndpoint("ammonia", "7782-50-5", 60)).toBeNull();
    expect(selectVerifiedAeglEndpoint("Ammonia, anhydrous", "7664-41-7", 60)).toBeNull();
    expect(selectVerifiedAeglEndpoint("1005", "7664-41-7", 60)).toBeNull();
  });

  it("does not infer an unsupported duration and maps levels 3/2/1", () => {
    const endpoint = selectVerifiedAeglEndpoint("chlorine", "7782-50-5", 10);
    expect(endpoint).not.toBeNull();
    expect(aeglThresholdBands(endpoint!).map((band) => [band.level, band.valuePpm])).toEqual([
      [3, 50], [2, 2.8], [1, 0.5],
    ]);
  });

  it("selects final EPA Hydrazine AEGL values by its canonical ID and CAS", () => {
    expect(selectVerifiedAeglEndpoint("hydrazine", "302-01-2", 60)).toMatchObject({
      endpointSource: "EPA AEGL",
      endpointStatus: "Final",
      selectedDurationMinutes: 60,
      aegl1: 0.1,
      aegl2: 13,
      aegl3: 35,
      units: "ppm",
    });
    expect(selectVerifiedAeglEndpoint("hydrazine", "302-01-2", 480)).toMatchObject({
      aegl1: 0.1,
      aegl2: 1.6,
      aegl3: 4.4,
    });
    expect(selectVerifiedAeglEndpoint("hydrazine", "57-14-7", 60)).toBeNull();
  });
});

describe("plume status precedence", () => {
  const complete = { hasChemicalLink: true, hasAeglEndpoint: true, hasWeather: true, hasReleaseInputs: true };

  it("fails closed in chemical, endpoint, weather, then release order", () => {
    expect(determinePlumeStatus({ ...complete, hasChemicalLink: false })).toBe("Blocked Missing Chemical Link");
    expect(determinePlumeStatus({ ...complete, hasAeglEndpoint: false })).toBe("Blocked Missing AEGL / LOC");
    expect(determinePlumeStatus({ ...complete, hasWeather: false })).toBe("Blocked Missing Weather");
    expect(determinePlumeStatus({ ...complete, hasReleaseInputs: false })).toBe("Blocked Missing Release Inputs");
  });

  it("never returns validated without an explicit passing validation fact", () => {
    expect(determinePlumeStatus(complete)).toBe("Planning Estimate");
    expect(determinePlumeStatus({ ...complete, weatherNeedsVerification: true })).toBe("Needs Verification");
    expect(determinePlumeStatus({ ...complete, validationCasesPassed: true })).toBe("Validated for this chemical/release scenario");
  });
});
