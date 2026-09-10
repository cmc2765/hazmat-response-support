import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CBRNE_AUTHORITATIVE_SOURCE_FACTS } from "../src/data/cbrne/authoritative/authoritativeSourceFacts.js";
import { CBRNE_CANONICAL_IDENTITIES } from "../src/data/cbrne/authoritative/canonicalIdentities.js";
import { CBRNE_ADDITIONAL_CANONICAL_RECORDS, CBRNE_CANONICAL_RECORD_CANDIDATES } from "../src/data/cbrne/authoritative/canonicalRecordCandidates.js";
import { CBRNE_CHEMICAL_COMPANION_CROSSWALKS } from "../src/data/cbrne/authoritative/chemicalCompanionCrosswalk.js";
import { CBRNE_MANUAL_ACQUISITION_QUEUE, CBRNE_SOURCE_COMPLETENESS } from "../src/data/cbrne/authoritative/completeness.js";
import { CBRNE_DOMAIN_SOURCE_PRECEDENCE, sourcePrecedenceForDomain } from "../src/data/cbrne/authoritative/domainSourcePrecedence.js";
import { RADIONUCLIDE_PHYSICS_RECORDS } from "../src/data/cbrne/authoritative/radionuclidePhysics.js";
import { CBRNE_RECORD_RECONCILIATIONS } from "../src/data/cbrne/authoritative/reconciliation.js";
import { CBRNE_SOURCE_ARTIFACTS, findSourceArtifact } from "../src/data/cbrne/authoritative/sourceArtifacts.js";
import { CBRNE_MASTER_RECORDS } from "../src/data/cbrne/cbrne-master-records.js";
import { cbrneProfileById } from "../src/lib/cbrne/cbrneProfileAdapter.js";
import { detectAuthoritativeFactConflicts } from "../src/lib/cbrne/sourceFactReview.js";
import { validateArtifactIntegrity, validateSourceArtifactCandidate } from "../src/lib/cbrne/sourceArtifactValidation.js";
import type { AuthoritativeSourceFact } from "../src/lib/cbrne/authoritativeSourceTypes.js";

const repositoryRoot = resolve(import.meta.dirname, "..");

