import crosswalks from "./generated-chemical-companion-crosswalk.json";
import type { ChemicalCompanionCrosswalk } from "../../../lib/cbrne/authoritativeSourceTypes.js";

export const CBRNE_CHEMICAL_COMPANION_CROSSWALKS: readonly ChemicalCompanionCrosswalk[] = Object.freeze(crosswalks as ChemicalCompanionCrosswalk[]);

export function chemicalCompanionCrosswalkForRecord(recordId: string) {
  return CBRNE_CHEMICAL_COMPANION_CROSSWALKS.find((crosswalk) => crosswalk.canonicalRecordId === recordId) ?? null;
}
