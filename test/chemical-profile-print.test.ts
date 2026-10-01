import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../server/public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../server/public/chemical-intel.css', import.meta.url), 'utf8');

describe('Chemical Profile print / export', () => {
  it('adds a keyboard-accessible page-selection dialog to the profile toolbar', () => {
    expect(html).toContain('id="chemical-profile-print-export-btn"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('id="chemical-profile-print-dialog"');
    expect(html).toContain('id="chemical-profile-print-all"');
    expect(html).toContain('id="chemical-profile-print-pages"');
    expect(html).toContain('Print / Save PDF');
    expect(script).toContain('dialog.showModal()');
    expect(script).toContain('Select at least one information page.');
  });

  it('renders every profile page for All pages and limits output to checked pages', () => {
    expect(script).toContain('const selectedKeys = new Set(printPageKeys || tabsList.map(([, key]) => key));');
    expect(script).toContain('tabsList.forEach(([label, key]) => {');
    expect(script).toContain('data-profile-print-key');
    expect(script).toContain('startChemicalProfilePrint(pageKeys);');
    expect(script).toContain('renderChemicalProfile(profileSnapshot, { printPageKeys: selectedKeys, printSnapshot: true });');
    expect(script).toContain('window.print()');
  });

  it('prints identifiers, source labels, date, and long names in a high-contrast layout', () => {
    for (const label of ['CAS', 'UN/NA', 'ERG Guide', 'Hazard Class', 'Sources', 'Print date']) {
      expect(script).toContain(label);
    }
    expect(styles).toContain('overflow-wrap: anywhere;');
    expect(styles).toContain('body.printing-chemical-profile #chemical-profile-print-root');
    expect(styles).toContain('background: #fff;');
    expect(script).toContain("root.querySelectorAll('button, nav, a, iframe, [hidden]");
    expect(script).toContain("window.addEventListener('afterprint', cleanupChemicalProfilePrint);");
  });
});
