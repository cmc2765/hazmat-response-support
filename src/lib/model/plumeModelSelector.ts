export const PLUME_MODEL_FAMILIES = [
  "Gaussian neutral gas",
  "Heavy gas / dense gas",
  "Continuous release",
  "Instantaneous / puff release",
  "Pool evaporation",
  "Jet release",
  "Fire/explosion scenario",
  "ERG overlay only",
  "No model available",
] as const;

export type PlumeModelFamily = typeof PLUME_MODEL_FAMILIES[number];

export interface PlumeModelSelectorInput {
  releaseKind?: "plume" | "puff" | null;
  sourceType?: string | null;
  vaporDensityAir?: number | null;
  denseGasKnown?: boolean;
  ergOverlayOnly?: boolean;
  fireOrExplosion?: boolean;
}

export interface PlumeModelSelection {
  modelFamily: PlumeModelFamily;
  releasePattern: "Continuous release" | "Instantaneous / puff release" | "Requires Review";
  calculationApproach: string;
  status: "Planning Estimate" | "Requires Review" | "Overlay Only" | "No Model Available";
  supported: boolean;
  assumptions: string[];
  limitations: string[];
}

export function selectPlumeModelFamily(input: PlumeModelSelectorInput): PlumeModelSelection {
  const releasePattern = input.releaseKind === "plume"
    ? "Continuous release"
    : input.releaseKind === "puff" ? "Instantaneous / puff release" : "Requires Review";
  if (input.ergOverlayOnly) return {
    modelFamily: "ERG overlay only", releasePattern, calculationApproach: "No dispersion calculation",
    status: "Overlay Only", supported: true, assumptions: [], limitations: ["ERG distances are not plume-model concentration contours."],
  };
  if (input.fireOrExplosion || /fire|explosion/i.test(input.sourceType || "")) return {
    modelFamily: "Fire/explosion scenario", releasePattern, calculationApproach: "No model available",
    status: "No Model Available", supported: false, assumptions: [], limitations: ["Fire and explosion source terms are not supported."],
  };
  if (/puddle|pool/i.test(input.sourceType || "")) return {
    modelFamily: "Pool evaporation", releasePattern, calculationApproach: "Gaussian dispersion requires an operator-provided source strength",
    status: "Planning Estimate", supported: false, assumptions: ["Operator-provided release rate is used without a pool-evaporation calculation."], limitations: ["Pool evaporation is not calculated or validated."],
  };
  if (/jet/i.test(input.sourceType || "")) return {
    modelFamily: "Jet release", releasePattern, calculationApproach: "Gaussian dispersion requires an operator-provided source strength",
    status: "Planning Estimate", supported: false, assumptions: ["Operator-provided release rate is used without a jet source-term calculation."], limitations: ["Jet momentum and thermodynamics are not modeled."],
  };
  const dense = input.denseGasKnown === true
    || (typeof input.vaporDensityAir === "number" && Number.isFinite(input.vaporDensityAir) && input.vaporDensityAir > 1);
  if (dense) return {
    modelFamily: "Heavy gas / dense gas", releasePattern, calculationApproach: "Gaussian plume/puff screening calculation",
    status: "Planning Estimate", supported: false,
    assumptions: ["Current geometry uses the existing Gaussian calculation."],
    limitations: ["Planning Estimate — dense gas behavior is not fully validated or explicitly modeled."],
  };
  const densityKnown = typeof input.vaporDensityAir === "number" && Number.isFinite(input.vaporDensityAir);
  return {
    modelFamily: input.releaseKind === "puff" ? "Instantaneous / puff release" : "Gaussian neutral gas",
    releasePattern,
    calculationApproach: "Gaussian plume/puff screening calculation",
    status: densityKnown ? "Planning Estimate" : "Requires Review",
    supported: true,
    assumptions: ["Neutral-gas Gaussian dispersion", "Level terrain", "Constant meteorology"],
    limitations: densityKnown ? [] : ["Vapor-density behavior is not confirmed; model-family applicability requires review."],
  };
}
