import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import semanticOutput from "../src/data/cbrne/authoritative/generated-resolved-pdf-facts.json";
import { CBRNE_AUTHORITATIVE_SOURCE_FACTS } from "../src/data/cbrne/authoritative/authoritativeSourceFacts.js";
import { CBRNE_DOMAIN_COMPLETENESS_MATRICES } from "../src/data/cbrne/authoritative/domainCompleteness.js";
import { CBRNE_SOURCE_ARTIFACTS, findSourceArtifact } from "../src/data/cbrne/authoritative/sourceArtifacts.js";
import { guidedResponseReadinessForRecord, authoritativeFactMayDriveGuidedResponse } from "../src/lib/cbrne/guidedResponseReadiness.js";
import { detectAuthoritativeFactConflicts } from "../src/lib/cbrne/sourceFactReview.js";
import { extractResolvedPdfFacts } from "../scripts/cbrne/extract-resolved-pdf-facts.js";

const output = semanticOutput as unknown as {
  baselineFactCount: number;
  checkpoint: { status: string; expectedArtifactCount: number; completedArtifactCount: number };
  artifacts: Array<{ sourceArtifactId: string; disposition: string; factsCreated: string[]; duplicateFactsSkipped: string[] }>;
  facts: typeof CBRNE_AUTHORITATIVE_SOURCE_FACTS;
};

