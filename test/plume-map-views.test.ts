import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const plumeUi = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");
const radarUi = readFileSync(new URL("../server/public/weather-radar.js", import.meta.url), "utf8");
const radarProviders = readFileSync(new URL("../server/public/weather-radar-providers.js", import.meta.url), "utf8");
const liveMapBootstrap = readFileSync(new URL("../server/public/live-map-bootstrap.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../server/public/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../server/public/index.html", import.meta.url), "utf8");
const plumeHtml = html.slice(html.indexOf('<section id="plume"'), html.indexOf('<section id="map"'));

describe("plume map views", () => {
  it("keeps one persistent map style when switching basemaps", () => {
    expect(plumeUi).not.toContain("plumeMap.setStyle(");
    expect(plumeUi).toContain("syncPlumeBasemapLayer();");
    expect(plumeUi).toContain("activePlumeMapView === 'street' ? 'none' : 'visible'");
  });

  it("supports wheel zoom on the single-screen plume map", () => {
    expect(plumeUi).toContain("plumeMap.scrollZoom.enable()");
    expect(plumeUi).not.toContain("plumeMap.scrollZoom.disable()");
  });

  it("uses an address control instead of plume-map attribution", () => {
    expect(html).toContain('id="plume-map-address-form"');
    expect(html).toContain('id="plume-map-address-input"');
    expect(html).toContain('placeholder="Enter address, coordinates, or use incident location"');
    expect(html).toContain('id="use-plume-incident-location-btn"');
    expect(plumeUi).toContain("attributionControl: false");
    expect(plumeUi).toContain("'Manual plume coordinates' : 'Manual plume address'");
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
    expect(plumeHtml).not.toContain('class="plume-safety-disclaimer"');
    expect(plumeHtml).toContain('class="plume-planning-notices"');
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

  it("keeps ALOHA and benchmark tooling off the operational responder page", () => {
    expect(plumeHtml).not.toMatch(/ALOHA|benchmark|comparison case|validation workbench/i);
    expect(plumeHtml).not.toContain('type="file" accept=".kml');
    expect(plumeUi).not.toContain("function importModelOverlay(");
    expect(plumeUi).not.toContain("function kmlToGeoJson(");
    expect(plumeUi).not.toContain("plume-aloha-import");
  });

  it("keeps the map face clear and shows Threat Zone without a redundant Plume Summary", () => {
    expect(html).not.toContain('id="plume-result-summary-card"');
    expect(plumeHtml).not.toContain("Plume Summary");
    expect(plumeHtml).not.toContain('id="plume-incident-data-panel"');
    expect(html).toContain("Model Inputs Summary");
    expect(html).toContain("Weather Details");
    expect(styles).not.toContain(".plume-result-summary-card");
    expect(html).toContain('id="plume-results-section" aria-label="Plume results" hidden');
    expect(plumeUi).toContain("if (resultsSection) resultsSection.hidden = false");
    expect(plumeHtml).not.toContain('class="plume-summary-row"');
    expect(plumeHtml).toContain('<h3>Threat Zone</h3>');
    expect(html).toContain('<summary>Model Details</summary>');
    expect(html.match(/id="plot-plume-btn"/g)?.length).toBe(1);
  });

  it("aggregates required-field validation into an actionable plume message", () => {
    expect(plumeUi).toContain("Cannot plot plume yet. Missing: ${missingInputs.join(', ')}.");
    expect(plumeUi).toContain("Cannot plot plume yet. Missing: Incident Location.");
    expect(plumeUi).toContain("getMissingPlumeRequiredInputs()");
    expect(plumeUi).toContain("const saveMode = savePlumeResult(activePlumeCommand, workflowRecord");
  });

  it("plots baseline output as an operational Planning Plume without validation interaction", () => {
    expect(plumeUi).not.toContain("plume plotted for planning. Verify with field monitoring, weather observations, official modeling, and Incident Command.");
    expect(plumeUi).toContain("Planning Plume — ${rangeTruncated ? 'at least ' : ''}${Math.round(maxDownwindM * 3.28084).toLocaleString()}");
    expect(plumeUi).toContain("validated: false");
    expect(plumeUi).toContain("generatedAt: createdAt");
    expect(html).toContain('id="plume-model-status-summary"');
    expect(plumeHtml).not.toContain('id="plume-validation-status-summary"');
    expect(html).toContain('id="plume-limitations-summary"');
    expect(plumeHtml).not.toMatch(/published comparison cases|validation results/i);
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
    expect(plumeUi).toContain('No Model / No Distance Available');
  });

  it("keeps weather in the operational flow and ERG as an automatic fallback", () => {
    expect(plumeHtml).not.toContain('id="toggle-erg-isolation-btn"');
    expect(plumeHtml).not.toContain('id="toggle-plume-weather-btn"');
    expect(plumeHtml).toContain('id="plume-weather-data-panel" aria-labelledby="plume-weather-data-heading"');
    expect(plumeHtml).not.toContain('id="plume-weather-data-panel" aria-labelledby="plume-weather-data-heading" hidden');
    expect(plumeHtml).toContain('id="plume-erg-spill-size" type="hidden" value="large"');
    expect(plumeHtml).toContain('id="plume-erg-period" type="hidden" value="night"');
    expect(plumeUi).toContain("availability.result?.mode === 'aegl-plume'");
    expect(plumeUi).toContain("availability.result?.mode === 'erg-protective-action'");
  });

  it("shows safe Plume Readiness reasons for missing weather and release inputs", () => {
    for (const id of [
      'plume-readiness-cas', 'plume-endpoint-badge', 'plume-readiness-erg',
      'plume-weather-badge', 'plume-source-strength-badge', 'plume-model-mode-badge', 'plume-input-status',
    ]) expect(plumeHtml).toContain(`id="${id}"`);
    expect(plumeUi).toContain("new Set(['Wind Speed', 'Wind Direction', 'Temperature', 'Current Weather Observation', 'Configured Live Weather Source'])");
    expect(plumeUi).toContain("Manual Entry — verify field conditions.");
    expect(plumeUi).toContain("`AEGL / LOC found. Missing: ${missing.join(', ')}.`");
    expect(plumeUi).toContain("`Missing: ${missingRelease.join(', ')}.`");
  });

  it("keeps the operational workflow without a fake step strip or validation interaction", () => {
    expect(plumeHtml).not.toContain('class="plume-operational-flow"');
    expect(plumeHtml.indexOf('Chemical Release')).toBeLessThan(plumeHtml.indexOf('Weather Data'));
    expect(plumeHtml.indexOf('Weather Data')).toBeLessThan(plumeHtml.indexOf('id="plot-plume-btn"'));
    expect(plumeHtml.indexOf('id="plot-plume-btn"')).toBeLessThan(plumeHtml.indexOf('id="plume-demographics"'));
    expect(plumeUi).toContain("function scheduleAutomaticPlanningPlume()");
    expect(plumeUi).toContain("Calculating Planning Plume");
    expect(plumeUi).toContain("Live weather unavailable — enter wind direction and wind speed.");
    expect(plumeHtml).not.toMatch(/validation workbench|comparison case|import.*ALOHA/i);
  });

  it("renders a clean plume-graphic hero and a 32/68 map-first workspace", () => {
    for (const id of ['plume-header-chemical', 'plume-header-identifiers']) {
      expect(plumeHtml).toContain(`id="${id}"`);
    }
    expect(plumeHtml).not.toContain('class="plume-readiness-strip"');
    expect(plumeHtml).not.toContain('class="plume-chip"');
    expect(plumeHtml).toContain('class="plume-hero-plume"');
    expect(plumeHtml).toContain('id="plume-aegl-one"');
    expect(plumeHtml).toContain('id="plume-aegl-two"');
    expect(plumeHtml).toContain('id="plume-aegl-three"');
    expect(plumeHtml).toContain('class="plume-hero-cap cap-one"');
    expect(plumeHtml).toContain('class="plume-hero-cap cap-two"');
    expect(plumeHtml).toContain('class="plume-hero-cap cap-three"');
    expect(plumeHtml).toContain('d="M14 28 L78 9 A9 19 0 0 1 78 47 Z"');
    expect(styles).toContain('grid-template-columns: minmax(350px, 32fr) minmax(620px, 68fr);');
    expect(styles).toContain('height: clamp(620px, 70vh, 820px) !important;');
    expect(plumeHtml).not.toContain('<summary>Advanced Release Inputs</summary>');
    expect(plumeHtml.indexOf('id="plume-release-quantity"')).toBeLessThan(plumeHtml.indexOf('id="plume-release-height"'));
    expect(plumeHtml).toContain('Release height (ft) <b class="plume-optional-label">Optional</b>');
    expect(plumeHtml).toContain('Weather Details');
  });

  it("keeps mandatory release and weather inputs visible, red, and explicitly required", () => {
    for (const id of [
      'plume-chemical-input', 'plume-release-type', 'plume-release-quantity',
      'plume-release-duration', 'plume-wind-speed', 'plume-wind-direction', 'plume-temperature',
    ]) expect(plumeHtml).toContain(`id="${id}"`);
    expect(plumeHtml.match(/plume-required-field/g)).toHaveLength(8);
    expect(plumeHtml.match(/<b>Required<\/b>/g)).toHaveLength(8);
    expect(styles).toContain('#plume .plume-required-field input');
    expect(styles).toContain('border: 2px solid #c1121f !important;');
    expect(styles).toContain('#plume .plume-required-field.is-complete input');
    expect(styles).toContain('border: 1px solid #7996af !important;');
    expect(plumeUi).toContain('function updateRequiredPlumeFieldStyles()');
    expect(plumeUi).toContain("classList.toggle('is-complete', isComplete)");
    expect(plumeUi).toContain("const releaseHeightFt = releaseHeightFtValue === '' ? 0 : Number(releaseHeightFtValue);");
    expect(plumeUi).not.toContain("missing.push('Release Height')");
  });

  it("accepts continuous release duration in minutes and converts it for the seconds-based model API", () => {
    expect(plumeHtml).toContain('Release duration (minutes) <b>Required</b>');
    expect(plumeHtml).toContain('id="plume-release-duration" type="number" min="0.1" step="0.1" inputmode="decimal" placeholder="Required in minutes"');
    expect(plumeUi).toContain("(Number(document.getElementById('plume-release-duration')?.value) * 60) || null");
    expect(plumeHtml).toContain('Puff evaluation time (seconds)');
  });

  it("uses readable white operational cards and keeps the map face unobstructed", () => {
    expect(plumeHtml).toContain('id="plume-weather-data-heading">Weather Data</strong>');
    expect(plumeHtml).not.toContain('id="plume-map-empty-accent"');
    expect(styles).toContain('background: #fff !important;');
    expect(styles).toContain('color: #061a2e !important;');
    expect(plumeUi).toContain('Current weather: ${latestPlumeWeather.source}.');
  });

  it("keeps Weather Data compact and removes the duplicated live-weather message from the layout", () => {
    expect(plumeHtml).not.toContain('id="plume-weather-prompt"');
    expect(plumeHtml).toContain('class="ghost-btn plume-weather-refresh" id="use-live-plume-weather-btn"');
    expect(styles).toContain('/* Compact, data-first Weather Data card. */');
    expect(styles).toContain('#plume .plume-control-column .plume-weather-grid');
    expect(styles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;');
    expect(styles).toContain('#plume .plume-weather-verification');
    expect(styles).toContain('background: #f8fafc !important;');
    const detailsStart = plumeHtml.indexOf('class="plume-input-review plume-weather-review"');
    const verificationStart = plumeHtml.indexOf('class="plume-weather-verification"');
    expect(verificationStart).toBeGreaterThan(detailsStart);
    expect(plumeHtml).not.toMatch(/plume-weather-verification[\s\S]*<details class="plume-input-review plume-weather-review"/);
  });

  it("provides safe basemap, terrain, building, compass, and wind-direction controls", () => {
    for (const view of ['satellite', 'street', 'terrain3d']) {
      expect(plumeHtml).toContain(`data-plume-map-view="${view}"`);
    }
    expect(plumeHtml).toContain('id="plume-buildings-toggle" type="button" aria-pressed="false" disabled');
    expect(plumeHtml).toContain('id="plume-reset-view-btn"');
    expect(plumeHtml).toContain('data-plume-layer="distance" aria-pressed="false">Distance</button>');
    for (const action of ['rotate-left', 'rotate-right', 'tilt-up', 'tilt-down', 'reset-north']) {
      expect(plumeHtml).toContain(`data-plume-camera="${action}"`);
    }
    expect(plumeUi).toContain('3D Terrain source not configured. Using pitched satellite view only.');
    expect(plumeUi).toContain('3D building height data not configured.');
    expect(plumeUi).toContain('Math.max(0, Math.min(70, plumeMap.getPitch() + delta))');
    expect(plumeUi).toContain('Wind from ${Math.round(windFromDegrees)}° · Downwind ${Math.round((windFromDegrees + 180) % 360)}°');
    expect(plumeUi).toContain("'hazmat-threat-zone-wind-label'");
    expect(plumeUi).not.toContain('plumeMap.setTerrain(');
    expect(plumeUi).not.toMatch(/addSource\([^)]*(?:dem|terrain|elevation)/i);
  });

  it("uses one map-toolbar Plot Plume action for the operational form submit", () => {
    expect(plumeHtml.match(/id="plot-plume-btn"/g)).toHaveLength(1);
    expect(plumeHtml).not.toContain('id="plot-plume-map-btn"');
    expect(plumeHtml).not.toContain('class="plume-compact-card plume-plot-card"');
    expect(plumeHtml).toContain('id="plot-plume-btn" type="submit" form="plume-model-form" disabled>Plot Plume</button>');
    expect(plumeUi).not.toContain('mapPlumePlotButton');
    expect(plumeUi).toContain('setPlumeMapResultVisible(true)');
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
    expect(html).toContain("Verify affected areas with local GIS, field reconnaissance, field monitoring, and Incident Command");
    expect(plumeUi).toContain("householdEstimate: null");
    expect(plumeUi).toContain("building: 'Building-footprint estimate'");
    expect(plumeUi).toContain("setThreatZoneMetric('currentPopulation', null, '', '', false)");
    expect(plumeUi).toContain("Nearby Census totals are context only and are not selected-zone counts.");
    expect(plumeUi).toContain("window.HazMatIQ.threatZoneImpactSummary");
    expect(plumeUi).not.toContain("if (panel) panel.open = true");
    expect(styles).toContain("#plume .plume-threat-metrics");
    expect(styles).toContain("grid-template-columns: repeat(5, minmax(0, 1fr));");
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
    expect(html).toContain('plume-live-radar-link" type="button" data-view="map"');
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

  it("places the map toolbar above the enlarged map and Threat Zone after it", () => {
    expect(html.indexOf('id="plume-model-form"')).toBeLessThan(html.indexOf('class="plume-map-column"'));
    expect(html.indexOf('id="plume-map-address-form"')).toBeLessThan(html.indexOf('id="plume-gis-map"'));
    expect(html.indexOf('class="plume-layer-row"')).toBeLessThan(html.indexOf('id="plume-gis-map"'));
    expect(html.indexOf('id="plume-gis-map"')).toBeLessThan(html.indexOf('id="plume-demographics"'));
    expect(html.match(/id="plume-demographics"/g)?.length).toBe(1);
    expect(html).not.toContain('<h3>Plume Summary</h3>');
    expect(html).toContain('<h3>Threat Zone</h3>');
    expect(html).toContain('>3D Terrain</button>');
    expect(html).not.toContain('>Street 3D</button>');
    expect(html).not.toContain('id="plume-map-legend"');
    expect(styles).toContain("#plume .plume-map-toolbar");
    expect(styles).toContain("height: clamp(700px, 78vh, 920px) !important;");
    expect(styles).toContain("grid-template-columns: minmax(320px, 27fr) minmax(680px, 73fr);");
    expect(styles).toContain("#plume .plume-results-grid");
    expect(plumeUi).toContain("document.getElementById('plume-model-form')?.addEventListener('submit'");
    expect(plumeUi).toContain("document.querySelectorAll('[data-plume-map-view]')");
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
