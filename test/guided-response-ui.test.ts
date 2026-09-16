import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../server/public/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");
const builder = readFileSync(new URL("../server/public/guided-response-decision-builder.js", import.meta.url), "utf8");
const ppeEngine = readFileSync(new URL("../src/lib/ppe/ppeRecommendationEngine.ts", import.meta.url), "utf8");
const styles = [
  readFileSync(new URL("../server/public/styles.css", import.meta.url), "utf8"),
  readFileSync(new URL("../server/public/chemical-intel.css", import.meta.url), "utf8"),
  readFileSync(new URL("../server/public/guided-response-overrides.css", import.meta.url), "utf8"),
].join("\n");
const guidedHtml = html.slice(
  html.indexOf('<section id="guided-response"'),
  html.indexOf('<section id="my-chemicals"'),
);
const lookupHtml = html.slice(
  html.indexOf('<section id="lookup"'),
  html.indexOf('<section id="chem-compare"'),
);

describe("Guided Response workflow", () => {
  it("uses the branded unified Hazard ID hero with one tabbed search console", () => {
    expect(styles).toContain('url("assets/hazard-id-level-b-hero-v2.png")');
    expect(lookupHtml.match(/data-hazard-search-tab=/g)).toHaveLength(3);
    expect(lookupHtml).toContain('id="chemical-search" type="search"');
    expect(lookupHtml).toContain('id="chemical-search"');
    expect(lookupHtml).toContain('id="chemical-lookup-btn"');
    expect(lookupHtml).not.toContain('id="cbrne-cwa-search"');
    expect(lookupHtml).not.toContain('id="radiological-search"');
    expect(lookupHtml).toContain('<h1 class="hazmat-hero-title">HAZARD ID</h1>');
    expect(styles).toContain("/* Hazard ID command console — cinematic single-search workspace. */");
    expect(styles).toMatch(/#lookup > \.hazard-id-command-console\.chemical-id-search-card[^}]*grid-column: 1 !important;/s);
    expect(styles).toMatch(/#lookup > #chemical-id-results[^}]*grid-column: 1 !important;/s);
  });

  it("does not render a Sources bubble in the populated Chemical Profile header", () => {
    const metaItems = script.slice(
      script.indexOf("const metaItems = ["),
      script.indexOf("metaItems.forEach"),
    );
    expect(metaItems).not.toContain("['Sources'");
  });

  it("consolidates Properties into Chemical Properties and Reactivity", () => {
    const properties = script.slice(
      script.indexOf("{ key: 'properties'"),
      script.indexOf("{ key: 'exposures'"),
    );
    expect(properties).toContain("createProfileSection('Chemical Properties'");
    expect(properties).toContain("createProfileSection('Reactivity'");
    expect(properties).not.toContain("createProfileSection('Flammability & Energy'");
    expect(properties).not.toContain("createProfileSection('Synonyms & Notes'");
    expect(styles).toContain('data-active-tab="properties"]');
    expect(styles).toContain('[data-section="chemical-properties"]');
    expect(styles).toContain('[data-section="reactivity"]');
  });

  it("uses bright white, enlarged Chemical Profile titles and field labels", () => {
    expect(styles).toMatch(/chemical-profile-section h4[^}]*color: #fff;[^}]*font-size: 1\.05rem;[^}]*font-weight: 850;/s);
    expect(styles).toMatch(/chemical-profile-row > span[^}]*chemical-profile-list-row strong[^}]*color: #fff;[^}]*font-size: 0\.88rem;[^}]*font-weight: 850;/s);
    expect(styles).toMatch(/chemical-profile-meta-title[^}]*color: #fff;[^}]*font-size: 0\.7rem;[^}]*font-weight: 800;/s);
  });

  it("centers and emphasizes the Chemical Profile transport metadata", () => {
    expect(script).toContain("['Hazard Class', hazardClassDisplayLines(profile?.header?.hazardClass || profile?.header?.hazard || noCurrentDataText)]");
    expect(script).not.toContain("['Packing Group', profile?.header?.packingGroup");
    expect(styles).toMatch(/chemical-profile-meta-item[^}]*display: grid;[^}]*grid-template-rows: auto minmax\(2\.4rem, 1fr\);/s);
    expect(styles).toMatch(/data-field="un-na"[^}]*color: #ffd34f;[^}]*font-size: 1\.35rem;[^}]*font-weight: 400;/s);
    expect(styles).toMatch(/data-field="erg-guide"[^}]*color: #ff8a1c;[^}]*font-size: 1\.35rem;[^}]*font-weight: 400;/s);
    expect(styles).toMatch(/#lookup \.chemical-profile-meta\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/s);
  });

  it("provides green Guided Response and print/download profile actions", () => {
    expect(styles).toMatch(/#open-guided-response-btn[^}]*border-color: #70d59b;[^}]*background: #2e7d4f;/s);
    expect(html).toContain('id="profile-export-btn"');
    expect(html).toContain('id="profile-print-btn"');
    expect(html).toContain('id="profile-download-btn"');
    expect(script).toContain('function printCurrentChemicalProfile()');
    expect(script).toContain("document.body.classList.add('printing-chemical-profile')");
    expect(script).toContain('exportCurrentChemicalProfile()');
    expect(styles).toContain('body.printing-chemical-profile #chemical-id-results');
  });

  it("removes the Chemical ID subtitle and makes the Response reactivity profile full width", () => {
    expect(lookupHtml).not.toContain('Powered by Chemical Companion');
    expect(styles).toMatch(/data-active-tab="response"[^}]*data-section="reactivity-profile"[^}]*grid-column: 1 \/ -1;[^}]*width: 100%;/s);
    expect(styles).toMatch(/data-section="reactivity-profile"[^}]*chemical-profile-grid[^}]*grid-template-columns: minmax\(0, 1fr\);/s);
  });

  it("places Guided Response immediately before Open Plume Model", () => {
    const guided = html.indexOf('id="open-guided-response-btn"');
    const plume = html.indexOf('id="open-plume-btn"');
    expect(guided).toBeGreaterThan(-1);
    expect(plume).toBeGreaterThan(guided);
    expect(html).toMatch(/id="open-guided-response-btn"[^>]*>Guided Response<\/button>\s*<button[^>]*id="open-plume-btn"/s);
    expect(styles).not.toMatch(/#chemical-id-results #open-guided-response-btn\s*\{[^}]*display:\s*none;/s);
  });

  it("opens Guided Response from both Chemical Profile and Plume Model", () => {
    expect(html).toContain('id="open-guided-response-btn" type="button">Guided Response</button>');
    expect(html).toContain('id="plume-guided-response-btn" type="button">Guided Response</button>');
    expect(script).toContain("function openGuidedResponseWorkspace()");
    expect(script).toContain("guidedResponseReturnView = document.getElementById('plume')?.classList.contains('active') ? 'plume' : 'lookup'");
    expect(script).toContain("document.getElementById('open-guided-response-btn')?.addEventListener('click', openGuidedResponseWorkspace)");
    expect(script).toContain("document.getElementById('plume-guided-response-btn')?.addEventListener('click', openGuidedResponseWorkspace)");
    expect(styles).toMatch(/#plume \.plume-guided-response \{[\s\S]*?background: #2e7d4f;/);
  });

  it("provides the new view, required actions, and compact disclaimers", () => {
    expect(html).toContain('id="guided-response" class="view"');
    expect(guidedHtml).toContain('class="guided-response-logo" src="assets/hazmatiq-logo-transparent.png"');
    expect(guidedHtml).toMatch(/guided-response-logo[^>]*>[\s\S]*<div class="hazmat-page-hero-content">[\s\S]*<h1 class="hazmat-hero-title">Guided Response<\/h1>/s);
    expect(guidedHtml).toContain('SOURCE-VERIFIED TACTICAL RESPONSE GUIDELINES');
    for (const id of [
      "guided-open-profile-btn",
      "guided-open-plume-btn",
      "guided-open-map-btn",
      "guided-open-report-btn",
      "guided-save-record-btn",
      "guided-save-incident-btn",
      "guided-save-chemical-btn",
      "guided-back-btn",
    ]) expect(html).toContain(`id="${id}"`);
    expect(html).toContain("Missing, outdated, unsupported, or unverified values must be treated as No Current Data Exists.");
    expect(script).toContain("createGuidedRecommendationBand(decisionRecord)");
    expect(script).toContain("createGuidedResponseRoute(decisionRecord)");
    expect(script).toContain("'Critical Triggers / Escalation Cues'");
  });

  it("reuses selected state and blocks missing or unresolved chemical identity", () => {
    expect(script).toContain("function renderGuidedResponse()");
    expect(script).toContain("No chemical selected. Return to HAZARD ID and select a Chemical Companion master record.");
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
    expect(styles).toContain("font-size: clamp(2.35rem, 3.5vw, 3.25rem)");
    expect(styles).toContain("align-self: start");
    expect(styles).toContain("justify-self: start");
    expect(styles).toContain("text-align: center");
  });

  it("uses page-scoped navy hero text and menu controls over the light smoke image", () => {
    expect(styles).toMatch(/#guided-response \.hazmat-hero-title,[\s\S]*color: #082b4a !important;/);
    expect(styles).toMatch(/#guided-response \.internal-command-menu span,[\s\S]*background: #082b4a !important;/);
    expect(styles).toMatch(/#guided-response > \.guided-response-heading::before[\s\S]*rgba\(245, 248, 250, 0\.96\)/);
  });

  it("resolves the active incident chemical before rendering Guided Response", () => {
    expect(script).toContain("async function ensureGuidedResponseChemicalSelection(requestId)");
    expect(script).toContain("const targetId = activeIncident?.selectedChemicalId");
    expect(script).toContain("await ensureGuidedResponseChemicalSelection(requestId)");
    expect(script).toContain("else if (target === 'guided-response') void openGuidedResponseWorkspace();");
  });

  it("renders the four-box tactical decision flow with responsive connectors", () => {
    expect(script).toContain("Tactical Decision Flow");
    for (const title of ["Identify / Analyze", "Verify & Isolate", "Life Safety", "Mitigation"]) {
      expect(script).toContain(`'${title}'`);
    }
    expect(script.match(/createTacticalFlowArrow\(\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(script).toContain("stageGrid.className = 'guided-stage-grid'");
    for (const removed of ["Decision First", "Verify All Data", "Team Safety"]) {
      expect(guidedHtml).not.toContain(removed);
      expect(script).not.toContain(removed);
    }
  });

  it("uses readable, restrained typography throughout the tactical decision flow", () => {
    expect(styles).toMatch(/#guided-response \.guided-tactical-section-heading h3[^}]*font-size: 1\.12rem;/s);
    expect(styles).toMatch(/#guided-response \.guided-stage-card h4[^}]*font-size: 0\.93rem;/s);
    expect(styles).toMatch(/#guided-response \.guided-stage-card dt[^}]*font-size: 0\.72rem;/s);
    expect(styles).toMatch(/#guided-response \.guided-stage-card dd[^}]*font-size: 0\.68rem;/s);
  });

  it("does not place a selected-chemical box inside the title box", () => {
    expect(script).not.toContain("createGuidedResponseCard('Selected Chemical'");
    expect(script).not.toContain("guided-header-summary");
    expect(styles).not.toContain(".guided-header-summary");
  });

  it("promotes Tactical Decision Flow to the full-width first content section", () => {
    expect(script).toContain("const flow = document.createElement('section')");
    expect(script).toContain("dashboard.append(main, rail)");
    expect(script).toContain("container.append(dashboard)");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr) minmax(280px, 325px)");
  });

  it("prioritizes a source-backed SCBA decision and omits manufacturer lists", () => {
    expect(builder).toContain("const recommendation = profile.ppeRecommendation");
    expect(builder).toContain("'SCBA MANDATED'");
    expect(builder).toContain("recommendation.scbaRequired");
    const renderer = script.slice(script.indexOf("function renderGuidedResponse()"), script.indexOf("const chemicalSearchForm"));
    expect(renderer).not.toContain("createGuidedManufacturerPanel");
    expect(renderer).not.toContain("respiratorRecommendations are not displayed");
  });

  it("uses one fail-closed protection level and a controlled Level C cartridge status", () => {
    for (const level of [
      "Vapor Protective Level A w/ SCBA",
      "Level B w/ SCBA",
      "Level C w/ APR — Appropriate Cartridge Required",
      "Level D — No Chemical Protection Required",
      "Requires IC / HazMat Specialist Review",
    ]) expect(ppeEngine).toContain(level);
    expect(ppeEngine).toContain("failedLevelCChecks");
    expect(ppeEngine).toContain("conditions.cartridgeVerified === true");
    expect(ppeEngine).toContain("conditions.concentrationBelowLimits === true");
    expect(script).toContain("const ppeLevelTiles");
    expect(script).toContain("Source Details / Manufacturer Details");
  });

  it("uses the same concise PPE recommendation in Profile, Incident Dashboard, and Guided Response", () => {
    const profilePpeRenderer = script.slice(
      script.indexOf("{ key: 'ppeRespiratory'"),
      script.indexOf("{ key: 'detectors'"),
    );
    const incidentPpeRenderer = script.slice(
      script.indexOf('function buildIncidentPpeSummary'),
      script.indexOf('function buildIncidentMedicalSummary'),
    );
    expect(profilePpeRenderer).toContain('createPpeRecommendationCard(profile?.ppeRecommendation)');
    expect(profilePpeRenderer).not.toContain('recommendedPpe');
    expect(profilePpeRenderer).not.toContain('respiratorRecommendations');
    expect(incidentPpeRenderer).toContain('record?.profile?.ppeRecommendation');
    expect(builder).toContain('profile.ppeRecommendation');
    expect(script).toContain('ppeRecommendation: profile.ppeRecommendation');
    expect(script).toContain('PPE recommendations are source-backed planning guidance');
  });

  it("renders exactly four PPE option tiles and keeps raw options collapsed", () => {
    const tileDefinitions = script.slice(
      script.indexOf('const ppeLevelTiles'),
      script.indexOf('function appendPpeRecommendationList'),
    );
    expect(tileDefinitions.match(/'LEVEL_[A-D]_[^']+'/g)).toHaveLength(4);
    expect(script).toContain("const rawDetails = document.createElement('details')");
    expect(script).not.toContain('rawDetails.open = true');
    expect(styles).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));');
  });

  it("keeps the Tactical Decision Flow Life Safety stage compact and ordered", () => {
    const lifeFlow = script.slice(
      script.indexOf("createGuidedStageCard(3, 'Life Safety'"),
      script.indexOf("createGuidedStageCard(4, 'Mitigation'"),
    );
    const labels = ["PPE level", "Respiratory", "Entry control", "Decon"];
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
    expect(builder).toContain("'Offensive — Conditional Source Control'");
    expect(builder).toContain("'Defensive — Contain and Protect'");
    expect(script).toContain("mitigationDecisionSupport: decisions.mitigationDecisionSupport");
    expect(script).toContain("readyForIncidentExport: true");
    expect(script).toContain("Final mitigation strategy must be approved by Incident Command.");
    expect(builder).toContain("const offensiveAvailable = sourceControlFacts.length > 0");
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
