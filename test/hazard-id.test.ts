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
  it("locks Hazard ID to the shared hero height and readable tactical title face", () => {
    const finalHeroLock = styles.slice(styles.indexOf("/* Final-loaded program hero lock."));
    expect(finalHeroLock).toContain('--hazmatiq-font-page-title: "DejaVu Sans Mono"');
    expect(finalHeroLock).toContain("--hazmatiq-internal-hero-height: 178px;");
    expect(finalHeroLock).toContain("#lookup.view.active:has(> #hazard-id-search-hero):not(.hazard-profile-open)");
    expect(finalHeroLock).toContain("grid-template-rows: var(--hazmatiq-internal-hero-height) minmax(0, 1fr) !important;");
    expect(finalHeroLock).toContain("#hazard-id-search-hero.hazard-id-page-hero");
    expect(finalHeroLock).toContain("max-height: var(--hazmatiq-internal-hero-height) !important;");
  });

  it("renders one search input with three tactical database tabs", () => {
    expect(html.match(/data-hazard-search-tab=/g)).toHaveLength(3);
    expect(html.match(/type="search"/g)?.length).toBeGreaterThan(0);
    for (const title of [">Chemical</button>", ">CBRNE / CWA</button>", ">Radiological</button>"]) expect(html).toContain(title);
    expect(html).not.toContain("chemical-search-assurance-grid");
    expect(html).not.toContain("chemical-search-trust-grid");
    expect(html).toContain('<h1 class="hazmat-hero-title">HAZARD ID</h1>');
    expect(html).toContain('class="hazard-id-hero-logo"');
    expect(html).not.toContain("HAZARD ID SEARCH");
    for (const action of ["Search.", "Identify.", "Verify.", "Respond."]) expect(html).toContain(`<span>${action}</span>`);
    expect(html).not.toContain("Unified Responder Intelligence");
    expect(html).not.toContain("ONE Database — ONE Command.");
    expect(html).not.toContain("hazard-workflow-rail");
    expect(html).not.toContain('hazmat-hero-symbol hazmat-hero-diamond');
    expect(script).toContain("Search isotope, radioactive material, package type, RDD, or radiological type.");
    expect(html).not.toContain('id="hazard-id-empty-profile"');
    expect(html).not.toContain("Unified Hazard Profile");
  });

  it("keeps Chemical Companion controls and safely gates non-chemical plume actions", () => {
    expect(html).toContain('id="chemical-search-form"');
    expect(html).toContain('id="chemical-id-results"');
  expect(html).toContain('script.js?v=plume-command-workspace-46');
    expect(html).toContain('id="open-plume-btn"');
    expect(html).toContain('id="hazard-profile-plume-btn" type="button" disabled');
    expect(script).toContain("Plume requires verified endpoint/source data.");
    expect(script).toContain("Radiological plume/standoff requires radiological model support.");
    for (const tab of ["Overview", "Properties", "Exposures", "PPE & Monitoring", "Response", "Medical", "Decon", "Sources"]) {
      expect(script).toContain(`['${tab}'`);
    }
    for (const tab of ["Hazards", "Detection", "PPE / Respiratory", "Isolation / Standoff", "Tech Ops", "Radiation Hazards", "Detection / Survey", "PPE / Contamination"]) {
      expect(script).toContain(`['${tab}'`);
    }
    expect(html).toContain('id="hazard-profile-overview-list"');
    expect(script).toContain("['Hazard Class', hazardClassDisplayLines(profile?.header?.hazardClass || profile?.header?.hazard || noCurrentDataText)]");
    expect(script).toContain('idlh: isAvailableGuidance(profileIdlh) ? profileIdlh : (record.commandFacts?.idlh || null)');
    expect(script).toContain("if (chemicalIdResults) chemicalIdResults.hidden = false;\n  try {\n    updateChemicalCard(combinedRecord);");
    expect(script).toContain("const renderActiveTab = (activeKey) => {");
    expect(script).toContain("button.addEventListener('click', () => {\n      renderActiveTab(key);");
    expect(script).not.toContain("renderChemicalProfile({ ...profile, activeTab: key })");
    expect(script.indexOf("tabs.replaceChildren();")).toBeLessThan(script.indexOf("renderNfpa704Placard(profile?.header?.nfpa704"));
    expect(script).toContain("Chemical profile section rendering failed.");
    expect(script).toContain("updateChemicalCard({ profile: chemicalSearchPreviewProfile(chemical) });");
    expect(script).toContain("renderStarterHazardTab(profile, defaultFieldNames);");
    expect(script).toContain("content.dataset.activeTab = button.dataset.tab;");
    expect(html).not.toContain('id="hazard-profile-action-cards"');
    expect(html).not.toContain('id="hazard-profile-limitations"');
    expect(html).toContain('class="hazard-profile-content hazard-profile-tab-content hazard-profile-card-grid"');
    expect(script).toContain("card.className = 'hazard-source-fact-card hazard-profile-card';");
    expect(script).toContain('resolvedChemicalIdlh(profile)');
    expect(script).toContain('profile?.exposures?.idlh,');
    expect(script).toContain('profile?.header?.idlh,');
    expect(script).toContain("/^IDLH(?:Ppm)?\\s*:/i");
    expect(script).toContain("content.replaceChildren(fragment);");
    expect(script).not.toContain("createChemicalProfileSourceSummary");
    expect(html.match(/class="confidence-meter" role="meter"/g)).toHaveLength(2);
    expect(script).toContain("const filledSegments = { high: 6, medium: 4, low: 2 }[level];");
    expect(styles).toContain('.confidence-meter[data-level="medium"] > i:nth-child(-n + 4)');
    expect(styles).toContain("grid-template-columns: minmax(350px, 42%) minmax(0, 58%) !important;");
    expect(styles).toContain("grid-row: 1 / span 2 !important;");
    expect(styles).toContain('grid-template-rows: minmax(290px, 44%) minmax(0, 56%) !important;');
    expect(styles).toMatch(/#lookup \.hazard-search-tab\[aria-selected="true"\] \{[\s\S]*?background: #f6c343 !important;/);
    expect(styles).toMatch(/#lookup #open-plume-btn \{[\s\S]*?order: 20;[\s\S]*?margin-left: auto;/);
    expect(styles).toMatch(/#chemical-id-results #open-plume-btn,[\s\S]*?background: linear-gradient\(180deg, #d72734, #a90e19\) !important;/);
    expect(styles).toMatch(/\/\* Final chemical profile geometry override\. \*\/[\s\S]*?#chemical-id-results \.chemical-nfpa-placard \{[\s\S]*?grid-area: placard !important;[\s\S]*?position: static !important;/);
    expect(styles).toMatch(/#chemical-id-results \.chemical-profile-tabs \{[\s\S]*?display: grid !important;[\s\S]*?visibility: visible !important;/);
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

  it("keeps the Hazard ID shell fluid from desktop through tablet widths", () => {
    expect(html).toContain('styles.css?v=plume-command-workspace-140');
    expect(html).toContain('chemical-intel.css?v=guided-response-visible-48');
    expect(styles).toContain("/* Hazard ID responsive workspace repair.");
    expect(styles).toMatch(/@media screen \{[\s\S]*?html \{[\s\S]*?background-color: #020b14;[\s\S]*?body \{[\s\S]*?background-attachment: fixed;/);
    expect(styles).toMatch(/\.app-shell:has\(#lookup\.view\.active\) \{[\s\S]*?min-height: 100vh;[\s\S]*?background:[\s\S]*?linear-gradient\(135deg, #020b14 0%, #061a2e 42%, #0b1f33 100%\);/);
    expect(styles).toMatch(/#lookup\.view\.active \{[\s\S]*?width: min\(100%, 1920px\);[\s\S]*?overflow-x: hidden;/);
    const naturalFlowStyles = styles.slice(styles.indexOf("/* Chemical Profile natural-flow contract."));
    expect(naturalFlowStyles).toMatch(/#lookup\.view\.active:has\(#chemical-id-results:not\(\[hidden\]\)\) \{[\s\S]*?grid-template-rows: auto auto !important;[\s\S]*?height: auto !important;[\s\S]*?overflow-y: visible !important;/);
    expect(naturalFlowStyles).toMatch(/#chemical-id-results \.chemical-profile-layout,[\s\S]*?#chemical-id-results \.chemical-profile-content \{[\s\S]*?height: auto !important;[\s\S]*?max-height: none !important;[\s\S]*?overflow-y: visible !important;[\s\S]*?position: relative;/);
    expect(naturalFlowStyles).toMatch(/\.chemical-profile-shell \{[\s\S]*?grid-template-rows: auto auto auto auto !important;[\s\S]*?gap: 6px;/);
    expect(naturalFlowStyles).not.toContain("overflow-y: auto");
    expect(styles).toMatch(/Populated-result state:[\s\S]*?#lookup\.view\.active:has\(#chemical-id-results:not\(\[hidden\]\)\)[\s\S]*?display: grid !important;[\s\S]*?background: transparent !important;/);
    expect(styles).toContain("column-gap: clamp(6px, 0.55vw, 10px) !important;");
    expect(styles).toMatch(/#chemical-id-results \.chemical-profile-content,[\s\S]*?grid-template-columns: repeat\(12, minmax\(0, 1fr\)\) !important;/);
  });

  it("uses mutually exclusive full-width search and profile states", () => {
    expect(html).toContain('id="hazard-id-search-hero"');
    expect(html).toContain('id="hazard-id-search-workspace"');
    expect(script).toContain("hazardSearchHero.hidden = !searchState");
    expect(script).toContain("hazardSearchWorkspace.hidden = !searchState");
    expect(script).toContain("data-hazard-page-state");
    expect(script).toContain("window.history.pushState({ ...window.history.state, hazardPageState: 'profile' }");
    expect(script).toContain("window.addEventListener('popstate'");
    expect(styles).toContain("/* Hazard ID page-state contract.");
    expect(styles.lastIndexOf("Definitive populated-profile geometry")).toBeGreaterThan(styles.lastIndexOf("Profile containment invariant"));
    expect(script).toContain("surface.style.setProperty('display', 'none', 'important')");
    expect(script).toContain("lookup?.classList.toggle('hazard-profile-open', !searchState)");
    expect(script).toContain("applyImportantStyles(lookup, fullWidthProfileStyles)");
    expect(script).toContain("applyImportantStyles(profileSurface, fullWidthSurfaceStyles)");
    expect(script).toContain("'grid-column': '1 / -1'");
    expect(styles).toMatch(/#lookup\.view\.active\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) !important;/s);
    expect(styles).toMatch(/#lookup\.view\.active\[data-hazard-page-state="single-profile"\]\s*\{[^}]*display: block !important;[^}]*width: 100% !important;/s);
  });

  it("moves cleanly from Chemical Profile to Plume Model and restores the profile", () => {
    expect(html).toContain('id="plume-back-to-profile-btn" type="button" hidden>← Back to Chemical Profile</button>');
    expect(script).toContain("if (active) view.style.removeProperty('display');");
    expect(script).toContain("else view.style.setProperty('display', 'none', 'important');");
    expect(script).toContain("const launchedFromChemicalProfile = document.getElementById('lookup')?.classList.contains('active')");
    expect(script).toContain("if (profileReturnButton) profileReturnButton.hidden = !launchedFromChemicalProfile");
    expect(script).toContain("function returnToChemicalProfileFromPlume()");
    expect(script).toContain("setHazardProfileMode('chemical', { writeHistory: false })");
    expect(script).toContain("document.getElementById('plume-back-to-profile-btn')?.addEventListener('click', returnToChemicalProfileFromPlume)");
    expect(styles).toMatch(/#plume \.plume-profile-return \{[\s\S]*?position: absolute;[\s\S]*?right: clamp/);
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
