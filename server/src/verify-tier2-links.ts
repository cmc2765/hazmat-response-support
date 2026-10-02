import { getDb } from "./db.js";
import * as schema from "./schema.js";
import { verifyTier2Links } from "./tier2/verify-links.js";

const db = getDb();
const facilities = await db.select().from(schema.tier2Facilities);
const chemicals = await db.select().from(schema.tier2Chemicals);
const contacts = await db.select().from(schema.tier2FacilityContacts);
const report = verifyTier2Links(facilities, chemicals, contacts);

console.log("Tier II Facility Relationship Verification");
console.log(`Facilities: ${report.facilities}`);
console.log(`Chemicals: ${report.chemicals}`);
console.log(`Contacts: ${report.contacts}`);
console.log(`Facilities with chemicals: ${report.facilitiesWithChemicals}`);
console.log(`Facilities with contacts: ${report.facilitiesWithContacts}`);
console.log(`Matched chemical rows: ${report.matchedChemicals}`);
console.log(`Unmatched chemical rows: ${report.unmatchedChemicals}`);
console.log(`Matched contact rows: ${report.matchedContacts}`);
console.log(`Unmatched contact rows: ${report.unmatchedContacts}`);
console.log(`Orphan chemical rows: ${report.orphanChemicals}`);
console.log(`Orphan contact rows: ${report.orphanContacts}`);
console.log(`Duplicate facility source IDs: ${report.duplicateFacilityIds}`);
console.log(`Duplicate chemical row IDs: ${report.duplicateChemicalIds}`);
console.log(`Duplicate contact row IDs: ${report.duplicateContactIds}`);

if (report.orphanChemicals || report.orphanContacts || report.duplicateFacilityIds) process.exitCode = 1;
