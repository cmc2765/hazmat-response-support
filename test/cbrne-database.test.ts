import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CBRNE_IMPORT_MANIFEST } from "../src/data/cbrne/cbrne-import-manifest.js";
import { CBRNE_MASTER_RECORDS } from "../src/data/cbrne/cbrne-master-records.js";
import { CBRNE_MANUAL_SOURCE_PACKS } from "../src/data/cbrne/cbrne-source-packs.js";
import { CBRNE_SOURCE_REGISTRY, CBRNE_SOURCE_REGISTRY_IDS, findCbrneSourceRegistryEntry } from "../src/data/cbrne/cbrne-source-registry.js";
import { BIOLOGICAL_SOURCE_HIERARCHY, CWA_SOURCE_HIERARCHY, RADIOLOGICAL_SOURCE_HIERARCHY } from "../src/data/cbrne/cbrne-source-hierarchy.js";
import { cbrneProfileById } from "../src/lib/cbrne/cbrneProfileAdapter.js";
import { containsBiologicalMisuseContent, isInverseSquareInputComplete } from "../src/lib/cbrne/cbrneSafetyGates.js";
import { hydrateCbrneDatabase } from "../src/lib/cbrne/hydrateCbrneDatabase.js";
import { searchCbrneRecords } from "../src/lib/cbrne/searchCbrneRecords.js";
import { stageCbrneImportPackage, validateCbrneImportPackage } from "../src/lib/cbrne/validateCbrneImport.js";
import type { CbrneImportPackage } from "../src/lib/cbrne/cbrneImportTypes.js";
import type { CbrneSourceFact } from "../src/lib/cbrne/cbrneTypes.js";

const chemicalSearchSource = readFileSync(new URL("../server/src/chemical-companion.ts", import.meta.url), "utf8");
const cbrneSearchSource = readFileSync(new URL("../src/lib/cbrne/searchCbrneRecords.ts", import.meta.url), "utf8");

const validPackage = (): CbrneImportPackage => ({
  packageId: "nrt-anthrax-review-1",
  packageName: "Anthrax responder fact staging",
  sourceRegistryId: "NRT_ANTHRAX_QRG",
  sourceName: "NRT Quick Reference Guide: Bacillus anthracis / Anthrax",
  sourceDocumentTitle: "NRT Quick Reference Guide: Bacillus anthracis (causes Anthrax)",
  sourceUrl: "https://nrt.response.epa.gov/sites/2/files/NRT%20CBRN%20BIO%20UPDATE%20Anthrax%20QRG_FINAL%202022%2002%2016.pdf",
  sourceDate: "2026-01-01",
  importedAt: "2026-08-25T00:00:00.000Z",
  importedBy: "Manual",
  reviewStatus: "Requires SME Review",
  records: [{
    displayName: "Anthrax",
    scientificName: "Bacillus anthracis",
    domain: "BIOLOGICAL",
    category: "BACTERIAL_AGENT",
    aliases: ["B. anthracis"],
    sourceFacts: [{
      sourceName: "NRT Quick Reference Guide: Bacillus anthracis / Anthrax",
      sourceDocumentTitle: "NRT Quick Reference Guide: Bacillus anthracis (causes Anthrax)",
      sourcePage: "Responder hazard summary",
      fieldGroup: "HAZARDS",
      fieldName: "Responder hazard summary",
      value: "Source-controlled responder summary",
      verificationStatus: "Verified",
    }],
  }],
});

