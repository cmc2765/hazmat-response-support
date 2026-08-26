import type { CbrneDomain } from "./cbrneTypes.js";

export const BIOLOGICAL_SAFETY_GATES = [
  "No standoff certainty may be inferred from an agent name alone.",
  "No PPE downgrade may be made from a profile alone.",
  "No decontamination procedure may be displayed unless source-backed.",
  "Medical actions require authoritative medical or public-health direction.",
  "Production, cultivation, weaponization, aerosolization, dispersal, and delivery content is prohibited.",
] as const;

export const CWA_SAFETY_GATES = [
  "No PPE downgrade or offensive entry decision may be made from a profile alone.",
  "Plume or standoff certainty requires a verified endpoint, model inputs, weather, and field monitoring.",
  "Antidote administration requires source-backed medical direction.",
] as const;

export const RADIOLOGICAL_SAFETY_GATES = [
  "No fixed standoff or protective-action decision may be inferred from isotope identity alone.",
  "Inverse-square calculations require a measured dose rate, measured distance, and documented point-source assumption.",
  "PPE supports contamination control and is not radiation shielding unless a source explicitly states otherwise.",
  "Use time, distance, shielding, survey data, and radiation-authority coordination.",
] as const;

const MISUSE_PATTERNS = [
  /(?:grow|culture|cultivat)(?:e|ion|ing).{0,40}(?:agent|bacteria|virus|pathogen)/i,
  /weaponiz/i,
  /aerosoliz/i,
  /dispersal method/i,
  /delivery system/i,
] as const;

export function safetyLimitationsForDomain(domain: CbrneDomain): readonly string[] {
  if (domain === "BIOLOGICAL") return BIOLOGICAL_SAFETY_GATES;
  if (domain === "CHEMICAL_WARFARE") return CWA_SAFETY_GATES;
  return RADIOLOGICAL_SAFETY_GATES;
}

export function containsBiologicalMisuseContent(value: unknown): boolean {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return MISUSE_PATTERNS.some((pattern) => pattern.test(text));
}

export function isInverseSquareInputComplete(input: {
  measuredDoseRate?: number | null;
  measuredDistance?: number | null;
  pointSourceAssumption?: boolean;
}): boolean {
  return Number.isFinite(input.measuredDoseRate)
    && Number.isFinite(input.measuredDistance)
    && input.pointSourceAssumption === true;
}
