import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../server/public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const reports = readFileSync(new URL('../server/public/reports.js', import.meta.url), 'utf8');
const equipment = readFileSync(new URL('../server/public/equipment.js', import.meta.url), 'utf8');
const sources = readFileSync(new URL('../server/public/sources.js', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../server/public/global-ui-overrides.css', import.meta.url), 'utf8');
const pageShellStyles = readFileSync(new URL('../server/public/page-shell.css', import.meta.url), 'utf8');

describe('Phase 2 page module ownership contract', () => {
  it('loads page modules after the shared runtime and existing feature modules', () => {
    expect(html.indexOf('<script src="script.js')).toBeGreaterThan(-1);
    expect(html.indexOf('<script src="reports.js"></script>')).toBeGreaterThan(html.indexOf('<script src="script.js'));
    expect(html.indexOf('<script src="equipment.js"></script>')).toBeGreaterThan(html.indexOf('<script src="monitor-inventory.js"></script>'));
    expect(html.indexOf('<script src="sources.js"></script>')).toBeGreaterThan(html.indexOf('<script src="script.js'));
  });

  it('routes Reports, Equipment, and Sources activation through page modules', () => {
    expect(script).toContain('window.HazMatIQ.initializeReportsPage');
    expect(script).toContain('window.HazMatIQ.initializeEquipmentPage?.(context)');
    expect(script).toContain('window.HazMatIQ.initializeSourcesPage?.(context)');
    expect(script).not.toContain('function showMonitorPanel');
    expect(script).not.toContain("querySelectorAll('[data-report-tab]')");
    expect(reports).toContain('window.HazMatIQ.initializeReportsPage = initializeReportsPage;');
    expect(equipment).toContain('window.HazMatIQ.initializeEquipmentPage = initializeEquipmentPage;');
    expect(sources).toContain('window.HazMatIQ.initializeSourcesPage = initializeSourcesPage;');
  });

  it('keeps page lifecycle bindings idempotent', () => {
    for (const module of [reports, equipment, sources]) {
      expect(module).toContain('let initialized = false;');
      expect(module).toContain('if (!initialized)');
      expect(module).toContain("root.dataset.lifecycleInitialized = 'true';");
    }
  });

  it('keeps Reports-specific layout out of global overrides', () => {
    expect(globalStyles).not.toContain('.reports-page > .variant-reports');
    expect(globalStyles).not.toContain('.reports-page > .report-center');
    expect(pageShellStyles).toContain('.reports-page > .variant-reports');
    expect(pageShellStyles).toContain('.reports-page > .report-center');
  });

  it('preserves the static Sources page root and catalog content', () => {
    expect(html).toContain('<section id="source" class="view sources-page"');
    expect(html).toContain('CAMEO Chemicals');
    expect(html).toContain('HazMatIQ plume model');
  });
});
