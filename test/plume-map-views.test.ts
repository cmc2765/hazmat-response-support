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

  it("supports Chemical Companion autocomplete in plume inputs", () => {
    expect(plumeUi).toContain("async function searchPlumeChemicals(value)");
    expect(plumeUi).toContain("async function selectPlumeChemical(chemical)");
    expect(plumeUi).toContain("ID ${chemical.selectedChemicalId}");
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

  it("keeps the plume map inside its page and Threat Zone inside the Command Dashboard", () => {
    expect(html.indexOf('id="plume-model-form"')).toBeLessThan(html.indexOf('class="plume-map-layout"'));
    expect(html.indexOf('id="plume-demographics"')).toBeLessThan(html.indexOf('class="content-area"'));
    expect(html.match(/id="plume-demographics"/g)?.length).toBe(1);
    expect(plumeUi).not.toContain("document.querySelector('.layout')?.append(plumeMapWorkspace)");
    expect(plumeUi).not.toContain("plumeMapWorkspace.append(document.getElementById('plume-demographics'))");
    expect(styles).toContain(".plume-map-layout {\n  grid-template-columns: minmax(0, 1fr);");
    expect(styles).toContain("grid-template-columns: minmax(0, 56fr) minmax(200px, 24fr)");
    expect(styles).toContain("grid-template-rows: repeat(2, minmax(0, 1fr))");
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
    for (const label of ['E-Plan Login', 'PPE Requirements', 'Medical Summary', 'Protective Action Guidance']) {
      expect(html).toContain(`<summary>${label}</summary>`);
    }
    expect(html.match(/data-command-reference/g)?.length).toBe(4);
    expect(plumeUi).toContain("document.querySelectorAll('[data-command-reference][open]')");
  });
});
