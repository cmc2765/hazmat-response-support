import { CBRNE_CWA_STARTER_RECORDS } from "../../data/hazard-id/cbrne-cwa-starter-records.js";
import type { HazardProfile, HazardSearchResult, HazardSourceFact } from "./hazardTypes.js";

const missingFact = (id: string, fieldName: string, notes: string): HazardSourceFact => ({
  id,
  sourceName: "No linked tactical source",
  fieldName,
  value: null,
  verificationStatus: "No Current Data Exists",
  notes,
});

export function cbrneCwaHazardProfile(result: HazardSearchResult): HazardProfile {
  const missing = (section: string, note: string) => [missingFact(`${result.id}-${section}`, section, note)];
  return {
    id: result.id,
    lane: "CBRNE_CWA",
    displayName: result.displayName,
    category: result.category,
    verificationStatus: "Requires Review",
    identifiers: { aliases: result.aliases ?? [], agentCodes: result.agentCodes ?? [], cas: result.cas ?? null, unNaNumbers: result.unNaNumbers ?? null },
    overviewFacts: missing("Source-backed overview", "Starter identity only; authoritative source linkage is required."),
    hazardFacts: missing("Hazards", "Do not infer tactical hazards from an agent name alone."),
    detectionFacts: missing("Detection", "Detection methods require source-backed agent and instrument compatibility data."),
    ppeFacts: missing("PPE / Respiratory", "Hazard ID alone cannot support a PPE downgrade or offensive entry decision."),
    isolationStandoffFacts: missing("Isolation / Standoff", "A verified endpoint, scenario, weather, model, and field monitoring are required."),
    medicalFacts: missing("Medical", "Antidote or treatment guidance requires medical direction and a linked authoritative source."),
    deconFacts: missing("Decon", "Agent-specific decontamination guidance requires authoritative source linkage."),
    technicalOperationsFacts: missing("Technical Operations", "Technical operations require source-backed incident-specific guidance."),
    sourceFacts: missing("Sources", "Review NIOSH ERSH-DB, CHEMM, CAMEO, EPA AEGL, ERG, OPCW, and applicable PPE frameworks."),
  };
}

export function findCbrneCwaStarter(id: string) {
  return CBRNE_CWA_STARTER_RECORDS.find((record) => record.id === id) ?? null;
}

