import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../server/public/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../server/public/chem-compare.js", import.meta.url), "utf8");
const appScript = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../server/public/styles.css", import.meta.url), "utf8");

describe("ChemCompare workspace", () => {
  it("opens from the Chemical Profile toolbar into a dedicated comparison view", () => {
    expect(html).toContain('id="open-chemcompare-btn"');
    expect(html).toContain('id="open-chemcompare-btn" type="button">CHEM COMPARE</button>');
    expect(html).toContain('class="chemical-action-button chem-compare"');
    expect(html).toContain('id="chem-compare" class="view chemcompare-page"');
    expect(html).toContain('id="chemcompare-back-btn"');
    expect(html.indexOf('src="script.js')).toBeLessThan(html.indexOf('src="chem-compare.js'));
    expect(script).toContain("showView('chem-compare')");
  });

  it("uses the current profile as the base without replacing the active chemical", () => {
    expect(script).toContain("if (!baseChemical && (!activeChemical || !activeChemicalRecord)) return;");
    expect(script).toContain("record: activeChemicalRecord");
    expect(script).not.toContain("setActiveChemical(chemical)");
    expect(script).not.toContain("openChemical(chemical)");
  });

  it("reuses Chemical ID autocomplete helpers and the existing search endpoint", () => {
    expect(script).toContain("normalizeChemicalQuery(value)");
    expect(script).toContain("/api/chemicals/search?q=");
    expect(script).toContain(".map(companionChemicalForUi)");
    expect(script).toContain("createSuggestion(");
    expect(script).toContain("chemicalSearchIdentifiers(chemical)");
  });

  it("normalizes every required source-backed comparison field", () => {
    for (const key of [
      "specificHazards",
      "specificGravity",
      "vaporDensity",
      "aeglLevels",
      "idlh",
      "ppeLevel",
      "waterReactivity",
      "isolationDistances",
    ]) expect(script).toContain(key);
    expect(script).toContain("function getChemicalCompareData(chemical)");
    expect(script).toContain("profile.ppeRecommendation");
  });

  it("fails closed for missing values and unresolved transport identifiers", () => {
    expect(script).toContain("const NO_DATA = 'No Current Data Exists'");
    expect(script).toContain("const BLOCKED_PPE = 'Blocked Pending Verified Chemical Link'");
    expect(script).toContain("isUnreviewedTransportationRecord(chemical)");
    expect(script).toContain("window.HazMatIQ.openChemCompareWithBase = openChemCompare");
    expect(appScript).toContain("window.HazMatIQ?.openChemCompareWithBase?.(chemical)");
    expect(html).toContain("Missing values are not guessed.");
  });

  it("uses an equal split and labels differences without relying on color alone", () => {
    expect(styles).toMatch(/\.chemcompare-split\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/s);
    expect(script).toContain("'Different', 'chemcompare-difference-badge'");
    expect(styles).toContain(".chemical-action-button.chem-compare");
    expect(styles).toMatch(/\.chemcompare-label\s*\{[^}]*background: #eadcae;[^}]*color: #111;/s);
  });
});
