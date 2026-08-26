import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../server/public/index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../server/public/styles.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../server/public/design-mode.js", import.meta.url), "utf8");

describe("prototype Design Mode layout editing", () => {
  it("registers only the approved layout containers", () => {
    const layoutIds = [
      "home.newIncident", "home.planningTools", "home.incidentReports",
      "hazardId.hero", "hazardId.chemicalSearch", "hazardId.cbrneSearch", "hazardId.radiologicalSearch", "hazardId.profile",
      "incidentCommand.hero", "incidentCommand.liveBrief", "incidentCommand.tacticalStatus", "incidentCommand.reports", "incidentCommand.commandTools", "incidentCommand.operationalDetails",
      "plume.map", "plume.controls", "plume.weather", "plume.summary", "plume.threatZone",
      "planningTools.eplan", "planningTools.preIncidentPlans", "planningTools.hazardPlanning", "planningTools.mapLayout", "planningTools.scenarioBuilder",
    ];
    for (const layoutId of layoutIds) expect(`${html}\n${script}`).toContain(layoutId);
    expect(html).not.toMatch(/<(button|label)[^>]+data-design-layout=/);
  });

  it("supports Pointer Event dragging and all four corner handles", () => {
    expect(script).toContain("document.addEventListener('pointerdown'");
    expect(script).toContain("document.addEventListener('pointermove'");
    expect(script).toContain("document.addEventListener('pointerup'");
    for (const corner of ["top-left", "top-right", "bottom-left", "bottom-right"]) {
      expect(styles).toContain(`.design-resize-handle.${corner}`);
    }
    expect(styles).toContain("touch-action: none;");
    expect(styles).toContain("user-select: none !important;");
  });

  it("persists only layout geometry in the dedicated override object", () => {
    expect(script).toContain("const layoutStorageKey = 'hazmatiq_layout_overrides'");
    expect(script).toContain("{ ...state.pending, updatedAt: new Date().toISOString() }");
    for (const field of ["x", "y", "width", "height"]) expect(script).toContain(`${field}:`);
    expect(script).not.toContain("hazmatiq_incidents");
    expect(script).not.toContain("hazmatiq_active_incident_id");
    expect(script).not.toContain("hazmatiq_latest_plume_overlay");
  });

  it("provides grid, export, page reset, and safety controls", () => {
    for (const label of ["DESIGN MODE ACTIVE", "Snap to Grid", "Grid Size ", "Copy Layout JSON", "Reset This Page", "Reset All Layout Overrides"]) {
      expect(script).toContain(label);
    }
    expect(script).toContain("Design Mode is for layout editing. Turn it off to test normal buttons.");
    expect(script).toContain("copy the layout JSON and ask Codex to stabilize it into CSS");
    expect(script).toContain("delete overrides[id]");
    expect(script).toContain("window.localStorage.removeItem(layoutStorageKey)");
    expect(script).toContain("layouts, summary:");
  });

  it("keeps controls and resize affordances inactive in normal mode", () => {
    expect(styles).toContain(".design-resize-handle { display: none; }");
    expect(styles).toContain(".design-mode-active [data-design-layout] * { pointer-events: none; }");
    expect(script).toContain("clearElementOverride(element)");
    expect(html).toContain('src="design-mode.js?v=layout-resize-1"');
  });
});
