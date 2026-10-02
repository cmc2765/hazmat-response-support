import { and, eq, inArray } from "drizzle-orm";
import type { DbClient } from "../db.js";
import * as schema from "../schema.js";
import { parseCsv, type CsvRecord } from "./importer.js";
import { readFile } from "node:fs/promises";

export type Tier2DetailImportReport = {
  sourceRows: number;
  matchedFacilities: number;
  unmatchedFacilities: number;
  contactsFound: number;
  chemicalsFound: number;
  chemicalColumnsDetected: boolean;
  errors: string[];
};

export type Tier2DetailImportResult = {
  report: Tier2DetailImportReport;
  contacts: Array<typeof schema.tier2FacilityContacts.$inferInsert>;
  chemicals: Array<typeof schema.tier2Chemicals.$inferInsert>;
};

function normalizedHeading(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function sourceValue(row: CsvRecord, aliases: string[]): string {
  const wanted = aliases.map(normalizedHeading);
  const heading = Object.keys(row).find((key) => wanted.includes(normalizedHeading(key)));
  return heading ? row[heading].trim() : "";
}

function nonEmpty(value: string): string | null {
  return value.trim() || null;
}

function contactValue(row: CsvRecord, slot: number, field: string): string {
  return sourceValue(row, [
    `Contact ${slot} -${field}`,
    `Contact ${slot} - ${field}`,
    `Contact${slot}-${field}`,
  ]);
}

function chemicalValue(row: CsvRecord, slot: number, field: string): string {
  return sourceValue(row, [
    `Chemical ${slot} -${field}`,
    `Chemical ${slot} - ${field}`,
    `Chemical${slot}-${field}`,
  ]);
}

const HAZARD_FLAG_FIELDS = [
  "H", "F", "R", "S", "Solid", "Liquid", "Gas", "Pure", "Mixture", "Explosive",
  "Flammable (gases, aerosols, liquids, or solids)", "Oxidizer (liquid, solid or gas)",
  "Self-reactive", "Pyrophoric (liquid or solid)", "Pyrophoric Gas", "Self-heating", "Organic peroxide",
  "Corrosive to metal", "Gas under pressure (compressed gas)", "In contact with water emits flammable gas",
  "Combustible Dust", "Acute toxicity (any route of exposure)", "Skin corrosion or irritation",
  "Serious eye damage or eye irritation", "Respiratory or skin sensitization", "Germ cell mutagenicity",
  "Carcinogenicity", "Reproductive toxicity", "Specific target organ toxicity(single or repeated exposure)",
  "Aspiration hazard", "Simple Asphyxiant", "Hazard Not Otherwise Classified",
];

function physicalStateFor(row: CsvRecord): string | null {
  const states = ["Solid", "Liquid", "Gas"].filter((state) => /^(y|yes|true|1|t)$/i.test(sourceValue(row, [state])));
  return states.length ? states.join(", ") : null;
}

function hazardFlagsFor(row: CsvRecord): string | null {
  const flags = Object.fromEntries(HAZARD_FLAG_FIELDS
    .map((field) => [field, sourceValue(row, [field])])
    .filter(([, value]) => value && !/^(f|false|0|-|no)$/i.test(value)));
  return Object.keys(flags).length ? JSON.stringify(flags) : null;
}

export function normalizeTier2Details(
  rows: CsvRecord[],
  facilities: Array<Pick<schema.Tier2FacilityRow, "id" | "sourceFacilityId">>,
  importedAt = new Date().toISOString(),
): Tier2DetailImportResult {
  const facilityBySourceId = new Map(facilities.map((facility) => [facility.sourceFacilityId, facility]));
  const contacts: Array<typeof schema.tier2FacilityContacts.$inferInsert> = [];
  const chemicals: Array<typeof schema.tier2Chemicals.$inferInsert> = [];
  let matchedFacilities = 0;
  let unmatchedFacilities = 0;
  const matched = new Set<string>();
  const errors: string[] = [];

  rows.forEach((row, rowIndex) => {
    const sourceFacilityId = sourceValue(row, ["Facility ID", "FacilityID"]);
    if (!sourceFacilityId) {
      errors.push(`Row ${rowIndex + 2}: missing Facility ID`);
      return;
    }
    const facility = facilityBySourceId.get(sourceFacilityId);
    if (!facility) {
      unmatchedFacilities += 1;
      return;
    }
    if (!matched.has(sourceFacilityId)) {
      matched.add(sourceFacilityId);
      matchedFacilities += 1;
    }

    for (let slot = 1; slot <= 3; slot += 1) {
      const name = nonEmpty(contactValue(row, slot, "Name"));
      const contactType = nonEmpty(contactValue(row, slot, "Contact Type"));
      const email = nonEmpty(contactValue(row, slot, "Email"));
      const phone24Hour = nonEmpty(contactValue(row, slot, "24-hour Phone"));
      const workPhone = nonEmpty(contactValue(row, slot, "Work Phone"));
      if (!name && !contactType && !email && !phone24Hour && !workPhone) continue;
      contacts.push({
        id: `e-plan:${sourceFacilityId}:contact:${slot}`,
        facilityId: facility.id,
        sourceFacilityId,
        contactType,
        name,
        email,
        phone24Hour,
        workPhone,
        sourceSystem: "E-Plan Tier II",
        importedAt,
      });
    }

    const standaloneChemicalName = nonEmpty(sourceValue(row, ["ChemicalName", "Chemical Name"]));
    if (standaloneChemicalName) {
      chemicals.push({
        id: `e-plan:${sourceFacilityId}:chemical:row-${rowIndex + 2}`,
        facilityId: facility.id,
        sourceFacilityId,
        chemicalName: standaloneChemicalName,
        casNumber: nonEmpty(sourceValue(row, ["CASNumber", "CAS Number", "CAS"])),
        ehsStatus: nonEmpty(sourceValue(row, ["EHS", "EHS Status"])),
        maximumQuantity: nonEmpty(sourceValue(row, ["MaxDailyQty", "Maximum Quantity"])),
        averageDailyQuantity: nonEmpty(sourceValue(row, ["AvgDailyQty", "Average Daily Quantity"])),
        maximumAmountLargestContainer: nonEmpty(sourceValue(row, ["MaxAmountInLargestContainer", "Maximum Amount In Largest Container"])),
        physicalState: physicalStateFor(row),
        hazardFlags: hazardFlagsFor(row),
        storageInformation: nonEmpty(sourceValue(row, ["Storage/Pressure/Temperature Types/Location/Max Amount", "Storage Information"])),
        sourceSystem: "E-Plan Tier II",
        importedAt,
      });
    } else {
      for (let slot = 1; slot <= 25; slot += 1) {
        const chemicalName = nonEmpty(chemicalValue(row, slot, "Name"))
          ?? nonEmpty(chemicalValue(row, slot, "Chemical Name"));
        if (!chemicalName) continue;
        const chemicalId = `e-plan:${sourceFacilityId}:chemical:${slot}`;
        chemicals.push({
          id: chemicalId,
          facilityId: facility.id,
          sourceFacilityId,
          chemicalName,
          casNumber: nonEmpty(chemicalValue(row, slot, "CAS")) ?? nonEmpty(chemicalValue(row, slot, "CAS Number")),
          ehsStatus: nonEmpty(chemicalValue(row, slot, "EHS Status")) ?? nonEmpty(chemicalValue(row, slot, "EHS")),
          maximumQuantity: nonEmpty(chemicalValue(row, slot, "Maximum Quantity")),
          averageDailyQuantity: nonEmpty(chemicalValue(row, slot, "Average Daily Quantity")),
          maximumAmountLargestContainer: nonEmpty(chemicalValue(row, slot, "Maximum Amount In Largest Container")),
          physicalState: nonEmpty(chemicalValue(row, slot, "Physical State")),
          hazardFlags: null,
          storageInformation: nonEmpty(chemicalValue(row, slot, "Storage Information")),
          sourceSystem: "E-Plan Tier II",
          importedAt,
        });
      }
    }
  });

  const chemicalColumnsDetected = rows.some((row) => Object.keys(row).some((heading) => normalizedHeading(heading).startsWith("chemical")));
  return {
    contacts,
    chemicals,
    report: {
      sourceRows: rows.length,
      matchedFacilities,
      unmatchedFacilities,
      contactsFound: contacts.length,
      chemicalsFound: chemicals.length,
      chemicalColumnsDetected,
      errors,
    },
  };
}

export async function parseTier2DetailsFile(filePath: string, db: DbClient): Promise<Tier2DetailImportResult> {
  const rows = parseCsv(await readFile(filePath, "utf8"));
  const facilities = await db.select({ id: schema.tier2Facilities.id, sourceFacilityId: schema.tier2Facilities.sourceFacilityId })
    .from(schema.tier2Facilities)
    .where(eq(schema.tier2Facilities.sourceSystem, "E-Plan Tier II"));
  return normalizeTier2Details(rows, facilities);
}

export async function importTier2Details(db: DbClient, result: Tier2DetailImportResult): Promise<{ contacts: number; chemicals: number }> {
  db.transaction((transaction) => {
    for (const contact of result.contacts) {
      transaction.insert(schema.tier2FacilityContacts).values(contact).onConflictDoUpdate({
        target: schema.tier2FacilityContacts.id,
        set: contact,
      }).run();
    }
    for (const chemical of result.chemicals) {
      transaction.insert(schema.tier2Chemicals).values(chemical).onConflictDoUpdate({
        target: schema.tier2Chemicals.id,
        set: chemical,
      }).run();
    }
  });
  return { contacts: result.contacts.length, chemicals: result.chemicals.length };
}

export async function clearTier2DetailsForSource(db: DbClient, sourceFacilityIds: string[]): Promise<void> {
  if (!sourceFacilityIds.length) return;
  db.transaction((transaction) => {
    transaction.delete(schema.tier2FacilityContacts).where(and(eq(schema.tier2FacilityContacts.sourceSystem, "E-Plan Tier II"), inArray(schema.tier2FacilityContacts.sourceFacilityId, sourceFacilityIds))).run();
    transaction.delete(schema.tier2Chemicals).where(and(eq(schema.tier2Chemicals.sourceSystem, "E-Plan Tier II"), inArray(schema.tier2Chemicals.sourceFacilityId, sourceFacilityIds))).run();
  });
}
