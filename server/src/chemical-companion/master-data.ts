export const transportationLinkTypes = [
  "exact_chemical_match",
  "synonym_or_alias",
  "mixture_or_solution",
  "generic_transport_class",
  "transportation_only",
  "duplicate_or_format_variant",
  "deprecated_or_obsolete",
  "requires_review",
  "rejected",
] as const;

export const linkedSourceNames = [
  "Chemical Companion",
  "CAMEO Chemicals",
  "ALOHA",
  "ERG",
  "NIOSH",
  "SDS",
  "Manual Review",
  "Other Approved Source",
] as const;

export const sourceBadgeLabels = [
  "Chemical Companion Master",
  "Linked ERG",
  "Linked CAMEO",
  "Linked ALOHA",
  "Transportation Identifier",
  "Requires Review",
  "No Current Data Exists",
] as const;

export const sourceFactCategories = [
  "identifier", "physical_property", "health_hazard", "fire_hazard", "reactivity",
  "isolation_distance", "protective_action", "ppe", "suit_compatibility", "decon",
  "detector", "medical", "plume_model_input", "plume_model_output", "transport",
  "container", "limitation",
] as const;

export interface TransportationLinkDecision {
  linkType: typeof transportationLinkTypes[number];
  reviewStatus: "approved" | "requires_review" | "rejected";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

export function isTransportationLinkGuidanceEligible(link: TransportationLinkDecision): boolean {
  return link.reviewStatus === "approved"
    && Boolean(link.reviewedBy?.trim())
    && Boolean(link.reviewedAt?.trim())
    && ["exact_chemical_match", "synonym_or_alias"].includes(link.linkType);
}
