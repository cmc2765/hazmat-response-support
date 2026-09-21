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

describe('Plume workspace initialization', () => {
  it('uses saved incident coordinates without requesting GPS or geocoding', async () => {
    const input = { value: '' };
    const gps = vi.fn();
    const result = await runInNewContext(`${declaration('parseGpsCoordinate')}\n${declaration('getIncidentCoordinates')}\ngetIncidentCoordinates()`, {
      document: { getElementById: () => input },
      getActiveIncident: () => ({ latitude: 33.52, longitude: -86.8 }),
      getIncidentAddressValue: () => '', getCurrentGps: gps,
    });
    expect(result).toEqual({ lat: 33.52, lon: -86.8, source: 'Saved incident location' });
    expect(gps).not.toHaveBeenCalled();
    expect(input.value).toBe('33.520000, -86.800000');
  });

  it('does not convert empty saved coordinates to a false location at zero, zero', async () => {
    const gps = vi.fn().mockResolvedValue({ lat: 34, lon: -87 });
    const result = await runInNewContext(`${declaration('parseGpsCoordinate')}\n${declaration('getIncidentCoordinates')}\ngetIncidentCoordinates()`, {
      document: { getElementById: () => ({ value: '' }) },
      getActiveIncident: () => ({ latitude: '', longitude: '' }),
      getIncidentAddressValue: () => '', getCurrentGps: gps,
    });
    expect(result).toEqual({ lat: 34, lon: -87, source: 'Current device GPS' });
    expect(gps).toHaveBeenCalledOnce();
  });

  it('restores the saved incident chemical even without a separate selection cache', async () => {
    const context = {
      window: { localStorage: { getItem: () => null } }, selectedChemicalStorageKey: 'chemical',
      selectedChemicalId: null as number | null, activeChemical: null as { id: string } | null,
      activeChemicalRecord: null,
      getActiveIncident: () => ({ selectedChemicalId: 22, chemicalName: 'Chlorine' }),
      fetchJson: vi.fn().mockResolvedValueOnce({ id: 22, name: 'Chlorine' }).mockResolvedValueOnce({ header: { name: 'Chlorine' } }),
      fetchPrimaryChemicalProfile: vi.fn().mockResolvedValue({
        id: '22', selectedChemicalId: 22, name: 'Chlorine', profile: { header: { name: 'Chlorine' } },
      }),
      setActiveChemical: (chemical: { id: number }) => { context.activeChemical = { id: String(chemical.id) }; context.selectedChemicalId = chemical.id; },
      buildFullChemicalRecord: vi.fn().mockResolvedValue({ name: 'Chlorine' }),
      applyChemicalContainerProfile: vi.fn(), restoreIncidentContainerData: vi.fn(),
      updateActiveIncidentRecord: vi.fn(), renderIncidentCommandSnapshot: vi.fn(), syncPlumeChemicalSelection: vi.fn(),
    };
    await runInNewContext(`${declaration('restoreSelectedChemical')}\nrestoreSelectedChemical()`, context);
    expect(context.fetchJson).toHaveBeenCalledWith('/api/chemicals/22');
    expect(context.activeChemicalRecord).toMatchObject({ name: 'Chlorine', profile: { header: { name: 'Chlorine' } } });
    expect(context.syncPlumeChemicalSelection).toHaveBeenCalled();
  });

  function refreshContext() {
    const status = { textContent: '' };
    return {
      Error, status, plumeRefreshToken: 0, activeChemicalRecord: null,
      document: { getElementById: (id: string) => id === 'plume-live-status' ? status : null },
      restoreSelectedChemical: vi.fn().mockResolvedValue(undefined),
      ensurePlumeMap: vi.fn().mockResolvedValue(undefined),
      getIncidentAddressValue: () => '', getActiveIncident: () => null,
      getIncidentCoordinates: vi.fn(), setText: vi.fn(), activeChemical: null,
      fetchWeatherSources: vi.fn(() => new Promise(() => {})),
    };
  }

  it('initializes the map and chemical independently when GPS is denied', async () => {
    const context = refreshContext();
    context.getIncidentCoordinates.mockRejectedValue(new Error('GPS permission denied.'));
    await runInNewContext(`${declaration('refreshPlumeWorkspace')}\nrefreshPlumeWorkspace()`, context);
    expect(context.ensurePlumeMap).toHaveBeenCalled();
    expect(context.restoreSelectedChemical).toHaveBeenCalled();
    expect(context.status.textContent).toContain('Enter an address or coordinates');
    expect(context.fetchWeatherSources).not.toHaveBeenCalled();
  });

  it('still requests weather when the map constructor throws synchronously', async () => {
    const context = refreshContext();
    context.getIncidentCoordinates.mockResolvedValue({ lat: 33.52, lon: -86.8, source: 'Incident' });
    context.ensurePlumeMap.mockImplementation(() => { throw new Error('WebGL unavailable'); });
    void runInNewContext(`${declaration('refreshPlumeWorkspace')}\nrefreshPlumeWorkspace()`, context);
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    expect(context.fetchWeatherSources).toHaveBeenCalledWith(33.52, -86.8);
    expect(context.setText).toHaveBeenCalledWith('plume-overlay-status', 'WebGL unavailable');
  });
});
