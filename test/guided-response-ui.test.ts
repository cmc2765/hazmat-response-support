import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../server/public/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");
const builder = readFileSync(new URL("../server/public/guided-response-decision-builder.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../server/public/styles.css", import.meta.url), "utf8");
const guidedHtml = html.slice(
  html.indexOf('<section id="guided-response"'),
  html.indexOf('<section id="my-chemicals"'),
);
const lookupHtml = html.slice(
  html.indexOf('<section id="lookup"'),
  html.indexOf('<section id="guided-response"'),
);

describe("Guided Response workflow", () => {
  it("uses the bright logo-free Chemical ID hero with live search controls", () => {
    expect(styles).toContain('url("assets/chemical-id-search-background.png")');
    expect(lookupHtml).toContain('class="chemical-id-search-content"');
    expect(lookupHtml).toContain('id="chemical-search"');
    expect(lookupHtml).toContain('id="chemical-lookup-btn"');
    expect(lookupHtml).toContain('id="save-my-chemical-btn"');
    expect(lookupHtml).not.toContain("hazmatiq-logo");
    expect(styles).toContain(".layout:has(#lookup.active) #lookup.active");
    expect(styles).toContain("grid-template-rows: minmax(clamp(420px, 52dvh, 600px), 1fr) auto auto;");
    expect(styles).toContain(".layout:has(#lookup.active) .chemical-id-search-card");
    expect(styles).toContain("height: 100%;");
  });

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
    expect(guidedHtml).toContain('class="guided-response-logo" src="assets/hazmatiq-logo-transparent.png"');
    expect(guidedHtml).toMatch(/class="guided-response-logo"[^>]*>\s*<div>\s*<h2>Guided Response<\/h2>/s);
    for (const id of [
      "guided-open-plume-btn",
      "guided-save-record-btn",
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
    expect(script).toContain("document.getElementById('guided-open-plume-btn')?.addEventListener('click', openPlumeWorkspace)");
  });

  it("uses a wrapping responsive card layout", () => {
    expect(styles).toContain(".guided-response-content");
    expect(styles).toContain('url("assets/guided-response-hero.png")');
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(styles).toContain("@media (max-width: 900px)");
  });

  it("keeps the Guided Response title box compact", () => {
    expect(styles).toContain("padding: 5px 12px");
    expect(styles).toContain("height: 62px");
    expect(styles).toContain("min-height: 36px");
  });

  it("makes the upper-left HazMatIQ identity prominent and symmetrical", () => {
    expect(styles).toContain("width: clamp(265px, 26vw, 360px)");
    expect(styles).toContain("font-size: clamp(1.85rem, 2.5vw, 2.4rem)");
    expect(styles).toContain("align-self: start");
    expect(styles).toContain("justify-self: start");
    expect(styles).toContain("text-align: center");
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

  it("uses readable, restrained typography throughout the tactical decision flow", () => {
    expect(styles).toMatch(/\.guided-tactical-section-heading h3[^}]*font-size: 1\.5rem;[^}]*font-weight: 700;/s);
    expect(styles).toMatch(/\.guided-flow-box h4[^}]*font-size: 1\.1rem;[^}]*font-weight: 700;/s);
    expect(styles).toMatch(/\.guided-flow-status[^}]*font-size: 0\.9rem;[^}]*font-weight: 700;/s);
    expect(styles).toMatch(/\.guided-flow-box dl > div[^}]*font-size: 0\.84rem;/s);
  });

  it("does not place a selected-chemical box inside the title box", () => {
    expect(script).not.toContain("createGuidedResponseCard('Selected Chemical'");
    expect(script).not.toContain("guided-header-summary");
    expect(styles).not.toContain(".guided-header-summary");
  });

  it("promotes Tactical Decision Flow to the full-width first content section", () => {
    expect(script).toContain("const flow = document.createElement('section')");
    expect(script).toContain("container.append(flow, createMitigationDecisionSupport(decisionRecord))");
    expect(styles).toContain("flex-direction: column");
    expect(styles).not.toContain("transform: rotate(-90deg)");
  });

  it("prioritizes a source-backed SCBA decision and omits manufacturer lists", () => {
    expect(builder).toContain("const mandatoryScba = scbaFacts.filter");
    expect(builder).toContain("'SCBA MANDATED'");
    expect(builder).toContain("'SCBA STRONGLY INDICATED'");
    expect(builder).toContain("'RESPIRATOR / CARTRIDGE SELECTION REQUIRES VERIFICATION'");
    const renderer = script.slice(script.indexOf("function renderGuidedResponse()"), script.indexOf("const chemicalSearchForm"));
    expect(renderer).not.toContain("createGuidedManufacturerPanel");
    expect(renderer).not.toContain("respiratorRecommendations are not displayed");
  });

  it("uses one fail-closed protection level and a controlled Level C cartridge status", () => {
    for (const level of [
      "Level A Vapor Protective Suit",
      "Level B Chemical Protective Suit",
      "Level C Chemical Protective Suit",
      "Level D / No chemical protective ensemble required",
      "Requires IC / HazMat Specialist Review",
    ]) expect(builder).toContain(level);
    expect(builder).toContain("const levels = explicitProtectionLevels(decisionFacts)");
    expect(builder).toContain("levels.length > 1");
    expect(builder).toContain("Cartridge selection requires verification with approved source data and agency SOP.");
    expect(builder).toContain("Level C Chemical Protective Suit + APR/PAPR verification required");
  });

  it("keeps the Tactical Decision Flow Life Safety box compact and ordered", () => {
    const lifeFlow = script.slice(
      script.indexOf("const lifeFlow = createTacticalFlowBox"),
      script.indexOf("const mitigationFlow = createTacticalFlowBox"),
    );
    const labels = ["SCBA Decision", "Protection Level", "Direct Guidance", "Downgrade Conditions", "Cartridge Status"];
    labels.forEach((label, index) => {
      expect(lifeFlow.indexOf(`label: '${label}'`)).toBeGreaterThan(index ? lifeFlow.indexOf(`label: '${labels[index - 1]}'`) : -1);
    });
    expect(lifeFlow).not.toContain("respiratorRecommendations");
  });

  it("builds an export-ready decision record and keeps mitigation under IC approval", () => {
    expect(script).toContain("tacticalDecisionFlow: {");
    expect(script).toContain("identifyAnalyze: decisions.identifyAnalyze");
    expect(script).toContain("verifyIsolate: decisions.verifyIsolate");
    expect(script).toContain("lifeSafety: decisions.lifeSafety");
    expect(script).toContain("mitigation: decisions.mitigation");
    expect(builder).toContain("? 'Defensive'");
    expect(script).toContain("mitigationDecisionSupport: decisions.mitigationDecisionSupport");
    expect(script).toContain("readyForIncidentExport: true");
    expect(script).toContain("Final mitigation strategy must be approved by Incident Command.");
    expect(script).not.toContain("const tacticalPosture = 'Offensive'");
  });

  it("uses section-level source summaries instead of badges on every populated row", () => {
    expect(script).toContain("guided-flow-sources");
    expect(script).toContain("Sources reviewed: ${sources.length ? sources.join(', ') : noCurrentDataText}");
    const renderer = script.slice(script.indexOf("function renderGuidedResponse()"), script.indexOf("const chemicalSearchForm"));
    expect(renderer).not.toContain("guided-source-badge");
  });

  it("removes the repeating Chemical Profile card grid from the active renderer", () => {
    const renderer = script.slice(script.indexOf("function renderGuidedResponse()"), script.indexOf("const chemicalSearchForm"));
    for (const removed of [
      "Confirm Chemical Identity",
      "Immediate Hazards",
      "PPE / Respiratory",
      "Isolation / Protective Actions",
      "Medical / First Aid",
      "Decon / Spill / Fire",
      "Plume Readiness",
    ]) expect(renderer).not.toContain(removed);
    expect(renderer).not.toContain("guided-response-main");
  });

  it("saves a compact tactical record locally and can attach it to an active incident", () => {
    expect(script).toContain("function saveGuidedResponseTacticalRecord");
    expect(script).toContain("guidedResponseTacticalStorageKey");
    expect(script).toContain("guidedResponseTacticalRecord: record");
    expect(script).toContain("Planning Mode — tactical decision record saved locally, not attached to an incident.");
    expect(script).toContain("Active Incident Mode — tactical decision record saved to this incident.");
  });
});