describe("separate CBRNE master database", () => {
  it("keeps the CBRNE registry physically and logically separate from Chemical Companion", () => {
    expect(CBRNE_IMPORT_MANIFEST.chemicalCompanionShared).toBe(false);
    expect(CBRNE_IMPORT_MANIFEST.storageBoundary).toBe("src/data/cbrne");
    expect(CBRNE_MASTER_RECORDS).toHaveLength(43);
    expect(cbrneSearchSource).not.toContain("chemical-companion");
    expect(chemicalSearchSource).not.toContain("CBRNE_MASTER_RECORDS");
  });

  it("contains every requested source hierarchy with the required source limitations", () => {
    expect(CWA_SOURCE_HIERARCHY.slice(0, 3).map((tier) => tier.label)).toEqual(["NIOSH ERSH-DB", "NRT CBRN QRG", "CHEMM"]);
    expect(BIOLOGICAL_SOURCE_HIERARCHY.map((tier) => tier.label)).toContain("CDC biological/public health pages when added");
    expect(RADIOLOGICAL_SOURCE_HIERARCHY.slice(0, 3).map((tier) => tier.label)).toEqual(["REMM", "EPA PAG", "IAEA first responder/radiological emergency guidance"]);
  });

  it("registers all 25 approved sources with unique IDs, HTTPS URLs, field mappings, and restrictions", () => {
    expect(CBRNE_SOURCE_REGISTRY).toHaveLength(25);
    expect(CBRNE_SOURCE_REGISTRY.map((source) => source.id)).toEqual(CBRNE_SOURCE_REGISTRY_IDS);
    expect(new Set(CBRNE_SOURCE_REGISTRY.map((source) => source.id)).size).toBe(25);
    for (const source of CBRNE_SOURCE_REGISTRY) {
      expect(source.baseUrl).toMatch(/^https:\/\//);
      expect(source.profileFieldGroups.length).toBeGreaterThan(0);
      expect(source.restrictedUse.length).toBeGreaterThan(0);
    }
  });

  it("keeps every automatic pack aligned with its exact registry name and allowed fields", () => {
    for (const pack of CBRNE_MANUAL_SOURCE_PACKS) {
      const source = findCbrneSourceRegistryEntry(pack.sourceRegistryId);
      expect(source).not.toBeNull();
      expect(pack.sourceName).toBe(source?.name);
      expect(pack.sourceUrl).toMatch(/^https:\/\//);
      for (const fact of pack.records.flatMap((record) => record.sourceFacts)) {
        expect(source?.profileFieldGroups).toContain(fact.fieldGroup);
      }
    }
  });
});

describe("CBRNE search and hydrated fail-closed profiles", () => {
  it("searches Anthrax by common, scientific, abbreviated, and category aliases", () => {
    for (const query of ["Anthrax", "Bacillus anthracis", "B. anthracis", "Biological agent", "Bacterial agent"]) {
      const result = searchCbrneRecords(query, { lane: "CBRNE_CWA" })[0];
      expect(result).toMatchObject({ id: "anthrax", displayName: "Anthrax", scientificName: "Bacillus anthracis", domain: "BIOLOGICAL" });
    }
  });

  it("searches CWA names/codes and radiological names/symbols in the correct lanes", () => {
    expect(searchCbrneRecords("VX", { lane: "CBRNE_CWA" })[0]?.id).toBe("vx");
    expect(searchCbrneRecords("GB", { lane: "CBRNE_CWA" })[0]?.id).toBe("sarin-gb");
    expect(searchCbrneRecords("Cs-137", { lane: "RADIOLOGICAL" })[0]?.id).toBe("cesium-137");
    expect(searchCbrneRecords("Dirty Bomb", { lane: "RADIOLOGICAL" })[0]?.id).toBe("radiological-dispersal-device");
    expect(searchCbrneRecords("Anthrax", { lane: "RADIOLOGICAL" })).toEqual([]);
  });

  it("hydrates Anthrax with source-backed sections and biological action cards", () => {
    const profile = cbrneProfileById("CBRNE_CWA", "anthrax");
    expect(profile).toMatchObject({ displayName: "Anthrax", scientificName: "Bacillus anthracis", domain: "BIOLOGICAL", verificationStatus: "Requires SME Review" });
    for (const facts of [profile?.overviewFacts, profile?.hazardFacts, profile?.detectionFacts, profile?.ppeFacts, profile?.isolationStandoffFacts, profile?.deconFacts, profile?.medicalFacts, profile?.technicalOperationsFacts, profile?.sourceFacts]) {
      expect(facts?.some((fact) => fact.value !== null)).toBe(true);
    }
    expect(profile?.actionCards.map((card) => card.title)).toContain("Identify / Verify Biological Threat");
    expect(profile?.actionCards.some((card) => card.status === "Requires SME Review")).toBe(true);
    const tacticalFacts = [profile?.overviewFacts, profile?.hazardFacts, profile?.detectionFacts, profile?.ppeFacts, profile?.isolationStandoffFacts, profile?.deconFacts, profile?.medicalFacts, profile?.technicalOperationsFacts].flat();
    expect(containsBiologicalMisuseContent(tacticalFacts)).toBe(false);
  });

  it("keeps Sarin operational content visible while retaining review and provenance metadata", () => {
    const profile = cbrneProfileById("CBRNE_CWA", "sarin-gb");
    expect(profile?.identifiers).toMatchObject({ agentCodes: ["GB"], cas: ["107-44-8"], unNaNumbers: ["2810"] });
    expect(profile?.identifiers.opcwSchedule).toContain("Schedule 1");
    const operationalFacts = [profile?.overviewFacts, profile?.hazardFacts, profile?.detectionFacts, profile?.deconFacts, profile?.medicalFacts].flat();
    expect(operationalFacts.some((fact) => String(fact?.value).includes("nerve-agent"))).toBe(true);
    expect(operationalFacts.some((fact) => fact?.fieldName === "Cholinergic toxidrome indicators")).toBe(true);
    expect(profile?.actionCards.some((card) => card.summary.includes("Review "))).toBe(false);
    expect(profile?.actionCards.some((card) => card.status === "Requires SME Review")).toBe(true);
    expect(profile?.sourceFacts.every((fact) => fact.sourceUrl && fact.sourceDocumentTitle)).toBe(true);
  });

  it("uses sourced radiological frameworks without inventing distance, dose-rate, shielding, or plume values", () => {
    const profile = cbrneProfileById("RADIOLOGICAL", "cesium-137");
    expect(profile?.isolationStandoffFacts[0]).toMatchObject({ verificationStatus: "Requires SME Review" });
    expect(profile?.ppeFacts[0]).toMatchObject({ verificationStatus: "Requires SME Review" });
    const tacticalText = [profile?.hazardFacts, profile?.isolationStandoffFacts, profile?.ppeFacts].flat().map((fact) => fact?.value).join(" ");
    expect(tacticalText).not.toMatch(/\b\d+(?:\.\d+)?\s*(?:ft|feet|m|meter|km|mile|mi|mrem|rem|mSv|Sv)\b/i);
    expect(tacticalText).toContain("does not shield");
    expect(isInverseSquareInputComplete({ measuredDoseRate: 2, measuredDistance: null, pointSourceAssumption: true })).toBe(false);
    expect(isInverseSquareInputComplete({ measuredDoseRate: 2, measuredDistance: 1, pointSourceAssumption: true })).toBe(true);
  });

  it("hydrates priority records from valid automatic local source packs", () => {
    const database = hydrateCbrneDatabase();
    expect(database.records.length).toBeGreaterThan(0);
    expect(database.sourceFacts.length).toBeGreaterThan(0);
    expect(database.importReports.every((report) => report.valid)).toBe(true);
    for (const id of ["anthrax", "vx", "sarin-gb", "sulfur-mustard-hd", "ricin", "cesium-137", "cobalt-60", "iridium-192", "radiological-dispersal-device"]) {
      expect(database.sourceFacts.some((fact) => fact.recordId === id && fact.value !== null)).toBe(true);
    }
    expect(database.sourceFacts.every((fact) => fact.sourceRegistryId && fact.sourceName && fact.sourceDocumentTitle && fact.sourceUrl && (fact.sourcePage || fact.notes))).toBe(true);
    for (const fact of database.sourceFacts) {
      const source = findCbrneSourceRegistryEntry(fact.sourceRegistryId);
      expect(fact.sourceName).toBe(source?.name);
      expect(source?.profileFieldGroups).toContain(fact.fieldGroup);
    }
    expect(database.sourceFacts.filter((fact) => !["IDENTITY", "SOURCES", "LIMITATIONS"].includes(fact.fieldGroup)).every((fact) => fact.verificationStatus !== "Verified")).toBe(true);
  });

  it("hydrates Sulfur Mustard and Ricin while keeping an unsupported profile fail closed", () => {
    for (const id of ["sulfur-mustard-hd", "ricin"]) {
      const profile = cbrneProfileById("CBRNE_CWA", id);
      for (const facts of [profile?.overviewFacts, profile?.hazardFacts, profile?.detectionFacts, profile?.ppeFacts, profile?.isolationStandoffFacts, profile?.deconFacts, profile?.medicalFacts, profile?.technicalOperationsFacts]) {
        expect(facts?.some((fact) => fact.value !== null)).toBe(true);
      }
    }
    const unsupported = cbrneProfileById("CBRNE_CWA", "botulinum-toxin");
    for (const facts of [unsupported?.ppeFacts, unsupported?.isolationStandoffFacts, unsupported?.deconFacts, unsupported?.medicalFacts]) {
      expect(facts?.[0]).toMatchObject({ value: null, verificationStatus: "No Current Data Exists" });
    }
  });

  it("keeps biological imports free of misuse-enabling content", () => {
    const biologicalValues = hydrateCbrneDatabase().sourceFacts
      .filter((fact) => ["anthrax", "ricin"].includes(fact.recordId))
      .map((fact) => String(fact.value ?? ""));
    expect(biologicalValues.join(" ")).not.toMatch(/\b(?:production|culture|growth|aerosolization|dispersal|weaponization|delivery|release methods?)\b/i);
  });
});

describe("CBRNE local import staging", () => {
  it("rejects incomplete metadata, missing fact sources/documents, and unsafe nulls", () => {
    const packageData = validPackage() as unknown as Record<string, unknown>;
    packageData.packageName = "";
    const record = (packageData.records as Array<Record<string, unknown>>)[0];
    const fact = (record.sourceFacts as Array<Record<string, unknown>>)[0];
    fact.sourceName = "";
    fact.sourceDocumentTitle = "";
    fact.value = null;
    fact.verificationStatus = "Requires SME Review";
    const result = validateCbrneImportPackage(packageData);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/packageName|sourceName|sourceDocumentTitle|null value/);
  });

  it("never auto-verifies imported tactical facts", () => {
    const result = validateCbrneImportPackage(validPackage());
    expect(result.valid).toBe(true);
    expect(result.warnings.join(" ")).toContain("never auto-verified");
    const staged = stageCbrneImportPackage(validPackage());
    expect(staged.valid).toBe(true);
    expect(staged.records[0]).toMatchObject({ matchType: "existing", record: { id: "anthrax" } });
    expect(staged.records[0].importedFacts[0].verificationStatus).toBe("Requires SME Review");
  });

  it("derives a missing sourceName and accepts normalized registry-name whitespace", () => {
    const missingName = validPackage();
    delete missingName.sourceName;
    const derived = validateCbrneImportPackage(missingName);
    expect(derived.valid).toBe(true);
    expect(derived.normalizedPackage?.sourceName).toBe("NRT Quick Reference Guide: Bacillus anthracis / Anthrax");

    const spacedName = validPackage() as unknown as Record<string, unknown>;
    spacedName.sourceName = "  NRT Quick Reference Guide:   Bacillus anthracis / Anthrax  ";
    const normalized = validateCbrneImportPackage(spacedName);
    expect(normalized.valid).toBe(true);
    expect(normalized.normalizedPackage?.sourceName).toBe("NRT Quick Reference Guide: Bacillus anthracis / Anthrax");
  });

  it("rejects a human source name used as sourceRegistryId and incomplete tactical provenance", () => {
    const badId = validPackage() as unknown as Record<string, unknown>;
    badId.sourceRegistryId = "NRT Quick Reference Guide: Bacillus anthracis / Anthrax";
    expect(validateCbrneImportPackage(badId).errors.join(" ")).toContain("sourceRegistryId must identify");

    for (const missing of ["sourceUrl", "sourceDocumentTitle", "sourcePage"] as const) {
      const incomplete = validPackage() as unknown as Record<string, unknown>;
      const facts = (incomplete.records as Array<{ sourceFacts: Array<Record<string, unknown>> }>)[0].sourceFacts;
      if (missing === "sourcePage") delete facts[0].sourcePage;
      else delete incomplete[missing];
      expect(validateCbrneImportPackage(incomplete).valid).toBe(false);
    }
  });

  it("keeps REMM PPE, survey, and decon facts in page-specific packs", () => {
    const expectations = [
      ["remm-radiation-ppe", "REMM_RADIATION_PPE", ["HAZARDS", "PPE"]],
      ["remm-radiation-survey", "REMM_SURVEY", ["RADIOLOGICAL_SURVEY", "TECHNICAL_OPERATIONS"]],
      ["remm-external-contamination-decon", "REMM_DECON", ["DECON", "MEDICAL"]],
    ] as const;
    for (const [packageId, sourceRegistryId, groups] of expectations) {
      const pack = CBRNE_MANUAL_SOURCE_PACKS.find((candidate) => candidate.packageId === packageId);
      expect(pack?.sourceRegistryId).toBe(sourceRegistryId);
      expect(new Set(pack?.records.flatMap((record) => record.sourceFacts.map((fact) => fact.fieldGroup)))).toEqual(new Set(groups));
    }
  });

  it("rejects registry-name drift and facts outside a source's approved field mapping", () => {
    const wrongName = validPackage();
    wrongName.sourceName = "CHEMM Nerve Agents";
    expect(validateCbrneImportPackage(wrongName).errors.join(" ")).toContain("match the approved registry entry name");

    const wrongField = validPackage();
    wrongField.sourceRegistryId = "OPCW_SCHEDULE_1";
    wrongField.sourceName = "OPCW Schedule 1 Chemicals";
    wrongField.sourceDocumentTitle = "OPCW Schedule 1";
    wrongField.sourceUrl = "https://www.opcw.org/chemical-weapons-convention/annexes/annex-chemicals/schedule-1";
    wrongField.records[0].sourceFacts[0].sourceName = "OPCW Schedule 1 Chemicals";
    wrongField.records[0].sourceFacts[0].fieldGroup = "PPE";
    expect(validateCbrneImportPackage(wrongField).errors.join(" ")).toContain("not approved for OPCW_SCHEDULE_1");
  });

  it("flags conflicts and does not overwrite an existing verified fact", () => {
    const existingFact: CbrneSourceFact = {
      id: "existing-verified-fact",
      recordId: "anthrax",
      sourceRegistryId: "NRT_ANTHRAX_QRG",
      sourceName: "NRT Quick Reference Guide: Bacillus anthracis / Anthrax",
      sourceDocumentTitle: "Reviewed reference",
      fieldGroup: "HAZARDS",
      fieldName: "Responder hazard summary",
      value: "Previously reviewed value",
      verificationStatus: "Verified",
    };
    const staged = stageCbrneImportPackage(validPackage(), CBRNE_MASTER_RECORDS, [existingFact]);
    expect(staged.records[0].conflicts).toHaveLength(1);
    expect(staged.records[0].importedFacts[0].verificationStatus).toBe("Conflicting Sources");
    expect(existingFact).toMatchObject({ value: "Previously reviewed value", verificationStatus: "Verified" });
  });
});
