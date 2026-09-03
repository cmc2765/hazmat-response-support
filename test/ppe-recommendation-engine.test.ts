import { describe, expect, it } from "vitest";
import {
  buildPpeRecommendation,
  PPE_LEVELS,
} from "../src/lib/ppe/ppeRecommendationEngine.js";

const verified = {
  masterLinked: true,
  chemicalId: 101,
  chemicalName: "Verified test chemical",
  generatedAt: "2026-08-18T00:00:00.000Z",
};

describe("source-backed PPE recommendation engine", () => {
  it("blocks unresolved transport-only identities", () => {
    const result = buildPpeRecommendation({
      masterLinked: false,
      chemicalName: "UN 9999",
    });
    expect(result.selectedLevel).toBe(PPE_LEVELS.BLOCKED);
    expect(result.levelCAllowed).toBe(false);
  });

  it("does not infer a recommendation from manufacturer options alone", () => {
    const result = buildPpeRecommendation({
      ...verified,
      hiddenRawOptions: { respirators: ["Manufacturer model 123"] },
    });
    expect(result.selectedLevel).toBe(PPE_LEVELS.NO_DATA);
    expect(result.hiddenRawOptions.respirators).toEqual(["Manufacturer model 123"]);
  });

  it("selects Level A only from explicit vapor-protective and SCBA facts", () => {
    const result = buildPpeRecommendation({
      ...verified,
      approvedSourceFacts: {
        CAMEO: ["Level A fully encapsulating vapor-protective suit for unknown release"],
        NIOSH: ["Positive-pressure SCBA for unknown concentration"],
      },
    });
    expect(result.selectedLevel).toBe(PPE_LEVELS.LEVEL_A);
    expect(result.scbaRequired).toBe(true);
    expect(result.cartridgeRequirement).toMatch(/Not applicable/i);
  });

  it("selects Level B when approved facts require SCBA but do not support Level A", () => {
    const result = buildPpeRecommendation({
      ...verified,
      approvedSourceFacts: { NIOSH: ["SCBA at any unknown concentration"] },
    });
    expect(result.selectedLevel).toBe(PPE_LEVELS.LEVEL_B);
    expect(result.scbaRequired).toBe(true);
    expect(result.aprAllowed).toBe(false);
  });

  it("blocks Level C until every atmospheric and cartridge condition is verified", () => {
    const blocked = buildPpeRecommendation({
      ...verified,
      approvedSourceFacts: { NIOSH: ["APR with an appropriate cartridge"] },
    });
    expect(blocked.selectedLevel).toBe(PPE_LEVELS.REVIEW);
    expect(blocked.levelCAllowed).toBe(false);
    expect(blocked.levelCSourceSupported).toBe(true);
    expect(blocked.levelCStatus).toBe("CONDITIONAL");
    expect(blocked.scbaRequired).toBe(true);
    expect(blocked.levelCBlockedReason).toMatch(/oxygen|IDLH|concentration|monitoring|cartridge/i);

    const allowed = buildPpeRecommendation({
      ...verified,
      approvedSourceFacts: { NIOSH: ["APR with an appropriate cartridge"] },
      operationalConditions: {
        unknownAtmosphere: false,
        oxygenAdequate: true,
        oxygenDeficient: false,
        atmosphereIdlh: false,
        concentrationKnown: true,
        concentrationBelowLimits: true,
        monitoringVerified: true,
        cartridgeVerified: true,
      },
    });
    expect(allowed.selectedLevel).toBe(PPE_LEVELS.LEVEL_C);
    expect(allowed.levelCAllowed).toBe(true);
    expect(allowed.aprAllowed).toBe(true);
  });

  it("allows verified Level C conditions when sources also include emergency SCBA guidance", () => {
    const result = buildPpeRecommendation({
      ...verified,
      approvedSourceFacts: {
        NIOSH: ["SCBA for unknown or IDLH concentrations", "APR with an appropriate cartridge below use limits"],
      },
      operationalConditions: {
        unknownAtmosphere: false,
        oxygenAdequate: true,
        oxygenDeficient: false,
        atmosphereIdlh: false,
        concentrationKnown: true,
        concentrationBelowLimits: true,
        monitoringVerified: true,
        cartridgeVerified: true,
      },
    });
    expect(result.selectedLevel).toBe(PPE_LEVELS.LEVEL_C);
    expect(result.levelCAllowed).toBe(true);
    expect(result.levelCStatus).toBe("ALLOWED");
  });

  it("does not treat prohibited or escape-only APR language as Level C support", () => {
    const result = buildPpeRecommendation({
      ...verified,
      approvedSourceFacts: { NIOSH: ["APR not recommended; escape-only respirator use"] },
    });
    expect(result.levelCSourceSupported).toBe(false);
    expect(result.levelCStatus).toBe("BLOCKED");
  });

  it("selects Level D only with explicit source guidance and verified non-exposure conditions", () => {
    const blocked = buildPpeRecommendation({
      ...verified,
      approvedSourceFacts: { 'Manual Review': ["Level D — no chemical protection required"] },
    });
    expect(blocked.selectedLevel).toBe(PPE_LEVELS.REVIEW);

    const allowed = buildPpeRecommendation({
      ...verified,
      approvedSourceFacts: { 'Manual Review': ["Level D — no chemical protection required"] },
      operationalConditions: {
        unknownAtmosphere: false,
        atmosphereIdlh: false,
        oxygenDeficient: false,
        monitoringVerified: true,
        outsideContaminatedZone: true,
        noRespiratoryHazard: true,
        noSkinHazard: true,
      },
    });
    expect(allowed.selectedLevel).toBe(PPE_LEVELS.LEVEL_D);
  });
});
