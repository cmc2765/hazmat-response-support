import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { describe, expect, it } from 'vitest';

const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const hazardProfile = readFileSync(new URL('../server/public/hazard-profile.js', import.meta.url), 'utf8');
const program = parse(script, { ecmaVersion: 'latest' });

function declaration(name: string) {
  const node = program.body.find((item) => item.type === 'FunctionDeclaration' && item.id?.name === name);
  if (!node) throw new Error(`Missing ${name}`);
  return script.slice(node.start, node.end);
}

class FakeClassList {
  private values = new Set<string>();

  constructor(...initial: string[]) {
    initial.forEach((value) => this.values.add(value));
  }

  contains(value: string) { return this.values.has(value); }
  toggle(value: string, force?: boolean) {
    const next = force === undefined ? !this.values.has(value) : force;
    if (next) this.values.add(value);
    else this.values.delete(value);
    return next;
  }
}

class FakeNode {
  hidden = false;
  textContent = '';
  dataset: Record<string, string> = {};
  children: FakeNode[] = [];
  classList = new FakeClassList();
  attributes: Record<string, string> = {};

  append(...children: FakeNode[]) { this.children.push(...children.filter(Boolean)); }
  replaceChildren(...children: FakeNode[]) { this.children = []; this.append(...children); }
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
  addEventListener() {}
  scrollIntoView() {}
}

const records = [
  { query: 'Chlorine', id: 22, name: 'Chlorine', cas: '7782-50-5', un: '1017' },
  { query: 'Sulfur dioxide', id: 102, name: 'Sulfur dioxide', cas: '7446-09-5', un: '1079' },
  { query: 'Ammonia', id: 10, name: 'Ammonia (anhydrous)', cas: '7664-41-7', un: '1005' },
  { query: 'Hydrazine', id: 54, name: 'Hydrazine', cas: '302-01-2', un: '2029' },
];

