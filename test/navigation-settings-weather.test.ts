import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../server/public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const weatherScript = readFileSync(new URL('../server/public/weather-workspace.js', import.meta.url), 'utf8');
const settingsScript = readFileSync(new URL('../server/public/settings-workspace.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../server/public/navigation-weather.css', import.meta.url), 'utf8');

describe('navigation, settings, and weather workspace contract', () => {
  it('keeps Dashboard and Command as separate primary workspaces', () => {
    const nav = html.slice(html.indexOf('<nav class="app-primary-nav"'), html.indexOf('</nav>', html.indexOf('<nav class="app-primary-nav"')));
    expect(nav).toMatch(/data-view="overview" data-nav-key="dashboard"/);
    expect(nav).toMatch(/data-view="incident" data-nav-key="command"/);
    expect(nav).not.toContain('data-nav-key="dashboard" aria-label="Open Command Dashboard"');
    expect(html).toContain('class="module-btn command-brand-home"');
    expect(script).toContain("showView('overview');");
  });

  it('removes Sources and Planning from the primary nav without deleting their workspaces', () => {
    const nav = html.slice(html.indexOf('<nav class="app-primary-nav"'), html.indexOf('</nav>', html.indexOf('<nav class="app-primary-nav"')));
    expect(nav).not.toMatch(/data-view="source"|data-view="planning-tools"/);
    expect(html).toContain('<section id="planning-tools"');
    expect(html).toContain('<section id="source"');
    expect(html).toContain('<button class="module-btn overview-action-btn overview-action-planning"');
  });

  it('provides a real persisted Settings workspace and shared theme state', () => {
    expect(html).toContain('<section id="settings" class="view settings-page"');
    expect(html).toContain('data-theme-choice="dark"');
    expect(html).toContain('data-theme-choice="light"');
    expect(html).toContain('id="settings-sources-toggle"');
    expect(script).toContain("window.localStorage.setItem('hazmatiq-theme', normalized)");
    expect(settingsScript).toContain('initializeSettingsPage');
    expect(styles).toContain('[data-theme="light"]');
  });

  it('provides incident-aware Weather Intelligence over the shared weather/radar infrastructure', () => {
    expect(html).toContain('<section id="weather" class="view weather-intelligence-page"');
    expect(html).toContain('id="weather-map"');
    expect(html).toContain('id="weather-radar-source"');
    expect(script).toContain('window.HazMatIQ.weatherService = {');
    expect(script).toContain('cacheAgeMs < 5 * 60 * 1000');
    expect(script).toContain("window.dispatchEvent(new CustomEvent('hazmatiq:weather-updated'");
    expect(weatherScript).toContain('incidentCommandLegacy');
    expect(weatherScript).toContain('getActiveIncident');
    expect(weatherScript).toContain('HazMatWeatherRadar.createController');
    expect(weatherScript).toContain('mapInfrastructure');
  });
});
