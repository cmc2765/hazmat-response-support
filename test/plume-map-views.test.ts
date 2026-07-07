import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const plumeUi = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");

describe("plume map views", () => {
  it("keeps one persistent map style when switching basemaps", () => {
    expect(plumeUi).not.toContain("plumeMap.setStyle(");
    expect(plumeUi).toContain("syncPlumeBasemapLayer();");
    expect(plumeUi).toContain("activePlumeMapView === 'satellite' ? 'visible' : 'none'");
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
});
