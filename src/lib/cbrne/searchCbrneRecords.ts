import type { CbrneDomain, CbrneMasterRecord, CbrneSearchResult } from "./cbrneTypes.js";
import { hydrateCbrneDatabase } from "./hydrateCbrneDatabase.js";

export type CbrneSearchLane = "CBRNE_CWA" | "RADIOLOGICAL";

const CBRNE_LANE_DOMAINS: readonly CbrneDomain[] = ["CHEMICAL_WARFARE", "BIOLOGICAL", "EXPLOSIVE"];
const RADIOLOGICAL_LANE_DOMAINS: readonly CbrneDomain[] = ["RADIOLOGICAL", "NUCLEAR", "CBRNE_SCENARIO"];

export function domainsForCbrneLane(lane: CbrneSearchLane): readonly CbrneDomain[] {
  return lane === "RADIOLOGICAL" ? RADIOLOGICAL_LANE_DOMAINS : CBRNE_LANE_DOMAINS;
}

function normalized(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function exactTerms(record: CbrneMasterRecord) {
  return [
    record.displayName,
    record.scientificName,
    ...record.commonNames,
    ...record.aliases,
    ...(record.agentCodes ?? []),
    ...(record.cas ?? []),
    ...(record.unNaNumbers ?? []),
    record.radionuclideSymbol,
  ].filter(Boolean).map(normalized);
}

function searchableTerms(record: CbrneMasterRecord) {
  return [...exactTerms(record), record.domain.replaceAll("_", " "), record.category.replaceAll("_", " ")];
}

function sourceSummary(record: CbrneMasterRecord) {
  const sources = [...new Set(hydrateCbrneDatabase().sourceFacts.filter((fact) => fact.recordId === record.id).map((fact) => fact.sourceName))];
  return sources.length ? sources : ["Starter identity record — authoritative source facts pending import"];
}

function toSearchResult(record: CbrneMasterRecord): CbrneSearchResult {
  return {
    id: record.id,
    displayName: record.displayName,
    scientificName: record.scientificName,
    domain: record.domain,
    category: record.category,
    aliases: [...new Set([...record.commonNames, ...record.aliases])],
    agentCodes: record.agentCodes,
    cas: record.cas,
    unNaNumbers: record.unNaNumbers,
    radionuclideSymbol: record.radionuclideSymbol,
    verificationStatus: record.verificationStatus,
    sourceSummary: sourceSummary(record),
  };
}

export function searchCbrneRecords(
  query: string,
  options: { lane?: CbrneSearchLane; domains?: readonly CbrneDomain[] } = {},
): CbrneSearchResult[] {
  const needle = normalized(query);
  if (!needle) return [];
  const allowedDomains = options.domains ?? (options.lane ? domainsForCbrneLane(options.lane) : undefined);
  return hydrateCbrneDatabase().records
    .filter((record) => !allowedDomains || allowedDomains.includes(record.domain))
    .filter((record) => searchableTerms(record).some((term) => term.includes(needle)))
    .sort((left, right) => {
      const leftExact = exactTerms(left).includes(needle);
      const rightExact = exactTerms(right).includes(needle);
      const leftStarts = searchableTerms(left).some((term) => term.startsWith(needle));
      const rightStarts = searchableTerms(right).some((term) => term.startsWith(needle));
      return Number(rightExact) - Number(leftExact)
        || Number(rightStarts) - Number(leftStarts)
        || left.displayName.localeCompare(right.displayName);
    })
    .map(toSearchResult);
}
