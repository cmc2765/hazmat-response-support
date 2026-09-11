import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CBRNE_AUTHORITATIVE_SOURCE_FACTS } from "../src/data/cbrne/authoritative/authoritativeSourceFacts.js";
import { CBRNE_CANONICAL_RECORD_CANDIDATES } from "../src/data/cbrne/authoritative/canonicalRecordCandidates.js";
import { CBRNE_COMPLETENESS_DOMAINS } from "../src/lib/cbrne/authoritativeSourceTypes.js";
import { CBRNE_DOMAIN_COMPLETENESS_MATRICES } from "../src/data/cbrne/authoritative/domainCompleteness.js";
import { CBRNE_EXTRACTION_MANIFEST } from "../src/data/cbrne/authoritative/extractionManifest.js";
import { CBRNE_SOURCE_ARTIFACTS, findSourceArtifact } from "../src/data/cbrne/authoritative/sourceArtifacts.js";
import { authoritativeFactMayDriveGuidedResponse } from "../src/lib/cbrne/guidedResponseReadiness.js";
import { normalizeCbrneUnitValue } from "../src/lib/cbrne/normalizeCbrneUnits.js";
import { detectAuthoritativeFactConflicts } from "../src/lib/cbrne/sourceFactReview.js";

describe("local CBRNE extraction projection", () => {
  it("accounts for every registry artifact and reuses duplicates", () => {
    expect(CBRNE_EXTRACTION_MANIFEST).toHaveLength(224);
    expect(CBRNE_EXTRACTION_MANIFEST.filter((item) => item.acquisitionDisposition === "ACQUIRED")).toHaveLength(209);
    expect(CBRNE_EXTRACTION_MANIFEST.filter((item) => item.hashValidation === "VERIFIED")).toHaveLength(213);
    expect(CBRNE_EXTRACTION_MANIFEST.every((item) => item.extractionDisposition)).toBe(true);
    expect(CBRNE_EXTRACTION_MANIFEST.filter((item) => item.extractionDisposition === "DUPLICATE_REUSED")).toHaveLength(4);
    expect(CBRNE_EXTRACTION_MANIFEST.filter((item) => item.acquisitionDisposition === "ACQUIRED" && item.hashValidation !== "VERIFIED")).toHaveLength(0);
  });

  it("keeps the generated manifest deterministic and linked to the registry", () => {
    const raw = JSON.parse(readFileSync(new URL("../src/data/cbrne/authoritative/generated-extraction-manifest.json", import.meta.url), "utf8"));
    expect(raw.generatedBy).toContain("build-extraction-manifest.ts");
    expect(raw.sourceArtifactCount).toBe(CBRNE_SOURCE_ARTIFACTS.length);
    expect(new Set(CBRNE_EXTRACTION_MANIFEST.map((item) => item.sourceArtifactId)).size).toBe(224);
  });

  it("gives all 43 original records a complete explicit 14-domain matrix", () => {
    expect(CBRNE_DOMAIN_COMPLETENESS_MATRICES).toHaveLength(43);
    expect(CBRNE_DOMAIN_COMPLETENESS_MATRICES.every((matrix) => Object.keys(matrix.domains).length === CBRNE_COMPLETENESS_DOMAINS.length)).toBe(true);
    expect(CBRNE_DOMAIN_COMPLETENESS_MATRICES.every((matrix) => CBRNE_COMPLETENESS_DOMAINS.every((domain) => Boolean(matrix.domains[domain])))).toBe(true);
  });

  it("retains source representation, normalized representation, and artifact hash on every fact", () => {
    expect(CBRNE_AUTHORITATIVE_SOURCE_FACTS).toHaveLength(148);
    for (const fact of CBRNE_AUTHORITATIVE_SOURCE_FACTS) {
      expect(fact.valueOriginal).toEqual(fact.value);
      expect(fact.unitsOriginal).toEqual(fact.units);
      expect(fact.sourceArtifactSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(fact.normalizationMethod).toBeTruthy();
      if (findSourceArtifact(fact.sourceArtifactId)?.artifactType === "PDF") expect(fact.sourceLocator).toMatch(/^Page\s+\d+/i);
    }
  });

  it("rejects incompatible conversions and preserves count-rate versus dose-rate dimensions", () => {
    expect(normalizeCbrneUnitValue(1, "Ci", "Bq").valueNormalized).toBe(3.7e10);
    expect(normalizeCbrneUnitValue(120, "cpm", "cps").valueNormalized).toBe(2);
    expect(() => normalizeCbrneUnitValue(1, "cpm", "µSv/h")).toThrow(/Incompatible unit dimensions/);
  });

  it("does not report contextual values as conflicts", () => {
    const base = CBRNE_AUTHORITATIVE_SOURCE_FACTS[0];
    const facts = [
      { ...base, factId: "context-a", field: "Emergency limit", value: 1, units: "ppm", context: { duration: "10 minutes" } },
      { ...base, factId: "context-b", field: "Emergency limit", value: 2, units: "ppm", context: { duration: "60 minutes" } },
    ];
    expect(detectAuthoritativeFactConflicts(facts)).toEqual([]);
  });

  it("keeps pending facts out of tactical Guided Response authority", () => {
    expect(CBRNE_AUTHORITATIVE_SOURCE_FACTS.every((fact) => !authoritativeFactMayDriveGuidedResponse(fact))).toBe(true);
    const physics = CBRNE_AUTHORITATIVE_SOURCE_FACTS.find((fact) => fact.fieldGroup === "RADIONUCLIDE_PHYSICS");
    expect(physics).toBeTruthy();
    expect(authoritativeFactMayDriveGuidedResponse({ ...physics!, reviewStatus: "VERIFIED_AUTHORITATIVE" })).toBe(false);
  });

  it("keeps all twelve known candidates explicit and family candidates unactivated", () => {
    expect(CBRNE_CANONICAL_RECORD_CANDIDATES).toHaveLength(12);
    expect(CBRNE_CANONICAL_RECORD_CANDIDATES.find((candidate) => candidate.candidateId === "cyanide-salts")?.disposition).toBe("REQUIRES_IDENTITY_REVIEW");
    expect(CBRNE_CANONICAL_RECORD_CANDIDATES.find((candidate) => candidate.candidateId === "organothiophosphate-pesticides")?.disposition).toBe("REQUIRES_IDENTITY_REVIEW");
  });
});
