import type { CbrneMasterRecord } from "../../lib/cbrne/cbrneTypes.js";
import { CBRNE_SOURCE_FACTS } from "./cbrne-source-facts.js";
import { CBRNE_STARTER_RECORDS } from "./cbrne-starter-records.js";

const STARTER_REGISTRY_DATE = "2026-08-25T00:00:00.000Z";

export const CBRNE_MASTER_RECORDS: readonly CbrneMasterRecord[] = CBRNE_STARTER_RECORDS.map((record) => ({
  id: record.id,
  domain: record.domain,
  category: record.category,
  displayName: record.displayName,
  scientificName: record.scientificName,
  commonNames: record.commonNames ?? [],
  aliases: record.aliases ?? [],
  agentCodes: record.agentCodes,
  cas: record.cas,
  unNaNumbers: record.unNaNumbers,
  radionuclideSymbol: record.radionuclideSymbol,
  isotopeMassNumber: record.isotopeMassNumber,
  opcwSchedule: record.opcwSchedule,
  recordSummary: record.recordSummary,
  verificationStatus: record.verificationStatus ?? "Requires SME Review",
  sourceFactIds: CBRNE_SOURCE_FACTS.filter((fact) => fact.recordId === record.id).map((fact) => fact.id),
  createdAt: STARTER_REGISTRY_DATE,
  updatedAt: STARTER_REGISTRY_DATE,
}));

export function findCbrneMasterRecord(id: string) {
  return CBRNE_MASTER_RECORDS.find((record) => record.id === id) ?? null;
}
