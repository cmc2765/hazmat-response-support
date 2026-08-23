export const PLUME_MODEL_MODES = {
  OFFICIAL_ALOHA_IMPORT: "OFFICIAL_ALOHA_IMPORT",
  HAZMATIQ_VALIDATED_MODEL: "HAZMATIQ_VALIDATED_MODEL",
  HAZMATIQ_PLANNING_ESTIMATE: "HAZMATIQ_PLANNING_ESTIMATE",
  ERG_ISOLATION_PROTECTIVE_ACTION_OVERLAY: "ERG_ISOLATION_PROTECTIVE_ACTION_OVERLAY",
  BLOCKED_MISSING_REQUIRED_DATA: "BLOCKED_MISSING_REQUIRED_DATA",
  NO_CURRENT_DATA_EXISTS: "NO_CURRENT_DATA_EXISTS",
} as const;

export type PlumeModelMode = typeof PLUME_MODEL_MODES[keyof typeof PLUME_MODEL_MODES];

export const PLUME_MODEL_MODE_LABELS: Record<PlumeModelMode, string> = {
  [PLUME_MODEL_MODES.OFFICIAL_ALOHA_IMPORT]: "Official ALOHA Output Imported — displayed by HazMatIQ",
  [PLUME_MODEL_MODES.HAZMATIQ_VALIDATED_MODEL]: "HazMatIQ Validated Model",
  [PLUME_MODEL_MODES.HAZMATIQ_PLANNING_ESTIMATE]: "HazMatIQ Planning Estimate",
  [PLUME_MODEL_MODES.ERG_ISOLATION_PROTECTIVE_ACTION_OVERLAY]: "ERG Isolation / Protective Action Overlay — Not a Plume Model",
  [PLUME_MODEL_MODES.BLOCKED_MISSING_REQUIRED_DATA]: "Cannot Plot — Missing Required Data",
  [PLUME_MODEL_MODES.NO_CURRENT_DATA_EXISTS]: "No Current Data Exists",
};

export interface PlumeModeFacts {
  officialAlohaImported?: boolean;
  ergOverlayOnly?: boolean;
  requiredDataComplete?: boolean;
  distanceDataAvailable?: boolean;
  validationCasesPassed?: boolean;
  validationStatus?: string;
}

export function selectPlumeModelMode(facts: PlumeModeFacts): PlumeModelMode {
  if (facts.officialAlohaImported) return PLUME_MODEL_MODES.OFFICIAL_ALOHA_IMPORT;
  if (facts.ergOverlayOnly) return PLUME_MODEL_MODES.ERG_ISOLATION_PROTECTIVE_ACTION_OVERLAY;
  if (facts.distanceDataAvailable === false) return PLUME_MODEL_MODES.NO_CURRENT_DATA_EXISTS;
  if (facts.requiredDataComplete === false) return PLUME_MODEL_MODES.BLOCKED_MISSING_REQUIRED_DATA;
  if (facts.validationCasesPassed === true && /^validated$/i.test(facts.validationStatus || "")) {
    return PLUME_MODEL_MODES.HAZMATIQ_VALIDATED_MODEL;
  }
  return PLUME_MODEL_MODES.HAZMATIQ_PLANNING_ESTIMATE;
}

export function plumeModelModeLabel(mode: PlumeModelMode): string {
  return PLUME_MODEL_MODE_LABELS[mode];
}
