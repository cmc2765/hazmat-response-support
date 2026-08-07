import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  validateLinkageCoverage,
  type LinkageCoverageSnapshot,
} from "../src/chemical-companion/linkage-coverage.js";

const snapshot = JSON.parse(readFileSync(
  new URL("../../data/chemical-companion-linkage-coverage.json", import.meta.url),
  "utf8",
)) as LinkageCoverageSnapshot;

describe("Chemical Companion linkage coverage", () => {
  it("retains every transportation identifier without claiming an unreviewed chemical link", () => {
    const report = validateLinkageCoverage(snapshot);
    expect(report.valid).toBe(true);
    expect(report.readyForEnforcement).toBe(false);
    expect(snapshot).toMatchObject({
      totalSourceIdentifiers: 1980,
      importedIdentifiers: 0,
      unlinkedIdentifiers: 1980,
      chemicalLinkableTargets: 0,
      unresolvedIdentifiers: 1980,
      percentCoverage: 0,
    });
    expect(snapshot.categoryCounts["unknown/requires-review"]).toBe(1980);
    expect(snapshot.unlinkedInventoryComplete).toBe(true);
    expect(snapshot.unlinkedRecords).toHaveLength(1980);
    expect(report.warnings.join(" ")).toContain("still require human review");
    expect(snapshot.unlinkedRecords.every((record) => record.sourceRelationships?.length)).toBe(true);
  });

  it("rejects a supposedly complete inventory that silently omits unlinked records", () => {
    const incomplete = structuredClone(snapshot);
    incomplete.unlinkedRecords = [];
    const report = validateLinkageCoverage(incomplete);
    expect(report.valid).toBe(false);
    expect(report.errors.join(" ")).toContain("Complete unlinked inventory must contain 1980 records");
  });

  it("does not confuse a complete review inventory with enforcement readiness", () => {
    const report = validateLinkageCoverage(snapshot);
    expect(report.valid).toBe(true);
    expect(report.readyForEnforcement).toBe(false);
    expect(report.sourceIdentifiersOutsideCurrentMetrics).toBe(0);
  });

  it("rejects aggregate category counts that silently omit unlinked identifiers", () => {
    const dropped = structuredClone(snapshot);
    dropped.categoryCounts["unknown/requires-review"] -= 1;
    const report = validateLinkageCoverage(dropped);
    expect(report.valid).toBe(false);
    expect(report.errors.join(" ")).toContain(
      "Category counts must retain all 1980 unlinked identifiers; found 1979",
    );
  });

  it("requires uncertain identifiers to stay marked requires review", () => {
    const uncertain = structuredClone(snapshot);
    uncertain.unlinkedRecords = [{
      sourceId: "example",
      identifier: "UN0000",
      category: "unknown/requires-review",
      resolution: "linked",
      linkedChemicalId: "example-chemical",
    }];
    const report = validateLinkageCoverage(uncertain);
    expect(report.valid).toBe(false);
    expect(report.errors).toContain("example must remain marked requires review.");
  });
});
