export const PPE_LEVELS = {
  LEVEL_A: "LEVEL_A_VAPOR_PROTECTIVE_SCBA",
  LEVEL_B: "LEVEL_B_SCBA",
  LEVEL_C: "LEVEL_C_APR_APPROPRIATE_CARTRIDGE",
  LEVEL_D: "LEVEL_D_NO_CHEMICAL_PROTECTION",
  REVIEW: "REQUIRES_REVIEW",
  NO_DATA: "NO_CURRENT_DATA_EXISTS",
  BLOCKED: "BLOCKED_PENDING_VERIFIED_CHEMICAL_LINK",
} as const;

export type PpeSelectedLevel = typeof PPE_LEVELS[keyof typeof PPE_LEVELS];
export type PpeSourceName = "Chemical Companion" | "NIOSH" | "CAMEO" | "ERG" | "Manual Review";

export const PPE_DISPLAY_LABELS: Record<PpeSelectedLevel, string> = {
  [PPE_LEVELS.LEVEL_A]: "Vapor Protective Level A w/ SCBA",
  [PPE_LEVELS.LEVEL_B]: "Level B w/ SCBA",
  [PPE_LEVELS.LEVEL_C]: "Level C w/ APR — Appropriate Cartridge Required",
  [PPE_LEVELS.LEVEL_D]: "Level D — No Chemical Protection Required",
  [PPE_LEVELS.REVIEW]: "Requires IC / HazMat Specialist Review",
  [PPE_LEVELS.NO_DATA]: "No Current Data Exists",
  [PPE_LEVELS.BLOCKED]: "Blocked Pending Verified Chemical Link",
};

export type PpeOperationalConditions = {
  unknownAtmosphere?: boolean;
  oxygenAdequate?: boolean;
  oxygenDeficient?: boolean;
  atmosphereIdlh?: boolean;
  emergencyInhalationHazard?: boolean;
  concentrationKnown?: boolean;
  concentrationBelowLimits?: boolean;
  monitoringVerified?: boolean;
  cartridgeVerified?: boolean;
  outsideContaminatedZone?: boolean;
  noRespiratoryHazard?: boolean;
  noSkinHazard?: boolean;
};

export type PpeRecommendationInput = {
  masterLinked: boolean;
  chemicalId?: string | number | null;
  chemicalName?: string | null;
  approvedSourceFacts?: Partial<Record<PpeSourceName, unknown>>;
  hiddenRawOptions?: Record<string, unknown>;
  operationalConditions?: PpeOperationalConditions;
  generatedAt?: string;
};

export type PpeRecommendation = {
  chemicalId: string | number | null;
  chemicalName: string;
  selectedLevel: PpeSelectedLevel;
  displayLabel: string;
  recommendationStatus: "SOURCE_BACKED_RECOMMENDATION" | "REQUIRES_REVIEW" | "NO_CURRENT_DATA" | "BLOCKED";
  respiratoryProtection: string;
  skinProtection: string;
  eyeFaceProtection: string;
  cartridgeRequirement: string;
  scbaRequired: boolean;
  aprAllowed: boolean;
  levelCAllowed: boolean;
  levelCBlockedReason: string;
  sourceSummary: string;
  decisionReasons: string[];
  verificationRequirements: string[];
  sourcesReviewed: PpeSourceName[];
  sourceConflicts: string[];
  limitations: string[];
  hiddenRawOptions: Record<string, string[]>;
  generatedAt: string;
};

const NO_DATA_PATTERN = /^(?:n\/?a|not available|not established|null|undefined|no current data exists)$/i;

function textValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(textValues);
  const text = String(value ?? "").trim();
  return text && !NO_DATA_PATTERN.test(text) ? [text] : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeHiddenOptions(options: Record<string, unknown> = {}): Record<string, string[]> {
  return Object.fromEntries(Object.entries(options).map(([key, value]) => [key, unique(textValues(value))]));
}

