import type { HazardSearchResult } from "./hazardTypes.js";

type ChemicalSearchRow = Record<string, unknown>;

export function chemicalHazardSearchResult(row: ChemicalSearchRow): HazardSearchResult {
  const chemicalId = row.ChemicalID ?? row.id;
  const requiresReview = row.reviewStatus === "requires_review" || row.guidanceEligible === false;
  return {
    id: String(chemicalId ?? row.sourceIdentifierId ?? "unresolved"),
    lane: "CHEMICAL",
    displayName: String(row.ChemicalName ?? row.name ?? "No Current Data Exists"),
    category: String(row.HazardClass ?? row.category ?? "Chemical"),
    aliases: Array.isArray(row.aliases) ? row.aliases.map(String) : [],
    cas: row.CasNumber && row.CasNumber !== "Not available" ? [String(row.CasNumber)] : [],
    unNaNumbers: row.UnnaNumber && row.UnnaNumber !== "Not available" ? [String(row.UnnaNumber)] : [],
    verificationStatus: requiresReview ? "Requires Review" : "Verified",
    sourceSummary: [requiresReview ? "Chemical identity requires review" : "Chemical Companion master record"],
  };
}

