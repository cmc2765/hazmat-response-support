import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const command = readFileSync(new URL('../server/public/incident-command.js', import.meta.url), 'utf8');

function plumeIdentityApi() {
  const start = script.indexOf('function normalizedChemicalName');
  const end = script.indexOf('function cleanIncidentOperationalMode');
  const context = {
    normalizeChemicalSelectionId: (value: unknown) => value,
  } as Record<string, unknown>;
  runInNewContext(`${script.slice(start, end)}; this.isIncidentPlumeCurrent = isIncidentPlumeCurrent;`, context);
  return context.isIncidentPlumeCurrent as (plume: unknown, incident: unknown) => boolean;
}

describe('Incident Command plume ownership', () => {
  it('rejects a Hydrazine plume when Ammonia is the active incident', () => {
    const isCurrent = plumeIdentityApi();
    expect(isCurrent({
      incidentId: 'incident-ammonia',
      chemical: { masterChemicalId: 54, chemicalName: 'Hydrazine' },
    }, {
      incidentId: 'incident-ammonia',
      selectedChemicalId: 12,
      chemicalName: 'Ammonia (anhydrous)',
    })).toBe(false);
  });

  it('accepts only a current incident plume with matching chemical identity', () => {
    const isCurrent = plumeIdentityApi();
    expect(isCurrent({
      incidentId: 'incident-ammonia',
      chemical: { masterChemicalId: 12, chemicalName: 'Ammonia (anhydrous)' },
    }, {
      incidentId: 'incident-ammonia',
      selectedChemicalId: 12,
      chemicalName: 'Ammonia (anhydrous)',
    })).toBe(true);
    expect(isCurrent({
      incidentId: 'incident-hydrazine',
      chemical: { masterChemicalId: 54, chemicalName: 'Hydrazine' },
    }, {
      incidentId: 'incident-ammonia',
      selectedChemicalId: 12,
      chemicalName: 'Ammonia (anhydrous)',
    })).toBe(false);
  });

  it('keeps planning plumes out of active-incident command summaries', () => {
    const model = script.slice(script.indexOf('function buildIncidentCommandViewModel'), script.indexOf('function incidentCommandStatusClass'));
    expect(model).toContain('const incidentPlumeCandidate = incident.plumeModelResults || null;');
    expect(model).toContain('isIncidentPlumeCurrent(incidentPlumeCandidate, incident)');
    expect(model).not.toContain('planning.plumeModelResults || readIncidentCommandStorage');
  });

  it('validates workflow ownership before saving to an active incident', () => {
    const save = script.slice(script.indexOf('function savePlumeResult'), script.indexOf('function saveLatestPlumeOverlay'));
    expect(save).toContain('if (!isIncidentPlumeCurrent(workflowRecord, activeIncident))');
    expect(save).toContain('PLUME SAVE BLOCKED — ACTIVE INCIDENT / PLUME CHEMICAL MISMATCH');
  });

  it('restores only the current incident snapshot and protects async switching', () => {
    expect(command).toContain('readIncidentMapSnapshot');
    expect(command).toContain('current?.incidentId !== state?.incidentId');
    expect(command).toContain("state?.plume?.status === 'PLOTTED'");
    expect(command).toContain('PLUME REQUIRES RECALCULATION');
    expect(script).toContain('paintedFrames >= 2 && cameraSettled');
    expect(script).not.toContain('incident.plumeModelResults || planning.plumeModelResults ||');
  });
});
