import type { Tier2ChemicalRow, Tier2FacilityContactRow, Tier2FacilityRow } from "../schema.js";

type ChildRow = Pick<Tier2ChemicalRow | Tier2FacilityContactRow, "id" | "facilityId" | "sourceFacilityId">;

function duplicateSourceIds(ids: string[]): number {
  const counts = new Map<string, number>();
  ids.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  return [...counts.values()].filter((count) => count > 1).length;
}

function matchedChild(row: ChildRow, facilitiesById: Set<string>, facilitiesBySourceId: Set<string>): boolean {
  return (row.facilityId ? facilitiesById.has(row.facilityId) : false) || facilitiesBySourceId.has(row.sourceFacilityId);
}

export type Tier2LinkVerification = {
  facilities: number;
  chemicals: number;
  contacts: number;
  facilitiesWithChemicals: number;
  facilitiesWithContacts: number;
  matchedChemicals: number;
  unmatchedChemicals: number;
  matchedContacts: number;
  unmatchedContacts: number;
  orphanChemicals: number;
  orphanContacts: number;
  duplicateFacilityIds: number;
  duplicateChemicalIds: number;
  duplicateContactIds: number;
};

export function verifyTier2Links(
  facilities: Tier2FacilityRow[],
  chemicals: Tier2ChemicalRow[],
  contacts: Tier2FacilityContactRow[],
): Tier2LinkVerification {
  const facilitiesById = new Set(facilities.map((facility) => facility.id));
  const facilitiesBySourceId = new Set(facilities.map((facility) => facility.sourceFacilityId));
  const matchedChemicals = chemicals.filter((row) => matchedChild(row, facilitiesById, facilitiesBySourceId)).length;
  const matchedContacts = contacts.filter((row) => matchedChild(row, facilitiesById, facilitiesBySourceId)).length;
  const chemicalFacilityIds = new Set(
    chemicals.filter((row) => matchedChild(row, facilitiesById, facilitiesBySourceId))
      .map((row) => row.facilityId ?? `source:${row.sourceFacilityId}`),
  );
  const contactFacilityIds = new Set(
    contacts.filter((row) => matchedChild(row, facilitiesById, facilitiesBySourceId))
      .map((row) => row.facilityId ?? `source:${row.sourceFacilityId}`),
  );

  return {
    facilities: facilities.length,
    chemicals: chemicals.length,
    contacts: contacts.length,
    facilitiesWithChemicals: chemicalFacilityIds.size,
    facilitiesWithContacts: contactFacilityIds.size,
    matchedChemicals,
    unmatchedChemicals: chemicals.length - matchedChemicals,
    matchedContacts,
    unmatchedContacts: contacts.length - matchedContacts,
    orphanChemicals: chemicals.length - matchedChemicals,
    orphanContacts: contacts.length - matchedContacts,
    duplicateFacilityIds: duplicateSourceIds(facilities.map((row) => row.sourceFacilityId)),
    duplicateChemicalIds: duplicateSourceIds(chemicals.map((row) => row.id)),
    duplicateContactIds: duplicateSourceIds(contacts.map((row) => row.id)),
  };
}

export function tier2ChildCounts(
  facility: Tier2FacilityRow,
  chemicals: Tier2ChemicalRow[],
  contacts: Tier2FacilityContactRow[],
) {
  const facilityChemicals = chemicals.filter((row) => row.facilityId === facility.id || row.sourceFacilityId === facility.sourceFacilityId);
  return {
    chemicalCount: facilityChemicals.length,
    ehsCount: facilityChemicals.filter((row) => /^(y|yes|true|1)$/i.test(row.ehsStatus?.trim() ?? "")).length,
    contactCount: contacts.filter((row) => row.facilityId === facility.id || row.sourceFacilityId === facility.sourceFacilityId).length,
  };
}