describe("targeted semantic extraction from resolved CBRNE PDFs", () => {
  it("processes exactly 46 resolved PDFs and excludes the four parser-limited PDFs", () => {
    expect(output.checkpoint).toMatchObject({ status: "COMPLETE", expectedArtifactCount: 46, completedArtifactCount: 46 });
    expect(output.artifacts).toHaveLength(46);
    expect(output.artifacts.map((item) => item.sourceArtifactId)).not.toContain("remm-triagetoolscombined");
    expect(output.artifacts.map((item) => item.sourceArtifactId)).not.toContain("fema-chemical-consequence-framework");
    expect(output.artifacts.map((item) => item.sourceArtifactId)).not.toContain("fema-biological-kpf");
    expect(output.artifacts.map((item) => item.sourceArtifactId)).not.toContain("cdc-radiation-contamination-vs-exposure-pdf");
  });

  it("keeps facts atomic, page-located, typed, and review-gated", () => {
    expect(output.facts.length).toBeGreaterThan(0);
    expect(new Set(output.facts.map((fact) => fact.factId)).size).toBe(output.facts.length);
    for (const fact of output.facts) {
      expect(fact.subdomain).toBeTruthy();
      expect(fact.valueOriginal).toBeTruthy();
      expect(fact.valueNormalized).toBeTruthy();
      expect(fact.reviewStatus).toBe("SOURCE_IMPORTED_PENDING_REVIEW");
      expect(fact.sourceArtifactSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(fact.sourceLocator).toMatch(/^Page \d+ — block \d+ — /);
      expect(fact.context).toMatchObject({ agentOrRecord: fact.canonicalRecordId, scenario: expect.any(String), phase: expect.any(String), sourceLimitation: expect.any(String) });
      if (typeof fact.value !== "string") throw new Error("Semantic facts must retain a textual source statement.");
      expect(fact.value.length).toBeGreaterThanOrEqual(45);
      expect(fact.value.length).toBeLessThanOrEqual(220);
    }
  });

  it("covers EPA/NRT, FEMA, EPA PAG, and CDC source families without admitting OPCW catalog text", () => {
    const families = new Set(output.facts.map((fact) => fact.sourceFamily));
    expect(families).toEqual(new Set(["EPA_NRT_QRG", "FEMA_NUCLEAR_RESPONSE", "EPA_PAG", "CDC_RADIATION_POPULATION_MONITORING"]));
    expect(output.artifacts.find((item) => item.sourceArtifactId === "opcw-handbook-2024")?.disposition).toBe("NO_SAFE_FACTS_ADMITTED");
    expect(output.artifacts.find((item) => item.sourceArtifactId === "fema-chemical-kpf")?.factsCreated).toEqual([]);
  });

  it("suppresses a duplicate candidate and remains resume-safe", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "hazmatiq-cbrne-semantic-"));
    const outputPath = resolve(tempRoot, "semantic.json");
    try {
      const duplicateSeed = output.facts[0];
      const firstProcessed: string[] = [];
      const first = extractResolvedPdfFacts({ outputPath, existingFacts: [duplicateSeed], onArtifactProcessed: (id) => firstProcessed.push(id) });
      const firstSerialized = readFileSync(outputPath, "utf8");
      const secondProcessed: string[] = [];
      const second = extractResolvedPdfFacts({ outputPath, existingFacts: [duplicateSeed], onArtifactProcessed: (id) => secondProcessed.push(id) });
      expect(first.checkpoint).toMatchObject({ status: "COMPLETE", expectedArtifactCount: 46, completedArtifactCount: 46 });
      expect(firstProcessed).toHaveLength(46);
      expect(first.artifacts.find((item) => item.sourceArtifactId === duplicateSeed.sourceArtifactId)?.duplicateFactsSkipped.length).toBeGreaterThan(0);
      expect(second.checkpoint).toEqual(first.checkpoint);
      expect(secondProcessed).toEqual([]);
      expect(readFileSync(outputPath, "utf8")).toBe(firstSerialized);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("updates affected completeness domains and readiness metadata without enabling tactical use", () => {
    const sarin = CBRNE_DOMAIN_COMPLETENESS_MATRICES.find((matrix) => matrix.canonicalRecordId === "sarin-gb")!;
    expect(sarin.domains.PPE).toBe("SOURCE_BACKED_PENDING_REVIEW");
    expect(sarin.domains.SAMPLING).toBe("SOURCE_BACKED_PENDING_REVIEW");
    expect(sarin.domains.DECONTAMINATION).toBe("SOURCE_BACKED_PENDING_REVIEW");
    expect(sarin.domains.SOURCE_PROVENANCE).toBe("SOURCE_BACKED_PENDING_REVIEW");
    const cyanide = CBRNE_DOMAIN_COMPLETENESS_MATRICES.find((matrix) => matrix.canonicalRecordId === "hydrogen-cyanide-ac")!;
    expect(cyanide.domains.ANALYSIS).toBe("SOURCE_BACKED_PENDING_REVIEW");
    expect(guidedResponseReadinessForRecord("sarin-gb")).toBe("DATA_READY_FOR_FUTURE_GUIDED_RESPONSE_REVIEW");
    expect(output.facts.every((fact) => !authoritativeFactMayDriveGuidedResponse(fact))).toBe(true);
  });

  it("keeps family/category guidance out of member records and distinguishes contextual conflicts", () => {
    expect(output.artifacts.find((item) => item.sourceArtifactId === "nrt-qrg-chemical-organothiophosphate-pesticides")?.factsCreated).toEqual([]);
    expect(output.artifacts.find((item) => item.sourceArtifactId === "nrt-qrg-chemical-cyanide-salts")?.factsCreated).toEqual([]);
    const base = CBRNE_AUTHORITATIVE_SOURCE_FACTS[0];
    const contextual = [
      { ...base, factId: "semantic-context-a", field: "Limit", value: "1", context: { route: "inhalation" } },
      { ...base, factId: "semantic-context-b", field: "Limit", value: "2", context: { route: "dermal" } },
    ];
    expect(detectAuthoritativeFactConflicts(contextual)).toEqual([]);
    expect(detectAuthoritativeFactConflicts([{ ...contextual[0], factId: "semantic-same-a" }, { ...contextual[0], factId: "semantic-same-b", value: "2" }])).toHaveLength(1);
  });

  it("retains source hashes and never changes authoritative source snapshots", () => {
    for (const fact of output.facts) {
      expect(fact.sourceArtifactSha256).toBe(findSourceArtifact(fact.sourceArtifactId)?.sha256);
    }
    for (const artifact of CBRNE_SOURCE_ARTIFACTS.filter((item) => output.artifacts.some((result) => result.sourceArtifactId === item.sourceArtifactId))) {
      expect(artifact.localSnapshotPath).toBeTruthy();
      const actual = createHash("sha256").update(readFileSync(artifact.localSnapshotPath!)).digest("hex");
      expect(actual).toBe(artifact.sha256);
      expect(existsSync(artifact.localSnapshotPath!)).toBe(true);
    }
  });
});
