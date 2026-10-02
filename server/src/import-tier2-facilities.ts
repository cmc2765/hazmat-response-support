import { parseTier2FacilityFile, importTier2Facilities, type Tier2ImportReport } from "./tier2/importer.js";
import { getDb } from "./db.js";
import { access } from "node:fs/promises";
import path from "node:path";

function argumentValue(args: string[], flag: string): string {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] ?? "" : "";
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function printReport(report: Tier2ImportReport) {
  console.log("Tier II Facility Import");
  console.log(`Records found: ${report.recordsFound}`);
  console.log(`Unique facilities: ${report.uniqueFacilities}`);
  console.log(`Facilities with coordinates: ${report.facilitiesWithCoordinates}`);
  console.log(`Facilities missing coordinates: ${report.facilitiesMissingCoordinates}`);
  console.log(`Duplicate Facility IDs: ${report.duplicateFacilityIds}`);
  console.log(`Invalid coordinates: ${report.invalidCoordinates}`);
  console.log(`Missing facility names: ${report.missingFacilityNames}`);
  console.log(`States detected: ${report.statesDetected.join(", ") || "None"}`);
  console.log(`Filing years detected: ${report.filingYearsDetected.join(", ") || "None"}`);
  if (report.missingFacilityIds) console.log(`Skipped records missing Facility ID: ${report.missingFacilityIds}`);
  if (report.errors.length) {
    console.log("Validation notes:");
    report.errors.forEach((error) => console.log(`- ${error}`));
  }
}

async function resolveImportPath(input: string): Promise<string> {
  if (path.isAbsolute(input)) return input;
  const candidates = [
    path.resolve(process.cwd(), input),
    path.resolve(process.cwd(), "..", input),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // The npm --prefix wrapper may run this script from server/ or the repository root.
    }
  }
  return candidates[0];
}

const args = process.argv.slice(2);
const filePath = argumentValue(args, "--file");
const state = argumentValue(args, "--state");
const dryRun = hasFlag(args, "--dry-run");

if (!filePath) {
  console.error("Usage: npm run import:tier2-facilities -- --file <path> [--state AL] [--dry-run]");
  process.exitCode = 1;
} else {
  try {
    const result = await parseTier2FacilityFile(await resolveImportPath(filePath), state);
    printReport(result.report);
    if (dryRun) {
      console.log("Dry run: no records written.");
    } else {
      const written = await importTier2Facilities(getDb(), result.records);
      console.log(`Imported: ${written} normalized facility records.`);
    }
  } catch (error) {
    console.error(`Tier II import failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
