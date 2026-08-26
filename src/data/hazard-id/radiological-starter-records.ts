import type { HazardSearchResult } from "../../lib/hazard-id/hazardTypes.js";

const record = (
  id: string,
  displayName: string,
  category: string,
  aliases: string[] = [],
  radionuclideSymbol?: string,
): HazardSearchResult => ({
  id,
  lane: "RADIOLOGICAL",
  displayName,
  category,
  aliases,
  radionuclideSymbol,
  verificationStatus: "Requires Review",
  sourceSummary: ["Starter identity record — source linkage requires review"],
});

export const RADIOLOGICAL_STARTER_RECORDS: readonly HazardSearchResult[] = [
  record("cesium-137", "Cesium-137", "Radionuclide", ["Caesium-137", "Cs-137"], "Cs-137"),
  record("cobalt-60", "Cobalt-60", "Radionuclide", ["Co-60"], "Co-60"),
  record("iridium-192", "Iridium-192", "Radionuclide", ["Ir-192"], "Ir-192"),
  record("americium-241", "Americium-241", "Radionuclide", ["Am-241"], "Am-241"),
  record("strontium-90", "Strontium-90", "Radionuclide", ["Sr-90"], "Sr-90"),
  record("iodine-131", "Iodine-131", "Radionuclide", ["I-131"], "I-131"),
  record("radium-226", "Radium-226", "Radionuclide", ["Ra-226"], "Ra-226"),
  record("uranium-235", "Uranium-235", "Radionuclide", ["U-235"], "U-235"),
  record("uranium-238", "Uranium-238", "Radionuclide", ["U-238"], "U-238"),
  record("plutonium-239", "Plutonium-239", "Radionuclide", ["Pu-239"], "Pu-239"),
  record("type-a-package", "Radioactive Material, Type A Package", "Radioactive Material Package", ["Type A Package"]),
  record("type-b-package", "Radioactive Material, Type B Package", "Radioactive Material Package", ["Type B Package"]),
  record("radiological-dispersal-device", "Radiological Dispersal Device", "Radiological Incident", ["RDD", "Dirty Bomb"]),
];

