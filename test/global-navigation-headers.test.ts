import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../server/public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../server/public/global-ui-overrides.css', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../server/public/styles.css', import.meta.url), 'utf8');

describe('global navigation and page header contract', () => {
  it('defines one canonical horizontal primary navigation with the required modules', () => {
    expect(html.match(/class="app-primary-nav"/g)).toHaveLength(1);
    const nav = html.slice(html.indexOf('<nav class="app-primary-nav"'), html.indexOf('</nav>', html.indexOf('<nav class="app-primary-nav"')));
    for (const [label, view] of [
      ['Dashboard', 'overview'],
      ['Hazard ID', 'lookup'],
      ['Plume Model', 'plume'],
      ['Live Map', 'map'],
      ['COMMAND', 'incident'],
      ['Reports', 'report'],
      ['Equipment', 'monitor'],
      ['Weather', 'weather'],
      ['Settings', null],
    ] as const) {
      expect(nav).toContain(`app-nav-label label">${label}</span>`);
      if (view) expect(nav).toContain(`data-view="${view}"`);
    }
    expect(nav).not.toContain('data-view="source"');
    expect(nav).not.toContain('data-view="planning-tools"');
    expect(nav.match(/class="module-btn app-nav-item/g)).toHaveLength(9);
  });

  it('synchronizes active navigation state through the canonical page activation path', () => {
    expect(script).toContain("document.querySelectorAll('.app-nav-item[data-view]')");
    expect(script).toContain("btn.setAttribute('aria-current', 'page')");
    expect(script).toContain('function activatePage(targetId');
    expect(globalStyles).toContain('.app-primary-nav .app-nav-item.active');
    expect(globalStyles).toContain('@media (max-width: 1099px)');
  });

  it('uses one continuous nav frame with a flush gold active accent', () => {
    expect(globalStyles).toContain('border-top: 3px solid #5d89a7 !important;');
    expect(globalStyles).toContain('border-bottom: 3px solid #5d89a7 !important;');
    expect(globalStyles).toContain('.app-shell > .command-header .app-primary-nav .app-nav-item.active::after');
    expect(globalStyles).toContain('bottom: -3px;');
    expect(globalStyles).toContain('background: #f6c343;');
    expect(globalStyles).toContain('box-sizing: border-box !important;');
  });

  it('keeps only title/subtitle copy in page heroes and removes the legacy tertiary tagline', () => {
    expect(html).not.toContain('Real-time data. Actionable intelligence. Safer decisions.');
    expect(html).not.toContain('class="internal-command-menu"');
    expect(html).not.toContain('class="app-header-status"');
    expect(html).toContain('class="brand-logo-command" src="assets/emergenz-hero-header.png?v=2"');
    expect(html).toContain('>Pre-Incident Planning</h1>');
    expect(html).toContain('>Incident Command</h1>');
    expect(html).toContain('>Sources</h1>');
  });

  it('locks the homepage header to one compact row so legacy hero rules cannot create an overlap band', () => {
    expect(globalStyles).toContain('grid-template-rows: 76px !important;');
    expect(globalStyles).toContain('max-height: 76px !important;');
    expect(styles).toContain('.command-header-plume');
    expect(styles).toContain('.command-header-contours');
  });
});
