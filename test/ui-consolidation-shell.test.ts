import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../server/public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const chemCompareScript = readFileSync(new URL('../server/public/chem-compare.js', import.meta.url), 'utf8');
const profileStyles = readFileSync(new URL('../server/public/hazard-profile-page.css', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../server/public/global-ui-overrides.css', import.meta.url), 'utf8');

function sectionMarkup(id: string) {
  const start = html.indexOf(`<section id="${id}"`);
  const next = html.indexOf('<section id="', start + 1);
  return html.slice(start, next < 0 ? html.length : next);
}

const pages = [
  ['overview', 'home-page', 'home'],
  ['planning-tools', 'planning-page', 'planning'],
  ['incident', 'incident-command-page', 'incident-command'],
  ['lookup', 'hazard-id-page', 'hazard-id'],
  ['chem-compare', 'chemical-compare-page', 'chemical-compare'],
  ['guided-response', 'guided-response-page', 'guided-response'],
  ['my-chemicals', 'saved-chemicals-page', 'saved-chemicals'],
  ['plume', 'plume-model-page', 'plume-model'],
  ['map', 'live-map-page', 'live-map'],
  ['monitor', 'equipment-page', 'equipment'],
  ['report', 'reports-page', 'reports'],
  ['source', 'sources-page', 'sources'],
] as const;

describe('Phase 1 shared shell and page ownership contract', () => {
  it('defines one canonical root for every major page', () => {
    for (const [id, rootClass, rootName] of pages) {
      const root = html.match(new RegExp(`<section id="${id}"[^>]*>`));
      expect(html.match(new RegExp(`<section id="${id}"`, 'g'))).toHaveLength(1);
      expect(root?.[0]).toContain(rootClass);
      expect(root?.[0]).toContain(`data-page-root="${rootName}"`);
    }
  });

  it('uses one activation contract and clears page-level activation state', () => {
    expect(script).toContain('function activatePage(targetId');
    expect(script).toContain('function updatePageActivationState(targetId)');
    expect(script).toContain('document.body.classList.remove(...pageActivationClasses);');
    expect(script).toContain('appShell?.classList.remove(...pageActivationClasses);');
    expect(script).toContain('initializeActivePage(targetId, { skipPlumeInitialization });');
    expect(script).toContain('function showView(targetId, context = {})');
    expect(script).toContain('return activatePage(targetId, context);');
    expect(script).toContain('window.HazMatIQ.activatePage = activatePage;');
    expect(script).toContain("view.classList.toggle('page-active', active);");
    expect(script).toContain("view.toggleAttribute('data-active-page', active);");
    expect(script).toContain('window.HazMatIQ.activePageContext = plumeContext || {};');
    expect(html.match(/class="view[^"]* active/g)).toHaveLength(1);
  });

  it('keeps profile UI owned by Hazard ID and hidden roots truly inactive', () => {
    expect(script).toContain("lookup.classList.toggle('hazard-profile-page', !searchState);");
    expect(profileStyles).toContain('.content-area > .view[hidden]');
    expect(profileStyles).toContain('#lookup.view:not([hidden])[data-hazard-page-state="chemical-profile"]');
    expect(profileStyles).toContain('#lookup.view:not([hidden])[data-hazard-page-state="hazard-profile"]');
    expect(globalStyles).toContain('.reports-page > .variant-reports');
    expect(globalStyles).toContain('.reports-page > .report-center');
    expect(chemCompareScript).not.toContain("getElementById('lookup')?.classList.remove('active')");
    for (const pageId of ['plume', 'map', 'monitor', 'report']) {
      expect(sectionMarkup(pageId)).not.toMatch(/(?:chemical|hazard)-profile-(?:tabs|toolbar)/);
    }
  });

  it('preserves the canonical contextual Plume implementation', () => {
    expect(script).toContain('function openPlumeModel(context = {})');
    expect(script).toContain('window.HazMatIQ.plumeNavigationContext = normalized;');
    expect(script).toContain("showView('plume', { skipPlumeInitialization: true });");
  });
});
