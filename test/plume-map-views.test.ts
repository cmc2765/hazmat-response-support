import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const plumeUi = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");
const radarUi = readFileSync(new URL("../server/public/weather-radar.js", import.meta.url), "utf8");
const liveMapBootstrap = readFileSync(new URL("../server/public/live-map-bootstrap.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../server/public/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../server/public/index.html", import.meta.url), "utf8");

describe("plume map views", () => {
  it("keeps one persistent map style when switching basemaps", () => {
    expect(plumeUi).not.toContain("plumeMap.setStyle(");
    expect(plumeUi).toContain("syncPlumeBasemapLayer();");
    expect(plumeUi).toContain("activePlumeMapView === 'satellite' ? 'visible' : 'none'");
  });

  it("supports wheel zoom on the single-screen plume map", () => {
    expect(plumeUi).toContain("plumeMap.scrollZoom.enable()");
    expect(plumeUi).not.toContain("plumeMap.scrollZoom.disable()");
  });

  it("uses an address control instead of plume-map attribution", () => {
    expect(html).toContain('id="plume-map-address-form"');
    expect(html).toContain('id="plume-map-address-input"');
    expect(plumeUi).toContain("attributionControl: false");
    expect(plumeUi).toContain("source: 'Manual plume address'");
    expect(plumeUi).toContain("source: 'Incident Brief address'");
  });

  it("keeps the Live Map in a single-screen flexible stage", () => {
    expect(styles).toContain(".app-shell:has(#map.active)");
    expect(styles).toContain("#map.view.active {\n    display: grid;");
    expect(styles).toContain("#map.active .live-map-stage,\n  #map.active #live-gis-map");
  });

  it("recreates each visible threat-zone layer independently", () => {
    for (const layerId of [
      "hazmat-threat-zones-fill",
      "hazmat-threat-zones-selection",
      "hazmat-threat-zones-border",
      "hazmat-threat-zones-outline",
    ]) {
      expect(plumeUi).toContain(`if (!plumeMap.getLayer('${layerId}'))`);
    }
  });

  it("publishes the latest plume for the Live Map", () => {
    expect(plumeUi).toContain("window.HazMatIQ.latestPlumeOverlay = overlay");
    expect(plumeUi).toContain("hazmatiq:plume-updated");
  });

  it("preserves a complete export-ready plume workflow without creating an incident", () => {
    expect(plumeUi).toContain("plumeModelResults: workflowRecord");
    expect(plumeUi).toContain("mode: activeIncident ? 'active-incident' : 'planning'");
    expect(plumeUi).toContain("const saved = getActiveIncident() ? incidentSelection : readPlanningState().selectedChemical");
    expect(html).not.toContain('id="plume-export-status"');
    expect(html).not.toContain('id="plume-mode-label"');
    expect(plumeUi).toContain("includeInIncidentReport: true");
    expect(plumeUi).toContain("reportReady: true");
    expect(plumeUi).toContain("decisionSupport: plumePlanningNotices[0]");
  });

  it("shows the four plume planning and verification notices", () => {
    expect(html.match(/class="plume-safety-disclaimer"/g)?.length).toBe(1);
    expect(html).toContain("HazMatIQ is a decision-support and planning tool.");
    expect(html).toContain("Plume results are planning estimates only");
    expect(html).toContain("No Current Data Exists");
    expect(html).toContain("Weather data source and observation time must be verified.");
  });

  it("labels readiness sources and does not infer PPE ensemble levels from partial text", () => {
    for (const status of [
      "Verified Source",
      "Imported Source",
      "Planning Estimate",
      "Manual Entry",
      "Needs Verification",
      "No Current Data Exists",
      "Blocked Pending Validation",
    ]) expect(plumeUi).toContain(status);
    expect(plumeUi).toContain("HazMatIQ does not infer an ensemble level from incomplete source coverage.");
    expect(plumeUi).toContain("Suit compatibility not verified from current source.");
    expect(plumeUi).not.toContain("hasScba ? (needsLevelA ? 'Level A' : 'Level B')");
  });

  it("stores structured source statuses and all required safety notices with incident data", () => {
    expect(plumeUi).toContain("weatherObservationTime:");
    expect(plumeUi).toContain("sourceStatuses: {");
    expect(plumeUi).toContain("safetyDisclaimers: {");
    expect(plumeUi).toContain("protectiveActionSummary");
    expect(html).toContain("External medical verification reference: CHEMM");
    expect(html).toContain("PPE and suit recommendations are decision-support guidance only.");
    expect(html).toContain("Verify all medical guidance, protective actions, isolation distances");
  });

  it("keeps imported plume overlays export-ready and distinct from backend estimates", () => {
    expect(plumeUi).toContain("const importedWorkflowRecord = {");
    expect(plumeUi).toContain("source: 'Operator-imported ALOHA / MARPLOT KML'");
    expect(plumeUi).toContain("savePlumeResult(activePlumeCommand, importedWorkflowRecord, await capturePlumeMapImage())");
    expect(plumeUi).toContain("HazMatIQ Plume Model · ${readinessStatus.planning}");
  });

  it("keeps the map face clear and populates results only from the Summary control", () => {
    expect(html).not.toContain('id="plume-result-summary-card"');
    expect(html).toContain("Plume Result Summary");
    expect(html).toContain('id="plume-incident-data-panel"');
    expect(html).toContain("Model Inputs Summary");
    expect(html).toContain("Weather Summary");
    expect(styles).not.toContain(".plume-result-summary-card");
    expect(plumeUi).toContain("plumeSummaryPanel?.addEventListener('toggle'");
    expect(plumeUi).toContain("if (plumeSummaryPanel.open) renderPlumeSummaryOnRequest()");
    expect(plumeUi).toContain("if (!plumeSummaryPanel?.open) return;");
    expect(html.match(/id="plot-plume-btn"/g)?.length).toBe(1);
  });

  it("aggregates required-field validation into an actionable plume message", () => {
    expect(plumeUi).toContain("Cannot plot plume yet. Missing: ${missingInputs.join(', ')}.");
    expect(plumeUi).toContain("Cannot plot plume yet. Missing: Incident Location.");
    expect(plumeUi).toContain("getMissingPlumeRequiredInputs()");
    expect(plumeUi).toContain("const saveMode = savePlumeResult(activePlumeCommand, workflowRecord");
  });

  it("plots baseline output as an explicitly unvalidated planning estimate", () => {
    expect(plumeUi).toContain("plume plotted for planning. Verify with field monitoring, weather observations, official modeling, and Incident Command.");
    expect(plumeUi).toContain("Planning Estimate — ${rangeTruncated ? 'at least ' : ''}${Math.round(maxDownwindM * 3.28084).toLocaleString()}");
    expect(plumeUi).toContain("Not independently validated");
    expect(plumeUi).toContain("validated: false");
    expect(plumeUi).toContain("generatedAt: createdAt");
    expect(html).toContain('id="plume-model-status-summary"');
    expect(html).toContain('id="plume-validation-status-summary"');
    expect(html).toContain('id="plume-limitations-summary"');
    expect(html).toContain("Baseline plume model has not been independently validated against published comparison cases unless validation results are shown.");
  });

  it("uses only verified AEGL zones with the required safety colors and weather freshness bands", () => {
    expect(plumeUi).toContain("const threatZoneColorNames = { 3: 'red', 2: 'orange', 1: 'yellow' }");
    expect(plumeUi).toContain("zone.thresholdKind === 'AEGL'");
    expect(plumeUi).toContain("if (ageMinutes <= 10) return { status: 'Current'");
    expect(plumeUi).toContain("if (ageMinutes <= 30) return { status: 'Recent / verify'");
    expect(plumeUi).toContain("if (ageMinutes <= 60) return { status: 'Stale'");
    expect(plumeUi).toContain("return { status: 'Expired'");
    expect(html).toContain('id="plume-weather-age"');
    expect(html).toContain('id="plume-endpoint-duration"');
    expect(html).toContain('id="plume-wind-direction" type="number"');
  });

  it("saves a structured plumeResult and preserves tactical safety boundaries", () => {
    for (const key of ["chemical:", "endpoint:", "weather:", "release:", "model:", "output:", "tacticalDecisionFlow:", "disclaimers:"]) {
      expect(plumeUi).toContain(key);
    }
    expect(plumeUi).toContain("lifeSafetyImpact: 'Plume output does not select or downgrade PPE");
    expect(plumeUi).toContain("mitigationImpact: 'Plume output alone does not justify offensive mitigation");
    expect(plumeUi).toContain("plumeResult,");
  });

  it("shows connected Threat Zone receptor and protective-action summaries", () => {
    expect(html).toContain('id="demographics-critical-receptors"');
    expect(html).toContain('id="demographics-protective-action"');
    expect(plumeUi).toContain("occupancy.education + occupancy.healthcare + occupancy.nursing + occupancy.critical");
  });

  it("separates mapped structures and Census geography totals from impacted-household estimates", () => {
    for (const id of [
      "demographics-structures",
      "demographics-census-households",
      "demographics-household-method",
      "demographics-household-status",
      "demographics-household-limitations",
    ]) expect(html).toContain(`id="${id}"`);
    expect(html).toContain("Census geographies may extend beyond the visible plume area");
    expect(plumeUi).toContain("householdEstimate: null");
    expect(plumeUi).toContain("exact: 'Exact field-verified count'");
    expect(plumeUi).toContain("building: 'Building-footprint estimate'");
    expect(plumeUi).toContain("areaWeighted: 'Area-weighted Census estimate'");
    expect(plumeUi).toContain("censusTotal: 'Census geography total'");
    expect(plumeUi).toContain("visual: 'Visual map estimate'");
    expect(plumeUi).toContain("structure count only");
    expect(plumeUi).toContain("not clipped to plume zone");
    expect(plumeUi).toContain("setDemographicMetric('demographics-housing', noCurrentDataText)");
    expect(plumeUi).toContain("householdEstimateMethod:");
    expect(plumeUi).toContain("householdEstimateStatus:");
  });

  it("supports Chemical Companion autocomplete in plume inputs", () => {
    expect(plumeUi).toContain("async function searchPlumeChemicals(value)");
    expect(plumeUi).toContain("async function selectPlumeChemical(chemical)");
    expect(plumeUi).toContain("Plume guidance blocked pending verified chemical link.");
    expect(plumeUi).toContain("Chemical Companion Master");
    expect(plumeUi).toContain("Transportation Identifier");
  });

  it("uses one shared high-definition radar controller in both maps", () => {
    expect(plumeUi).toContain("HazMatWeatherRadar.createController(plumeMap");
    expect(plumeUi).toContain("HazMatWeatherRadar.createController(liveMap");
    expect(liveMapBootstrap).toContain("HazMatWeatherRadar.createController(map");
    expect(liveMapBootstrap).not.toContain("radar_base_reflectivity/MapServer/export");
    expect(radarUi).toContain("const IMAGE_SIZE = 1024");
    expect(radarUi).toContain("'raster-resampling': 'linear'");
  });

  it("keeps radar below plume geometry and never removes plume sources during refresh", () => {
    expect(plumeUi).toContain("beforeLayerId: 'hazmat-threat-zones-fill'");
    expect(plumeUi).toContain("beforeLayerId: livePlumeFillLayerId");
    expect(radarUi).toContain("layer.id.includes('plume') && layer.type === 'fill'");
    expect(radarUi).not.toContain("removeSource('hazmat-threat-zones'");
    expect(radarUi).not.toContain("removeSource('live-plume-overlay'");
    expect(radarUi).toContain("setTiles([tiles(3)])");
  });

  it("does not apply radar enhancement filters to the entire map canvas", () => {
    expect(styles).not.toContain("radar-enhanced #live-gis-map canvas");
  });

  it("uses a map-first Plume Model layout with three supporting cards below it", () => {
    expect(html.indexOf('id="plume-model-form"')).toBeLessThan(html.indexOf('class="plume-map-layout"'));
    expect(html.indexOf('id="plume-demographics"')).toBeGreaterThan(html.indexOf('class="plume-map-layout"'));
    expect(html.match(/id="plume-demographics"/g)?.length).toBe(1);
    expect(html).toContain('class="plume-lower-summary-grid"');
    expect(html).not.toContain('id="plume-map-legend"');
    expect(html).not.toContain("<strong>Threat zones</strong>");
    expect(plumeUi).not.toContain("document.querySelector('.layout')?.append(plumeMapWorkspace)");
    expect(plumeUi).not.toContain("plumeMapWorkspace.append(document.getElementById('plume-demographics'))");
    expect(styles).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(styles).toContain("#plume #plume-demographics { grid-column: 1; }");
    expect(styles).toContain("#plume .plume-model-section:first-child { grid-column: 2; }");
    expect(styles).toContain("grid-column: 3;");
    expect(styles).toContain("height: clamp(560px, 65dvh, 700px)");
    expect(styles).toContain("#plume #plume-demographics { order: 4; }");
    expect(styles).toContain("#plume .plume-model-section:first-child { order: 5; }");
    expect(styles).toContain("#plume .plume-model-section:nth-child(2) { order: 6; }");
    expect(styles).toContain("overflow: visible;");
    expect(plumeUi).toContain("document.getElementById('plume-model-form')?.addEventListener('submit'");
    expect(plumeUi).toContain("document.querySelectorAll('[data-plume-layer]')");
  });

  it("scopes the desktop three-column command layout away from Chemical ID", () => {
    expect(styles).toContain(".layout:has(#incident.active) > .content-area");
    expect(styles).toContain("grid-template-columns: minmax(520px, 56fr) minmax(220px, 22fr)");
    expect(styles).not.toContain(".layout:has(#lookup.active)");
    expect(plumeUi).toContain("new ResizeObserver");
  });

  it("keeps HazMat Command across the top and uses the four requested right-rail dropdowns", () => {
    expect(styles).toContain(".layout:has(#incident.active) .incident-command-snapshot");
    expect(styles).toContain("grid-column: 1 / -1");
    for (const label of ['E-Plan Login', 'PPE Requirements', 'Medical Summary', 'Protective Actions']) {
      expect(html).toContain(`<summary>${label}</summary>`);
    }
    expect(html.match(/data-command-reference/g)?.length).toBe(4);
    expect(plumeUi).toContain("document.querySelectorAll('[data-command-reference][open]')");
  });
});
