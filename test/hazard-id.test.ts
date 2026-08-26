import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { searchStarterHazards } from "../src/lib/hazard-id/hazardSearch.js";
import { starterHazardProfile } from "../src/lib/hazard-id/hazardProfileAdapter.js";

const html = readFileSync(new URL("../server/public/index.html", import.meta.url), "utf8");
const styles = [
  readFileSync(new URL("../server/public/styles.css", import.meta.url), "utf8"),
  readFileSync(new URL("../server/public/chemical-intel.css", import.meta.url), "utf8"),
].join("\n");
const script = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");

describe("unified Hazard ID workspace", () => {
  it("renders one search input with three tactical database tabs", () => {
    expect(html.match(/data-hazard-search-tab=/g)).toHaveLength(3);
    expect(html.match(/type="search"/g)?.length).toBeGreaterThan(0);
    for (const title of [">Chemical</button>", ">CBRNE / CWA</button>", ">Radiological</button>"]) expect(html).toContain(title);
    expect(html).not.toContain("chemical-search-assurance-grid");
    expect(html).not.toContain("chemical-search-trust-grid");
    expect(html).toContain('<h1 class="hazmat-hero-title">HAZARD ID</h1>');
    expect(html).not.toContain("HAZARD ID SEARCH");
    for (const action of ["Search.", "Identify.", "Verify.", "Respond."]) expect(html).toContain(`<span>${action}</span>`);
    expect(html).not.toContain("Unified Responder Intelligence");
    expect(html).not.toContain("ONE Database — ONE Command.");
    expect(html).not.toContain('hazmat-hero-symbol hazmat-hero-diamond');
    expect(script).toContain("Search isotope, radioactive material, package type, RDD, or radiological type.");
    expect(html).toContain('<p class="eyebrow">HAZARD PROFILE</p>');
    expect(html).not.toContain("Unified Hazard Profile");
  });

  it("keeps Chemical Companion controls and safely gates non-chemical plume actions", () => {
    expect(html).toContain('id="chemical-search-form"');
    expect(html).toContain('id="chemical-id-results"');
    expect(html).toContain('id="open-plume-btn"');
    expect(html).toContain('id="hazard-profile-plume-btn" type="button" disabled');
    expect(script).toContain("Plume requires verified endpoint/source data.");
    expect(script).toContain("Radiological plume/standoff requires radiological model support.");
  });

  it("uses the attached dashboard visual language", () => {
    expect(styles).toContain("/* Hazard ID command console — cinematic single-search workspace. */");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr) !important;");
    expect(styles).toContain("min-height: clamp(140px, 13vw, 180px) !important;");
    expect(styles).toContain("hazardBlueprintDrift 40s linear infinite");
    expect(styles).toMatch(/\.hazard-id-page-hero \.hazmat-hero-subtitle \{[\s\S]*?display: flex;[\s\S]*?justify-content: space-between;[\s\S]*?width: min\(100%, 520px\);/);
    expect(styles).toContain("min-height: 0 !important;");
    expect(styles).toContain('font-family: Impact, "Agency FB", "DIN Condensed"');
    expect(styles).toContain("#lookup > .hazard-id-page-hero::after {");
    expect(styles).toContain("transform: skewX(-5deg) scaleX(0.95);");
    expect(styles).toMatch(/\.hazard-unified-search-form #chemical-search \{[\s\S]*?background: #f1f5f9;[\s\S]*?color: #071f36;/);
    expect(styles).toContain(".hazard-unified-search-form .chemical-search-input-wrap::before,");
    expect(styles).toMatch(/\.hazard-unified-search-form \.chemical-search-input-wrap::after \{[\s\S]*?content: none;[\s\S]*?display: none;/);
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});

describe("source-governed starter adapters", () => {
  it("supports CWA name and agent-code aliases", () => {
    expect(searchStarterHazards("CBRNE_CWA", "GB")[0]?.displayName).toBe("Sarin");
    expect(searchStarterHazards("CBRNE_CWA", "HD")[0]?.displayName).toBe("Sulfur Mustard");
    expect(searchStarterHazards("CBRNE_CWA", "VX")[0]?.displayName).toBe("VX");
  });

  it("supports radiological names, symbols, and incident aliases", () => {
    expect(searchStarterHazards("RADIOLOGICAL", "Cs-137")[0]?.displayName).toBe("Cesium-137");
    expect(searchStarterHazards("RADIOLOGICAL", "Cobalt-60")[0]?.radionuclideSymbol).toBe("Co-60");
    expect(searchStarterHazards("RADIOLOGICAL", "Dirty Bomb")[0]?.displayName).toBe("Radiological Dispersal Device");
  });

  it("hydrates priority profiles while preserving review gates", () => {
    const completeProfiles = [
      ["CBRNE_CWA", "anthrax"],
      ["CBRNE_CWA", "vx"],
      ["CBRNE_CWA", "sarin-gb"],
      ["CBRNE_CWA", "sulfur-mustard-hd"],
      ["CBRNE_CWA", "ricin"],
      ["RADIOLOGICAL", "cesium-137"],
      ["RADIOLOGICAL", "cobalt-60"],
      ["RADIOLOGICAL", "iridium-192"],
    ] as const;
    for (const [lane, id] of completeProfiles) {
      const profile = starterHazardProfile(lane, id);
      expect(profile?.verificationStatus).toBe("Requires SME Review");
      for (const facts of [profile?.overviewFacts, profile?.hazardFacts, profile?.detectionFacts, profile?.ppeFacts, profile?.isolationStandoffFacts, profile?.medicalFacts, profile?.deconFacts, profile?.technicalOperationsFacts]) {
        expect(facts?.some((fact) => fact.value !== null)).toBe(true);
        expect(facts?.filter((fact) => fact.value !== null).every((fact) => fact.verificationStatus !== "Verified")).toBe(true);
      }
    }

    const rdd = starterHazardProfile("RADIOLOGICAL", "radiological-dispersal-device");
    expect(rdd?.overviewFacts[0]).toMatchObject({ value: null, verificationStatus: "No Current Data Exists" });
    for (const facts of [rdd?.hazardFacts, rdd?.detectionFacts, rdd?.ppeFacts, rdd?.isolationStandoffFacts, rdd?.medicalFacts, rdd?.deconFacts, rdd?.technicalOperationsFacts]) {
      expect(facts?.some((fact) => fact.value !== null)).toBe(true);
      expect(facts?.filter((fact) => fact.value !== null).every((fact) => fact.verificationStatus !== "Verified")).toBe(true);
    }
  });

  it("renders the complete source-status footer and counts actual packs per record", () => {
    expect(html).toContain('id="hazard-profile-conflict-count"');
    expect(script).toContain("sourceStatus.conflictingSourcesCount");
    expect(starterHazardProfile("CBRNE_CWA", "anthrax")?.sourceStatus).toMatchObject({
      sourcePacksLoaded: 1,
      conflictingSourcesCount: 0,
      missingFieldCount: 0,
    });
    expect(starterHazardProfile("CBRNE_CWA", "vx")?.sourceStatus?.sourcePacksLoaded).toBe(3);
    expect(starterHazardProfile("RADIOLOGICAL", "cesium-137")?.sourceStatus?.sourcePacksLoaded).toBe(5);
  });
});
