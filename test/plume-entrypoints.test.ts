import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../server/public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
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

  it('does not carry Chemical Profile presentation into the Plume workspace', () => {
    const plumeHtml = html.slice(html.indexOf('<section id="plume"'), html.indexOf('<section id="map"'));
    expect(plumeHtml).toContain('class="plume-main-workspace"');
    expect(plumeHtml).not.toContain('chemical-profile-tabs');
    expect(plumeHtml).not.toContain('chemical-profile-shell');
    expect(script).toContain('document.documentElement.dataset.activeWorkspace = targetId;');
  });
});

describe('Plume navigation context normalization', () => {
  it('keeps chemical, incident, location, release, weather, and source context together', () => {
    const result = runInNewContext(`
      ${declaration('activeViewId')}
      ${declaration('normalizeChemicalSelectionId')}
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
