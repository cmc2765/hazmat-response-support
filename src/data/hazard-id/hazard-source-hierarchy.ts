import type { HazardIdLane } from "../../lib/hazard-id/hazardTypes.js";

export const HAZARD_SOURCE_HIERARCHY: Readonly<Record<HazardIdLane, readonly string[]>> = {
  CHEMICAL: ["Chemical Companion", "CAMEO Chemicals", "NIOSH", "ERG 2024", "EPA AEGL", "NFPA framework where available"],
  CBRNE_CWA: ["NIOSH ERSH-DB", "CHEMM", "CAMEO Chemicals", "EPA AEGL", "ERG 2024", "OPCW identity/classification", "NIOSH CEL / OSHA CBRN PPE framework"],
  RADIOLOGICAL: ["REMM", "EPA PAG", "IAEA emergency guidance", "NNDC NuDat / IAEA LiveChart", "EPA Radionuclide Basics", "49 CFR / ERG Class 7", "RESRAD-RDD / HotSpot external model references"],
};

export const HAZARD_SOURCE_RULES = Object.freeze([
  "OPCW supports identity and classification, not tactical response guidance by itself.",
  "NNDC and IAEA nuclide data support isotope identity, not tactical standoff by themselves.",
  "EPA PAG supports protective-action decisions, not isotope identity.",
  "ERG supports initial transportation response.",
  "HotSpot and RESRAD remain external model references unless imported and validated.",
]);

