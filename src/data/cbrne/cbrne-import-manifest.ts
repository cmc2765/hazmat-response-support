import { CBRNE_MASTER_RECORDS } from "./cbrne-master-records.js";
import { hydrateCbrneDatabase } from "../../lib/cbrne/hydrateCbrneDatabase.js";

const hydrated = hydrateCbrneDatabase();

export const CBRNE_IMPORT_MANIFEST = Object.freeze({
  databaseId: "hazmatiq-cbrne-master",
  schemaVersion: "1.0.0",
  storageBoundary: "src/data/cbrne",
  chemicalCompanionShared: false,
  starterRecordCount: CBRNE_MASTER_RECORDS.length,
  sourceFactCount: hydrated.sourceFacts.length,
  sourcePackCount: hydrated.importReports.filter((report) => report.valid).length,
  tacticalImportPolicy: "Local packages only; never auto-verify; never overwrite verified facts.",
  generatedAt: "2026-08-25T00:00:00.000Z",
});
