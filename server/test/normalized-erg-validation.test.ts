import { describe, expect, it } from "vitest";
import {
  validateNormalizedErgImport,
  type NormalizedErgImportBundle,
} from "../src/erg/normalized-erg-validation.js";

function validBundle(): NormalizedErgImportBundle {
  const provenance = { sourceId: "phmsa-erg-2024", revisionId: "erg-2024-r1" };
  return {
    sources: [{ id: "phmsa-erg-2024", name: "PHMSA ERG", citation: "Emergency Response Guidebook 2024", license: "Public domain" }],
    revisions: [{ id: "erg-2024-r1", sourceId: "phmsa-erg-2024", revisionLabel: "2024", publishedAt: "2024-01-01" }],
    guidebooks: [{ id: "erg-us-2024", countryCode: "USA", edition: "2024", title: "ERG 2024", ...provenance }],
    materials: [{ id: "chlorine", preferredName: "Chlorine", ...provenance }],
    unNaIdentifiers: [{ id: "un-1017", identifierType: "UN", identifierValue: "1017", countryCode: "USA", ...provenance }],
    materialIdentifiers: [{ id: "chlorine-un-1017", materialId: "chlorine", unNaIdentifierId: "un-1017", ...provenance }],
    guides: [{ id: "guide-124", guidebookId: "erg-us-2024", guideNumber: "124", title: "Gases - Toxic and/or Corrosive", ...provenance }],
    containers: [{ id: "ton-cylinder", name: "Ton cylinder", ...provenance }],
    windBands: [{ id: "low-wind", name: "Low wind", maximumSpeedMph: 6, ...provenance }],
    table1: [{
      id: "t1-chlorine-large-day",
      materialIdentifierId: "chlorine-un-1017",
      guideId: "guide-124",
      spillSize: "large",
      period: "day",
      initialIsolationFt: 1500,
      protectiveActionMi: 4.1,
      ...provenance,
    }],
    table2: [{
      id: "t2-chlorine",
      materialIdentifierId: "chlorine-un-1017",
      toxicGasProduced: "Chlorine",
      ...provenance,
    }],
    table3: [{
      id: "t3-chlorine-ton-low-day",
      materialIdentifierId: "chlorine-un-1017",
      containerId: "ton-cylinder",
      windBandId: "low-wind",
      period: "day",
      initialIsolationFt: 1000,
      protectiveActionMi: 1.2,
      ...provenance,
    }],
  };
}

describe("normalized ERG staging import validation", () => {
  it("reports table counts and coverage for a referentially complete bundle", () => {
    const report = validateNormalizedErgImport(validBundle());
    expect(report.valid).toBe(true);
    expect(report.errorCount).toBe(0);
    expect(report.importedRowsByTable.table1).toBe(1);
    expect(report.coverageSummary).toMatchObject({
      materials: 1,
      materialsWithIdentifiers: 1,
      materialIdentifierCoveragePercent: 100,
      table1Identifiers: 1,
      table2Identifiers: 1,
      table3Identifiers: 1,
    });
  });

  it("rejects duplicate identifiers and invalid table references", () => {
    const bundle = validBundle();
    bundle.unNaIdentifiers.push({ ...bundle.unNaIdentifiers[0], id: "duplicate-un-1017" });
    bundle.table3[0].containerId = "missing-container";
    bundle.table3[0].windBandId = "missing-wind-band";
    const report = validateNormalizedErgImport(bundle);
    expect(report.valid).toBe(false);
    expect(report.rejectedRowsByReason).toMatchObject({
      "duplicate-un-na-identifier": 1,
      "invalid-container-reference": 1,
      "invalid-wind-band-reference": 1,
    });
  });

  it("rejects missing names, guide numbers, provenance, and orphaned relationships", () => {
    const bundle = validBundle();
    bundle.materials[0].preferredName = "";
    bundle.guides[0].guideNumber = "";
    bundle.guides[0].guidebookId = "missing-guidebook";
    bundle.materialIdentifiers[0].materialId = "missing-material";
    delete bundle.table1[0].sourceId;
    const report = validateNormalizedErgImport(bundle);
    expect(report.valid).toBe(false);
    expect(report.rejectedRowsByReason).toMatchObject({
      "missing-material-name": 1,
      "missing-guide-number": 1,
      "orphaned-guide-reference": 1,
      "orphaned-material-identifier": 1,
      "missing-or-invalid-source": 1,
    });
  });
});