function runVisibilityFlow() {
  const ids = [
    'lookup', 'hazard-id-search-hero', 'hazard-id-search-workspace', 'facility-inventory',
    'chemical-id-results', 'hazard-profile-results', 'hazard-id-empty-profile',
    'chemical-name', 'chemical-profile-meta', 'chemical-profile-tabs', 'chemical-profile-content',
  ];
  const nodes = Object.fromEntries(ids.map((id) => [id, new FakeNode()])) as Record<string, FakeNode>;
  nodes.lookup.classList.toggle('active', true);
  nodes.lookup.dataset.pageRoot = 'hazard-id';
  nodes['chemical-id-results'].hidden = true;
  nodes['hazard-profile-results'].hidden = true;
  nodes['hazard-id-empty-profile'].hidden = true;
  const profileById = new Map(records.map((record) => [record.id, record]));
  const fetchJson = async (url: string) => {
    if (url.startsWith('/api/facilities')) return { facilities: [] };
    if (url.startsWith('/api/chemicals/search')) {
      const query = decodeURIComponent(url.split('=')[1] || '').toLowerCase();
      const record = records.find((item) => item.query.toLowerCase() === query);
      return {
        chemicals: record ? [{
          ChemicalID: record.id,
          ChemicalName: record.name,
          CasNumber: record.cas,
          UnnaNumber: record.un,
          ErgNumber: '124',
          guidanceEligible: true,
        }] : [],
      };
    }
    const id = Number(url.match(/\/api\/chemicals\/(\d+)\/profile/)?.[1]);
    const record = profileById.get(id);
    return {
      header: { name: record?.name, cas: record?.cas, un: record?.un, ergGuide: '124', sources: ['Chemical Companion Master'] },
      properties: {}, exposures: {},
    };
  };
  const context = {
    console,
    records,
    fetchJson,
    document: { getElementById: (id: string) => nodes[id] || null },
    window: {
      clearTimeout() {},
      matchMedia: () => ({ matches: false }),
      HazMatIQ: { hazardProfileLegacy: {} },
    },
  } as Record<string, unknown>;
  const runtime = `
    ${declaration('normalizeChemicalSelectionId')}
    ${declaration('normalizeChemicalQuery')}
    ${declaration('isChemicalCompanionSelection')}
    ${declaration('companionChemicalForUi')}
    ${declaration('isUnreviewedTransportationRecord')}
    ${declaration('setHazardProfileMode')}
    ${declaration('openChemical')}
    ${declaration('searchChemicalId')}
    let latestChemicalSearch = 0;
    let latestChemicalProfileRequest = 0;
    let selectedChemicalId = null;
    let activeChemicalRecord = null;
    let chemicalSearchTimer = 0;
    const chemicalSearchInput = { value: '', setAttribute() {} };
    const chemicalSearchSuggestions = { hidden: true, replaceChildren() {}, setAttribute() {} };
    const chemicalSearchStatus = { textContent: '', dataset: {} };
    const chemicalIdResults = document.getElementById('chemical-id-results');
    const facilityInventory = document.getElementById('facility-inventory');
    const hazardProfileResults = document.getElementById('hazard-profile-results');
    const hazardEmptyProfile = document.getElementById('hazard-id-empty-profile');
    function clearChemicalSuggestions() {}
    function setChemicalSearchStatus(message, state = '') { chemicalSearchStatus.textContent = message; chemicalSearchStatus.dataset.state = state; }
    function setActiveChemical(chemical) { selectedChemicalId = chemical.selectedChemicalId; }
    function chemicalProfileRecord(chemical, profile) {
      return {
        id: String(chemical.selectedChemicalId), selectedChemicalId: chemical.selectedChemicalId,
        name: profile.header.name, cas: profile.header.cas, un: profile.header.un,
        ergGuide: profile.header.ergGuide, profile,
      };
    }
    function buildFullChemicalRecord() { return Promise.resolve(null); }
    function applyChemicalContainerProfile() {}
    function updateActiveIncidentRecord() {}
    function renderIncidentCommandSnapshot() {}
    function updateChemicalCard(record) {
      const profile = record.profile;
      document.getElementById('chemical-name').textContent = profile.header.name;
      document.getElementById('chemical-profile-meta').textContent = 'CAS: ' + profile.header.cas + ' · UN ' + profile.header.un;
      document.getElementById('chemical-profile-tabs').textContent = 'Overview';
      document.getElementById('chemical-profile-content').textContent = 'Profile content';
    }
    ${hazardProfile}
    window.HazMatIQ.hazardProfileLegacy.openChemical = openChemical;
    (async () => {
      const rendered = [];
      for (const item of records) {
        await searchChemicalId(item.query, { submit: true });
        rendered.push({
          name: document.getElementById('chemical-name').textContent,
          meta: document.getElementById('chemical-profile-meta').textContent,
          profileVisible: !document.getElementById('chemical-id-results').hidden,
          landingVisible: !document.getElementById('hazard-id-search-workspace').hidden,
          pageState: document.getElementById('lookup').dataset.hazardPageState,
          pageRoot: document.getElementById('lookup').dataset.pageRoot,
          tabs: document.getElementById('chemical-profile-tabs').textContent,
        });
      }
      return rendered;
    })()
  `;
  return runInNewContext(runtime, context);
}

describe('Hazard ID chemical profile DOM visibility', () => {
  it('renders all representative ordinary chemicals into the visible canonical profile surface', async () => {
    const results = await runVisibilityFlow() as Array<Record<string, unknown>>;
    expect(results).toHaveLength(4);
    expect(results).toEqual(records.map((record) => expect.objectContaining({
      name: record.name,
      meta: expect.stringContaining(`CAS: ${record.cas}`),
      profileVisible: true,
      landingVisible: false,
      pageState: 'chemical-profile',
      pageRoot: 'hazard-id',
      tabs: 'Overview',
    })));
  });
});
