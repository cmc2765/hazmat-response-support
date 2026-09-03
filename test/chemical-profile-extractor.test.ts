import { describe, expect, it } from "vitest";
import { extractChemicalProfileFacts } from "@/lib/chemical-profile";

describe("chemical profile fact extraction", () => {
  it("falls through to source facts for exposure and ERG values", () => {
    const facts = extractChemicalProfileFacts({
      chemical: {
        properties: { molecular_weight: "70.90 g/mol" },
        nfpa704: { health: "3", fire: "0", reactivity: "1" },
      },
      sourceFacts: [
        { fieldName: "NIOSH IDLH", value: "10 ppm", sourceName: "NIOSH" },
        { fieldName: "ERG Guide", value: "117", sourceName: "ERG 2024" },
        { fieldName: "Initial Isolation Distance", value: "100 m", sourceName: "ERG 2024" },
        { fieldName: "Protective Action Day", value: "1.5 km", sourceName: "ERG 2024" },
      ],
    });

    expect(facts.exposures.idlh).toBe("10 ppm");
    expect(facts.identity.ergGuide).toBe("117");
    expect(facts.isolation.initialIsolation).toBe("100 m");
    expect(facts.isolation.protectiveAction).toBe("1.5 km");
    expect(facts.properties.molecularWeight).toBe("70.90 g/mol");
    expect(facts.nfpa).toMatchObject({ health: "3", fire: "0", reactivity: "1" });
  });

  it("does not convert missing fields into fabricated values", () => {
    const facts = extractChemicalProfileFacts({ chemical: { name: "Unknown" } });
    expect(facts.exposures).toEqual({});
    expect(facts.properties).toEqual({});
    expect(facts.missing).toContain("IDLH");
  });
});
