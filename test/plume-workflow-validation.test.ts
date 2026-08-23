import { describe, expect, it } from "vitest";
import {
  inspectAlohaImport,
  PLUME_MODEL_MODES,
  selectPlumeModelFamily,
  selectPlumeModelMode,
  validatePlumeWeather,
  validateSourceStrength,
} from "@/lib/model";

describe("plume workflow validation", () => {
  it("never promotes a planning result without a completed validation gate", () => {
    expect(selectPlumeModelMode({ requiredDataComplete: true, validationCasesPassed: false }))
      .toBe(PLUME_MODEL_MODES.HAZMATIQ_PLANNING_ESTIMATE);
    expect(selectPlumeModelMode({ requiredDataComplete: true, validationCasesPassed: true, validationStatus: "validated" }))
      .toBe(PLUME_MODEL_MODES.HAZMATIQ_VALIDATED_MODEL);
  });

  it("classifies weather freshness and restricts manual weather to planning", () => {
    const manual = validatePlumeWeather({
      windSpeedMps: 2,
      windDirectionDeg: 180,
      source: "Manual Entry",
      sourceMode: "manual",
      observationTime: "2026-08-23T12:00:00.000Z",
      now: "2026-08-23T12:05:00.000Z",
    });
    expect(manual.freshness).toBe("Current");
    expect(manual.usableForPlanning).toBe(true);
    expect(manual.eligibleForValidatedModel).toBe(false);
    expect(validatePlumeWeather({ windSpeedMps: 0, windDirectionDeg: 180 }).usableForPlanning).toBe(false);
  });

  it("reports source strength instead of inferring missing thermodynamic inputs", () => {
    const status = validateSourceStrength({ chemicalId: "10", releaseKind: "plume" });
    expect(status.status).toBe("Cannot Calculate Source Strength");
    expect(status.sourceStrengthValue).toBeNull();
    expect(status.sourceStrengthMethod).toBe("No Current Data Exists");
  });

  it("flags dense-gas applicability without claiming a supported dense-gas solver", () => {
    const selection = selectPlumeModelFamily({ releaseKind: "plume", vaporDensityAir: 2.5 });
    expect(selection.modelFamily).toBe("Heavy gas / dense gas");
    expect(selection.supported).toBe(false);
    expect(selection.limitations.join(" ")).toMatch(/not fully validated|not explicitly modeled/i);
  });

  it("requires source confirmation before using the official ALOHA import mode", () => {
    expect(inspectAlohaImport({ fileName: "threat.kml", geometryAvailable: true }).imported).toBe(false);
    expect(inspectAlohaImport({
      fileName: "threat.kml",
      format: "KML",
      geometryAvailable: true,
      officialAlohaSourceConfirmed: true,
    }).display).toBe("Official ALOHA Output Imported");
  });
});
