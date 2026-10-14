import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../server/public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../server/public/global-ui-overrides.css', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../server/public/styles.css', import.meta.url), 'utf8');
const sharedHeaderStyles = readFileSync(new URL('../server/public/dashboard-header.css', import.meta.url), 'utf8');
const compass = readFileSync(new URL('../server/public/assets/emergenz-compass-tight.png', import.meta.url));
const wordmark = readFileSync(new URL('../server/public/assets/emergenz-wordmark-tight.png', import.meta.url));

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
      ['Monitoring', 'monitor'],
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
    expect(sharedHeaderStyles).toContain('.app-shell > .app-header-row .app-primary-nav .app-nav-item.active');
    expect(sharedHeaderStyles).toContain('@media (max-width: 1100px)');
  });

  it('uses one continuous nav frame with a flush gold active accent', () => {
    expect(sharedHeaderStyles).toContain('border: 0 !important;');
    expect(sharedHeaderStyles).toContain('border: 2px solid rgba(143, 180, 207, 0.62) !important;');
    expect(globalStyles).not.toContain('.app-shell > .command-header .app-primary-nav');
    expect(sharedHeaderStyles).toContain('background: #f6c343 !important;');
    expect(sharedHeaderStyles).toContain('grid-template-columns: repeat(9, minmax(0, 1fr)) !important;');
    expect(sharedHeaderStyles).toContain('--dashboard-page-gap: 8px;');
    expect(sharedHeaderStyles).toContain('margin-bottom: var(--dashboard-page-gap) !important;');
    expect(sharedHeaderStyles).toContain('.app-shell > .layout {\n  margin-top: 0 !important;\n  padding-top: 0 !important;\n}');
    expect(sharedHeaderStyles).toContain('#lookup.view.active {\n  margin-top: 0 !important;\n  padding: 0 10px 10px !important;\n  row-gap: 0 !important;\n}');
    expect(sharedHeaderStyles).toContain('margin-bottom: var(--dashboard-page-gap) !important;');
    expect(sharedHeaderStyles).toContain('#incident .incident-command-dashboard {\n  padding-top: 0 !important;\n}');
  });

  it('keeps only title/subtitle copy in page heroes and removes the legacy tertiary tagline', () => {
    expect(html).not.toContain('Real-time data. Actionable intelligence. Safer decisions.');
    expect(html).not.toContain('class="internal-command-menu"');
    expect(html).not.toContain('class="app-header-status"');
    expect(html).toContain('class="brand-logo-mark"');
    expect(html).toContain('class="brand-logo-emblem" src="assets/emergenz-compass-tight.png?v=1"');
    expect(html).toContain('class="brand-logo-wordmark" src="assets/emergenz-wordmark-tight.png?v=1"');
    expect(html).toContain('aria-label="Return to the EMERGENZ Home Page"');
    expect(html).toContain('>Pre-Incident Planning</h1>');
    expect(html).toContain('>Incident Command</h1>');
    expect(html).toContain('>Sources</h1>');
  });

  it('shares a bounded logo, one-third desktop brand area, and consistent page heroes', () => {
    expect(sharedHeaderStyles).toContain('--dashboard-header-height: 72px;');
    expect(sharedHeaderStyles).toContain('max-height: 70px !important;');
    expect(sharedHeaderStyles).toContain('max-width: calc(100% - 76px) !important;');
    expect(sharedHeaderStyles).toContain('max-width: none !important;');
    expect(sharedHeaderStyles).toContain(
      'grid-template-columns: calc((100% - (2 * var(--dashboard-card-gap))) / 3) minmax(0, 1fr) !important;',
    );
    expect(sharedHeaderStyles).toContain('grid-template-rows: 88px 62px !important;');
    expect(sharedHeaderStyles).toContain('height: 150px !important;');
    expect(sharedHeaderStyles).toContain('height: 138px !important;');
    expect(compass.readUInt32BE(16)).toBe(604);
    expect(compass.readUInt32BE(20)).toBe(589);
    expect(wordmark.readUInt32BE(16)).toBe(1524);
    expect(wordmark.readUInt32BE(20)).toBe(295);
    expect(styles).toContain('.command-header-plume');
  });
});
