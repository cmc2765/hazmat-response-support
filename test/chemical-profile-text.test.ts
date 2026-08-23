import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CHEMICAL_PROFILE_EMPTY_STATE,
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
    for (const actionId of ["open-guided-response-btn", "open-plume-btn", "profile-save-chemical-btn", "chemical-profile-back-btn"]) {
      expect(html).toContain(`id="${actionId}"`);
    }
  });

  it("renders Chemical Profile AEGL values only through the four conservative time bands", () => {
    expect(script).toContain("function groupedAeglProfileEntries(values)");
    expect(script).toContain("createProfileSection('AEGL Values', groupedAeglProfileEntries(");
  });

  it("uses yellow selection, matte cards, and the non-railcar bundled search asset", () => {
    expect(styles).toMatch(/\.chemical-profile-tab\.active\s*\{[^}]*background: #f6c343;/s);
    expect(styles).toContain("Chemical Profile visual system");
    expect(styles).toContain('url("assets/chemical-id-search-background-v2.png")');
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

  it("keeps decon in its own tab instead of duplicating it in Overview", () => {
    const overview = script.slice(script.indexOf("{ key: 'overview'"), script.indexOf("{ key: 'properties'"));
    expect(overview).not.toContain("createProfileSection('Decon Considerations'");
    expect(script).toContain("{ key: 'decon', title: 'DECON'");
  });

  it("keeps the Medical, Decon, and Monitoring tabs operationally concise", () => {
    const detectors = script.slice(script.indexOf("{ key: 'detectors'"), script.indexOf("{ key: 'reactivity'"));
    const medical = script.slice(script.indexOf("{ key: 'medical'"), script.indexOf("{ key: 'fire'"));
    const decon = script.slice(script.indexOf("{ key: 'decon'"), script.indexOf("{ key: 'sources'"));

    expect(detectors).toContain("Available Monitoring Equipment");
    for (const equipment of ["AreaRAE", "MultiRAE", "ToxiRAE", "Rigaku", "HAZMATID Elite", "CHEMMstrip"]) {
      expect(detectors).toContain(equipment);
    }
    expect(detectors).not.toContain("profile?.detectors?.items");
    expect(medical).not.toContain("createProfileSection('Source Status'");
    expect(decon).toContain("createProfileSection('Decontamination guidance'");
    expect(decon).not.toContain("createProfileSection('Decon layers'");
  });

  it("uses the reference toolbar, light-grey search field and built-in profile icons", () => {
    expect(html).toContain('class="chemical-profile-toolbar"');
    expect(html).toMatch(/id="open-guided-response-btn"[^>]*>Guided Response<\/button>\s*<button[^>]*id="open-plume-btn"[^>]*>Plot Plume<\/button>/s);
    expect(styles).toMatch(/#lookup \.chemical-id-search-card #chemical-search[^}]*background: #e2e5e8;/s);
    expect(styles).toContain('background: #d7dce1;');
    expect(script).toContain('function createChemicalProfileIcon');
    expect(script).toContain("chemicalProfileIconPaths");
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

  it("uses readable, top-aligned white titles and larger profile values", () => {
    expect(styles).toMatch(/\.chemical-profile-section h4,[\s\S]*?color: #fff;[\s\S]*?font-size: 1\.05rem;[\s\S]*?font-weight: 850;/);
    expect(styles).toContain("grid-template-rows: auto minmax(0, 1fr);");
    expect(styles).toMatch(/\.chemical-profile-row strong,[\s\S]*?font-size: 0\.94rem;/);
  });
});
