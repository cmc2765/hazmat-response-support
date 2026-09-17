import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../server/public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const module = readFileSync(new URL('../server/public/hazard-profile.js', import.meta.url), 'utf8');

function moduleApi() {
  const context = { window: {}, document: { getElementById: () => null } } as Record<string, unknown>;
  runInNewContext(module, context);
  return (context.window as { HazMatIQ: Record<string, (...args: unknown[]) => unknown> }).HazMatIQ;
}

describe('Hazard ID / Profile module ownership', () => {
  it('loads after the shared runtime and participates in the canonical page lifecycle', () => {
    expect(html.indexOf('<script src="hazard-profile.js"></script>')).toBeGreaterThan(html.indexOf('<script src="script.js'));
    expect(script).toContain("if (targetId === 'lookup') window.HazMatIQ.initializeHazardProfilePage?.(context);");
    expect(script).toContain('window.HazMatIQ.hazardProfileLegacy = {');
    expect(module).toContain('window.HazMatIQ.normalizeProfileForUi = normalizeProfileForUi;');
  });

  it('normalizes Chemical Companion and starter-hazard identities to one result shape', () => {
    const api = moduleApi();
    const chemical = api.normalizeHazardSearchResult({
      ChemicalID: 102,
      ChemicalName: 'Sulfur dioxide',
      CasNumber: '7446-09-5',
      UnnaNumber: '1079',
      ErgNumber: '125',
      reviewStatus: 'master-record',
    });
    const hazard = api.normalizeHazardSearchResult({
      id: 'sarin-gb',
      lane: 'CBRNE_CWA',
      displayName: 'Sarin',
      category: 'NERVE_AGENT',
      verificationStatus: 'Verified Source',
    });

    expect(chemical).toMatchObject({
      profileType: 'chemical', canonicalId: '102', displayName: 'Sulfur dioxide',
      chemicalCompanionId: 102, cbrneCanonicalId: null, cas: '7446-09-5', un: '1079', erg: '125',
      routingLane: 'CHEMICAL', sourceState: 'master-record',
    });
    expect(hazard).toMatchObject({
      profileType: 'hazard', canonicalId: 'sarin-gb', displayName: 'Sarin',
      chemicalCompanionId: null, cbrneCanonicalId: 'sarin-gb', category: 'NERVE_AGENT',
      routingLane: 'CBRNE_CWA', sourceState: 'Verified Source',
    });
  });

  it('maintains one active profile state and clears it defensively', () => {
    const api = moduleApi();
    const state = api.setActiveHazardState({ id: 'cesium-137', lane: 'RADIOLOGICAL', displayName: 'Cesium-137' }, { status: 'loading' }) as Record<string, unknown>;
    expect(state).toMatchObject({ canonicalId: 'cesium-137', routingLane: 'RADIOLOGICAL', status: 'loading', nioshSourceId: null });
    expect(api.getActiveHazardState()).toBe(state);
    expect(api.setActiveHazardState(null)).toBeNull();
    expect(api.getActiveHazardState()).toBeNull();
  });

  it('delegates profile tabs through one owned listener instead of per-render bindings', () => {
    const chemicalRenderer = script.slice(script.indexOf('function renderChemicalProfile'), script.indexOf('function updateChemicalCard'));
    const hazardRenderer = script.slice(script.indexOf('function renderStarterHazardProfile'), script.indexOf('async function openStarterHazard'));
    expect(chemicalRenderer).not.toContain("button.addEventListener('click', () => {");
    expect(hazardRenderer).not.toContain("button.addEventListener('click', () => {");
    expect(script).toContain('button.dataset.profileFields = JSON.stringify(fieldNames);');
    expect(module).toContain('#chemical-profile-tabs [data-tab], #hazard-profile-tabs [data-profile-fields]');
    expect(module).toContain('api.renderChemicalProfile({ ...profile, activeTab: button.dataset.tab });');
    expect(module).toContain('api.renderStarterHazardTab(profile, fields);');
  });
});
