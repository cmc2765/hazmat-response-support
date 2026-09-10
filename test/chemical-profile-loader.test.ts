import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { describe, expect, it, vi } from 'vitest';

const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const program = parse(script, { ecmaVersion: 'latest' });

function declaration(name: string) {
  const node = program.body.find((item) => item.type === 'FunctionDeclaration' && item.id?.name === name);
  if (!node) throw new Error(`Missing ${name}`);
  return script.slice(node.start, node.end);
}

function runtime(extra: string) {
  return `
    ${declaration('normalizeChemicalSelectionId')}
    ${declaration('companionChemicalForUi')}
    let chemicalSearchTimer = null;
    let latestChemicalSearch = 0;
    let latestChemicalProfileRequest = 0;
    let activeChemical = null;
    let selectedChemicalId = null;
    let activeChemicalRecord = null;
    let activePlumeCommand = null;
    let activePpeSelection = [];
    const selectedChemicalStorageKey = 'chemical';
    const chemicalIdResults = null;
    const statuses = [];
    function setChemicalSearchStatus(message, state = '') { statuses.push({ message, state }); }
    ${declaration('setActiveChemical')}
    ${declaration('openChemical')}
    (async () => {
      ${extra}
    })()
  `;
}

function context(overrides: Record<string, unknown> = {}) {
  return {
    Error,
    console,
    document: { getElementById: () => null },
    window: {
      clearTimeout: vi.fn(),
      localStorage: { setItem: vi.fn(), removeItem: vi.fn() },
      matchMedia: () => ({ matches: false }),
    },
    hasActiveIncident: () => false,
    savePlanningState: vi.fn(),
    syncPlumeChemicalSelection: vi.fn(),
    applyChemicalContainerProfile: vi.fn(),
    clearErgIsolationOverlay: vi.fn(),
    clearThreatZones: vi.fn().mockResolvedValue(undefined),
    setText: vi.fn(),
    updateActiveIncidentRecord: vi.fn(),
    renderIncidentCommandSnapshot: vi.fn(),
    chemicalProfileSources: () => ['Chemical Companion Master'],
    formatIdlh: (value: unknown) => value,
    setHazardProfileMode: vi.fn(),
    updateChemicalCard: vi.fn(),
    buildFullChemicalRecord: () => new Promise(() => {}),
    ...overrides,
  };
}

const sulfurDioxideSearchRow = {
  ChemicalID: 102,
  ChemicalName: 'Sulfur dioxide',
  CasNumber: '7446-09-5',
  UnnaNumber: '1079',
  ErgNumber: '125',
  recordType: 'master-chemical',
  guidanceEligible: true,
};

describe('Hazard ID Chemical Companion profile loader', () => {
  it('keeps a numeric master ID through search, selection, and successful profile rendering', async () => {
    const updateChemicalCard = vi.fn();
    const fetchJson = vi.fn().mockResolvedValue({
      selectedChemicalId: 102,
      header: { name: 'Sulfur dioxide', idlh: '100 ppm', un: '1079', ergGuide: '125' },
    });
    const result = await runInNewContext(runtime(`
      const chemical = companionChemicalForUi(${JSON.stringify(sulfurDioxideSearchRow)});
      await openChemical(chemical);
      return ({ chemical, selectedChemicalId, activeChemical, statuses });
    `), context({ fetchJson, updateChemicalCard }));

    expect(result.chemical.selectedChemicalId).toBe(102);
    expect(result.chemical.id).toBe('102');
    expect(result.selectedChemicalId).toBe(102);
    expect(result.activeChemical.selectedChemicalId).toBe(102);
    expect(fetchJson).toHaveBeenCalledWith('/api/chemicals/102/profile');
    expect(updateChemicalCard).toHaveBeenCalledWith(expect.objectContaining({
      id: '102', selectedChemicalId: 102, name: 'Sulfur dioxide',
    }));
    expect(result.statuses.at(-1)).toEqual({ message: '', state: '' });
  });

  it('does not let a stale profile response overwrite a newer chemical selection', async () => {
    const updateChemicalCard = vi.fn();
    const deferred: { chlorine?: (value: unknown) => void; sulfurDioxide?: (value: unknown) => void } = {};
    const fetchJson = vi.fn((url: string) => new Promise((resolve) => {
      if (url.includes('/22/profile')) deferred.chlorine = resolve;
      else deferred.sulfurDioxide = resolve;
    }));
    const result = await runInNewContext(runtime(`
      const chlorine = companionChemicalForUi({ ChemicalID: 22, ChemicalName: 'Chlorine', recordType: 'master-chemical', guidanceEligible: true });
      const sulfurDioxide = companionChemicalForUi(${JSON.stringify(sulfurDioxideSearchRow)});
      const oldRequest = openChemical(chlorine);
      await Promise.resolve();
      const newRequest = openChemical(sulfurDioxide);
      await Promise.resolve();
      deferred.sulfurDioxide?.({ header: { name: 'Sulfur dioxide' } });
      await newRequest;
      deferred.chlorine?.({ header: { name: 'Chlorine' } });
      await oldRequest;
      return ({ activeChemical, selectedChemicalId, statuses });
    `), context({ fetchJson, updateChemicalCard, deferred }));

    expect(result.selectedChemicalId).toBe(102);
    expect(result.activeChemical.selectedChemicalId).toBe(102);
    expect(updateChemicalCard).toHaveBeenCalledTimes(1);
    expect(updateChemicalCard.mock.calls[0][0].name).toBe('Sulfur dioxide');
    expect(result.statuses.at(-1)).toEqual({ message: '', state: '' });
  });

  it('leaves loading immediately when the primary profile fails even if enrichment never settles', async () => {
    const setHazardProfileMode = vi.fn();
    const fetchJson = vi.fn().mockResolvedValue(null);
    const result = await runInNewContext(runtime(`
      await openChemical(companionChemicalForUi(${JSON.stringify(sulfurDioxideSearchRow)}));
      return ({ statuses });
    `), context({ fetchJson, setHazardProfileMode }));

    expect(setHazardProfileMode).toHaveBeenCalledWith('empty');
    expect(result.statuses.at(-1)).toEqual({
      message: 'Database information for Sulfur dioxide could not be loaded.',
      state: 'error',
    });
    expect(result.statuses.some((status: { message: string }) => status.message.includes('Loading'))).toBe(true);
    expect(result.statuses.at(-1).state).not.toBe('loading');
  });
});
