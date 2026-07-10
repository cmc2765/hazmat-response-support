import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../server/public/index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../server/public/styles.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");

describe("compact tactical notifications", () => {
  it("replaces the large notification center with a compact strip", () => {
    expect(html).toContain('id="notification-center"');
    expect(html).not.toContain("Notification Center</span>");
    expect(html.indexOf('id="notification-severity-icon"')).toBeLessThan(html.indexOf('<strong class="notification-center-title">Notification Center</strong>'));
    expect(html).toContain('aria-label="Tactical alert status"');
    expect(styles).toContain("height: 40px");
    expect(styles).toContain("min-height: 40px");
  });

  it("keeps the live 24-hour clock visible", () => {
    expect(script).toContain("hourCycle: 'h23'");
    expect(script).toContain("second: '2-digit'");
    expect(script).toContain("window.setInterval(renderTacticalClock, 1000)");
    expect(styles).not.toContain(".notification-center .notification-updated { display: none; }");
  });

  it("omits feels-like only from the compact strip and retains it for responder rehab", () => {
    expect(script).toContain("conditions.replace(/ · Feels Like [^·]+/i, '')");
    expect(script).toContain("{ label: 'Feels Like', value:");
  });

  it("uses an overlay drawer without adding a layout column", () => {
    expect(html).toContain('id="notification-drawer"');
    expect(html).toContain('role="dialog"');
    expect(styles).toContain(".notification-drawer {\n  position: fixed;");
    expect(script).toContain("notificationDrawerTrigger?.focus?.()");
    expect(script).toContain("event.key === 'Escape'");
  });

  it("retains history, severity, acknowledgment, and resolution state", () => {
    expect(script).toContain("hazmatiq_notification_history");
    expect(script).toContain("acknowledged: false");
    expect(script).toContain("previous.resolved = true");
    expect(script).toContain("notificationSeverityRank");
  });
});
