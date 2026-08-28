import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../server/public/index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../server/public/styles.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");

describe("HazMatIQ Command Bar", () => {
  it("integrates compact tactical status into the global command bar", () => {
    expect(html).toContain('class="topbar hazmat-command-bar command-header"');
    expect(html).toContain('id="notification-center"');
    expect(html).toContain('class="notification-center hazmat-command-context"');
    expect(html).toContain("<span>System</span>");
    expect(html).toContain('id="notification-weather"');
    expect(html).toContain('id="notification-alert-count"');
    expect(html).not.toContain('class="module-nav hazmat-command-nav"');
    expect(html).not.toContain('class="notification-item notification-incident"');
    expect(html).not.toContain('id="command-bar-incident"');
    expect(styles).toContain(".command-header.hazmat-command-bar.topbar");
    expect(styles).toContain("min-height: 408px;");
    expect(styles).toContain("--hazmat-navy: #061a2e");
    expect(script).toContain("function syncCommandBarContext()");
  });

  it("keeps navigation in the command drawer instead of the workspace header", () => {
    expect(html.match(/class="module-nav hazmat-command-nav"/g)).toBeNull();
    expect(html.match(/class="workspace-drawer-nav"/g)).toHaveLength(1);
    expect(styles).toContain(".layout > .sidebar { display: none; }");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr);");
    for (const view of [
      "overview",
      "incident",
      "lookup",
      "plume",
      "map",
      "report",
      "monitor",
      "my-chemicals",
    ]) {
      expect(html).toContain(`data-view="${view}"`);
    }
  });

  it("uses one shared tactical hero system across major landing pages", () => {
    for (const title of [
      "Incident Command Dashboard",
      "HAZARD ID",
      "Plume Model",
      "Live Map",
      "Guided Response",
      "Incident Reports &amp; ICS Forms",
      "Monitoring Equipment",
      "My Chemicals",
    ])
      expect(html).toContain(title);
    expect(html).not.toContain("HazMatIQ Command Center");
    expect(html.match(/hazmat-page-hero/g)?.length).toBeGreaterThanOrEqual(9);
    expect(html).toMatch(/hazmat-page-hero hazmat-page-hero-compact variant-plume/);
    expect(html).toMatch(/hazmat-page-hero hazmat-page-hero-compact variant-live-map/);
    expect(styles).toContain(".hazmat-page-hero {");
    expect(styles).toContain(".hazmat-page-hero-compact");
    expect(styles).toContain("color: var(--hazmat-text) !important;");
  });

  it("renders Incident Command as a real-state operational dashboard", () => {
    for (const label of [
      "Real-Time Operational Overview",
      "Incident Brief",
      "Tactical Status",
      "Incident Reports",
      "Command Tools",
      "Operational Details",
      "NO ACTIVE INCIDENT",
    ]) {
      expect(html).toContain(label);
    }
    for (const action of [
      "Open Plume Model",
      "Open Live Map",
      "Add Incident Note",
      "Generate Report",
      "Complete Incident",
    ]) {
      expect(html).toContain(action);
    }
    expect(styles).toContain('url("assets/incident-command-hero-v2.png")');
    expect(script).toContain("function buildIncidentCommandViewModel()");
    expect(script).toContain("function renderIncidentCommandDashboard()");
    expect(script).toContain("hazmatiq_monitor_readings");
    expect(script).toContain("hazmatiq_latest_plume_overlay");
    expect(script).toContain("incidentNotes:");
    expect(script).toContain("completedAt: now.toISOString()");
    expect(script).not.toContain("Northridge Chemical Release");
    expect(script).not.toContain("123 Industrial Way");
  });

  it("keeps Incident Command compact and fills Tactical Status from live incident state", () => {
    const tacticalModel = script.slice(
      script.indexOf("function buildIncidentCommandViewModel()"),
      script.indexOf("function incidentCommandStatusClass"),
    );
    expect(html).not.toContain('class="incident-command-hero-grid"');
    expect(styles).toMatch(
      /#incident \.incident-command-hero \{[^}]*min-height: clamp\(138px, 15vw, 205px\) !important;/s,
    );
    expect(styles).toMatch(
      /#incident \.incident-command-hero::after \{[^}]*border: 0;[^}]*box-shadow: none;[^}]*transform: none;/s,
    );
    expect(styles).toMatch(
      /#incident \.incident-command-hero \.hazmat-page-hero-content \{[^}]*justify-items: center;/s,
    );
    expect(styles).toMatch(/#incident \.incident-command-subtitle \{[^}]*margin: 8px auto 0;/s);
    expect(script).toContain("function incidentCommandMonitoringState(incident)");
    expect(tacticalModel).toContain("profile.ppeRecommendation");
    expect(tacticalModel).toContain("profile.decon");
    expect(tacticalModel).toContain("incident.medicalSummary || profile.medical");
    expect(tacticalModel).toContain("No plume run saved for this incident");
    expect(tacticalModel).not.toContain("status: 'No Current Data'");
    for (const icon of ["🛡️", "🥽", "💧", "❤️", "🏭", "☁️", "📡"])
      expect(tacticalModel).toContain(icon);
  });

  it("uses green high-contrast controls for every Plume Model action", () => {
    expect(styles).toContain('button[data-view="plume"]');
    expect(styles).toContain('button[data-command-view="plume"]');
    for (const id of [
      "#open-plume-btn",
      "#guided-open-plume-btn",
      "#hazard-profile-plume-btn",
      "#plot-plume-btn",
    ]) {
      expect(styles).toContain(id);
    }
    expect(styles).toMatch(
      /button\[data-view="plume"\][\s\S]*?color: #fff !important;[\s\S]*?background: linear-gradient\(180deg, #2c9b55, #176b39\) !important;/,
    );
  });

  it("uses the permanent command header and complete overlay workspace navigation", () => {
    expect(html).toContain('id="command-menu-toggle"');
    expect(html).toContain('id="workspace-navigation-drawer"');
    expect(html).toContain('class="brand-logo-command"');
    expect(html).toContain('src="assets/hazmatiq-logo-command.png"');
    expect(html).toContain('<span class="command-center-label">Command Dashboard</span>');
    const systemStatus = html.slice(
      html.indexOf('<div class="notification-item notification-system">'),
      html.indexOf('<div class="notification-item notification-weather-item">'),
    );
    expect(systemStatus).toContain('id="command-menu-toggle"');
    expect(html).not.toContain('id="command-bar-mode"');
    expect(html).not.toContain('class="department-logo-link"');
    expect(html).not.toContain('id="command-profile-control"');
    expect(html).not.toContain('id="notification-weather-source"');
    expect(html).not.toContain('class="brand-logo"');
    expect(html).not.toContain("data-design-");
    expect(html).not.toContain("design-mode.js");
    expect(styles).not.toContain(".design-mode-toolbar");
    const commandDrawer = html.slice(
      html.indexOf('<aside class="workspace-navigation-drawer"'),
      html.indexOf('<div class="notification-drawer-backdrop"'),
    );
    expect(commandDrawer.match(/data-view="[^"]+"/g)).toEqual([
      'data-view="incident"',
      'data-view="lookup"',
      'data-view="plume"',
      'data-view="map"',
      'data-view="monitor"',
      'data-view="report"',
      'data-view="my-chemicals"',
    ]);
    expect(commandDrawer).not.toContain('data-view="overview"');
    expect(commandDrawer).not.toContain('data-view="guided-response"');
    expect(commandDrawer).toContain("Settings");
    expect(commandDrawer).toContain("Dark Command Theme");
    expect(commandDrawer).toContain("Theme token · HMI-DARK");
    expect(commandDrawer).not.toContain("Not configured");
    expect(script).toContain("function openWorkspaceDrawer(");
    expect(script).toContain("function closeWorkspaceDrawer(");
    expect(script).toContain("function activateDarkCommandTheme(");
  });

  it("uses a restrained animated command interface with readable status zones", () => {
    expect(html).not.toContain('class="command-hero-scene"');
    expect(html).not.toContain('src="assets/command-header-hazmat-scene-v2.png"');
    expect(html).toContain('class="command-header-plume"');
    expect(html).toContain('class="command-header-contours"');
    expect(html).not.toContain('class="command-header-pattern"');
    expect(styles).toContain(".command-header::before {");
    expect(styles).toContain("animation: commandRadarSweep 22s linear infinite;");
    expect(styles).toContain("transform-origin: 50% 50%;");
    expect(styles).toContain("top: 51%;");
    expect(styles).toContain("left: 82%;");
    expect(styles).toContain("opacity: 0.42;");
    expect(styles).not.toContain("@keyframes commandPatternFloat");
    expect(styles).toContain("@keyframes commandPlumeBreathe");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/\.command-header \.brand-logo-command \{[\s\S]*?object-fit: contain;/);
    expect(html).toContain('class="module-btn command-brand-home"');
    expect(html).toContain('data-view="overview" aria-label="Return to the HazMatIQ Home Page"');
    expect(html).not.toContain('id="notification-details-btn"');
    expect(html).not.toContain('id="notification-ack-btn"');
    expect(html).not.toContain('id="command-smoke-canvas"');
    expect(script).not.toContain("window.setTimeout(initializeCommandSmokeCanvas");
    expect(script).toContain("Closest available station");
    expect(script).toContain("RH ${humidity}%");
    expect(script).toContain("WIND ${windSpeed} MPH ${windDirection}");
    expect(html).toContain('class="command-promo-grid overview-promo-strip"');
    expect(html.match(/class="overview-promo-box"/g)).toHaveLength(8);
    expect(styles).toContain(
      "grid-template-columns: minmax(150px, 0.85fr) minmax(300px, 1.5fr) minmax(150px, 0.85fr);",
    );
  });

  it("keeps the approved three-panel cinematic homepage", () => {
    expect(html.match(/class="module-btn overview-action-btn /g)).toHaveLength(3);
    for (const title of ["New Incident", "Planning Tools", "Incident Reports"])
      expect(html).toContain(`<span class="overview-action-title">${title}</span>`);
    const overview = html.slice(
      html.indexOf('<section id="overview"'),
      html.indexOf('<section id="planning-tools"'),
    );
    expect(overview.match(/class="module-btn overview-action-btn /g)).toHaveLength(3);
    expect(overview).not.toContain("operational capabilities");
    expect(overview).not.toContain("Training Mode");
    expect(overview).not.toContain('class="overview-action-icon"');
    for (const phrase of ["Establish Command.", "Plan Smarter.", "Document Clearly."])
      expect(overview).toContain(`<span class="overview-action-phrase">${phrase}</span>`);
    expect(overview).toContain("Start Incident, Set Objectives, Control the Scene");
    expect(overview).toContain("Incident Intelligence, Mapping, Event Planning");
    expect(overview).toContain("Complete Reports, Access ICS Forms, Export Packages");
    for (const action of ["Establish Command", "Open Planning Tools", "Open Reports"])
      expect(overview).toContain(`<span class="overview-action-cta">${action}`);
    expect(overview).toContain('data-view="planning-tools"');
    expect(overview).toContain('data-view="report"');
    expect(styles).toContain('background-image: url("assets/home-card-scenes-v5.png") !important;');
    expect(styles).toContain("background-position: center top !important;");
    expect(styles).toContain("background-position: center center !important;");
    expect(styles).toContain("background-position: center bottom !important;");
    expect(styles).toContain("background-position: center 54.1% !important;");
    expect(styles).toContain("background-size: 100% 320% !important;");
    expect(styles).toContain("border: 2px solid var(--overview-accent);");
    expect(styles).toContain(
      "/* Editable Homepage layout. Keep homepage changes in this section while it is in development. */",
    );
    expect(styles).toContain("animation: homepageRadarSweep 20s linear infinite;");
    expect(styles).toContain("top: calc(50% - 5px);");
    expect(styles).toContain("gap: 10px;");
    expect(styles).not.toContain("Final Home cascade lock");
    expect(styles).not.toContain("Homepage brand-first sizing and full-width launcher layout");
    expect(styles).toContain("width: min(1134px, calc(60vw - clamp(8px, 0.7vw, 11px)));");
    expect(styles).toContain("height: auto;");
    expect(styles).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(styles).toContain("font-size: 0.78rem;");
    expect(styles).toContain("border: 1px solid rgba(255, 255, 255, 0.88);");
    expect(styles).toContain("--overview-accent: #c8102e;");
    expect(styles).toContain("--overview-accent: #1765b0;");
    expect(styles).toContain("--overview-accent: #f2cf20;");
    expect(styles).toContain("border: 8px solid var(--overview-accent);");
    expect(styles).toContain(
      ".app-shell:has(#overview.view.active) > .command-header .command-center-label",
    );
    expect(styles).toContain(
      ".app-shell:has(#overview.view.active) > .command-header .hazmat-command-context .notification-alert-count",
    );
  });

  it("keeps the live 24-hour clock visible", () => {
    expect(script).toContain("hourCycle: 'h23'");
    expect(script).toContain("second: '2-digit'");
    expect(script).toContain("window.setInterval(renderTacticalClock, 1000)");
    expect(html.indexOf('class="notification-item notification-system"')).toBeLessThan(
      html.indexOf('id="notification-updated"'),
    );
    expect(styles).toContain(".notification-center .notification-updated");
    expect(styles).toContain("color: #fff;");
    expect(styles).not.toContain(".notification-center .notification-updated { display: none; }");
  });

  it("uses four station fields in the compact strip and retains feels-like for responder rehab", () => {
    expect(script).toContain(
      "[weather.temperatureF, weather.rh, weather.windSpeedMph, weather.windDirDeg]",
    );
    expect(script).toContain("Closest station observation unavailable");
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
