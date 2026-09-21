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
    expect(script).toContain("createChemicalProfileSourceSummary");
    expect(script).toContain("createChemicalProfileEmptyState");
  });

  it("includes the complete profile workflow and hero actions", () => {
    for (const tab of ["Overview", "Properties", "Exposures", "PPE & Monitoring", "Response", "Medical", "Decon", "Sources"]) {
      expect(script).toContain(`['${tab}'`);
    }
    for (const actionId of ["open-plume-btn", "open-guided-response-btn", "open-chemcompare-btn", "chemical-profile-back-btn"]) {
      expect(html).toContain(`id="${actionId}"`);
    }
  });

  it("renders available AEGL values as a structured duration table", () => {
    expect(script).toContain("function groupedAeglProfileEntries(values)");
    expect(script).toContain("groupAeglByTimeframe");
    expect(script).toContain("...createMonitoringConcernSections(profile?.exposures?.monitoringConcerns || ['Not available'])");
    expect(script).toContain("createProfileSection('AEGL Values', groupedAeglProfileEntries(aeglValues), true)");
  });

  it("uses yellow selection, matte cards, and the correctly configured PPE hero asset", () => {
    expect(styles).toMatch(/\.chemical-profile-tab\.active\s*\{[^}]*background: #f6c343;/s);
    expect(styles).toContain("Chemical Profile visual system");
    expect(styles).toContain('url("assets/hazard-id-level-b-hero-v2.png")');
  });

  it("keeps the dashboard shell and stacks the full-width profile below search", () => {
    expect(styles).toContain('#lookup.active:has(#chemical-id-results:not([hidden]))');
    expect(styles).toContain('.layout:has(#lookup.active) #lookup.active');
    expect(styles).toContain('> #chemical-id-results {');
    expect(styles).toContain('#chemical-id-results .chemical-profile-content[data-active-tab="overview"]');
    expect(html).toContain('id="open-plume-btn" type="button">PLOT PLUME</button>');
    expect(script).toContain("activeTab: 'overview'");
  });

  it("keeps Overview limited to decision-first profile sections", () => {
    const overview = script.slice(script.indexOf("{ key: 'overview'"), script.indexOf("{ key: 'properties'"));
    const overviewSections = [...overview.matchAll(/createProfileSection\('([^']+)'/g)].map((match) => match[1]);
    expect(overviewSections).toEqual([
      'Chemical Summary',
      'Exposure Limits',
      'AEGL Values',
      'Frontline Considerations',
    ]);
    expect(overview).not.toContain('Reactivity');
    expect(script).toContain("{ key: 'decon', title: 'DECON'");
  });

  it("keeps the Medical, Decon, and Monitoring tabs operationally concise", () => {
    const medical = script.slice(script.indexOf("{ key: 'medical'"), script.indexOf("{ key: 'fire'"));
    const decon = script.slice(script.indexOf("{ key: 'decon'"), script.indexOf("{ key: 'sources'"));

    expect(script).toContain("function createDetailedMonitoringSections(profile)");
    expect(script).toContain("'Monitoring Methods'");
    expect(script).toContain("'Detection / Identification'");
    expect(script).toContain("'Instrument Limitations / Interferences'");
    expect(script).toContain("'Field Monitoring / Readings'");
    expect(medical).not.toContain("createProfileSection('Source Status'");
    expect(decon).toContain("createProfileSection('Personnel / Product Decon'");
    expect(decon).toContain("createProfileSection('Technical Decon'");
    expect(decon).toContain('createHybridDeconLink()');
    expect(decon).not.toContain("createProfileSection('Decon layers'");
    expect(styles).toMatch(/data-active-tab="decon"[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/s);
    expect(script).toContain('Consider FirstLine Hybrid Decon only when product-specific guidance is available');
  });

  it('maps the complete normalized profile into the eight operational tabs', () => {
    for (const section of ['Exposure Limits', 'Monitoring Methods', 'Isolation Distances', 'Source Traceability']) {
      expect(script).toContain(`createProfileSection('${section}'`);
    }
    expect(script).toContain('function createChemmMedicalEmbed(profile)');
    expect(script).toContain("createProfileSection('Entry Cautions'");
    expect(script).toContain("CHEMM opens in a separate window for browser compatibility.");
    expect(script).toContain("createProfileSection('Source Traceability', chemicalProfileSources(profile), true)");
    expect(script).toContain('content.replaceChildren(fragment);');
    expect(styles).toContain('.chemical-profile-content-card');
    expect(styles).toContain('.chemical-profile-meta-value');
    expect(styles).toContain('.chemical-profile-content[data-active-tab]');
  });

  it("uses CHEMM as the Medical tab's primary guidance surface", () => {
    const medical = script.slice(script.indexOf("{ key: 'medical'"), script.indexOf("{ key: 'fire'"));
    expect(medical).toContain('createChemmMedicalEmbed(profile)');
    expect(medical).toContain("createProfileSection('Entry Cautions'");
    expect(script).toContain("frame.src = 'https://chemm.hhs.gov/mmghome.htm'");
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr) !important;');
    expect(styles).toContain('.chemical-profile-medical-embed-frame');
    expect(medical).not.toContain("createProfileSection('Treatment'");
    expect(medical).not.toContain("createProfileSection('Routes and symptoms'");
  });

  it("uses the reference toolbar, light-grey search field and built-in profile icons", () => {
    expect(html).toContain('class="chemical-profile-toolbar"');
    expect(html).toMatch(/id="open-plume-btn"[^>]*>PLOT PLUME<\/button>[\s\S]*id="open-chemcompare-btn"/s);
    expect(styles).toContain('#chemical-id-results .chemical-profile-toolbar');
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
    expect(styles).toContain('.chemical-profile-header-card');
    expect(styles).toContain('.chemical-profile-meta-item');
    expect(styles).toContain('.chemical-hazard-overview');
    expect(styles).toContain('#chemical-id-results .chemical-profile-header-card');
    expect(styles).toContain('@media (max-width: 900px)');
    expect(styles).toContain('@media (max-width: 520px)');
  });

  it("uses content-height tab cards and keeps safety data horizontal", () => {
    expect(styles).toContain('.chemical-profile-content[data-active-tab]');
    expect(styles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(styles).toContain('.erg-profile-table');
    expect(styles).toContain('.erg-profile-table');
    expect(styles).toContain('.chemical-nfpa-placard figcaption');
    expect(styles).toContain("@media (max-width: 700px)");
  });

  it("renders full-width horizontal section bands with high-contrast headings", () => {
    expect(styles).toContain('#chemical-id-results .chemical-profile-content > .chemical-profile-section');
    expect(styles).toContain('grid-column: 1 / -1');
    expect(styles).toContain('.chemical-profile-section h4');
    expect(styles).toContain('color: #fff;');
  });

  it("keeps product-specific entry cautions in the operational profile and reactivity in Properties", () => {
    const overview = script.slice(script.indexOf("{ key: 'overview'"), script.indexOf("{ key: 'properties'"));
    const frontline = overview.slice(overview.indexOf("createProfileSection('Frontline Considerations'"));
    expect(frontline).toContain("createProfileSection('Frontline Considerations'");
    expect(frontline).not.toContain("Vapor behavior");
    expect(frontline).not.toContain("Reactivity");
    expect(script).toContain('function chemicalEntryCautionValues(profile)');
    expect(script).toContain("add('Entry Cautions', chemicalEntryCautionValues(profile))");

    const properties = script.slice(script.indexOf("{ key: 'properties'"), script.indexOf("{ key: 'exposures'"));
    expect(properties).toContain("createProfileSection('Reactivity'");
    expect(script).not.toContain("renderSectionGroups('reactivity'");
    const medical = script.slice(script.indexOf("{ key: 'medical'"), script.indexOf("{ key: 'fire'"));
    expect(medical).not.toContain("{ label: 'EMS considerations'");
  });

  it("removes the duplicate ERG number from Response isolation while emphasizing the distance values", () => {
    const response = script.slice(script.indexOf("key: 'response'"), script.indexOf("const tabsList"));
    expect(response).toContain("renderSectionGroups('isolationErg', 'reactivity', 'fire')");
    expect(script).toContain("createProfileSection('Isolation Distances'");
    expect(script).toContain("createProfileSection('ERG Notes'");
    expect(styles).toContain('data-active-tab="response"');
  });

  it("keeps CHEMM and product-specific entry cautions as the Medical workflow", () => {
    expect(styles).toContain('data-active-tab="medical"');
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr) !important;');
    expect(script).toContain("createProfileSection('Entry Cautions'");
    expect(script).toContain("section.dataset.section = 'chemm-medical-guidance'");
  });

  it("stacks shortened hazard classes in Frontline and the fixed profile header", () => {
    expect(script).toContain("function formatHazardClassLines(value)");
    expect(script).toContain("['Hazard Class', formatHazardClassLines");
    expect(styles).toContain('.chemical-profile-meta-item[data-field="hazard-class"]');
    expect(styles).toContain('white-space: pre-line;');
  });

  it("uses a compact aligned Fire Behavior band in Response and retains the full Fire tab", () => {
    const response = script.slice(script.indexOf("key: 'response'"), script.indexOf("const tabsList"));
    expect(response).toContain("renderSectionGroups('isolationErg', 'reactivity', 'fire')");
    const fire = script.slice(script.indexOf("{ key: 'fire'"), script.indexOf("{ key: 'decon'"));
    expect(fire).toContain("createProfileSection('Fire behavior'");
    expect(fire).toContain("createProfileSection('Fire response'");
    expect(styles).toContain('data-active-tab="fire"');
  });
});
