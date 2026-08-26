import { RADIOLOGICAL_STARTER_RECORDS } from "../../data/hazard-id/radiological-starter-records.js";
import type { HazardProfile, HazardSearchResult, HazardSourceFact } from "./hazardTypes.js";

const missingFact = (id: string, fieldName: string, notes: string): HazardSourceFact => ({
  id,
  sourceName: "No linked tactical source",
  fieldName,
  value: null,
  verificationStatus: "No Current Data Exists",
  notes,
});

export function radiologicalHazardProfile(result: HazardSearchResult): HazardProfile {
  const missing = (section: string, note: string) => [missingFact(`${result.id}-${section}`, section, note)];
  return {
    id: result.id,
    lane: "RADIOLOGICAL",
    displayName: result.displayName,
    category: result.category,
    verificationStatus: "Requires Review",
    identifiers: { aliases: result.aliases ?? [], radionuclideSymbol: result.radionuclideSymbol ?? null },
    overviewFacts: missing("Source-backed overview", "Starter identity only; isotope and material details require authoritative source linkage."),
    hazardFacts: missing("Radiation Hazards", "Do not infer dose, exposure, or protective actions from a material name alone."),
    detectionFacts: missing("Detection / Survey", "Survey guidance requires instrument, geometry, calibration, and measured field data."),
    ppeFacts: missing("PPE / Contamination Control", "PPE does not block penetrating radiation; use time, distance, shielding, contamination control, and survey mapping."),
    isolationStandoffFacts: missing("Isolation / Standoff", "No standoff may be inferred without scenario guidance or measured dose-rate inputs."),
    medicalFacts: missing("Medical", "Coordinate radiological medical decisions with medical control and radiation authorities."),
    deconFacts: missing("Decon", "Contamination-control and decon guidance require source-backed incident conditions."),
    technicalOperationsFacts: missing("Technical Operations", "Coordinate time, distance, shielding, survey mapping, and radiation authority support."),
    sourceFacts: missing("Sources", "Review REMM, EPA PAG, IAEA, NNDC/LiveChart, EPA Radionuclide Basics, and 49 CFR/ERG Class 7."),
  };
}

export function findRadiologicalStarter(id: string) {
  return RADIOLOGICAL_STARTER_RECORDS.find((record) => record.id === id) ?? null;
}