function baseRecommendation(input: PpeRecommendationInput, selectedLevel: PpeSelectedLevel): PpeRecommendation {
  return {
    chemicalId: input.chemicalId ?? null,
    chemicalName: String(input.chemicalName ?? "").trim() || "No Current Data Exists",
    selectedLevel,
    displayLabel: PPE_DISPLAY_LABELS[selectedLevel],
    recommendationStatus: "REQUIRES_REVIEW",
    respiratoryProtection: "Requires IC / HazMat Specialist Review",
    skinProtection: "Requires IC / HazMat Specialist Review",
    eyeFaceProtection: "Requires IC / HazMat Specialist Review",
    cartridgeRequirement: "No Current Data Exists",
    scbaRequired: false,
    aprAllowed: false,
    levelCAllowed: false,
    levelCBlockedReason: "APR/cartridge conditions have not been verified.",
    sourceSummary: "No Current Data Exists",
    decisionReasons: [],
    verificationRequirements: [],
    sourcesReviewed: [],
    sourceConflicts: [],
    limitations: [],
    hiddenRawOptions: normalizeHiddenOptions(input.hiddenRawOptions),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}

function matchedFacts(facts: string[], pattern: RegExp): string[] {
  return unique(facts.filter((fact) => pattern.test(fact)));
}

function factReason(label: string, facts: string[]): string {
  const sample = facts[0];
  return sample ? `${label}: ${sample}` : "";
}

export function buildPpeRecommendation(input: PpeRecommendationInput): PpeRecommendation {
  if (!input.masterLinked || input.chemicalId === null || input.chemicalId === undefined || input.chemicalId === "") {
    const blocked = baseRecommendation(input, PPE_LEVELS.BLOCKED);
    blocked.recommendationStatus = "BLOCKED";
    blocked.respiratoryProtection = PPE_DISPLAY_LABELS[PPE_LEVELS.BLOCKED];
    blocked.skinProtection = PPE_DISPLAY_LABELS[PPE_LEVELS.BLOCKED];
    blocked.eyeFaceProtection = PPE_DISPLAY_LABELS[PPE_LEVELS.BLOCKED];
    blocked.levelCBlockedReason = "A verified Chemical Companion master link is required.";
    blocked.limitations = ["Unresolved transport identifiers cannot drive PPE guidance."];
    blocked.verificationRequirements = ["Verify the Chemical Companion master chemical link."];
    return blocked;
  }

  const approvedSourceFacts = input.approvedSourceFacts ?? {};
  const sourceEntries = (Object.entries(approvedSourceFacts) as Array<[PpeSourceName, unknown]>)
    .map(([source, value]) => [source, unique(textValues(value))] as const)
    .filter(([, facts]) => facts.length > 0);
  const sourcesReviewed = sourceEntries.map(([source]) => source);
  const facts = unique(sourceEntries.flatMap(([, values]) => values));
  const recommendation = baseRecommendation(input, PPE_LEVELS.REVIEW);
  recommendation.sourcesReviewed = sourcesReviewed;
  recommendation.sourceSummary = sourcesReviewed.length ? sourcesReviewed.join(", ") : "No Current Data Exists";

  if (!facts.length) {
    recommendation.selectedLevel = PPE_LEVELS.NO_DATA;
    recommendation.displayLabel = PPE_DISPLAY_LABELS[PPE_LEVELS.NO_DATA];
    recommendation.recommendationStatus = "NO_CURRENT_DATA";
    recommendation.respiratoryProtection = PPE_DISPLAY_LABELS[PPE_LEVELS.NO_DATA];
    recommendation.skinProtection = PPE_DISPLAY_LABELS[PPE_LEVELS.NO_DATA];
    recommendation.eyeFaceProtection = PPE_DISPLAY_LABELS[PPE_LEVELS.NO_DATA];
    recommendation.levelCBlockedReason = "No approved PPE or respiratory source data exists for this verified chemical.";
    recommendation.limitations = ["Missing PPE data is not defaulted to Level C or Level D."];
    recommendation.verificationRequirements = ["Obtain approved chemical-specific PPE source data."];
    return recommendation;
  }

  const explicitA = matchedFacts(facts, /\blevel\s*a\b|fully\s+encapsulat|vapor[- ]protective\s+suit/i);
  const explicitB = matchedFacts(facts, /\blevel\s*b\b/i);
  const explicitC = matchedFacts(facts, /\blevel\s*c\b/i);
  const explicitD = matchedFacts(facts, /\blevel\s*d\b|no chemical (?:protective ensemble|protection) required/i);
  const scbaFacts = matchedFacts(facts, /\bSCBA\b|self-contained breathing apparatus/i)
    .filter((fact) => !/escape\s+only|no\s+SCBA|SCBA\s+not/i.test(fact));
  const aprFacts = matchedFacts(facts, /\bAPR\b|\bPAPR\b|air-purifying respirator|cartridge|canister/i);
  const skinVaporFacts = matchedFacts(facts, /skin absorption|dermal toxic|vapor[- ]protective|fully\s+encapsulat|chemical[- ]resistant (?:suit|clothing)|splash protection/i);
  const eyeFacts = matchedFacts(facts, /eye|goggle|face\s*shield/i);
  const conditions = { unknownAtmosphere: true, ...input.operationalConditions };
  const conditionRequiresScba = conditions.unknownAtmosphere === true
    || conditions.oxygenDeficient === true
    || conditions.atmosphereIdlh === true
    || conditions.emergencyInhalationHazard === true;
  const explicitLevels = [explicitA.length && "Level A", explicitB.length && "Level B", explicitC.length && "Level C", explicitD.length && "Level D"].filter(Boolean) as string[];

  if (explicitLevels.length > 1) {
    recommendation.sourceConflicts = [`Conflicting explicit PPE levels: ${explicitLevels.join(", ")}.`];
  }

  const levelCChecks: Array<[boolean, string]> = [
    [conditions.oxygenAdequate === true && conditions.oxygenDeficient !== true, "Oxygen concentration is not verified adequate."],
    [conditions.atmosphereIdlh === false, "Atmosphere is not verified below IDLH."],
    [conditions.concentrationKnown === true, "Concentration is not known."],
    [conditions.monitoringVerified === true, "Air monitoring is not verified."],
    [conditions.cartridgeVerified === true, "Chemical-specific cartridge/canister suitability is not verified."],
    [conditions.concentrationBelowLimits === true, "Concentration is not verified below the applicable exposure/use limits."],
    [aprFacts.length > 0 || explicitC.length > 0, "APR/PAPR use is not source-supported."],
    [scbaFacts.length === 0 && !conditionRequiresScba, "A condition requiring SCBA remains present."],
  ];
  const failedLevelCChecks = levelCChecks.filter(([passed]) => !passed).map(([, reason]) => reason);
  recommendation.levelCAllowed = failedLevelCChecks.length === 0;
  recommendation.aprAllowed = recommendation.levelCAllowed;
  recommendation.levelCBlockedReason = recommendation.levelCAllowed ? "" : failedLevelCChecks.join(" ");

  const levelDAllowed = explicitD.length > 0
    && conditions.outsideContaminatedZone === true
    && conditions.noRespiratoryHazard === true
    && conditions.noSkinHazard === true
    && conditions.monitoringVerified === true
    && conditions.unknownAtmosphere !== true
    && conditions.atmosphereIdlh === false
    && conditions.oxygenDeficient !== true;

  let selectedLevel: PpeSelectedLevel = PPE_LEVELS.REVIEW;
  if (!recommendation.sourceConflicts.length && explicitA.length && scbaFacts.length) selectedLevel = PPE_LEVELS.LEVEL_A;
  else if (!recommendation.sourceConflicts.length && scbaFacts.length && !explicitC.length && !explicitD.length) {
    selectedLevel = skinVaporFacts.length && explicitA.length ? PPE_LEVELS.LEVEL_A : PPE_LEVELS.LEVEL_B;
  } else if (!recommendation.sourceConflicts.length && (explicitC.length || aprFacts.length) && recommendation.levelCAllowed) {
    selectedLevel = PPE_LEVELS.LEVEL_C;
  } else if (!recommendation.sourceConflicts.length && levelDAllowed) selectedLevel = PPE_LEVELS.LEVEL_D;

  recommendation.selectedLevel = selectedLevel;
  recommendation.displayLabel = PPE_DISPLAY_LABELS[selectedLevel];
  recommendation.recommendationStatus = selectedLevel === PPE_LEVELS.REVIEW ? "REQUIRES_REVIEW" : "SOURCE_BACKED_RECOMMENDATION";
  recommendation.scbaRequired = selectedLevel === PPE_LEVELS.LEVEL_A
    || selectedLevel === PPE_LEVELS.LEVEL_B
    || (selectedLevel === PPE_LEVELS.REVIEW && conditionRequiresScba);
  recommendation.decisionReasons = unique([
    factReason("Explicit protection-level guidance", [...explicitA, ...explicitB, ...explicitC, ...explicitD]),
    factReason("Respiratory source guidance", scbaFacts.length ? scbaFacts : aprFacts),
    factReason("Skin/vapor source guidance", skinVaporFacts),
    ...recommendation.sourceConflicts,
  ]).slice(0, 4);

  const commonVerification = ["Incident Command approval", "Agency SOPs", "Air monitoring", "Oxygen concentration", "IDLH status"];
  if (selectedLevel === PPE_LEVELS.LEVEL_A) {
    recommendation.scbaRequired = true;
    recommendation.respiratoryProtection = "Positive-pressure SCBA required.";
    recommendation.skinProtection = "Fully encapsulating vapor-protective suit; verify chemical compatibility.";
    recommendation.eyeFaceProtection = eyeFacts.length ? "Use the source-backed eye/face protection with the Level A ensemble." : "Level A ensemble eye/face protection; verify task requirements.";
    recommendation.cartridgeRequirement = "Not applicable — SCBA selected.";
    recommendation.verificationRequirements = [...commonVerification, "Vapor-protective suit compatibility"];
  } else if (selectedLevel === PPE_LEVELS.LEVEL_B) {
    recommendation.scbaRequired = true;
    recommendation.respiratoryProtection = "Positive-pressure SCBA required.";
    recommendation.skinProtection = "Chemical-protective splash suit; verify chemical and task compatibility.";
    recommendation.eyeFaceProtection = eyeFacts.length ? "Use the source-backed eye/face protection with the Level B ensemble." : "Verify eye/face protection for splash and task hazards.";
    recommendation.cartridgeRequirement = "Not applicable — SCBA selected.";
    recommendation.verificationRequirements = [...commonVerification, "Chemical-protective suit compatibility"];
    recommendation.limitations.push("A fully encapsulating Level A vapor-protective requirement was not established by the reviewed source facts.");
  } else if (selectedLevel === PPE_LEVELS.LEVEL_C) {
    recommendation.respiratoryProtection = "APR/PAPR with a verified chemical-appropriate cartridge or canister.";
    recommendation.skinProtection = "Chemical-protective clothing compatible with the chemical and assigned task.";
    recommendation.eyeFaceProtection = eyeFacts.length ? "Use the source-backed eye/face protection." : "Verify eye/face protection for the task.";
    recommendation.cartridgeRequirement = "Appropriate cartridge required — verify service life, change schedule, and manufacturer approval.";
    recommendation.verificationRequirements = [...commonVerification, "Known concentration below applicable limits", "Cartridge suitability and change schedule"];
  } else if (selectedLevel === PPE_LEVELS.LEVEL_D) {
    recommendation.respiratoryProtection = "No chemical respiratory protection required for the verified task/area.";
    recommendation.skinProtection = "Standard work clothing for the verified non-exposure task/area.";
    recommendation.eyeFaceProtection = "Task-appropriate occupational eye protection.";
    recommendation.cartridgeRequirement = "Not applicable.";
    recommendation.verificationRequirements = ["Maintain air monitoring", "Confirm work remains outside contaminated zones", "Incident Command approval", "Agency SOPs"];
  } else {
    recommendation.respiratoryProtection = recommendation.scbaRequired
      ? "Positive-pressure SCBA required; final protective ensemble requires specialist review."
      : (scbaFacts.length ? "SCBA source guidance exists; final ensemble requires specialist review." : "Requires IC / HazMat Specialist Review.");
    recommendation.skinProtection = skinVaporFacts.length ? "Skin/suit source guidance exists; compatibility and ensemble level require review." : "Requires IC / HazMat Specialist Review.";
    recommendation.eyeFaceProtection = eyeFacts.length ? "Eye/face source guidance exists; verify the final ensemble." : "Requires IC / HazMat Specialist Review.";
    recommendation.cartridgeRequirement = aprFacts.length ? "Cartridge suitability is not verified; Level C is blocked." : "No Current Data Exists";
    recommendation.verificationRequirements = unique([...commonVerification, "Cartridge suitability if APR/PAPR is considered", "Suit compatibility", "IC / HazMat Specialist review"]);
    recommendation.limitations.push(recommendation.levelCBlockedReason || "Available source facts do not support selection of Level A, B, C, or D.");
  }

  if ((selectedLevel === PPE_LEVELS.LEVEL_A || selectedLevel === PPE_LEVELS.LEVEL_B) && !skinVaporFacts.length) {
    recommendation.limitations.push("Chemical-specific suit compatibility is not established by the decision facts and must be verified.");
  }
  if (conditions.unknownAtmosphere) recommendation.limitations.push("Planning display assumes an unknown atmosphere until field monitoring verifies conditions.");
  recommendation.limitations = unique(recommendation.limitations);
  recommendation.verificationRequirements = unique(recommendation.verificationRequirements);
  return recommendation;
}
