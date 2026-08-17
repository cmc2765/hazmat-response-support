import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  formatResponderGuidance,
  normalizeBulletList,
  normalizeResponderText,
  normalizeSectionHeading,
} from "../src/utils/normalizeResponderText.js";

const browserScript = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../server/public/index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../server/public/styles.css", import.meta.url), "utf8");

describe("responder display-text normalization", () => {
  it("normalizes whitespace and display markdown while preserving acronyms", () => {
    expect(normalizeResponderText("  **Use   scba and ppe.**  ")).toBe("Use SCBA and PPE.");
    expect(normalizeSectionHeading("##  Medical Considerations: ")).toBe("Medical Considerations");
    expect(normalizeResponderText("No Current Data Exists.")).toBe("No Current Data Exists.");
  });

  it("merges only an incomplete conditional followed by a lowercase action", () => {
    expect(normalizeBulletList(["If damp", "remove clothing immediately."])).toEqual([
      "If damp, remove clothing immediately.",
    ]);
    expect(formatResponderGuidance(["If wearing bulky clothing or denim", "remove outer layer."])).toEqual([
      "If wearing bulky clothing or denim, remove outer layer.",
    ]);
  });

  it("does not merge warnings, source labels, acronyms, numeric instructions, or complete sentences", () => {
    expect(normalizeBulletList(["If damp", "warning: avoid ignition sources."])).toHaveLength(2);
    expect(normalizeBulletList(["When monitoring", "Source: NIOSH"])).toHaveLength(2);
    expect(normalizeBulletList(["Before entry", "SCBA is required."])).toHaveLength(2);
    expect(normalizeBulletList(["During evacuation", "move 300 feet upwind."])).toHaveLength(2);
    expect(normalizeBulletList(["If damp.", "remove clothing immediately."])).toHaveLength(2);
  });

  it("wires the browser formatter before the application and fixes the known patient sequence", () => {
    expect(html.indexOf('src="responder-text.js"')).toBeLessThan(html.indexOf('src="script.js"'));
    expect(browserScript).toContain("'If damp, remove clothing immediately.'");
    expect(browserScript).toContain("'If wearing bulky clothing or denim, remove outer layer.'");
    expect(browserScript).toContain("'Add fans if available to enhance ventilation effectiveness.'");
    expect(browserScript).toContain("responderText.formatResponderGuidance(filtered)");
  });

  it("uses shared HazMatIQ font and spacing tokens across operational cards", () => {
    expect(styles).toContain('--hazmatiq-font-body: "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif');
    expect(styles).toContain('--hazmatiq-font-heading: "Segoe UI", "Bahnschrift", "Roboto", "Helvetica Neue", Arial, sans-serif');
    expect(styles).toContain("--hazmatiq-card-padding: 14px");
    expect(styles).not.toContain('font-family: "Courier New"');
    expect(styles).not.toContain('font-family: "Bahnschrift Condensed"');
  });
});
