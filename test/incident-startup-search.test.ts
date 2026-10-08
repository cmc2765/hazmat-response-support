import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { describe, expect, it, vi } from 'vitest';

const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const program = parse(script, { ecmaVersion: 'latest' });
function declaration(name: string) {
  const node = program.body.find((node) => node.type === 'FunctionDeclaration' && node.id?.name === name);
  if (!node) throw new Error(`Missing ${name}`);
  return script.slice(node.start, node.end);
}

describe('Incident startup and product lookup', () => {
  it('can render a saved incident after chemical state is initialized', () => {
    const selected = program.body.filter((node) => {
      if (node.type === 'VariableDeclaration') return node.declarations.some((item) => item.id.type === 'Identifier' && ['activeChemical', 'activeChemicalRecord'].includes(item.id.name));
      return node.type === 'ExpressionStatement' && script.slice(node.start, node.end) === 'startIncidentTimer();';
    });
    const rendered = vi.fn();
    runInNewContext([
      declaration('firstChemicalDataValue'),
      declaration('normalizeChemicalSelectionId'),
      declaration('incidentChemicalIdentity'),
      declaration('hasCanonicalIncidentChemicalIdentity'),
      declaration('selectedChemicalOperationalData'),
      'function startIncidentTimer() { rendered(selectedChemicalOperationalData({ incident: { selectedChemicalId: 10, chemicalName: "Saved product" }, profile: {} })); }',
      ...selected.map((node) => script.slice(node.start, node.end)),
    ].join('\n'), { rendered });
    expect(rendered).toHaveBeenCalledWith(expect.objectContaining({ chemicalName: 'Saved product' }));
  });

  it.each(['1017', 'UN1017', 'UN 1017'])('looks up %s and exposes matching incident suggestions', async (query) => {
    const append = vi.fn();
    const setAttribute = vi.fn();
    const fetchJson = vi.fn().mockResolvedValue({ chemicals: [{ id: 'chlorine', name: 'Chlorine' }] });
    const suggestions = { replaceChildren: vi.fn(), append, childElementCount: 1, hidden: true };
    const context = {
      latestIncidentProductSearch: 0, incidentProductSuggestions: suggestions,
      incidentProductInput: { setAttribute }, fetchJson,
      companionChemicalForUi: (value: unknown) => value,
      isUnreviewedTransportationRecord: () => false,
      chemicalSearchDetail: () => 'UN 1017',
      createSuggestion: vi.fn(() => 'suggestion'),
    };
    await runInNewContext(`${declaration('normalizeChemicalQuery')}\n${declaration('parseJsonField')}\n${declaration('chemicalSearchIdentifiers')}\n${declaration('searchIncidentProducts')}\nsearchIncidentProducts(${JSON.stringify(query)})`, context);
    expect(fetchJson).toHaveBeenCalledWith('/api/chemicals/search?q=1017');
    expect(append).toHaveBeenCalledWith('suggestion');
    expect(suggestions.hidden).toBe(false);
    expect(setAttribute).toHaveBeenCalledWith('aria-expanded', 'true');
  });
});
