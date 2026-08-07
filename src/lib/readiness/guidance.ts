export type SafetyGuidanceKind = "ppe" | "suit-compatibility" | "medical" | "protective-action";

export interface SafetyGuidanceEvidence {
  id: string;
  kind: SafetyGuidanceKind;
  sourceId: string | null;
  sourceRevision: string | null;
  sourceLocator: string | null;
  chemicalId: string | null;
  chemicalForm: string | null;
  manufacturer?: string | null;
  productOrMaterial?: string | null;
  domainReviewer: string | null;
  reviewedAt: string | null;
  reviewState: "approved" | "requires-review" | "blocked";
  hasConflictingEvidence: boolean;
}

export function evaluateSafetyGuidance(evidence: SafetyGuidanceEvidence) {
  const blockers: string[] = [];
  for (const field of ["sourceId", "sourceRevision", "sourceLocator", "chemicalId", "chemicalForm", "domainReviewer", "reviewedAt"] as const) {
    if (!evidence[field]?.trim()) blockers.push(`${field} is required.`);
  }
  if (evidence.kind === "suit-compatibility") {
    if (!evidence.manufacturer?.trim()) blockers.push("manufacturer is required for suit compatibility.");
    if (!evidence.productOrMaterial?.trim()) blockers.push("product or material is required for suit compatibility.");
  }
  if (evidence.reviewState !== "approved") blockers.push("domain review is not approved.");
  if (evidence.hasConflictingEvidence) blockers.push("conflicting evidence requires resolution.");
  return { recommendationAllowed: blockers.length === 0, blockers };
}
