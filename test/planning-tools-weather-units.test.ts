import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nwsWindSpeedToMps } from "../src/integrations/weather/nws.js";

const html = readFileSync(new URL("../server/public/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");
const planningStyles = readFileSync(new URL("../server/public/preplan-overrides.css", import.meta.url), "utf8");

describe("weather wind units", () => {
  it("normalizes NWS wind measurements to the model's meters per second", () => {
    expect(nwsWindSpeedToMps({ value: 36, unitCode: "wmoUnit:km_h-1" })).toBeCloseTo(10);
    expect(nwsWindSpeedToMps({ value: 10, unitCode: "wmoUnit:mi_h-1" })).toBeCloseTo(4.4704);
    expect(nwsWindSpeedToMps({ value: 10, unitCode: "wmoUnit:m_s-1" })).toBe(10);
  });

  it("converts every supported display source to mph", () => {
    expect(script).toContain("function convertWindSpeedToMph(value, unit = 'mph')");
    expect(script).toContain("return speed * 0.621371;");
    expect(script).toContain("return speed * 2.23694;");
    expect(script).toContain("return speed * 1.15078;");
    expect(script).toContain("windSpeedUnit: 'mph'");
    expect(script).toContain("['windSpeed', 'Wind speed (mph)', 'text']");
    expect(html).toContain("Wind speed (mph)");
  });
});

describe("Planning Tools card board", () => {
  it("renders six equal cards including Pipeline Planning", () => {
    const planningGrid = html.slice(
      html.indexOf('<div class="planning-tools-grid">'),
      html.indexOf('<p class="planning-tools-status muted"'),
    );
    expect(planningGrid.match(/<section class="planning-tool-section/g)).toHaveLength(6);
    expect(planningGrid).toContain('<span class="planning-tool-index">06</span>');
    expect(planningGrid).toContain('id="planning-pipeline-title">Pipeline Planning</h3>');
    expect(planningGrid).toContain('id="pipeline-preplan-btn"');
    expect(planningStyles).toContain("grid-auto-rows: 320px;");
    expect(planningStyles).toContain("height: 320px;");
    expect(planningStyles).toContain("#planning-tools .planning-tool-scenario");
  });

  it("returns home from either Command Dashboard HAZMATIQ logo", () => {
    expect(script).toContain("function returnToHazMatIqHome()");
    expect(script).toContain("document.querySelectorAll('#command-brand-home, .workspace-drawer-home')");
    expect(script).toContain("showView('overview');");
  });
});
