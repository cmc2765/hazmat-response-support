import type { CbrneCategory, CbrneDomain, CbrneVerificationStatus } from "../../lib/cbrne/cbrneTypes.js";

export type CbrneStarterRecord = {
  id: string;
  domain: CbrneDomain;
  category: CbrneCategory;
  displayName: string;
  scientificName?: string;
  commonNames?: string[];
  aliases?: string[];
  agentCodes?: string[];
  cas?: string[];
  unNaNumbers?: string[];
  radionuclideSymbol?: string;
  isotopeMassNumber?: number;
  opcwSchedule?: string;
  recordSummary?: string;
  verificationStatus?: CbrneVerificationStatus;
};

const cwa = (
  id: string,
  displayName: string,
  category: CbrneCategory,
  agentCodes: string[] = [],
  aliases: string[] = [],
): CbrneStarterRecord => ({ id, displayName, domain: "CHEMICAL_WARFARE", category, agentCodes, aliases });

const biological = (
  id: string,
  displayName: string,
  category: CbrneCategory,
  scientificName: string | undefined,
  aliases: string[] = [],
): CbrneStarterRecord => ({ id, displayName, scientificName, domain: "BIOLOGICAL", category, aliases });

const radionuclide = (
  id: string,
  displayName: string,
  symbol: string,
  mass: number,
  aliases: string[] = [],
): CbrneStarterRecord => ({
  id,
  displayName,
  domain: "RADIOLOGICAL",
  category: "RADIONUCLIDE",
  radionuclideSymbol: symbol,
  isotopeMassNumber: mass,
  aliases,
});

export const CBRNE_STARTER_RECORDS: readonly CbrneStarterRecord[] = [
  cwa("sarin-gb", "Sarin", "NERVE_AGENT", ["GB"], ["Sarin"]),
  cwa("vx", "VX", "NERVE_AGENT", ["VX"], ["VX nerve agent"]),
  cwa("tabun-ga", "Tabun", "NERVE_AGENT", ["GA"], ["Tabun"]),
  cwa("soman-gd", "Soman", "NERVE_AGENT", ["GD"], ["Soman"]),
  cwa("cyclosarin-gf", "Cyclosarin", "NERVE_AGENT", ["GF"], ["Cyclosarin"]),
  cwa("fourth-generation-agents", "Fourth Generation Agents", "FOURTH_GENERATION_AGENT", [], ["A-Series", "Novichok", "FGA"]),
  cwa("sulfur-mustard-hd", "Sulfur Mustard", "BLISTER_AGENT", ["HD"], ["Mustard", "Mustard gas"]),
  cwa("lewisite-l", "Lewisite", "BLISTER_AGENT", ["L"], ["Lewisite"]),
  cwa("mustard-lewisite-hl", "Mustard-Lewisite", "BLISTER_AGENT", ["HL"], ["Mustard Lewisite"]),
  cwa("nitrogen-mustard-hn1", "Nitrogen Mustard HN-1", "BLISTER_AGENT", ["HN-1"]),
  cwa("nitrogen-mustard-hn2", "Nitrogen Mustard HN-2", "BLISTER_AGENT", ["HN-2"]),
  cwa("nitrogen-mustard-hn3", "Nitrogen Mustard HN-3", "BLISTER_AGENT", ["HN-3"]),
  cwa("phosgene-oxime-cx", "Phosgene Oxime", "BLISTER_AGENT", ["CX"]),
  cwa("hydrogen-cyanide-ac", "Hydrogen Cyanide", "BLOOD_AGENT", ["AC"], ["Hydrocyanic acid"]),
  cwa("cyanogen-chloride-ck", "Cyanogen Chloride", "BLOOD_AGENT", ["CK"]),
  cwa("arsine-sa", "Arsine", "BLOOD_AGENT", ["SA"]),
  cwa("phosgene-cg", "Phosgene", "CHOKING_AGENT", ["CG"]),
  cwa("chlorine-cl", "Chlorine", "CHOKING_AGENT", ["CL"]),
  cwa("chloropicrin-ps", "Chloropicrin", "CHOKING_AGENT", ["PS"]),

  {
    ...biological("anthrax", "Anthrax", "BACTERIAL_AGENT", "Bacillus anthracis", ["B. anthracis", "Biological agent", "Bacterial agent"]),
    commonNames: ["Anthrax"],
    recordSummary: "Starter identity record for responder-facing biological hazard identification. Tactical facts require authoritative source import and SME review.",
  },
  biological("plague", "Plague", "BACTERIAL_AGENT", "Yersinia pestis", ["Y. pestis"]),
  biological("tularemia", "Tularemia", "BACTERIAL_AGENT", "Francisella tularensis", ["F. tularensis"]),
  biological("smallpox", "Smallpox", "VIRAL_AGENT", "Variola virus", ["Variola"]),
  biological("viral-hemorrhagic-fever", "Viral Hemorrhagic Fever", "VIRAL_AGENT", undefined, ["VHF", "Viral hemorrhagic fevers"]),
  biological("ricin", "Ricin", "BIOLOGICAL_TOXIN", undefined, ["Ricin toxin"]),
  biological("abrin", "Abrin", "BIOLOGICAL_TOXIN", undefined, ["Abrin toxin"]),
  biological("botulinum-toxin", "Botulinum Toxin", "BIOLOGICAL_TOXIN", "Clostridium botulinum toxin", ["Botulism toxin"]),
  biological("brucellosis", "Brucellosis", "BACTERIAL_AGENT", "Brucella", ["Brucella species"]),
  biological("q-fever", "Q Fever", "BACTERIAL_AGENT", "Coxiella burnetii", ["C. burnetii"]),

  radionuclide("cesium-137", "Cesium-137", "Cs-137", 137, ["Caesium-137", "Cs137"]),
  radionuclide("cobalt-60", "Cobalt-60", "Co-60", 60, ["Co60"]),
  radionuclide("iridium-192", "Iridium-192", "Ir-192", 192, ["Ir192"]),
  radionuclide("americium-241", "Americium-241", "Am-241", 241, ["Am241"]),
  radionuclide("strontium-90", "Strontium-90", "Sr-90", 90, ["Sr90"]),
  radionuclide("iodine-131", "Iodine-131", "I-131", 131, ["I131"]),
  radionuclide("radium-226", "Radium-226", "Ra-226", 226, ["Ra226"]),
  radionuclide("uranium-235", "Uranium-235", "U-235", 235, ["U235"]),
  radionuclide("uranium-238", "Uranium-238", "U-238", 238, ["U238"]),
  radionuclide("plutonium-239", "Plutonium-239", "Pu-239", 239, ["Pu239"]),
  { id: "type-a-package", displayName: "Radioactive Material, Type A Package", domain: "RADIOLOGICAL", category: "RADIOACTIVE_MATERIAL", aliases: ["Type A Package"] },
  { id: "type-b-package", displayName: "Radioactive Material, Type B Package", domain: "RADIOLOGICAL", category: "RADIOACTIVE_MATERIAL", aliases: ["Type B Package"] },
  { id: "radiological-dispersal-device", displayName: "Radiological Dispersal Device", domain: "CBRNE_SCENARIO", category: "RADIOLOGICAL_DISPERSAL_DEVICE", aliases: ["RDD", "Dirty Bomb"] },
  { id: "improvised-nuclear-device", displayName: "Improvised Nuclear Device", domain: "NUCLEAR", category: "IMPROVISED_NUCLEAR_DEVICE", aliases: ["IND"] },
];
