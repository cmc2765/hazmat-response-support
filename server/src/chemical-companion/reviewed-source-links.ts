export interface ReviewedTransportationLink {
  sourceIdentifierId: number;
  masterChemicalId: number;
  identifierValue: string;
  properShippingName: string;
  ergGuide: string;
  linkType: "exact_chemical_match" | "synonym_or_alias";
  reviewStatus: "approved";
  reviewedBy: string;
  reviewedAt: string;
  notes: string;
}

export interface ReviewedChemicalSourceLink {
  masterChemicalId: number;
  sourceName: "EPA AEGL" | "CAMEO Chemicals" | "ERG";
  sourceRecordId: string;
  sourceIdentifierType: "CAS" | "CAMEO chemical ID" | "UN/ERG";
  sourceIdentifierValue: string;
  matchBasis: string;
  reviewStatus: "approved";
  sourceUrl: string;
}

export interface ReviewedMasterAliases {
  masterChemicalId: number;
  casNumber: string;
  aliases: readonly string[];
  matchBasis: string;
}

export const REVIEWED_TRANSPORTATION_LINKS: readonly ReviewedTransportationLink[] = [{
  sourceIdentifierId: 6203,
  masterChemicalId: 56,
  identifierValue: "1050",
  properShippingName: "Hydrogen chloride, anhydrous",
  ergGuide: "125",
  linkType: "exact_chemical_match",
  reviewStatus: "approved",
  reviewedBy: "HazMatIQ source-link audit",
  reviewedAt: "2026-08-24",
  notes: "Exact Chemical Companion master CAS 7647-01-0 and UN1050 match; distinct from UN1789 hydrochloric acid solution.",
}];

export const REVIEWED_CHEMICAL_SOURCE_LINKS: readonly ReviewedChemicalSourceLink[] = [
  {
    masterChemicalId: 56,
    sourceName: "EPA AEGL",
    sourceRecordId: "hydrogen-chloride-7647-01-0-final",
    sourceIdentifierType: "CAS",
    sourceIdentifierValue: "7647-01-0",
    matchBasis: "Exact CAS and reviewed Chemical Companion master link",
    reviewStatus: "approved",
    sourceUrl: "https://www.epa.gov/aegl/hydrogen-chloride-results-aegl-program",
  },
  {
    masterChemicalId: 56,
    sourceName: "CAMEO Chemicals",
    sourceRecordId: "4649",
    sourceIdentifierType: "CAMEO chemical ID",
    sourceIdentifierValue: "4649",
    matchBasis: "Existing canonical CAMEO link for Hydrogen chloride, anhydrous",
    reviewStatus: "approved",
    sourceUrl: "https://cameochemicals.noaa.gov/chemical/4649",
  },
  {
    masterChemicalId: 56,
    sourceName: "ERG",
    sourceRecordId: "UN1050-guide125",
    sourceIdentifierType: "UN/ERG",
    sourceIdentifierValue: "UN1050 / Guide 125",
    matchBasis: "Exact Chemical Companion and PHMSA ERG transport identifiers",
    reviewStatus: "approved",
    sourceUrl: "https://www.phmsa.dot.gov/training/hazmat/erg/emergency-response-guidebook-erg",
  },
];

export const REVIEWED_MASTER_ALIASES: readonly ReviewedMasterAliases[] = [{
  masterChemicalId: 56,
  casNumber: "7647-01-0",
  aliases: ["Hydrogen chloride", "HCl", "Hydrochloric acid gas", "Anhydrous hydrogen chloride"],
  matchBasis: "Reviewed aliases tied to Chemical Companion master 56 and exact CAS 7647-01-0; no name-only identity merge",
}];

export function reviewedSourceLinksForMaster(masterChemicalId: number) {
  return REVIEWED_CHEMICAL_SOURCE_LINKS.filter((link) => link.masterChemicalId === masterChemicalId);
}
