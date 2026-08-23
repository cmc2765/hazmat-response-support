import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHEMICALS } from "../src/data/chemicals.js";
import { queryChemicalProfile } from "../server/src/chemical-companion.js";
import "../server/public/guided-response-decision-builder.js";

type BuilderApi = {
  buildGuidedResponseDecisions: (
    selectedChemical: Record<string, unknown>,
    linkedSources?: Record<string, unknown>,
    plumeState?: Record<string, unknown>,
    weatherState?: Record<string, unknown>,
  ) => Record<string, any>;
};

const builder = (globalThis as typeof globalThis & { HazMatIQGuidedResponse: BuilderApi }).HazMatIQGuidedResponse;
const ergGuides = JSON.parse(readFileSync(new URL("../server/public/data/erg-guides-2024.json", import.meta.url), "utf8")).guides;

function buildForMaster(chemicalId: number) {
  const profile = queryChemicalProfile(chemicalId) as Record<string, any>;
  const supportingChemical = CHEMICALS.find((chemical) => chemical.cas?.includes(profile.header.cas));
  if (!supportingChemical) throw new Error(`No approved supporting mapping for Chemical Companion ${chemicalId}`);
  return builder.buildGuidedResponseDecisions({
    masterLinked: true,
    masterChemicalId: chemicalId,
    chemicalName: profile.header.name,
    transportationIdentifier: profile.header.un,
  }, {
    profile,
    approvedSources: supportingChemical.sources?.map((source) => source.source),
    ppeReference: supportingChemical.ppe,
    responderGuide: ergGuides[String(profile.header.ergGuide).replace(/P$/i, "")],
  }, {
    missingInputs: ["wind direction"],
    status: "Requires Verification",
  }, {
    status: "Requires Verification",
  });
}

describe("Guided Response tactical decision builder", () => {
  it("uses real ammonia master/supporting records for direct isolation and PPE decisions", () => {
    const record = buildForMaster(10);
    expect(record.verifyIsolate.specificValues.initialIsolation).toBe("30 meters");
    expect(record.verifyIsolate.specificValues.protectiveAction).toContain("Small spill, day: 0.1 kilometers");
    expect(record.verifyIsolate.status).not.toMatch(/Guidance Available/i);
    expect(record.lifeSafety.specificValues.scbaDecision).toBe("SCBA MANDATED");
    expect(record.lifeSafety.specificValues.protectionLevel).toBe("Vapor Protective Level A w/ SCBA");
    expect(record.lifeSafety.specificValues.cartridgeStatus).toBe("Not displayed — SCBA is mandated.");
    expect(record.lifeSafety.executionNote).toMatch(/Incident Command approval required/);
    expect(record.evidenceObjects.lifeSafetyDecisionEvidence.sourceBacked).toBe(true);
  });

  it("uses real chlorine master/supporting records for direct isolation and PPE decisions", () => {
    const record = buildForMaster(22);
    expect(record.verifyIsolate.specificValues.initialIsolation).toBe("60 meters");
    expect(record.verifyIsolate.specificValues.protectiveAction).toContain("Small spill, night: 1.5 kilometers");
    expect(record.lifeSafety.specificValues.scbaDecision).toBe("SCBA MANDATED");
    expect(record.lifeSafety.specificValues.protectionLevel).toBe("Vapor Protective Level A w/ SCBA");
    expect(record.mitigation.specificValues.tacticalPosture).toBe("Defensive");
    expect(record.mitigationDecisionSupport.spillReleaseControl).toMatch(/Stop leak if you can do it without risk/i);
  });

  it("fails closed when PPE data is absent and never turns IC approval into the PPE decision", () => {
    const record = builder.buildGuidedResponseDecisions({
      masterLinked: true,
      masterChemicalId: 999,
      chemicalName: "Verified test master",
    }, {
      profile: { header: { name: "Verified test master" }, safetyCritical: { records: [] } },
      approvedSources: ["Chemical Companion"],
    });
    expect(record.lifeSafety.specificValues.scbaDecision).toBe("No Current Data Exists");
    expect(record.lifeSafety.specificValues.protectionLevel).toBe("No Current Data Exists");
    expect(record.lifeSafety.primaryDecision).not.toMatch(/IC approval/i);
    expect(record.lifeSafety.executionNote).toMatch(/Incident Command approval required/);
    expect(record.mitigationDecisionSupport.neutralization).toBe("Neutralization Requires Source-Backed Verification");
  });

  it("blocks unresolved transportation identifiers", () => {
    const record = builder.buildGuidedResponseDecisions({
      masterLinked: false,
      transportationIdentifier: "1005",
    });
    expect(record.blocked).toBe(true);
    expect(record.blockReason).toMatch(/verified Chemical Companion master link/);
  });

  it("uses plume output only as planning support and never as a PPE downgrade", () => {
    const profile = queryChemicalProfile(10);
    if (!profile) throw new Error("Expected verified ammonia Chemical Companion profile");
    const record = builder.buildGuidedResponseDecisions({
      masterLinked: true,
      masterChemicalId: 10,
      chemicalName: profile.header.name,
    }, {
      profile,
      approvedSources: ["Chemical Companion", "ERG", "NIOSH", "CAMEO"],
    }, {
      status: "Planning Estimate",
      endpointSelected: "EPA AEGL 60-minute",
      zoneMeaning: "Red AEGL-3 · Orange AEGL-2 · Yellow AEGL-1",
    }, { status: "Stale" });
    expect(record.verifyIsolate.specificValues.endpointSelected).toBe("EPA AEGL 60-minute");
    expect(record.verifyIsolate.directGuidance).toMatch(/planning estimates only/i);
    expect(record.lifeSafety.specificValues.plumePlanningImpact).toMatch(/does not select or downgrade PPE/i);
    expect(record.lifeSafety.limitations).toContain("Plume output alone cannot downgrade PPE or respiratory protection.");
  });
});
