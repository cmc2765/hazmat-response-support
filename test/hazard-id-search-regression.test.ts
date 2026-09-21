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
    ${declaration('normalizeChemicalQuery')}
    ${declaration('companionChemicalForUi')}
    ${declaration('isUnreviewedTransportationRecord')}
    ${declaration('searchChemicalId')}
    let latestChemicalSearch = 0;
    const statuses = [];
    const chemicalSearchSuggestions = null;
    const chemicalSearchInput = null;
    const facilityInventory = { hidden: false };
    function setChemicalSearchStatus(message, state = '') { statuses.push({ message, state }); }
    function clearChemicalSuggestions() {}
    const openedProfiles = [];
    (async () => {
      ${extra}
    })()
  `;
}

function context(fetchJson: (url: string) => Promise<unknown>, onProfileOpen: (chemical: unknown) => void) {
  const openedProfiles: unknown[] = [];
  return {
    console,
    fetchJson,
    window: {
      clearTimeout: vi.fn(),
      HazMatIQ: {
        normalizeHazardSearchResult: (result: Record<string, unknown>) => ({
          profileType: 'chemical',
          canonicalId: String(result.selectedChemicalId),
          chemicalCompanionId: result.selectedChemicalId,
          cbrneCanonicalId: null,
          routingLane: 'CHEMICAL',
          sourceState: 'master-record',
        }),
        openHazardProfile: (chemical: unknown) => {
          openedProfiles.push(chemical);
          onProfileOpen(chemical);
          return Promise.resolve();
        },
      },
    },
    openedProfiles,
  };
}

describe('Hazard ID search regression', () => {
  it('opens a verified Chlorine profile without waiting for facility lookup', async () => {
    let resolveFacility!: (value: unknown) => void;
    const facilityRequest = new Promise((resolve) => { resolveFacility = resolve; });
    const fetchJson = vi.fn((url: string) => url.includes('/api/facilities')
      ? facilityRequest
      : Promise.resolve({
        chemicals: [{
          ChemicalID: 22,
          ChemicalName: 'Chlorine',
          CasNumber: '7782-50-5',
          UnnaNumber: '1017',
          ErgNumber: '124',
          recordType: 'master-chemical',
          guidanceEligible: true,
        }],
      }));
    let resolveProfileOpen!: () => void;
    const profileOpened = new Promise<void>((resolve) => { resolveProfileOpen = resolve; });
    const testContext = context(fetchJson, resolveProfileOpen);

    const request = runInNewContext(runtime(`
      await searchChemicalId('Chlorine', { submit: true });
      return { statuses, openedProfiles };
    `), testContext);
    await Promise.race([
      profileOpened,
      new Promise((_, reject) => setTimeout(() => reject(new Error('profile opener did not run')), 250)),
    ]);

    expect(testContext.openedProfiles).toHaveLength(1);
    expect(testContext.openedProfiles[0]).toMatchObject({
      selectedChemicalId: 22,
      name: 'Chlorine',
      cas: '["7782-50-5"]',
      un: '["1017"]',
    });
    expect(fetchJson).toHaveBeenCalledWith('/api/chemicals/search?q=Chlorine');
    expect(fetchJson).toHaveBeenCalledWith('/api/facilities?q=Chlorine');

    resolveFacility({ facilities: [] });
    const result = await request;
    expect(result.statuses).toEqual([{ message: 'Searching chemical and facility records…', state: 'loading' }]);
  });
});
