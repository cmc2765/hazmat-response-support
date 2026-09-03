import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CHEMICAL_PROFILE_EMPTY_STATE,
  formatFirstAidGuidance,
  groupAeglByTimeframe,
  mergeBrokenGuidanceFragments,
  normalizeChemicalProfileText,
  normalizeEmptyState,
  normalizeGuidanceItems,
  normalizeHeading,
  normalizeSourceLabel,
  removeContradictoryEmptyStates,
} from "../src/utils/normalizeChemicalProfileText.js";

const html = readFileSync(new URL("../server/public/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");
const styles = [
  readFileSync(new URL("../server/public/styles.css", import.meta.url), "utf8"),
  readFileSync(new URL("../server/public/chemical-intel.css", import.meta.url), "utf8"),
].join("\n");

describe("Chemical Profile text normalization", () => {
  it("groups AEGL durations into four profile bands using the lowest concentration per level", () => {
    expect(groupAeglByTimeframe([
      "AEGL1_10min: 0.5 ppm",
      "AEGL1_30min: 0.4 ppm",
      "AEGL1_60min: 0.35 ppm",
      "AEGL1_4hr: 0.2 ppm",
      "AEGL1_8hr: 0.1 ppm",
      "AEGL1_12hr: 0.08 ppm",
      "AEGL2_60min: 2 ppm",
      "AEGL2_4hr: 1 ppm",
    ])).toEqual([
      { label: "< 1 Hour", value: "AEGL-1: 0.4 ppm · AEGL-2: No Current Data Exists · AEGL-3: No Current Data Exists" },
      { label: "1-4 Hours", value: "AEGL-1: 0.2 ppm · AEGL-2: 1 ppm · AEGL-3: No Current Data Exists" },
      { label: "4-8 Hours", value: "AEGL-1: 0.1 ppm · AEGL-2: No Current Data Exists · AEGL-3: No Current Data Exists" },
      { label: "8-12 Hours", value: "AEGL-1: 0.08 ppm · AEGL-2: No Current Data Exists · AEGL-3: No Current Data Exists" },
    ]);
  });

  it("removes markdown and normalizes headings without changing identifiers or values", () => {
    expect(normalizeChemicalProfileText(" **UN 1017 · IDLH 10 ppm** ")).toBe("UN 1017 · IDLH 10 ppm");
    expect(normalizeHeading("## EMS Considerations:")).toBe("EMS Considerations");
    expect(normalizeSourceLabel("Chemical Companion Master")).toBe("Chemical Companion");
  });

  it("removes malformed quote-and-period endings from imported guidance", () => {
    expect(normalizeChemicalProfileText('Decontamination is recommended.".')).toBe(
      "Decontamination is recommended.",
    );
  });

  it("removes a contradictory None placeholder when real EMS guidance exists", () => {
    expect(removeContradictoryEmptyStates(["None", "Remove from hazardous area"])).toEqual([
      "Remove from hazardous area",
    ]);
    expect(normalizeEmptyState("N/A")).toBe(CHEMICAL_PROFILE_EMPTY_STATE);
    expect(normalizeGuidanceItems(["None", "N/A", "Not available"])).toEqual([
      CHEMICAL_PROFILE_EMPTY_STATE,
    ]);
  });

  it("merges safe continuations and removes a duplicate decontaminate fragment", () => {
    expect(mergeBrokenGuidanceFragments([
      "Remove from hazardous area",
      "decontaminate with enhanced ventilation or water",
      "and treat symptomatically.",
      "decontaminate",
    ])).toEqual([
      "Remove from hazardous area.",
      "Decontaminate with enhanced ventilation or water and treat symptomatically.",
    ]);
  });

  it("does not merge numeric thresholds, source labels, or warnings", () => {
    expect(mergeBrokenGuidanceFragments(["When monitoring", "move 300 feet upwind."])).toHaveLength(2);
    expect(mergeBrokenGuidanceFragments(["When monitoring", "Source: NIOSH"])).toHaveLength(2);
    expect(mergeBrokenGuidanceFragments(["If irritation occurs", "warning: stop work."])).toHaveLength(2);
  });

  it("keeps first-aid sentences together and capitalizes each source line", () => {
    expect(formatFirstAidGuidance([
      "first aid: move to fresh air; administer oxygen if needed.",
      "flush eyes continuously. Continue flushing during transport.",
      "Flush eyes continuously. Continue flushing during transport.",
      "1) monitor breathing. Continue supportive care.",
    ])).toEqual([
      "Move to fresh air; administer oxygen if needed.",
      "Flush eyes continuously. Continue flushing during transport.",
      "1) Monitor breathing. Continue supportive care.",
    ]);
  });
});

describe("Chemical Profile UI system", () => {
  it("loads the shared browser normalizer before the profile renderer", () => {
    expect(html.indexOf('src="chemical-profile-text.js')).toBeLessThan(html.indexOf('src="script.js'));
    expect(script).toContain("chemicalProfileText.normalizeGuidanceItems");
    expect(script).not.toContain("createChemicalProfileSourceSummary");
    expect(script).toContain("createChemicalProfileEmptyState");
  });

  it("includes the complete profile workflow and hero actions", () => {
    for (const tab of ["Overview", "Properties", "Exposures", "PPE & Monitoring", "Response", "Medical", "Decon", "Sources"]) {
      expect(script).toContain(`['${tab}'`);
    }
    for (const actionId of ["open-guided-response-btn", "open-plume-btn", "profile-save-chemical-btn", "chemical-profile-back-btn"]) {
      expect(html).toContain(`id="${actionId}"`);
    }
  });

  it("renders available AEGL values as a structured duration table", () => {
    expect(script).toContain("function parsedAeglTableRows(values)");
    expect(script).toContain("function createAeglTable(values");
    expect(script).toContain("['Duration', 'AEGL-1', 'AEGL-2', 'AEGL-3']");
    expect(script).toContain("return createAeglTable(values, title)");
    expect(script).toContain("...createMonitoringConcernSections(profile?.exposures?.monitoringConcerns || ['Not available'])");
    expect(script).not.toContain("function groupedAeglProfileEntries(values)");
  });

  it("uses yellow selection, matte cards, and the correctly configured PPE hero asset", () => {
    expect(styles).toMatch(/\.chemical-profile-tab\.active\s*\{[^}]*background: #f6c343;/s);
    expect(styles).toContain("Chemical Profile visual system");
    expect(styles).toContain('url("assets/hazard-id-level-b-hero-v2.png")');
  });

  it("keeps the dashboard shell and stacks the full-width profile below search", () => {
    expect(styles).toContain('#lookup.active:has(#chemical-id-results:not([hidden]))');
    expect(styles).toMatch(/\.layout:has\(#lookup\.active\) #lookup\.active\s*\{[^}]*flex-direction: column;/s);
    expect(styles).toMatch(/#lookup\.active:has\(#chemical-id-results:not\(\[hidden\]\)\) > #chemical-id-results\s*\{[^}]*width: 100%;/s);
    expect(styles).not.toContain('.layout:has(#lookup.active) > .sidebar {\n  display: none;');
    expect(styles).toContain('#chemical-id-results .chemical-profile-content[data-active-tab="overview"]');
    expect(html).toContain('id="open-plume-btn" type="button">Plot Plume</button>');
    expect(script).toContain("activeTab: 'overview'");
  });

  it("keeps Overview limited to four decision-first sections", () => {
    const overview = script.slice(script.indexOf("{ key: 'overview'"), script.indexOf("{ key: 'properties'"));
    const overviewSections = [...overview.matchAll(/createProfileSection\('([^']+)'/g)].map((match) => match[1]);
    expect(overviewSections).toEqual([
      'Chemical Summary',
      'Frontline Considerations',
      'Isolation Distances (ERG)',
      'Exposure Quick Look',
    ]);
    expect(overview).not.toContain('Reactivity');
    expect(overview).not.toContain('EMS Considerations');
    expect(overview).not.toContain('PPE Quick Look');
    expect(overview).not.toContain('Medical Quick Look');
    expect(overview).not.toContain('Fire Considerations');
    expect(overview).not.toContain('Decon Considerations');
    expect(script).toContain("{ key: 'decon', title: 'DECON'");
  });

  it("keeps the Medical, Decon, and Monitoring tabs operationally concise", () => {
    const detectors = script.slice(script.indexOf("{ key: 'detectors'"), script.indexOf("{ key: 'isolationErg'"));
    const medical = script.slice(script.indexOf("{ key: 'medical'"), script.indexOf("{ key: 'fire'"));
    const decon = script.slice(script.indexOf("{ key: 'decon'"), script.indexOf("{ key: 'sources'"));

    expect(detectors).toContain("Available Monitoring Equipment");
    expect(detectors).toContain("profile?.detectors?.items");
    expect(detectors).toContain("profile?.detectors?.pidRelevance");
    expect(detectors).toContain("profile?.detectors?.electrochemicalSensors");
    expect(detectors).toContain("profile?.detectors?.limitations");
    expect(medical).not.toContain("createProfileSection('Source Status'");
    expect(decon).toContain("createProfileSection('Personnel / Product Decon'");
    expect(decon).toContain("createProfileSection('Technical Decon'");
    expect(decon).toContain('createHybridDeconLink()');
    expect(decon).not.toContain("createProfileSection('Decon layers'");
    expect(styles).toMatch(/data-active-tab="decon"[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/s);
    expect(script).toContain('Consider FirstLine Hybrid Decon only when product-specific guidance is available');
  });

  it('maps the complete normalized profile into the eight operational tabs', () => {
    for (const section of ['Exposure Quick Look', 'Available Monitoring Equipment', 'Routes of Exposure', 'Signs and Symptoms', 'ERG Public Safety', 'Spill / Release Control']) {
      expect(script).toContain(`createProfileSection('${section}'`);
    }
    expect(script).toContain("createProfileSection('Source Traceability', chemicalProfileSourceFacts(profile), true)");
    expect(script).toContain('value.textContent = parts[0] || noCurrentDataText');
    expect(styles).toContain('Chemical Profile hydration styling lock.');
    expect(styles).toMatch(/data-field="hazard-class"[^}]*chemical-profile-meta-value[^}]*color: #f6c343 !important;/s);
    expect(styles).toMatch(/chemical-profile-content-card,[\s\S]*?linear-gradient\(135deg, rgba\(3, 15, 28, 0\.98\), rgba\(6, 26, 46, 0\.96\), rgba\(11, 31, 51, 0\.98\)\) !important;/);
  });

  it("orders Medical as a compact exposure, treatment, and responder workflow", () => {
    const medical = script.slice(script.indexOf("{ key: 'medical'"), script.indexOf("{ key: 'fire'"));
    expect(medical.indexOf("createProfileSection('Target Organs'"))
      .toBeLessThan(medical.indexOf("createProfileSection('Treatment'"));
    expect(medical.indexOf("createProfileSection('Routes of Exposure'")).toBeLessThan(medical.indexOf("createProfileSection('Signs and Symptoms'"));
    expect(medical.indexOf("createProfileSection('Signs and Symptoms'")).toBeLessThan(medical.indexOf("createProfileSection('Treatment'"));
    expect(medical.indexOf("createProfileSection('Responders hazards'")).toBeLessThan(medical.indexOf("createProfileSection('Treatment'"));
    expect(styles).toMatch(/data-active-tab="medical"[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s);
    expect(styles).toContain('data-section="routes-of-exposure"] {\n  grid-column: 1 !important;');
    expect(styles).toMatch(/data-section="signs-and-symptoms"[^}]*grid-column: 1 \/ -1 !important;[^}]*grid-row: 2/s);
    expect(styles).toMatch(/data-section="responders-hazards"[^}]*grid-column: 1 \/ -1 !important;[^}]*grid-row: 3/s);
    expect(styles).toMatch(/data-section="treatment"[^}]*grid-column: 1 \/ -1 !important;/s);
    expect(styles).toMatch(/data-section="target-organs"[^}]*chemical-profile-list[^}]*display: flex !important;/s);
    expect(medical).toContain("createProfileSection('Treatment', auditedMedicalTreatmentRows(profile))");
    expect(script).toContain('chemicalProfileText.formatFirstAidGuidance');
    expect(script).toContain("{ label: 'Immediate first aid', value: firstAid }");
    expect(script).toContain("{ label: 'Antidotes / specific therapy', value: antidotes }");
    expect(script).toContain("{ label: 'Clinical treatment', value: treatmentNotes }");
    expect(script).toContain("section.classList.add('chemical-profile-life-safety')");
    expect(styles).toContain('content: "LIFE SAFETY";');
  });

  it("uses the reference toolbar, light-grey search field and built-in profile icons", () => {
    expect(html).toContain('class="chemical-profile-toolbar"');
    expect(html).toMatch(/id="open-guided-response-btn"[^>]*>Guided Response<\/button>\s*<button[^>]*id="open-plume-btn"[^>]*>Plot Plume<\/button>/s);
    expect(styles).toMatch(/#lookup \.chemical-id-search-card #chemical-search[^}]*background: #e2e5e8;/s);
    expect(styles).toContain('background: #d7dce1;');
    expect(script).toContain('function createChemicalProfileIcon');
    expect(script).toContain("chemicalProfileIconPaths");
  });

  it("uses dark navy Export / Print wording on the light-grey controls", () => {
    expect(styles).toMatch(/#chemical-id-results #profile-export-btn \{[^}]*color: #071f36;[^}]*background: #d7dce1;/s);
    expect(styles).toMatch(/\.chemical-profile-export-options button \{[^}]*color: #071f36;[^}]*background: #d7dce1;/s);
  });

  it("renders the NFPA 704 placard from selected-profile values instead of a static icon", () => {
    for (const field of ["health", "flammability", "instability", "special"]) {
      expect(html).toContain(`id="nfpa-704-${field}"`);
    }
    expect(script).toContain("function renderNfpa704Placard");
    expect(script).toContain("profile?.header?.nfpa704");
    expect(script).toContain("source.textContent = hasRecord ? '' : noCurrentDataText");
    expect(styles).toContain(".nfpa-704-diamond");
  });

  it("uses bold titles with regular-weight profile values", () => {
    expect(styles).toMatch(/\.chemical-profile-section h4,[\s\S]*?color: #fff;[\s\S]*?font-size: 1\.05rem;[\s\S]*?font-weight: 850;/);
    expect(styles).toContain("grid-template-rows: auto minmax(0, 1fr);");
    expect(styles).toMatch(/\.chemical-profile-row strong,[\s\S]*?font-size: 0\.94rem;[\s\S]*?font-weight: 400;/);
    expect(styles).toMatch(/\.chemical-profile-meta-value \{[\s\S]*?font-weight: 400;/);
  });

  it("keeps the Chemical Profile toolbar in normal flow above the results", () => {
    expect(styles).toMatch(/#lookup \.chemical-profile-toolbar \{[\s\S]*?position: static;[\s\S]*?top: auto;/);
  });

  it("color-codes the primary hazard, IDLH, and ERG Guide summary values", () => {
    expect(styles).toMatch(/data-field="primary-hazard"[^}]*> strong \{[\s\S]*?color: #ffd34f;/);
    expect(styles).toMatch(/data-field="idlh"[^}]*> strong \{[\s\S]*?color: #ff5a5f;/);
    expect(styles).toMatch(/data-field="erg-guide"[^}]*> strong \{[\s\S]*?color: #ff8a1c;/);
    expect(styles).toContain('.chemcompare-row[data-field="idlh"] .chemcompare-value-main');
    expect(script).toContain("row.dataset.field = String(label).toLowerCase()");
  });

  it("presents the Chemical Profile header as one seamless responsive summary", () => {
    const seamlessHeaderStyles = styles.slice(styles.lastIndexOf("/* Final seamless-header cascade lock."));

    expect(seamlessHeaderStyles).toMatch(/\.chemical-nfpa-placard \{[\s\S]*?border: 0 !important;[\s\S]*?background: transparent !important;[\s\S]*?box-shadow: none !important;/);
    expect(seamlessHeaderStyles).toMatch(/\.chemical-profile-meta-item,[\s\S]*?min-height: 0;[\s\S]*?height: auto;[\s\S]*?border-radius: 0 !important;[\s\S]*?background: transparent !important;/);
    expect(seamlessHeaderStyles).toMatch(/\.chemical-hazard-overview \{[\s\S]*?height: auto;[\s\S]*?max-height: none;[\s\S]*?border-left: 1px solid[\s\S]*?background: transparent !important;/);
    expect(seamlessHeaderStyles).toContain("font-size: clamp(2.25rem, 3.5vw, 3.5rem);");
    expect(seamlessHeaderStyles).toMatch(/#profile-export-btn \{[\s\S]*?color: #fff;[\s\S]*?background: #082943;/);
    expect(seamlessHeaderStyles).toContain("@media (max-width: 1200px)");
    expect(seamlessHeaderStyles).toContain("@media (max-width: 760px)");
    expect(seamlessHeaderStyles).toContain("@media (max-width: 520px)");
  });

  it("uses content-height tab cards and keeps safety data horizontal", () => {
    const layoutStyles = styles.slice(styles.lastIndexOf("/* Final content-driven cascade lock."));

    expect(layoutStyles).toMatch(/\.chemical-profile-content\[data-active-tab\] \{[\s\S]*?grid-auto-flow: row dense;[\s\S]*?grid-auto-rows: max-content !important;[\s\S]*?height: auto !important;[\s\S]*?max-height: none !important;[\s\S]*?overflow: visible !important;/);
    expect(layoutStyles).toContain("grid-template-columns: repeat(3, minmax(0, 1fr)) !important;");
    expect(layoutStyles).toContain("grid-template-columns: repeat(4, minmax(0, 1fr)) !important;");
    expect(layoutStyles).toContain("writing-mode: horizontal-tb !important;");
    expect(layoutStyles).toContain(".chemical-profile-aegl-table");
    expect(styles).toContain(':is(th, td)[data-level="1"] { color: #65c43b; }');
    expect(styles).toContain(':is(th, td)[data-level="2"] { color: #f59e0b; }');
    expect(styles).toContain(':is(th, td)[data-level="3"] { color: #ef3340; }');
    expect(styles).toContain(".chemical-nfpa-placard figcaption { order: 2;");
    expect(layoutStyles).toContain("@media (max-width: 700px)");
  });

  it("renders full-width horizontal section bands with high-contrast headings", () => {
    const layoutStyles = styles.slice(styles.lastIndexOf("/* Final content-driven cascade lock."));
    expect(layoutStyles).toContain("Every profile section is a horizontal information band");
    expect(layoutStyles).toMatch(/data-active-tab\] > \.chemical-profile-section,[\s\S]*?grid-column: 1 \/ -1 !important;[\s\S]*?width: 100% !important;/);
    expect(layoutStyles).toContain("repeat(auto-fit, minmax(min(100%, 245px), 1fr)) !important");
    expect(layoutStyles).toMatch(/\.chemical-profile-section h4,[\s\S]*?color: #ffd34f !important;[\s\S]*?font-weight: 950 !important;/);
  });

  it("keeps EMS and vapor guidance in their proper tabs and reactivity only in Properties", () => {
    const overview = script.slice(script.indexOf("{ key: 'overview'"), script.indexOf("{ key: 'properties'"));
    const frontline = overview.slice(overview.indexOf("createProfileSection('Frontline Considerations'"), overview.indexOf("createProfileSection('Isolation Distances (ERG)'"));
    expect(frontline.indexOf("PPE Recommendation")).toBeLessThan(frontline.indexOf("Primary hazard"));
    expect(frontline).not.toContain("Vapor behavior");
    expect(frontline).not.toContain("EMS considerations");
    expect(frontline).not.toContain("Reactivity");
    expect(overview).toContain("{ label: 'Vapor behavior', value: profile?.fire?.vaporBehavior");

    const properties = script.slice(script.indexOf("{ key: 'properties'"), script.indexOf("{ key: 'exposures'"));
    expect(properties).toContain("createProfileSection('Vapor Behavior'");
    expect(properties).toContain("createProfileSection('Reactivity'");
    expect(script).not.toContain("{ key: 'reactivity'");
    expect(script).not.toContain("renderSectionGroups('reactivity'");
    const medical = script.slice(script.indexOf("{ key: 'medical'"), script.indexOf("{ key: 'fire'"));
    expect(medical).toContain("createProfileSection('EMS Considerations', auditedEmsConsiderations(profile), true)");
    expect(medical).not.toContain("{ label: 'EMS considerations'");
    expect(script).toContain("function distinctProfileGuidance(value, exclusions = [])");
  });

  it("removes the duplicate ERG number from Response isolation while emphasizing the distance values", () => {
    const response = script.slice(script.indexOf("key: 'response'"), script.indexOf("const tabsList"));
    expect(response).toContain("renderResponseIsolationSections()");
    expect(script).toContain("querySelector('[data-field=\"erg-guide-number\"]')?.remove()");
    expect(styles).toMatch(/data-active-tab="response"[^}]*data-section="isolation-distances"[\s\S]*?data-field="initial-isolation"[\s\S]*?text-align: center/s);
    expect(styles).toContain('font-weight: 950 !important;');
  });

  it("keeps Signs and Symptoms and Responder Hazards in separate full-width rows", () => {
    expect(styles).toMatch(/data-section="signs-and-symptoms"[^}]*grid-column: 1 \/ -1 !important;[^}]*grid-row: 2/s);
    expect(styles).toMatch(/data-section="responders-hazards"[^}]*grid-column: 1 \/ -1 !important;[^}]*grid-row: 3/s);
    expect(styles).toMatch(/data-section="signs-and-symptoms"[^}]*chemical-profile-list[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/s);
  });

  it("stacks shortened hazard classes in Frontline and the fixed profile header", () => {
    expect(script).toContain("function hazardClassDisplayLines(value)");
    expect(script).toContain(".replace(/\\bsubstances?\\b/gi, '')");
    expect(script).toContain("{ label: 'Primary hazard', value: hazardClassDisplayLines(");
    expect(script).toContain("['Hazard Class', hazardClassDisplayLines(");
    expect(script).toContain("contentValue.classList.add('chemical-hazard-class-list')");
    expect(script).toContain("contentValue.replaceChildren(...hazardClasses.map");
    expect(styles).toContain("Compact vertical DOT hazard-class display");
    expect(styles).toMatch(/data-field="hazard-class"[^}]*\.chemical-hazard-class-list \{[\s\S]*?display: grid !important;[\s\S]*?white-space: nowrap;[\s\S]*?overflow: hidden;/);
    expect(styles).toMatch(/data-field="primary-hazard"[^}]*\.chemical-profile-value-list \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/);
  });

  it("uses a compact aligned Fire Behavior band in Response and retains the full Fire tab", () => {
    const response = script.slice(script.indexOf("key: 'response'"), script.indexOf("const tabsList"));
    expect(script).toContain("function conciseFireResponseGuidance(value, maxItems = 2)");
    expect(response).toContain("createProfileSection('Fire Behavior'");
    for (const label of ['Fire / explosion risk', 'Explosive range', 'Extinguishing media', 'Immediate precautions']) {
      expect(response).toContain(`label: '${label}'`);
    }
    expect(response).not.toContain("renderSectionGroups('fire')");
    const fire = script.slice(script.indexOf("{ key: 'fire'"), script.indexOf("{ key: 'decon'"));
    expect(fire).toContain("createProfileSection('Fire behavior'");
    expect(fire).toContain("createProfileSection('Fire response'");
    expect(styles).toContain("Response keeps fire intelligence compact");
    expect(styles).toMatch(/data-active-tab="response"[^}]*data-section="fire-behavior"[^}]*chemical-profile-grid \{[\s\S]*?repeat\(4, minmax\(0, 1fr\)\) !important;/);
  });
});
