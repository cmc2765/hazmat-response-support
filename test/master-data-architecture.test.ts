import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isTransportationLinkGuidanceEligible,
  linkedSourceNames,
  sourceBadgeLabels,
  sourceFactCategories,
  transportationLinkTypes,
} from "../server/src/chemical-companion/master-data.js";

const schema = readFileSync(new URL("../server/src/schema.ts", import.meta.url), "utf8");
const companion = readFileSync(new URL("../server/src/chemical-companion.ts", import.meta.url), "utf8");
const architecture = readFileSync(new URL("../docs/chemical-companion-master-data-architecture.md", import.meta.url), "utf8");

describe("Chemical Companion master-data architecture", () => {
  it("provides separate transport links and non-destructive source fact tables", () => {
    for (const table of [
      "transportation_identifier",
      "chemical_transport_link",
      "chemical_source_link",
      "chemical_source_fact",
    ]) expect(schema).toContain(`"${table}"`);
    expect(transportationLinkTypes).toContain("requires_review");
    expect(linkedSourceNames).toEqual(expect.arrayContaining(["CAMEO Chemicals", "ALOHA", "ERG", "NIOSH", "SDS"]));
    expect(sourceBadgeLabels).toEqual(expect.arrayContaining([
      "Chemical Companion Master", "Linked ERG", "Linked CAMEO", "Linked ALOHA",
      "Transportation Identifier", "Requires Review", "No Current Data Exists",
    ]));
    expect(sourceFactCategories).toContain("plume_model_input");
  });

  it("removes shipping-family forced links and makes transport records ineligible by default", () => {
    expect(companion).not.toContain("identityOwners");
    expect(companion).not.toContain("shippingIdentity");
    expect(companion).toContain("ChemicalID: null");
    expect(companion).toContain("reviewStatus: 'requires_review', guidanceEligible: false");
    expect(architecture).toContain("Chemical Companion is the master chemical identity dataset for HazMatIQ");
  });

  it("requires attributable approval before an exact transport link can drive guidance", () => {
    expect(isTransportationLinkGuidanceEligible({
      linkType: "exact_chemical_match",
      reviewStatus: "requires_review",
    })).toBe(false);
    expect(isTransportationLinkGuidanceEligible({
      linkType: "exact_chemical_match",
      reviewStatus: "approved",
      reviewedBy: "reviewer:1",
      reviewedAt: "2026-08-07T00:00:00.000Z",
    })).toBe(true);
    expect(isTransportationLinkGuidanceEligible({
      linkType: "generic_transport_class",
      reviewStatus: "approved",
      reviewedBy: "reviewer:1",
      reviewedAt: "2026-08-07T00:00:00.000Z",
    })).toBe(false);
  });
});
