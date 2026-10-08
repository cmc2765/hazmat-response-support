import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../server/public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const plumeStyles = readFileSync(new URL('../server/public/plume-overrides.css', import.meta.url), 'utf8');
const program = parse(script, { ecmaVersion: 'latest' });

function declaration(name: string) {
  const node = program.body.find((item) => item.type === 'FunctionDeclaration' && item.id?.name === name);
  if (!node) throw new Error(`Missing ${name}`);
  return script.slice(node.start, node.end);
}

describe('canonical Plume Model entry points', () => {
  it('keeps one complete Plume workspace and preserves every shortcut', () => {
    expect(html.match(/<section id="plume"/g)).toHaveLength(1);
    for (const label of [
      'PLUME MODELING',
      'Open Plume Model',
      'PLOT PLUME',
      'Plot / Edit Plume',
    ]) expect(html).toContain(label);
    for (const id of [
      'plume-chemical-input',
      'plume-release-quantity',
      'plume-release-duration',
      'plume-weather-source',
      'plume-wind-direction',
      'plume-gis-map',
      'plot-plume-btn',
      'plume-endpoint-card-heading',
    ]) expect(html).toContain(`id="${id}"`);
  });

  it('routes direct and contextual navigation through the canonical initializer', () => {
    expect(script).toContain('function openPlumeModel(context = {})');
    expect(script).toContain('function normalizePlumeNavigationContext(input = {})');
    expect(script).toContain('return openPlumeModel(activationContext);');
    expect(script).toContain("showView('plume', { skipPlumeInitialization: true });");
    expect(script).toContain('window.HazMatIQ.plumeNavigationContext = normalized;');
    expect(script).not.toMatch(/showView\(['"]plume['"]\);/);
    expect(script).toContain("openPlumeWorkspace({ sourcePage: 'incident', incident: getActiveIncident() })");
    expect(script).toContain("openPlumeWorkspace({ sourcePage: activeViewId() })");
    expect(script).toContain("document.querySelectorAll('.preplan-actions [data-view]')");
    expect(html).toContain('data-command-view="plume">Plot / Edit Plume</button>');
  });

  it('opens Plume from Chemical Profile with the selected profile context', () => {
    expect(script).toMatch(/document\.getElementById\('open-plume-btn'\)\?\.addEventListener\('click', \(\) => openPlumeWorkspace\(\{[\s\S]*sourcePage: 'hazard-id',[\s\S]*chemical: activeChemical,[\s\S]*chemicalRecord: activeChemicalRecord,/);
  });

  it('does not carry Chemical Profile presentation into the Plume workspace', () => {
    const plumeHtml = html.slice(html.indexOf('<section id="plume"'), html.indexOf('<section id="map"'));
    expect(plumeHtml).toContain('class="plume-v2-workspace"');
    expect(plumeHtml).not.toContain('chemical-profile-tabs');
    expect(plumeHtml).not.toContain('chemical-profile-shell');
    expect(script).toContain('document.documentElement.dataset.activeWorkspace = targetId;');
  });

  it('keeps the Plume 2.0 workspace as one three-column DOM composition', () => {
    const workspace = html.match(/<div class="plume-v2-workspace">([\s\S]*?)<\/div>\s*<section class="plume-results-section/s)?.[1] || '';
    expect(workspace).toMatch(/<aside class="plume-v2-input-column"/);
    expect(workspace).toMatch(/<main class="plume-v2-map-column"/);
    expect(workspace).toMatch(/<aside class="plume-v2-intelligence-column"/);
    expect(workspace.indexOf('class="plume-v2-input-column"')).toBeLessThan(workspace.indexOf('class="plume-v2-map-column"'));
    expect(workspace.indexOf('class="plume-v2-map-column"')).toBeLessThan(workspace.indexOf('class="plume-v2-intelligence-column"'));
    const directColumns = (workspace.match(/<(?:aside|main) class="plume-v2-[^"]+"/g) || [])
      .map((line) => line.match(/class="([^"]+)"/)?.[1]);
    expect(directColumns).toEqual([
      'plume-v2-input-column',
      'plume-v2-map-column',
      'plume-v2-intelligence-column',
    ]);
    for (const id of ['plume-chemical-input', 'plume-release-type', 'plume-release-quantity', 'plume-release-duration', 'plume-weather-source', 'plume-wind-speed', 'plume-wind-direction', 'plume-temperature', 'plume-endpoint-duration', 'plume-map-address-input']) {
      expect((html.match(new RegExp(`id="${id}"`, 'g')) || [])).toHaveLength(1);
    }
  });

  it('locks the target shell, protected controls, and responder workflow order', () => {
    const plumeHtml = html.slice(html.indexOf('<section id="plume"'), html.indexOf('<section id="map"'));
    const protectedIds = [
      'plume', 'plume-model-form',
      'plume-chemical-input', 'plume-release-type', 'plume-release-quantity', 'plume-release-unit', 'plume-puff-duration', 'plume-release-duration', 'plume-release-height',
      'plume-endpoint-duration', 'plume-erg-spill-size', 'plume-erg-period',
      'plume-weather-source', 'plume-weather-source-name', 'plume-wind-speed', 'plume-wind-direction', 'plume-temperature', 'plume-stability-class', 'plume-surface-roughness', 'plume-manual-observation-time', 'plume-elevation', 'plume-columbia-csv',
      'columbia-humidity', 'columbia-wind-gust', 'columbia-pressure',
      'plume-container-type', 'container-model-source', 'container-capacity', 'container-release-phase', 'container-pressure-condition', 'container-fill-level', 'container-release-location', 'container-size-preset', 'container-size', 'container-size-unit', 'container-pressure-profile', 'container-pressure', 'container-pressure-unit', 'container-pressure-source',
      'plume-map-address-input',
    ];
    for (const id of protectedIds) expect((html.match(new RegExp(`\\bid="${id}"`, 'g')) || [])).toHaveLength(1);
    expect(plumeHtml.indexOf('Chemical Release')).toBeLessThan(plumeHtml.indexOf('Weather Conditions'));
    expect(plumeHtml.indexOf('Weather Conditions')).toBeLessThan(plumeHtml.indexOf('Modeling Criteria'));
    expect(plumeHtml.indexOf('Modeling Criteria')).toBeLessThan(plumeHtml.indexOf('plume-left-plot-button'));
    expect(plumeHtml).toContain('class="plume-map-action-controls"');
    expect(plumeHtml).toContain('Operational Guidance');
    expect(plumeHtml).not.toContain('plume-protective-action-list');
    expect(plumeStyles).toContain('grid-template-columns: minmax(280px, 23fr) minmax(0, 54fr) minmax(280px, 23fr);');
    expect(plumeStyles).toContain('#plume.view.active #plume-gis-map,');
    expect(script.match(/async function plotPlumeFromControls\(/g)).toHaveLength(1);
    expect(script).not.toContain("['Evacuate:'");
  });
});

describe('Plume navigation context normalization', () => {
  it('keeps chemical, incident, location, release, weather, and source context together', () => {
    const result = runInNewContext(`
      ${declaration('activeViewId')}
      ${declaration('normalizeChemicalSelectionId')}
      function isIncidentPlumeCurrent() { return false; }
      ${declaration('normalizePlumeNavigationContext')}
      normalizePlumeNavigationContext({
        sourcePage: 'incident',
        chemicalId: 22,
        chemicalName: 'Chlorine',
        cas: '7782-50-5',
        un: '1017',
        incidentId: 'incident-1',
        incidentName: 'Active Chlorine Release',
        location: { latitude: 33.52, longitude: -86.8, address: 'Main Street' },
        releaseData: { releaseKind: 'plume', quantity: '5', durationMinutes: '10' },
        weatherData: { windSpeedMph: 8, windDirectionDeg: 180, temperatureF: 72 },
      })
    `, {
      activeChemical: null,
      activeChemicalRecord: null,
      plumeManualLocation: null,
      window: { hazmatiqLiveMap: null },
      document: { getElementById: () => null },
      getActiveIncident: () => null,
      readPlanningState: () => ({}),
      views: [],
    });
    expect(result).toMatchObject({
      chemicalId: 22,
      chemicalName: 'Chlorine',
      cas: '7782-50-5',
      un: '1017',
      incidentId: 'incident-1',
      incidentName: 'Active Chlorine Release',
      latitude: 33.52,
      longitude: -86.8,
      sourcePage: 'incident',
      releaseData: { releaseKind: 'plume', quantity: '5', durationMinutes: '10' },
      weatherData: { windSpeedMph: 8, windDirectionDeg: 180, temperatureF: 72 },
    });
  });
});
