import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../server/public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const module = readFileSync(new URL('../server/public/incident-command.js', import.meta.url), 'utf8');
const incidentOverrides = readFileSync(new URL('../server/public/incident-overrides.css', import.meta.url), 'utf8');
const reports = readFileSync(new URL('../server/public/reports.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server/src/app.ts', import.meta.url), 'utf8');

function moduleApi() {
  const context = {
    window: {
      HazMatIQ: {
        isIncidentPlumeCurrent: (plume: unknown, incident: Record<string, unknown>) => {
          const candidate = plume as Record<string, unknown> | null;
          const chemical = candidate?.chemical as Record<string, unknown> | null;
          return Boolean(candidate
            && String(candidate.incidentId || '') === String(incident.incidentId || '')
            && String(chemical?.masterChemicalId || chemical?.selectedChemicalId || '') === String(incident.selectedChemicalId || incident.chemicalCompanionId || ''));
        },
      },
    },
    document: { getElementById: () => null },
  } as Record<string, unknown>;
  runInNewContext(module, context);
  return (context.window as { HazMatIQ: Record<string, (...args: unknown[]) => unknown> }).HazMatIQ;
}

function responseTabsRenderer() {
  const shell = {
    hidden: false,
    attributes: {} as Record<string, string>,
    setAttribute(name: string, value: string) { this.attributes[name] = value; },
    removeAttribute(name: string) { delete this.attributes[name]; },
  };
  const tabs = {
    hidden: false,
    children: [] as Array<Record<string, unknown>>,
    replaceChildren() { this.children = []; },
    append(child: Record<string, unknown>) { this.children.push(child); },
  };
  const count = { textContent: '' };
  const document = {
    querySelector: () => shell,
    getElementById: (id: string) => id === 'incident-response-tabs' ? tabs : id === 'incident-response-tabs-count' ? count : null,
    createElement: () => {
      const classes = new Set<string>();
      return {
        type: '', className: '', dataset: {} as Record<string, string>, attributes: {} as Record<string, string>,
        classList: { toggle(name: string, active: boolean) { if (active) classes.add(name); else classes.delete(name); }, contains: (name: string) => classes.has(name) },
        setAttribute(name: string, value: string) { this.attributes[name] = value; },
        append() {}, addEventListener() {},
      };
    },
  };
  let incidents: Array<{ incidentId: string; incidentName: string; status: string }> = [];
  const context = {
    document,
    window: { localStorage: { getItem: () => 'incident-1' } },
    activeIncidentIdStorageKey: 'hazmatiq_active_incident_id',
    readIncidents: () => incidents,
  } as Record<string, unknown>;
  const start = script.indexOf('function renderIncidentResponseTabs()');
  const end = script.indexOf('function switchActiveIncident', start);
  runInNewContext(`${script.slice(start, end)}; this.render = renderIncidentResponseTabs;`, context);
  return {
    render: context.render as () => void,
    shell,
    tabs,
    count,
    setIncidents(value: typeof incidents) { incidents = value; },
  };
}