describe("authoritative CBRNE source artifact registry", () => {
  it("fully dispositions every enumerated official artifact with unique IDs and approved URLs", () => {
    expect(CBRNE_SOURCE_ARTIFACTS).toHaveLength(224);
    expect(new Set(CBRNE_SOURCE_ARTIFACTS.map((artifact) => artifact.sourceArtifactId)).size).toBe(CBRNE_SOURCE_ARTIFACTS.length);
    for (const artifact of CBRNE_SOURCE_ARTIFACTS) {
      expect(validateSourceArtifactCandidate(artifact)).toEqual([]);
      expect(artifact.currentStatus).toMatch(/^(ACQUIRED|DUPLICATE|SUPERSEDED|OUT_OF_SCOPE|ACCESS_BLOCKED|MANUAL_ACQUISITION_REQUIRED|FAILED)$/);
    }
    expect(CBRNE_SOURCE_COMPLETENESS.every((family) => family.silentlySkipped === 0)).toBe(true);
  });

  it("keeps every acquired snapshot offline with verified bytes, SHA-256, type, and parse method", () => {
    const localArtifacts = CBRNE_SOURCE_ARTIFACTS.filter((artifact) => ["ACQUIRED", "DUPLICATE"].includes(artifact.currentStatus));
    expect(localArtifacts.length).toBe(213);
    for (const artifact of localArtifacts) {
      expect(artifact.localSnapshotPath).toMatch(/^data\/cbrne\/source-artifacts\//);
      expect(existsSync(resolve(repositoryRoot, artifact.localSnapshotPath!))).toBe(true);
      expect(statSync(resolve(repositoryRoot, artifact.localSnapshotPath!)).size).toBe(artifact.fileSize);
      expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(artifact.parsed).toBe(true);
      expect(artifact.parseMethod).toMatch(/^(PDF_STRUCTURE|HTML_DOCUMENT|STRUCTURED_JSON)$/);
      expect(validateArtifactIntegrity(artifact, repositoryRoot)).toEqual([]);
    }
  });

  it("detects exact duplicate responses and preserves one canonical snapshot", () => {
    const duplicates = CBRNE_SOURCE_ARTIFACTS.filter((artifact) => artifact.currentStatus === "DUPLICATE");
    expect(duplicates.map((artifact) => artifact.sourceArtifactId).sort()).toEqual([
      "chemm-fga-medical-management", "chemm-medical-countermeasures", "chemm-nerve-agents", "chemm-nerve-agents-hospital",
    ]);
    for (const duplicate of duplicates) {
      const canonical = findSourceArtifact(duplicate.duplicateOf!);
      expect(canonical?.currentStatus).toBe("ACQUIRED");
      expect(duplicate.sha256).toBe(canonical?.sha256);
    }
  });

  it("records supersession and keeps restricted systems out of local storage", () => {
    expect(["epa-pag-2016", "epa-pag-2013", "epa-pag-1992"].every((id) => findSourceArtifact(id)?.currentStatus === "SUPERSEDED")).toBe(true);
    for (const id of ["fbi-restricted-threat-credibility-material", "atf-bats"]) {
      const artifact = findSourceArtifact(id)!;
      expect(artifact.currentStatus).toBe("OUT_OF_SCOPE");
      expect(artifact.localSnapshotPath).toBeNull();
      expect(artifact.sha256).toBeNull();
    }
  });

  it("is idempotent when generated artifacts and crosswalks are reapplied by canonical key", () => {
    const artifactRerun = new Map([...CBRNE_SOURCE_ARTIFACTS, ...CBRNE_SOURCE_ARTIFACTS].map((artifact) => [artifact.sourceArtifactId, artifact]));
    const crosswalkRerun = new Map([...CBRNE_CHEMICAL_COMPANION_CROSSWALKS, ...CBRNE_CHEMICAL_COMPANION_CROSSWALKS].map((crosswalk) => [crosswalk.canonicalRecordId, crosswalk]));
    expect(artifactRerun.size).toBe(CBRNE_SOURCE_ARTIFACTS.length);
    expect(crosswalkRerun.size).toBe(CBRNE_CHEMICAL_COMPANION_CROSSWALKS.length);
    expect([...artifactRerun.values()]).toEqual(CBRNE_SOURCE_ARTIFACTS);
    expect([...crosswalkRerun.values()]).toEqual(CBRNE_CHEMICAL_COMPANION_CROSSWALKS);
  });
});

describe("typed identity, fact provenance, and source precedence", () => {
  it("assigns every existing record to exactly one typed identity namespace", () => {
    expect(CBRNE_MASTER_RECORDS).toHaveLength(43);
    expect(CBRNE_CANONICAL_IDENTITIES).toHaveLength(43);
    expect(new Set(CBRNE_CANONICAL_IDENTITIES.map((identity) => {
      if (identity.namespace === "CWA_CHEMICAL") return identity.canonicalCbrneId;
      if (identity.namespace === "RADIONUCLIDE") return identity.canonicalNuclideId;
      if (identity.namespace === "RAD_NUCLEAR_SCENARIO") return identity.canonicalScenarioId;
      return identity.canonicalBiologicalId;
    })).size).toBe(43);
    expect(CBRNE_CANONICAL_IDENTITIES.filter((identity) => identity.namespace === "RADIONUCLIDE")).toHaveLength(10);
    expect(CBRNE_CANONICAL_IDENTITIES.filter((identity) => identity.namespace === "RAD_NUCLEAR_SCENARIO")).toHaveLength(4);
  });

  it("keeps element, mass number, and metastable state explicit", () => {
    const cobalt = RADIONUCLIDE_PHYSICS_RECORDS.find((record) => record.canonicalRecordId === "cobalt-60")!;
    expect(cobalt).toMatchObject({ canonicalNuclideId: "nuclide:co-60", elementSymbol: "CO", massNumber: 60, metastableState: null });
    expect(CBRNE_CHEMICAL_COMPANION_CROSSWALKS.find((item) => item.canonicalRecordId === "cobalt-60")?.companionIds).toEqual([46]);
    expect(CBRNE_CHEMICAL_COMPANION_CROSSWALKS.find((item) => item.canonicalRecordId === "cobalt-60")?.companionIds).not.toContain(47);
  });

  it("attaches exact artifact and locator provenance while retaining review gates", () => {
    expect(CBRNE_AUTHORITATIVE_SOURCE_FACTS.length).toBeGreaterThan(70);
    for (const fact of CBRNE_AUTHORITATIVE_SOURCE_FACTS) {
      expect(fact.sourceArtifactId).toBeTruthy();
      expect(fact.sourceLocator).toBeTruthy();
      expect(findSourceArtifact(fact.sourceArtifactId)?.currentStatus).toBe("ACQUIRED");
      expect(fact.reviewStatus).toBe("SOURCE_IMPORTED_PENDING_REVIEW");
      expect(fact.reviewedBy).toBeNull();
      expect(fact.reviewedAt).toBeNull();
      expect(fact.factBasis).toBeTruthy();
      expect(fact.hazmatiqProcessing).toBeTruthy();
    }
    const anthrax = CBRNE_AUTHORITATIVE_SOURCE_FACTS.find((fact) => fact.canonicalRecordId === "anthrax" && fact.sourceLocator === "Page 1 — Agent Characteristics");
    expect(anthrax).toMatchObject({ sourceArtifactId: "nrt-qrg-biological-anthrax", sourceLocator: "Page 1 — Agent Characteristics" });
  });

  it("uses domain-specific precedence and keeps legacy ERSH subordinate", () => {
    expect(CBRNE_DOMAIN_SOURCE_PRECEDENCE).toHaveLength(12);
    expect(sourcePrecedenceForDomain("CWA_IDENTITY")?.orderedSourceFamilies[0]).toBe("OPCW_CWA_IDENTITY");
    expect(sourcePrecedenceForDomain("CHEMICAL_RESPONSE")?.orderedSourceFamilies.at(-1)).toBe("NIOSH_ERSH_LEGACY");
    expect(sourcePrecedenceForDomain("RADIONUCLIDE_PHYSICS")?.orderedSourceFamilies).toEqual(["NNDC_ENSDF"]);
  });

  it("isolates FBI and ATF facts to public coordination domains", () => {
    const fbiFacts = CBRNE_AUTHORITATIVE_SOURCE_FACTS.filter((fact) => fact.sourceFamily === "FBI_PUBLIC_WMD");
    const atfFacts = CBRNE_AUTHORITATIVE_SOURCE_FACTS.filter((fact) => fact.sourceFamily === "ATF_PUBLIC_EXPLOSIVES");
    expect(fbiFacts).toHaveLength(1);
    expect(fbiFacts[0]).toMatchObject({ identityNamespace: "FEDERAL_COORDINATION", domain: "FEDERAL_CRIMINAL_NEXUS", fieldGroup: "COORDINATION", factKind: "SOURCE_DERIVED_COORDINATION_GUIDANCE" });
    expect(atfFacts).toHaveLength(1);
    expect(atfFacts[0]).toMatchObject({ identityNamespace: "EXPLOSIVES_COORDINATION", domain: "EXPLOSIVE", fieldGroup: "COORDINATION", factKind: "SOURCE_DERIVED_COORDINATION_GUIDANCE" });
  });

  it("reports conflicting facts without overwriting either source value", () => {
    const base = CBRNE_AUTHORITATIVE_SOURCE_FACTS[0];
    const facts: AuthoritativeSourceFact[] = [
      { ...base, factId: "conflict-a", field: "Synthetic review field", value: 1, units: "unit" },
      { ...base, factId: "conflict-b", field: "Synthetic review field", value: 2, units: "unit" },
    ];
    expect(detectAuthoritativeFactConflicts(facts)).toEqual([expect.objectContaining({ factIds: ["conflict-a", "conflict-b"], values: [1, 2] })]);
    expect(facts.map((fact) => fact.value)).toEqual([1, 2]);
  });
});

describe("reconciliation, crosswalk quarantine, and runtime integration", () => {
  it("reconciles all 43 existing records explicitly", () => {
    expect(CBRNE_RECORD_RECONCILIATIONS).toHaveLength(43);
    expect(CBRNE_RECORD_RECONCILIATIONS.map((item) => item.canonicalRecordId).sort()).toEqual(CBRNE_MASTER_RECORDS.map((item) => item.id).sort());
    for (const item of CBRNE_RECORD_RECONCILIATIONS) {
      expect(item.authoritativeIdentitiesFound.length).toBeGreaterThan(0);
      expect(Array.isArray(item.factsImported)).toBe(true);
      expect(Array.isArray(item.factsRejected)).toBe(true);
      expect(Array.isArray(item.missingDomains)).toBe(true);
    }
  });

  it("quarantines all Chemical Companion operational data even when identity matches", () => {
    expect(CBRNE_CHEMICAL_COMPANION_CROSSWALKS).toHaveLength(51);
    const identityMatches = CBRNE_CHEMICAL_COMPANION_CROSSWALKS.filter((item) => item.identityStatus === "MATCHED_TO_AUTHORITY");
    expect(identityMatches.length).toBeGreaterThan(25);
    expect(identityMatches.every((item) => item.operationalDataStatus === "SOURCE_UNPROVEN")).toBe(true);
    expect(CBRNE_CHEMICAL_COMPANION_CROSSWALKS.find((item) => item.canonicalRecordId === "sarin-gb")).toMatchObject({ matchBasis: "CAS", companionIds: [96], identityStatus: "MATCHED_TO_AUTHORITY" });
    expect(CBRNE_CHEMICAL_COMPANION_CROSSWALKS.find((item) => item.canonicalRecordId === "ricin")).toMatchObject({ matchBasis: "TYPED_BIOLOGICAL_NAME", companionIds: [4], identityStatus: "MATCHED_TO_AUTHORITY" });
    expect(CBRNE_CHEMICAL_COMPANION_CROSSWALKS.filter((item) => item.identityNamespace === "RAD_NUCLEAR_SCENARIO").every((item) => item.operationalDataStatus === "NOT_APPLICABLE")).toBe(true);
  });

  it("exposes provenance and reviewed physics through the offline profile contract", () => {
    const anthrax = cbrneProfileById("CBRNE_CWA", "anthrax")!;
    expect(anthrax.authoritativeFacts.length).toBeGreaterThan(0);
    expect(anthrax.sourceStatus.factLevelProvenanceCount).toBe(anthrax.authoritativeFacts.length);
    expect(anthrax.sourceStatus.sourceArtifactIds).toContain("nrt-qrg-biological-anthrax");
    const cesium = cbrneProfileById("RADIOLOGICAL", "cesium-137")!;
    expect(cesium.radionuclidePhysics).toMatchObject({ canonicalNuclideId: "nuclide:cs-137", reviewStatus: "SOURCE_IMPORTED_PENDING_REVIEW" });
  });

  it("preserves exposure versus contamination and blocks physics-to-tactics inference", () => {
    const distinction = CBRNE_AUTHORITATIVE_SOURCE_FACTS.find((fact) => fact.factId === "cdc-radiation-exposure-contamination-distinction")!;
    expect(String(distinction.value)).toMatch(/exposure and radioactive contamination are distinct/i);
    const serializedPhysics = JSON.stringify(RADIONUCLIDE_PHYSICS_RECORDS);
    expect(serializedPhysics).not.toMatch(/standoffDistance|evacuationDistance|ppeLevel|shieldingThickness|medicalDose/i);
    expect(RADIONUCLIDE_PHYSICS_RECORDS.every((record) => record.limitations.some((item) => /Do not infer shielding, PPE, standoff/i.test(item)))).toBe(true);
  });

  it("tracks authoritative candidates without silently activating them", () => {
    expect(CBRNE_CANONICAL_RECORD_CANDIDATES).toHaveLength(12);
    expect(CBRNE_ADDITIONAL_CANONICAL_RECORDS).toHaveLength(8);
    expect(CBRNE_CANONICAL_RECORD_CANDIDATES.filter((item) => item.disposition === "CANONICAL_RECORD_CREATED")).toHaveLength(8);
    expect(CBRNE_CANONICAL_RECORD_CANDIDATES.every((item) => !CBRNE_MASTER_RECORDS.some((record) => record.id === item.candidateId))).toBe(true);
  });

  it("places every unavailable, blocked, or duplicate target into the manual queue", () => {
    const expected = CBRNE_SOURCE_ARTIFACTS.filter((artifact) => ["MANUAL_ACQUISITION_REQUIRED", "ACCESS_BLOCKED", "FAILED", "DUPLICATE"].includes(artifact.currentStatus));
    expect(CBRNE_MANUAL_ACQUISITION_QUEUE).toHaveLength(expected.length);
    expect(CBRNE_MANUAL_ACQUISITION_QUEUE.map((item) => item.sourceArtifactId).sort()).toEqual(expected.map((item) => item.sourceArtifactId).sort());
    for (const item of CBRNE_MANUAL_ACQUISITION_QUEUE) {
      expect(item.reasonAutomationFailed).toBeTruthy();
      expect(item.expectedData.length).toBeGreaterThan(0);
      expect(item.targetCanonicalRecords.length).toBeGreaterThan(0);
    }
  });

  it("stores no network dependency in normalized runtime modules", () => {
    const profileSource = readFileSync(resolve(repositoryRoot, "src/lib/cbrne/cbrneProfileAdapter.ts"), "utf8");
    const normalizedSource = readFileSync(resolve(repositoryRoot, "src/data/cbrne/authoritative/radionuclidePhysics.ts"), "utf8");
    expect(profileSource).not.toMatch(/\bfetch\s*\(/);
    expect(normalizedSource).not.toMatch(/\bfetch\s*\(/);
  });
});
