import { describe, expect, it } from "vitest";
import { verifyTier2Links } from "../src/tier2/verify-links.js";
import type { Tier2ChemicalRow, Tier2FacilityContactRow, Tier2FacilityRow } from "../src/schema.js";

describe("Tier II relationship verification", () => {
  it("detects orphan child rows and duplicate source IDs", () => {
    const facilities = [
      { id: "facility-1", sourceFacilityId: "AL-1" },
      { id: "facility-2", sourceFacilityId: "AL-1" },
    ] as unknown as Tier2FacilityRow[];
    const chemicals = [
      { id: "chemical-1", facilityId: "facility-1", sourceFacilityId: "AL-1" },
      { id: "chemical-orphan", facilityId: "missing", sourceFacilityId: "AL-999" },
    ] as unknown as Tier2ChemicalRow[];
    const contacts = [
      { id: "contact-1", facilityId: "facility-1", sourceFacilityId: "AL-1" },
      { id: "contact-orphan", facilityId: null, sourceFacilityId: "AL-999" },
    ] as unknown as Tier2FacilityContactRow[];

    expect(verifyTier2Links(facilities, chemicals, contacts)).toMatchObject({
      facilities: 2,
      chemicals: 2,
      contacts: 2,
      matchedChemicals: 1,
      orphanChemicals: 1,
      matchedContacts: 1,
      orphanContacts: 1,
      duplicateFacilityIds: 1,
    });
  });
});
