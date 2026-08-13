import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../server/public/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../server/public/styles.css", import.meta.url), "utf8");
const guidedHtml = html.slice(
  html.indexOf('<section id="guided-response"'),
  html.indexOf('<section id="my-chemicals"'),
);

describe("Guided Response workflow", () => {
  it("does not render a Sources bubble in the populated Chemical Profile header", () => {
    const metaItems = script.slice(
      script.indexOf("const metaItems = ["),
      script.indexOf("metaItems.forEach"),
    );
    expect(metaItems).not.toContain("['Sources'");
  });

  it("places Guided Response immediately before Open Plume Model", () => {
    const guided = html.indexOf('id="open-guided-response-btn"');
    const plume = html.indexOf('id="open-plume-btn"');
    expect(guided).toBeGreaterThan(-1);
    expect(plume).toBeGreaterThan(guided);
    expect(html).toMatch(/id="open-guided-response-btn"[^>]*>Guided Response<\/button>\s*<button[^>]*id="open-plume-btn"/s);
  });

  it("provides the new view, required actions, and compact disclaimers", () => {
    expect(html).toContain('id="guided-response" class="view"');
    expect(guidedHtml).toContain('class="guided-response-logo" src="assets/hazmatiq-logo.png"');
    expect(guidedHtml).toMatch(/class="guided-response-logo"[^>]*>\s*<div>\s*<h2>Guided Response<\/h2>/s);
    for (const id of [
      "guided-open-plume-btn",
      "guided-save-incident-btn",
      "guided-save-chemical-btn",
      "guided-back-btn",
    ]) expect(html).toContain(`id="${id}"`);
    expect(html).toContain("Missing, outdated, unsupported, or unverified values must be treated as No Current Data Exists.");
  });

  it("reuses selected state and blocks missing or unresolved chemical identity", () => {
    expect(script).toContain("function renderGuidedResponse()");
    expect(script).toContain("No chemical selected. Return to Chemical ID and select a Chemical Companion master record.");
    expect(script).toContain("Chemical-specific response guidance requires a verified Chemical Companion master link.");
    expect(script).toContain("sectionPlumeButton.addEventListener('click', openPlumeWorkspace)");
  });

  it("uses a wrapping responsive card layout", () => {
    expect(styles).toContain(".guided-response-content");
    expect(styles).toContain('url("assets/guided-response-hero.png")');
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(styles).toContain("@media (max-width: 900px)");
  });

  it("renders the four-box tactical decision flow with downward arrows", () => {
    expect(script).toContain("Tactical Decision Flow");
    for (const title of ["Identify / Analyze", "Verify and Isolate", "Life Safety", "Mitigation"]) {
      expect(script).toContain(`'${title}'`);
    }
    expect(script.match(/createTacticalFlowArrow\(\)/g)?.length).toBeGreaterThanOrEqual(4);
    for (const removed of ["Decision First", "Verify All Data", "Team Safety"]) {
      expect(guidedHtml).not.toContain(removed);
      expect(script).not.toContain(removed);
    }
  });

  it("prioritizes a source-backed SCBA decision and fail-closed manufacturer panels", () => {
    expect(script).toContain("const explicitScba = respiratoryValues.some");
    expect(script).toContain("const sourceBackedIdlh = guidedHasValue(idlh)");
    expect(script).toContain("'SCBA MANDATED'");
    expect(script).toContain("'RESPIRATOR SELECTION REQUIRES VERIFICATION'");
    expect(script).toContain("['3M', 'MSA', 'North']");
    expect(script).toContain("Manufacturer-specific respiratory options not verified from current source.");
  });

  it("builds an export-ready decision record and keeps mitigation under IC approval", () => {
    expect(script).toContain("tacticalDecisionFlow: {");
    expect(script).toContain("identifyAnalyze: {");
    expect(script).toContain("verifyIsolate: {");
    expect(script).toContain("lifeSafety: {");
    expect(script).toContain("mitigation: {");
    expect(script).toContain("const tacticalPosture = 'Requires IC decision'");
    expect(script).toContain("Final mitigation strategy must be approved by Incident Command.");
    expect(script).not.toContain("const tacticalPosture = 'Offensive'");
  });

  it("uses section-level source summaries instead of badges on every populated row", () => {
    expect(script).toContain("guided-section-sources");
    expect(script).toContain("Sources: ${sources.length ? sources.join(', ') : noCurrentDataText}");
    expect(script).toContain("guidedHasValue(displayed) && !['Needs Verification'].includes(sourceBadge) ? '' : sourceBadge");
  });
});
