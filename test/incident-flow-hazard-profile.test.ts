import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../server/public/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");
const compareScript = readFileSync(new URL("../server/public/chem-compare.js", import.meta.url), "utf8");
const incidentStyles = readFileSync(new URL("../server/public/incident-overrides.css", import.meta.url), "utf8");
const chemicalStyles = readFileSync(new URL("../server/public/chemical-intel.css", import.meta.url), "utf8");
const profilePageStyles = readFileSync(new URL("../server/public/hazard-profile-page.css", import.meta.url), "utf8");
const guidedStyles = readFileSync(new URL("../server/public/guided-response-overrides.css", import.meta.url), "utf8");

describe("Incident decision flow and Hazard ID profile loading", () => {
  it("uses the five requested command decisions", () => {
    const flow = html.slice(
      html.indexOf('<section class="incident-command-flow"'),
      html.indexOf('<div class="incident-command-main-grid">'),
    );

    expect(flow.match(/<article>/g)).toHaveLength(5);
    for (const title of [
      "1. Scene Size-Up",
      "2. Public Protection",
      "3. Plume Model",
      "4. Tactical Decision",
      "5. Document / Report",
    ]) expect(flow).toContain(title);
    expect(flow).toMatch(/1\. Scene Size-Up[\s\S]*data-command-view="lookup">Open Hazard ID/);
    expect(incidentStyles).toContain("grid-template-columns: repeat(5, minmax(0, 1fr));");
  });

  it("renders the authoritative chemical profile independently of optional enrichment", () => {
    const loader = script.slice(
      script.indexOf("async function openChemical(chemical"),
      script.indexOf("function companionChemicalForUi"),
    );

    expect(loader).toContain("chemical.guidanceEligible === false");
    expect(loader).toContain("const recordPromise = buildFullChemicalRecord(chemical).catch");
    expect(loader).toContain("profileResponse = await fetchJson(profileUrl);");
    expect(loader.indexOf("updateChemicalCard(profileRecord);")).toBeLessThan(loader.indexOf("void recordPromise.then((record) =>"));
    expect(loader).toContain("const isCurrentProfileRequest = () => profileRequestId === latestChemicalProfileRequest");
    expect(loader).toContain("if (!profile) {");
    expect(loader).toContain("Database information for ${chosenChemicalName || 'this chemical'} could not be loaded.");
    expect(loader).toContain("setHazardProfileMode('chemical');");
    expect(loader).toContain("updateChemicalCard(profileRecord);");
  });

  it("loads and refreshes weather independently of the plume basemap", () => {
    const plumeRefresh = script.slice(
      script.indexOf("async function refreshPlumeWorkspace"),
      script.indexOf("let plumeAutomaticCalculationTimer"),
    );

    expect(script).toContain("fetchJson(`/api/weather/current?${proxyQuery}`, { timeoutMs: 10000 })");
    expect(script).toContain("notificationWeatherLocation = { lat: location.lat, lon: location.lon };");
    expect(script).toContain("? { ...openMeteo, headerSource: 'Open-Meteo current conditions' }");
    expect(script).toContain("function convertWindSpeedToMph(value, unit = 'mph')");
    expect(script).toContain("return speed * 0.621371;");
    expect(plumeRefresh).toContain("const mapReadyPromise = Promise.resolve().then(() => ensurePlumeMap(location))");
    expect(plumeRefresh.indexOf("const { openMeteo, nws } = await fetchWeatherSources")).toBeLessThan(
      plumeRefresh.indexOf("await Promise.all([mapReadyPromise, chemicalReady]);"),
    );
  });

  it("uses exclusive full-page search and Chemical Profile states", () => {
    const profileToolbar = html.slice(
      html.indexOf('<header class="chemical-profile-toolbar">'),
      html.indexOf('<article class="panel-card chemical-profile-header-card">'),
    );

    expect(html).toContain('id="lookup" class="view hazard-id-page" data-page-root="hazard-id"');
    expect(html).toContain('id="hazard-id-search-hero"');
    expect(html).toContain('id="hazard-id-search-workspace"');
    expect(profileToolbar).toContain('id="chemical-profile-back-btn"');
    expect(profileToolbar).toContain('id="open-chemcompare-btn"');
    expect(profileToolbar).not.toContain('id="open-guided-response-btn"');
    expect(profileToolbar).toContain('id="open-plume-btn"');
    expect(profileToolbar).not.toContain('id="profile-export-btn"');
    expect(profileToolbar).not.toContain('id="profile-save-chemical-btn"');
    expect(script).toContain("lookup.dataset.hazardPageState = mode === 'chemical'");
    expect(script).toContain("if (searchHero) searchHero.hidden = !searchState;");
    expect(chemicalStyles).not.toMatch(/#chemical-id-results \.chem-compare\s*\{[^}]*display:\s*none;/s);
    expect(profilePageStyles).toContain('#lookup.view[data-hazard-page-state="chemical-profile"]');
    expect(profilePageStyles).toContain("min-height: calc(100dvh - 24px) !important;");
    expect(compareScript).toContain("showView('lookup', { preserveHazardState: true });");
  });

  it("uses the transparent HAZMATIQ artwork on Guided Response", () => {
    expect(html).toContain('class="guided-response-logo" src="assets/hazmatiq-logo-transparent.png"');
  });

  it("maps selected chemical profile fields into every operational consumer", () => {
    expect(script).toContain("function selectedChemicalOperationalData(");
    expect(script).toContain("profile.exposures?.idlh");
    expect(script).toContain("profile.header?.hazardClass");
    expect(script).toContain("hazardClass: chemicalData.hazardClass || ''");
    expect(script).toContain("idlh: chemicalData.idlh || ''");
    expect(script).toContain("const chemicalData = selectedChemicalOperationalData({ incident, profile });");
    expect(script).toContain("const chemicalData = selectedChemicalOperationalData();");
    expect(script).toContain("nioshSourceId: firstChemicalDataValue(niosh.sourceRecordId, incident?.nioshSourceId)");
    expect(script).toContain("['IDLH Source', model.nioshSourceId ? `NIOSH · ${model.nioshSourceId}` : noCurrentDataText]");
    expect(script).toContain("chemicalSources: chemicalProfile ? chemicalProfileSources(chemicalProfile) : (existingIncident?.chemicalSources || [])");
    expect(script).toContain("const ppeSource = profile.ppeRecommendation || profile.ppeRespiratory || incident.ppeSummary;");
    expect(script).toContain("const persistedMedicalSource = incident.medicalSummary || profile.medical;");
    expect(script).toContain("const medicalSource = profile.medical || persistedMedicalSource;");
    expect(script).toContain("status: operationalStatus(ppeSource?.status || ppeSource?.recommendationStatus");
  });

  it("uses compact expandable Guided Response decision panels", () => {
    expect(script).toContain("const box = document.createElement('details');");
    expect(script).toContain("box.open = title === 'Life Safety';");
    expect(script).toContain("chemicalStrip.className = 'guided-chemical-strip';");
    expect(guidedStyles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(guidedStyles).toContain("#guided-response .guided-flow-arrow");
    expect(guidedStyles).toContain("background: #0b2944;");
  });
});
