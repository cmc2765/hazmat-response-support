import { access } from "node:fs/promises";
import path from "node:path";
import { getDb } from "./db.js";
import { importTier2Details, parseTier2DetailsFile } from "./tier2/details.js";

function argumentValue(args: string[], flag: string): string {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] ?? "" : "";
}

async function resolveImportPath(input: string): Promise<string> {
  if (path.isAbsolute(input)) return input;
  const candidates = [path.resolve(process.cwd(), input), path.resolve(process.cwd(), "..", input)];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the path relative to the repository root when invoked via npm --prefix.
    }
  }
  return candidates[0];
}

const filePath = argumentValue(process.argv.slice(2), "--file");
const dryRun = process.argv.includes("--dry-run");
if (!filePath) {
  console.error("Usage: npm run import:tier2-details -- --file <path> [--dry-run]");
  process.exitCode = 1;
} else {
  try {
    const db = getDb();
    const result = await parseTier2DetailsFile(await resolveImportPath(filePath), db);
    console.log("Tier II Detail Import");
    console.log(`Source rows: ${result.report.sourceRows}`);
    console.log(`Matched facilities: ${result.report.matchedFacilities}`);
    console.log(`Unmatched facilities: ${result.report.unmatchedFacilities}`);
    console.log(`Contacts found: ${result.report.contactsFound}`);
    console.log(`Chemicals found: ${result.report.chemicalsFound}`);
    console.log(`Chemical columns detected: ${result.report.chemicalColumnsDetected ? "Yes" : "No"}`);
    if (result.report.errors.length) result.report.errors.forEach((error) => console.log(`- ${error}`));
    if (dryRun) {
      console.log("Dry run: no records written.");
    } else {
      const written = await importTier2Details(db, result);
      console.log(`Imported: ${written.contacts} contacts, ${written.chemicals} chemicals.`);
    }
  } catch (error) {
    console.error(`Tier II detail import failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