describe('Incident Command operational hub', () => {
  it('loads as the page-owned module and provides direct command actions', () => {
    expect(html.indexOf('<script src="incident-command.js"></script>')).toBeGreaterThan(html.indexOf('<script src="script.js'));
    expect(html).toContain('id="ic-command-actions"');
    expect(html).toContain('id="ic-chemical-summary"');
    expect(html).toContain('data-incident-command-action="chemical-profile"');
    expect(html).toContain('id="ic-plume-preview-image"');
    expect(script).toContain("if (targetId === 'incident') window.HazMatIQ.initializeIncidentCommand?.(context);");
    expect(script).toContain("window.dispatchEvent(new CustomEvent('hazmatiq:incident-command-updated'");
    expect(reports).toContain('context.incidentId');
  });

  it('only renders the response strip when two or more incidents are open', () => {
    expect(html).toContain('class="incident-response-tabs-shell" aria-label="Open incident responses" hidden');
    expect(script).toContain("const openIncidents = readIncidents().filter((incident) => incident.status !== 'Completed');");
    expect(script).toContain('if (openIncidents.length <= 1) {');
    expect(script).toContain("shell.hidden = true;");
    expect(script).toContain("if (count) count.textContent = `${openIncidents.length} RESPONSES`;");
    expect(script).toContain('shell.hidden = false;');
  });

  it('collapses 0/1 open incidents and renders tabs only for 2+ open incidents', () => {
    const renderer = responseTabsRenderer();
    renderer.setIncidents([]);
    renderer.render();
    expect(renderer.shell.hidden).toBe(true);
    expect(renderer.tabs.children).toHaveLength(0);
    expect(renderer.count.textContent).toBe('');

    renderer.setIncidents([{ incidentId: 'incident-1', incidentName: 'Thursday Madness', status: 'Active' }]);
    renderer.render();
    expect(renderer.shell.hidden).toBe(true);
    expect(renderer.tabs.children).toHaveLength(0);

    renderer.setIncidents([
      { incidentId: 'incident-1', incidentName: 'Thursday Madness', status: 'Active' },
      { incidentId: 'incident-2', incidentName: 'Warehouse Leak', status: 'Active' },
      { incidentId: 'incident-3', incidentName: 'Completed Drill', status: 'Completed' },
    ]);
    renderer.render();
    expect(renderer.shell.hidden).toBe(false);
    expect(renderer.tabs.children).toHaveLength(2);
    expect(renderer.count.textContent).toBe('2 RESPONSES');
    const activeTabClassList = renderer.tabs.children[0].classList as { contains: (name: string) => boolean };
    expect(activeTabClassList.contains('is-active')).toBe(true);
  });

  it('normalizes one incident state for chemical, plume, command, and report consumers', () => {
    const api = moduleApi();
    const state = api.normalizeIncidentState({
      incidentId: 'incident-1', incidentName: 'Hydrazine Tank Leak', status: 'Active',
      address: '1 Main St', latitude: '33.5', longitude: '-86.8',
      chemicalName: 'Hydrazine', selectedChemicalId: 54, casNumber: '302-01-2', unNumber: '2029', ergGuide: '132',
      hazardClass: '3 (Flammable liquid)', sourceStatuses: { chemical: 'Verified Source' },
      objectives: 'Isolate release area\nIdentify leak point',
      commandStructure: 'IC / HazMat Group / Safety', communications: 'Channel 3',
      medicalPlan: 'EMS staging', stagingResources: 'South lot',
      plumeModelResults: {
        incidentId: 'incident-1',
        chemical: { masterChemicalId: 54, chemicalName: 'Hydrazine' },
        output: { threatZones: [{ threatRank: 3 }] },
      }, plumeMapImage: 'data:image/jpeg;base64,preview',
      incidentNotes: [{ text: 'Initial size-up' }],
    });
    expect(state).toMatchObject({
      incidentId: 'incident-1', location: '1 Main St',
      activeChemical: { canonicalId: '54', displayName: 'Hydrazine', chemicalCompanionId: 54, cas: '302-01-2' },
      plume: { status: 'PLOTTED', mapImage: 'data:image/jpeg;base64,preview' },
      command: { objectives: ['Isolate release area', 'Identify leak point'], structure: 'IC / HazMat Group / Safety' },
    });
  });

  it('maps the canonical incident state to reusable ICS prefill data', () => {
    const api = moduleApi();
    const prefill = api.buildIcsPrefill({
      incidentId: 'incident-2', incidentName: 'Hydrazine Tank Leak', incidentNumber: 'H-2',
      startDate: '09/17/2026', startTime: '10:00 AM', address: '1 Main St',
      chemicalName: 'Hydrazine', casNumber: '302-01-2', unNumber: '2029', ergGuide: '132',
      objectives: 'Isolate release area\nIdentify leak point', commandStructure: 'IC / HazMat Group / Safety',
      communications: 'Channel 3', medicalPlan: 'EMS staging', stagingResources: 'South lot',
      notes: 'Initial size-up',
    }) as Record<string, unknown>;
    expect(prefill).toMatchObject({
      incidentId: 'incident-2',
      shared: { incidentName: 'Hydrazine Tank Leak', incidentLocation: '1 Main St' },
      forms: {
        '202': { objectives: 'Isolate release area\nIdentify leak point' },
        '203': { commandStructure: 'IC / HazMat Group / Safety' },
        '205': { communications: 'Channel 3' },
        '206': { medicalPlan: 'EMS staging' },
        '204': { assignments: 'South lot' },
      },
    });
    expect(server).toContain('normalized.includes("objectives")');
    expect(server).toContain('normalized.includes("communicationsplan")');
  });

  it('does not promote a text-only incident label into a canonical chemical profile', () => {
    const api = moduleApi();
    const state = api.normalizeIncidentState({
      incidentId: 'incident-text-only', incidentName: 'Unresolved release', status: 'Active',
      chemicalName: 'Ammonia',
    }) as { activeChemical: unknown; plume: { status: string } };
    expect(state.activeChemical).toBeNull();
    expect(state.plume.status).toBe('NOT PLOTTED');
  });

  it('consumes the saved plume result without creating another model', () => {
    expect(module).toContain('source.plumeModelResults || null');
    expect(module).toContain('source.plumeMapImage ||');
    expect(module).toContain("['Source / Review', state?.activeChemical?.sourceState]");
    expect(module).not.toContain('runPlume(');
    expect(module).not.toContain('ensurePlumeMap(');
    expect(script).toContain('function openPlumeModel(context = {})');
    expect(script).toContain('function savePlumeResult(command, workflowRecord, mapImage = \'\')');
  });

  it('reserves red life-safety emphasis for IDLH rows', () => {
    expect(script).toContain("['IDLH', model.idlh, true, 'idlh']");
    expect(script).not.toContain("['Primary Hazard', model.primaryHazard, true]");
    expect(script).not.toContain("['Medical Concerns', model.medicalConcerns, true]");
    expect(script).not.toContain("item.lifeSafety ? ' is-life-safety' : ''");
    expect(incidentOverrides).toContain('.incident-command-brief-list .is-idlh');
    expect(incidentOverrides).not.toContain('.incident-command-brief-list .is-life-safety');
    expect(incidentOverrides).not.toContain('.incident-command-tactical-row.is-life-safety');
  });

  it('propagates starter-hazard identity and preserves the existing safety boundary', () => {
    expect(script).toContain('propagateHazardToIncident?.(result, profile);');
    expect(module).toContain('chemicalProfile: viewProfile');
    expect(module).toContain('sourceStatuses: { ...(incident.sourceStatuses || {}), chemical: normalized.sourceState || NO_DATA }');
    expect(script).toContain('window.HazMatIQ?.openChemCompareWithBase?.(chemical);');
  });
});
