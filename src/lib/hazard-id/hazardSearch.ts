import { searchCbrneRecords } from "../cbrne/searchCbrneRecords.js";
import type { HazardIdLane, HazardSearchResult } from "./hazardTypes.js";

export function searchStarterHazards(lane: Exclude<HazardIdLane, "CHEMICAL">, query: string): HazardSearchResult[] {
  return searchCbrneRecords(query, { lane }).map((result) => ({
    ...result,
    lane,
    category: result.category.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toLocaleUpperCase()),
  }));
}
