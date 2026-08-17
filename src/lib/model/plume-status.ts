export const PLUME_STATUSES = [
  "Validated for this chemical/release scenario",
  "Planning Estimate",
  "Needs Verification",
  "Blocked Missing AEGL / LOC",
  "Blocked Missing Chemical Link",
  "Blocked Missing Weather",
  "Blocked Missing Release Inputs",
  "Not Independently Validated",
] as const;

export type PlumeStatus = typeof PLUME_STATUSES[number];

export interface PlumeStatusFacts {
  hasChemicalLink: boolean;
  hasAeglEndpoint: boolean;
  hasWeather: boolean;
  weatherNeedsVerification?: boolean;
  hasReleaseInputs: boolean;
  validationCasesPassed?: boolean;
}

export function determinePlumeStatus(facts: PlumeStatusFacts): PlumeStatus {
  if (!facts.hasChemicalLink) return "Blocked Missing Chemical Link";
  if (!facts.hasAeglEndpoint) return "Blocked Missing AEGL / LOC";
  if (!facts.hasWeather) return "Blocked Missing Weather";
  if (!facts.hasReleaseInputs) return "Blocked Missing Release Inputs";
  if (facts.weatherNeedsVerification) return "Needs Verification";
  if (facts.validationCasesPassed) return "Validated for this chemical/release scenario";
  return "Planning Estimate";
}
