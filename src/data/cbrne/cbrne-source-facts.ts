import type { CbrneSourceFact } from "../../lib/cbrne/cbrneTypes.js";

/**
 * This is the immutable base layer. Runtime CBRNE/RAD facts are built from
 * validated local source packs by hydrateCbrneDatabase(); keeping the base
 * empty prevents imported data from being mistaken for reviewed static data.
 */
export const CBRNE_SOURCE_FACTS: readonly CbrneSourceFact[] = [];

export function sourceFactsForRecord(recordId: string, facts: readonly CbrneSourceFact[] = CBRNE_SOURCE_FACTS) {
  return facts.filter((fact) => fact.recordId === recordId);
}
