import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const plumeUi = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");
const radarUi = readFileSync(new URL("../server/public/weather-radar.js", import.meta.url), "utf8");
const radarProviders = readFileSync(new URL("../server/public/weather-radar-providers.js", import.meta.url), "utf8");
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
    expect(html).toContain("PPE recommendations are source-backed planning guidance");
    expect(html).toContain("Verify all medical guidance, protective actions, isolation distances");
  });

  it("keeps imported plume overlays export-ready and distinct from backend estimates", () => {
    expect(plumeUi).toContain("const importedWorkflowRecord = {");
    expect(plumeUi).toContain("modelMode: official ? 'OFFICIAL_ALOHA_IMPORT' : 'REQUIRES_SOURCE_REVIEW'");
    expect(plumeUi).toContain("HazMatIQ displays this imported output and does not recalculate or validate it.");
    expect(plumeUi).toContain("savePlumeResult(activePlumeCommand, importedWorkflowRecord, geojson ? await capturePlumeMapImage() : '')");
    expect(plumeUi).toContain("HazMatIQ Plume Model · ${readinessStatus.planning}");
  });

  it("keeps the map face clear and populates results only from the Summary control", () => {
    expect(html).not.toContain('id="plume-result-summary-card"');
    expect(html).toContain("Plume Summary");
    expect(html).toContain('id="plume-incident-data-panel"');
    expect(html).toContain("Model Inputs Summary");
    expect(html).toContain("Weather Summary");
    expect(styles).not.toContain(".plume-result-summary-card");
    expect(plumeUi).toContain("plumeSummaryPanel?.addEventListener('toggle'");
    expect(plumeUi).toContain("if (plumeSummaryPanel.open) {");
    expect(plumeUi).toContain("renderPlumeSummaryOnRequest();");
    expect(plumeUi).toContain("if (!plumeSummaryPanel?.open) return;");
    expect(plumeUi).toContain("function constrainPlumeSummaryToMap()");
    expect(plumeUi).toContain("Math.min(mapHeight, visiblePageHeight)");
    expect(styles).toContain("#plume #plume-incident-data-panel .plume-summary-content");
    expect(styles).toContain("overflow-y: auto;");
    expect(html.match(/id="plot-plume-btn"/g)?.length).toBe(1);
  });

  it("aggregates required-field validation into an actionable plume message", () => {
    expect(plumeUi).toContain("Cannot plot plume yet. Missing: ${missingInputs.join(', ')}.");
    expect(plumeUi).toContain("Cannot plot plume yet. Missing: Incident Location.");
    expect(plumeUi).toContain("getMissingPlumeRequiredInputs()");
    expect(plumeUi).toContain("const saveMode = savePlumeResult(activePlumeCommand, workflowRecord");
  });

  it("plots baseline output as an explicitly unvalidated planning estimate", () => {
    expect(plumeUi).not.toContain("plume plotted for planning. Verify with field monitoring, weather observations, official modeling, and Incident Command.");
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

  it("uses a distinct ERG fallback overlay and a manual-review no-data mode", () => {
    expect(html).toContain('id="plume-erg-spill-size"');
    expect(html).toContain('id="plume-erg-period"');
    expect(plumeUi).toContain("function ergOverlayToGeoJson(result, origin)");
    expect(plumeUi).toContain("overlayMode: 'erg-protective-action'");
    expect(plumeUi).toContain("color: '#ff7a00'");
    expect(plumeUi).toContain('ERG Initial Isolation / Protective Action Overlay — not a modeled plume.');
    expect(plumeUi).toContain('Bright orange: ERG Initial Isolation / Protective Action guide area — not a toxic concentration zone');
    expect(plumeUi).toContain('No Current Data Exists');
    expect(plumeUi).toContain('Manual / Incident Command review required');
  });

  it("provides independent ERG isolation and Weather Data toolbar toggles", () => {
    expect(html).toContain('id="toggle-erg-isolation-btn"');
    expect(html).toContain('id="toggle-plume-weather-btn"');
    expect(html).toContain('id="plume-weather-data-panel" aria-labelledby="plume-weather-data-heading" hidden');
    expect(plumeUi).toContain("async function toggleErgIsolationOverlay()");
    expect(plumeUi).toContain("features.filter((feature) => feature.properties?.zoneId === 'erg-initial-isolation')");
    expect(plumeUi).toContain("clearErgIsolationOverlay('ERG Initial Isolation Distance hidden.')");
    expect(plumeUi).toContain("panel.hidden = !willOpen");
    expect(styles).toContain("#plume .plume-layer-controls .plume-erg-layer-btn");
    expect(styles).toContain("#plume .plume-layer-controls .plume-weather-layer-btn");
  });

  it("places Plot Plume before the ERG and Weather controls at matching toolbar size", () => {
    const plotIndex = html.indexOf('id="plot-plume-btn"');
    const ergIndex = html.indexOf('id="toggle-erg-isolation-btn"');
    const weatherIndex = html.indexOf('id="toggle-plume-weather-btn"');

    expect(plotIndex).toBeGreaterThan(-1);
    expect(plotIndex).toBeLessThan(ergIndex);
    expect(ergIndex).toBeLessThan(weatherIndex);
    expect(styles).toContain("#plume .plume-layer-controls .plume-plot-btn");
    expect(styles).toContain("grid-template-columns: repeat(5, minmax(92px, 1fr));");
  });

  it("uses a compact full-width Model Inputs workspace", () => {
    expect(styles).toContain("#plume.view.active {\n    grid-template-columns: minmax(0, 1fr);");
    expect(styles).toContain("#plume .plume-model-section:first-child {\n    grid-column: 1 / -1;");
    expect(styles).toContain("max-height: 310px;");
    expect(styles).toContain("grid-template-columns: repeat(6, minmax(0, 1fr));");
    expect(styles).toContain("grid-template-columns: repeat(7, minmax(0, 1fr));");
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
    expect(plumeUi).toContain("occupancy.education + healthcareFacilities + occupancy.critical");
  });

  it("uses five selected-area metrics and keeps Census totals in collapsed context", () => {
    for (const metric of ["residentialHomes", "currentPopulation", "criticalInfrastructure", "healthcareFacilities", "schools"]) {
      expect(html).toContain(`data-threat-metric="${metric}"`);
    }
    expect(html.match(/data-threat-metric=/g)).toHaveLength(5);
    for (const id of [
      "demographics-structures",
      "demographics-census-households",
      "demographics-household-method",
      "demographics-household-status",
      "demographics-household-limitations",
    ]) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('class="threat-zone-estimate-details" hidden');
    expect(html).toContain("Census geographies and facility datasets may be incomplete or extend beyond the selected area");
    expect(plumeUi).toContain("householdEstimate: null");
    expect(plumeUi).toContain("building: 'Building-footprint estimate'");
    expect(plumeUi).toContain("setThreatZoneMetric('currentPopulation', null, '', '', false)");
    expect(plumeUi).toContain("Nearby Census totals are context only and are not selected-zone counts.");
    expect(plumeUi).toContain("window.HazMatIQ.threatZoneImpactSummary");
    expect(plumeUi).toContain("if (panel) panel.open = true");
    expect(styles).toContain("#plume.view.active #plume-demographics[open]");
    expect(styles).toContain("#plume #plume-demographics .plume-threat-zone-content");
    expect(styles).toContain("position: absolute;");
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

  it("uses the provider radar controller only on Live Map", () => {
    expect(plumeUi).not.toContain("HazMatWeatherRadar.createController(plumeMap");
    expect(plumeUi).toContain("HazMatWeatherRadar.createController(liveMap");
    expect(liveMapBootstrap).toContain("HazMatWeatherRadar.createController(map");
    expect(html).not.toContain('data-plume-layer="radar"');
    expect(html).toContain('class="plume-live-radar-link"');
    expect(html).toContain('data-live-layer="weatherRadar"');
    expect(html).not.toContain('class="live-radar-panel"');
    expect(html).not.toContain('id="live-radar-provider"');
    expect(html).not.toContain('id="live-radar-opacity"');
    expect(radarProviders).toContain("radar_base_reflectivity_time/ImageServer");
    expect(radarUi).toContain("const DEFAULT_OPACITY = 0.58");
    expect(radarUi).toContain("'raster-resampling': 'linear'");
    expect(plumeUi).toContain("liveRadarController.setOpacity(0.58)");
  });

  it("keeps only one primary radar and the official NOAA fallback in the runtime registry", () => {
    expect(radarProviders).toContain("RAINVIEWER_VISUAL_PROTOTYPE");
    expect(radarProviders).toContain("NOAA_MRMS_OFFICIAL_FALLBACK");
    for (const removed of ["RADRVIEW_SELF_HOSTED", "LIBREWXR_SELF_HOSTED", "TOMORROW_IO_VISUAL", "AERIS_MAPSGL_VISUAL", "MAPBOX_WEATHER_VISUAL", "AWN_EXTERNAL"]) {
      expect(radarProviders).not.toContain(removed);
    }
    expect(radarProviders).toContain("getFrames");
    expect(radarProviders).toContain("getLatestFrame");
    expect(radarUi).toContain("await activate(registry.IDS.NOAA, false)");
  });

  it("keeps radar below plume geometry and never removes plume sources during refresh", () => {
    expect(plumeUi).toContain("beforeLayerId: livePlumeFillLayerId");
    expect(radarUi).toContain("layer.id.includes('plume') && layer.type === 'fill'");
    expect(radarUi).not.toContain("removeSource('hazmat-threat-zones'");
    expect(radarUi).not.toContain("removeSource('live-plume-overlay'");
    expect(radarUi).toContain("source?.setTiles");
  });

  it("does not apply radar enhancement filters to the entire map canvas", () => {
    expect(styles).not.toContain("radar-enhanced #live-gis-map canvas");
  });

  it("places adjacent Plume Summary and Threat Zone controls above the plume map", () => {
    expect(html.indexOf('id="plume-model-form"')).toBeLessThan(html.indexOf('class="plume-map-layout"'));
    expect(html.indexOf('id="plume-demographics"')).toBeLessThan(html.indexOf('class="plume-map-layout"'));
    expect(html.indexOf('id="plume-incident-data-panel"')).toBeLessThan(html.indexOf('id="plume-demographics"'));
    expect(html.match(/id="plume-demographics"/g)?.length).toBe(1);
    expect(html).not.toContain('class="plume-lower-summary-grid"');
    expect(html).not.toContain('id="plume-demographics" open');
    expect(html).toContain('<summary>Plume Summary</summary>');
    expect(html).toContain('<summary>Threat Zone</summary>');
    expect(html).not.toContain('id="plume-map-legend"');
    expect(html).not.toContain("<strong>Threat zones</strong>");
    expect(plumeUi).not.toContain("document.querySelector('.layout')?.append(plumeMapWorkspace)");
    expect(plumeUi).not.toContain("plumeMapWorkspace.append(document.getElementById('plume-demographics'))");
    expect(styles).toContain("#plume #plume-incident-data-panel > summary");
    expect(styles).toContain("background: var(--yellow);");
    expect(styles).toContain("#plume #plume-demographics > summary");
    expect(styles).toContain("background: var(--red);");
    expect(styles).toContain("height: clamp(560px, 65dvh, 700px)");
    expect(styles).toContain("#plume #plume-demographics .plume-threat-zone-content");
    expect(styles).toContain("overflow-y: auto;");
    expect(styles).toContain("overflow: visible;");
    expect(plumeUi).toContain("document.getElementById('plume-model-form')?.addEventListener('submit'");
    expect(plumeUi).toContain("document.querySelectorAll('[data-plume-layer]')");
  });

  it("scopes the desktop three-column command layout away from Chemical ID", () => {
    expect(styles).toContain(".layout:has(#incident.active) > .content-area");
    expect(styles).toContain("grid-template-columns: minmax(520px, 56fr) minmax(220px, 22fr)");
    expect(styles).not.toMatch(/\.layout:has\(#lookup\.active\)[^{]*\{[^}]*grid-template-columns:\s*minmax\(520px, 56fr\)/s);
    expect(plumeUi).toContain("new ResizeObserver");
  });

  it("keeps HazMat Command across the top and uses the four requested right-rail dropdowns", () => {
    expect(styles).toContain(".layout:has(#incident.active) .incident-command-snapshot");
    expect(styles).toContain("grid-column: 1 / -1");
    for (const label of ['E-Plan Login', 'PPE Requirements', 'Medical Summary', 'Protective Actions']) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    for (const image of [
      'protective_actions_incident_command_dashboard.png',
      'hazmat_ppe_requirements_dashboard.png',
      'emergency_medical_summary_dashboard.png',
      'secure_e_plan_login_dashboard.png',
    ]) expect(html).toContain(`assets/incident-dashboard/cards/${image}`);
    expect(html.match(/class="incident-image-bubble__bg"/g)?.length).toBe(4);
    expect(html.match(/class="incident-image-bubble__bg"[^>]*alt=""[^>]*draggable="false"/g)?.length).toBe(4);
    expect(html.match(/class="incident-image-bubble__bg"[^>]*loading="eager"/g)?.length).toBe(4);
    expect(styles).toContain("border: 2px solid var(--red);");
    expect(styles).toContain("z-index: 0;");
    expect(styles).not.toContain("background: #0b1f33;\n  box-shadow: 0 10px 24px");
    expect(styles).toContain('.command-reference-panel[open] .command-reference-content');
    expect(styles).toContain('right: calc(100% + 8px);');
    expect(styles).toContain('width: min(720px, 235%);');
    expect(html.match(/data-command-reference/g)?.length).toBe(4);
    expect(plumeUi).toContain("document.querySelectorAll('[data-command-reference][open]')");
  });
});
