export const SOURCE_STRENGTH_STATUSES = [
  "Complete",
  "Planning Estimate",
  "Missing Required Inputs",
  "Cannot Calculate Source Strength",
  "Requires Review",
  "No Current Data Exists",
] as const;

export type SourceStrengthStatusName = typeof SOURCE_STRENGTH_STATUSES[number];

export interface SourceStrengthValidationInput {
  chemicalId?: string | null;
  releaseKind?: "plume" | "puff" | null;
  sourceType?: string | null;
  containerType?: string | null;
  containerCapacity?: string | number | null;
  releaseRateKgPerSec?: number | null;
  totalMassKg?: number | null;
  releaseDurationSec?: number | null;
  evaluationTimeSec?: number | null;
  phase?: string | null;
  pressureCondition?: string | null;
  sourceTemperatureC?: number | null;
  holeSize?: string | number | null;
  poolDimensions?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  weatherAvailable?: boolean;
  sourceStrengthMethodVerified?: boolean;
}

export interface SourceStrengthValidationResult {
  status: SourceStrengthStatusName;
  releaseScenario: string;
  requiredInputs: string[];
  providedInputs: string[];
  missingInputs: string[];
  sourceStrengthAvailable: boolean;
  sourceStrengthValue: number | null;
  sourceStrengthUnits: "kg/s" | "kg" | "No Current Data Exists";
  sourceStrengthMethod: string;
  sourceStrengthLimitations: string[];
}

function present(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return Boolean(String(value ?? "").trim());
}

export function validateSourceStrength(input: SourceStrengthValidationInput): SourceStrengthValidationResult {
  const continuous = input.releaseKind === "plume";
  const puff = input.releaseKind === "puff";
  const releaseScenario = continuous ? "Continuous release" : puff ? "Instantaneous / puff release" : "Requires Review";
  const requiredInputs = [
    "chemical", "releaseType", "sourceType", "containerType", "containerCapacity",
    continuous ? "releaseRate" : "releaseAmount", "releaseDuration", "phase",
    "pressureCondition", "location", "weather",
  ];
  if (/jet/i.test(input.sourceType || "")) requiredInputs.push("holeSize", "sourceTemperature");
  if (/puddle|pool/i.test(input.sourceType || "")) requiredInputs.push("poolDimensions", "sourceTemperature");
  const facts: Record<string, boolean> = {
    chemical: present(input.chemicalId),
    releaseType: continuous || puff,
    sourceType: present(input.sourceType),
    containerType: present(input.containerType),
    containerCapacity: present(input.containerCapacity),
    releaseRate: present(input.releaseRateKgPerSec),
    releaseAmount: present(input.totalMassKg),
    releaseDuration: present(input.releaseDurationSec) || (puff && present(input.evaluationTimeSec)),
    phase: present(input.phase),
    pressureCondition: present(input.pressureCondition),
    sourceTemperature: typeof input.sourceTemperatureC === "number" && Number.isFinite(input.sourceTemperatureC),
    holeSize: present(input.holeSize),
    poolDimensions: present(input.poolDimensions),
    location: Number.isFinite(input.latitude) && Number.isFinite(input.longitude),
    weather: input.weatherAvailable === true,
  };
  const providedInputs = requiredInputs.filter((field) => facts[field]);
  const missingInputs = requiredInputs.filter((field) => !facts[field]);
  const sourceStrengthAvailable = continuous ? facts.releaseRate : puff ? facts.releaseAmount : false;
  const sourceStrengthValue = continuous
    ? (sourceStrengthAvailable ? Number(input.releaseRateKgPerSec) : null)
    : puff && sourceStrengthAvailable ? Number(input.totalMassKg) : null;
  const sourceStrengthUnits = continuous ? "kg/s" : puff ? "kg" : "No Current Data Exists";
  const sourceStrengthMethod = !sourceStrengthAvailable
    ? "No Current Data Exists"
    : continuous
      ? "Direct operator-provided release rate; existing unit conversion only"
      : "Direct operator-provided total released mass; existing unit conversion only";
  const sourceStrengthLimitations = [
    "HazMatIQ does not currently calculate a thermodynamic leak, flashing, jet, or pool-evaporation source term.",
    sourceStrengthAvailable ? "Operator-entered source strength has not been independently verified." : "Source strength is unavailable and was not inferred.",
    ...missingInputs.map((field) => `Missing source/release input: ${field}.`),
  ];
  const status: SourceStrengthStatusName = !continuous && !puff
    ? "Requires Review"
    : !sourceStrengthAvailable
      ? "Cannot Calculate Source Strength"
      : input.sourceStrengthMethodVerified && missingInputs.length === 0
        ? "Complete"
        : "Planning Estimate";
  return {
    status,
    releaseScenario,
    requiredInputs,
    providedInputs,
    missingInputs,
    sourceStrengthAvailable,
    sourceStrengthValue,
    sourceStrengthUnits,
    sourceStrengthMethod,
    sourceStrengthLimitations,
  };
}
