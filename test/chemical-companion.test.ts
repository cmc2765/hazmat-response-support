import { describe, expect, it } from 'vitest';
import { normalizeChemicalProfile, queryChemicalProfile, searchCompanionChemicals } from '../server/src/chemical-companion.js';

describe('normalizeChemicalProfile', () => {
  it('loads a companion profile only from the selected ChemicalID', () => {
    const profile = queryChemicalProfile(54);

    expect(profile?.header.name).toBe('Hydrazine');
    expect(profile?.header.ergGuide).toBe('132');
    expect(profile?.properties.molecularWeight).toBe('32.05');
    expect(queryChemicalProfile('Hydrazine')).toBeNull();
  });

  it.each([
    ['hydrazine', 54, 'Hydrazine', '302-01-2', '2029'],
    ['anhydrous ammonia', 10, 'Ammonia (anhydrous)', '7664-41-7', '1005'],
  ])('ranks the canonical record first for %s', (query, ChemicalID, ChemicalName, CasNumber, UnnaNumber) => {
    const [result] = searchCompanionChemicals(query);
    expect(result).toMatchObject({ ChemicalID, ChemicalName, CasNumber, UnnaNumber });
    expect(result).toHaveProperty('ErgNumber');
    expect(result).toHaveProperty('matchReason');
  });

  it('keeps ammonia records distinct and does not promote Acetaldehyde ammonia', () => {
    const results = searchCompanionChemicals('ammonia');
    expect(results[0]).toMatchObject({ ChemicalID: 10, ChemicalName: 'Ammonia (anhydrous)' });
    expect(results.map((row) => row.ChemicalName)).toEqual(expect.arrayContaining([
      'Ammonia (anhydrous)',
      'Ammonia solution, with more than 10% but not more than 35% ammonia',
      'Acetaldehyde ammonia',
    ]));
  });

  it('normalizes the main sections and keeps missing fields readable', () => {
    const profile = normalizeChemicalProfile({
      ChemicalID: 54,
      ChemicalName: 'Hydrazine',
      CasNumber: '302-01-2',
      UnnaNumber: '2029',
      ErgNumber: '132',
      ChemicalFormula: 'N2H4',
      MolecularWeight: '32.05',
      OdorThreshold: 'Not available',
      VaporDensity: '1.1',
      FlashPoint: '99 °F',
      SpecificGravity: '1.0',
      IonizationPoint: '8.5 eV',
      BoilingPoint: '236 °F',
      MeltingPoint: '34 °F',
      DecompositionPoint: 'Not available',
      HeatOfVaporization: 'Not available',
      VaporPressure: '10 mmHg',
      ChemicalEnvironmentalPersistence: 'Moderate persistence in water and soil',
      ChemicalSynonyms: 'Hydrazine, diamine',
      ChemicalMixtureReactivity: 'Reacts with oxidizers and metals',
      ChemicalClass: 'Toxic',
      ChemicalStability: 'Stable if isolated',
      ChemicalClassIncompatibilities: 'Oxidizers',
      ErgWarning: 'Poison, Corrosive',
      WaterSolubility: 'Miscible',
      LowerExplosiveLimit: '4.0',
      UpperExplosiveLimit: '100',
    }, {
      synonyms: [{ ChemicalSynonym: 'Diamine' }],
      exposureLimits: [{ IDLHPpm: '50', RELTWAPpm: '0.03', TLVTWAPpm: '0.01' }],
      isolationDistances: [{ IsolationDistanceSmallSpillDayNightMeters: 30, IsolationDistanceLargeSpillDayNightMeters: 100, ProtectiveActionZoneSmallSpillDayKilometers: 0.2 }],
      symptoms: [{ ChemicalSignsSymptom: 'Eye irritation' }],
      compatibility: ['Oxidizers'],
      respirators: [{ PpeManufacturerID: 1, Degradation: 'Good' }],
      suits: [{ Thickness: '0.5 mm' }],
      gloves: [{ Thickness: 'Nitrile' }],
      boots: [{ Thickness: 'Rubber' }],
      detectors: [{ detector_name: 'PID', type: 'PID' }],
      decon: [{ notes: 'Soap and water' }],
      protocols: [{ DecontaminationProtocol: 'Technical decon' }],
    });

    expect(profile.header.name).toBe('Hydrazine');
    expect(profile.header.cas).toBe('302-01-2');
    expect(profile.header.ergGuide).toBe('132');
    expect(profile.properties.molecularWeight).toBe('32.05');
    expect(profile.exposures.idlh).toBe('50');
    expect(profile.ppeRespiratory.recommendedPpe).toContain('Respiratory protection');
    expect(profile.detectors.items[0]).toContain('PID');
    expect(profile.reactivity.incompatibilities[0]).toBe('Oxidizers');
    expect(profile.isolationErg.ergGuide).toBe('132');
    expect(profile.sources).toEqual(expect.arrayContaining(['Chemical Companion']));
  });
});
