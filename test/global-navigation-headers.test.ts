import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../server/public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../server/public/global-ui-overrides.css', import.meta.url), 'utf8');

describe('global navigation and page header contract', () => {
  it('defines one canonical horizontal primary navigation with the required modules', () => {
    expect(html.match(/class="app-primary-nav"/g)).toHaveLength(1);
    const nav = html.slice(html.indexOf('<nav class="app-primary-nav"'), html.indexOf('</nav>', html.indexOf('<nav class="app-primary-nav"')));
    for (const [label, view] of [
      ['Dashboard', 'overview'],
      ['Hazard ID', 'lookup'],
      ['Plume Model', 'plume'],
      ['Live Map', 'map'],
      ['Incident Command', 'incident'],
      ['Reports', 'report'],
      ['Equipment', 'monitor'],
      ['Sources', 'source'],
      ['Planning', 'planning-tools'],
      ['Settings', null],
    ] as const) {
      expect(nav).toContain(`app-nav-label">${label}</span>`);
      if (view) expect(nav).toContain(`data-view="${view}"`);
    }
  });

  it('synchronizes active navigation state through the canonical page activation path', () => {
    expect(script).toContain("document.querySelectorAll('.app-nav-item[data-view]')");
    expect(script).toContain("btn.setAttribute('aria-current', 'page')");
    expect(script).toContain('function activatePage(targetId');
    expect(globalStyles).toContain('.app-primary-nav .app-nav-item.active');
    expect(globalStyles).toContain('@media (max-width: 1099px)');
  });

  it('keeps only title/subtitle copy in page heroes and removes the legacy tertiary tagline', () => {
    expect(html).not.toContain('Real-time data. Actionable intelligence. Safer decisions.');
    expect(html).not.toContain('class="internal-command-menu"');
    expect(html).not.toContain('class="app-header-status"');
    expect(html).toContain('class="brand-logo-command" src="assets/hazscope-incident-intelligence-response-planning.png?v=1"');
    expect(html).toContain('>Pre-Incident Planning</h1>');
    expect(html).toContain('>Incident Command</h1>');
    expect(html).toContain('>Sources</h1>');
  });

  it('locks the homepage header to one compact row so legacy hero rules cannot create an overlap band', () => {
    expect(globalStyles).toContain('grid-template-rows: 76px !important;');
    expect(globalStyles).toContain('max-height: 76px !important;');
    expect(globalStyles).toContain('.command-header .command-header-plume');
    expect(globalStyles).toContain('.command-header .command-header-contours');
  });
});
