import type { HazardSearchResult } from "../../lib/hazard-id/hazardTypes.js";

const record = (
  id: string,
  displayName: string,
  category: string,
  aliases: string[] = [],
  agentCodes: string[] = [],
): HazardSearchResult => ({
  id,
  lane: "CBRNE_CWA",
  displayName,
  category,
  aliases,
  agentCodes,
  verificationStatus: "Requires Review",
  sourceSummary: ["Starter identity record — source linkage requires review"],
});

export const CBRNE_CWA_STARTER_RECORDS: readonly HazardSearchResult[] = [
  record("sarin-gb", "Sarin", "Nerve Agent", ["Sarin"], ["GB"]),
  record("vx", "VX", "Nerve Agent", ["VX"], ["VX"]),
  record("tabun-ga", "Tabun", "Nerve Agent", ["Tabun"], ["GA"]),
  record("soman-gd", "Soman", "Nerve Agent", ["Soman"], ["GD"]),
  record("cyclosarin-gf", "Cyclosarin", "Nerve Agent", ["Cyclosarin"], ["GF"]),
  record("fourth-generation-agents", "Fourth Generation Agents", "Nerve Agent Category", ["A-Series", "Novichok"], []),
  record("sulfur-mustard-hd", "Sulfur Mustard", "Blister Agent", ["Mustard Gas"], ["HD"]),
  record("lewisite-l", "Lewisite", "Blister Agent", ["Lewisite"], ["L"]),
  record("mustard-lewisite-hl", "Mustard-Lewisite", "Blister Agent", ["Mustard Lewisite"], ["HL"]),
  record("nitrogen-mustard-hn1", "Nitrogen Mustard HN-1", "Blister Agent", [], ["HN-1"]),
  record("nitrogen-mustard-hn2", "Nitrogen Mustard HN-2", "Blister Agent", [], ["HN-2"]),
  record("nitrogen-mustard-hn3", "Nitrogen Mustard HN-3", "Blister Agent", [], ["HN-3"]),
  record("phosgene-oxime-cx", "Phosgene Oxime", "Blister Agent", [], ["CX"]),
  record("hydrogen-cyanide-ac", "Hydrogen Cyanide", "Blood Agent", ["Hydrocyanic Acid"], ["AC"]),
  record("cyanogen-chloride-ck", "Cyanogen Chloride", "Blood Agent", [], ["CK"]),
  record("arsine-sa", "Arsine", "Blood Agent", [], ["SA"]),
  record("phosgene-cg", "Phosgene", "Choking Agent", [], ["CG"]),
  record("chlorine-cl", "Chlorine", "Choking Agent", [], ["CL"]),
  record("chloropicrin-ps", "Chloropicrin", "Choking Agent", [], ["PS"]),
];

