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

  it('populates the PPE Best Match from a known Kappler HazMatch suit record', () => {
    const profile = queryChemicalProfile(10);

    expect(profile?.header.name).toBe('Ammonia (anhydrous)');
    expect(profile?.ppeRespiratory.bestMatch).toMatch(/^Kappler USA, Inc\. — /);
    expect(profile?.ppeRespiratory.bestMatch).toContain('Frontline® 300');
  });

  it('keeps the Best Match status visible when Kappler has no chemical-specific suit record', () => {
    const profile = queryChemicalProfile(54);

    expect(profile?.ppeRespiratory.bestMatch).toBe('Kappler HazMatch — no chemical-specific suit record');
  });

  it('combines Chemical Companion, NIOSH, and ERG decon guidance for hydrofluoric acid', () => {
    const profile = queryChemicalProfile(58);

    expect(profile?.decon.preferredMethod).toContain('Designated HazMat personnel method: Water');
    expect(profile?.decon.hazmatPersonnelProcedure).toEqual(expect.arrayContaining([
      expect.stringContaining('low-pressure water'),
      expect.stringContaining('controlled assisted doffing'),
    ]));
    expect(profile?.decon.technicalDecon).toEqual(expect.arrayContaining([
      expect.stringContaining('Technical people decon'),
      expect.stringContaining('Technical equipment decon'),
    ]));
    expect(profile?.decon.patientVictimDecon).toEqual(expect.arrayContaining([
      expect.stringContaining('calcium gluconate gel'),
      expect.stringContaining('water flush ≥30 min'),
    ]));
    expect(profile?.decon.sourceBasis).toEqual(expect.arrayContaining([
      'Chemical Companion decontamination method matrix',
      'NIOSH Pocket Guide first-aid data',
      'PHMSA ERG 2024 Guide 157',
    ]));
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
      exposureLimits: [{ IDLHPpm: '50', PELTWAPpm: '0.5', RELTWAPpm: '0.03', TLVTWAPpm: '0.01' }],
      isolationDistances: [{ IsolationDistanceSmallSpillDayNightMeters: 30, IsolationDistanceLargeSpillDayNightMeters: 100, ProtectiveActionZoneSmallSpillDayKilometers: 0.2 }],
      symptoms: [{ ChemicalSignsSymptom: 'Eye irritation' }],
      physicalStates: [{ ChemicalPhysicalState: 'Vapor' }],
      emsParadigms: [{ EmsParadigm: 'Avoid inhalation and skin contact' }],
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
    expect(profile.header.idlh).toBe('50 ppm');
    expect(profile.exposures.idlh).toBe('50 ppm');
    expect(profile.exposures.oshaPel).toBe('0.5 ppm');
    expect(profile.exposures.nioshRel).toBe('0.03 ppm');
    expect(profile.exposures.acgihTlv).toBe('0.01 ppm');
    expect(profile.exposures.routes[0]).toMatch(/^Most likely: Inhalation/);
    expect(profile.exposures.routes).toEqual(expect.arrayContaining([
      expect.stringMatching(/^Also possible: Skin contact/),
    ]));
    expect(profile.ppeRespiratory.recommendedPpe).toContain('Respiratory protection');
    expect(profile.detectors.items[0]).toContain('PID');
    expect(profile.reactivity.incompatibilities[0]).toBe('Oxidizers');
    expect(profile.isolationErg.ergGuide).toBe('132');
    expect(profile.sources).toEqual(expect.arrayContaining(['Chemical Companion']));
  });

  it('preserves an IDLH measurement that already includes its unit', () => {
    const profile = normalizeChemicalProfile({}, {
      exposureLimits: [{
        IDLHPpm: '25 mg/m³ (as CN)',
        PELTWAPpm: '5 mg/m^3',
        RELTWAPpm: '2 ppb',
        TLVTWAPpm: '0.5 ppm',
      }],
    });

    expect(profile.header.idlh).toBe('25 mg/m³ (as CN)');
    expect(profile.exposures.idlh).toBe('25 mg/m³ (as CN)');
    expect(profile.exposures.oshaPel).toBe('5 mg/m^3');
    expect(profile.exposures.nioshRel).toBe('2 ppb');
    expect(profile.exposures.acgihTlv).toBe('0.5 ppm');
  });

  it('explains the standalone calcium note for hydrofluoric acid', () => {
    const profile = normalizeChemicalProfile({ ChemicalName: 'Hydrofluoric acid' }, {
      emsParadigms: [{ EmsParadigm: 'Calcium' }, { EmsParadigm: 'NA' }],
    });

    expect(profile.exposures.acuteNotes).toEqual([
      expect.stringContaining('Calcium gluconate — indicated for hydrofluoric acid skin exposure'),
    ]);
    expect(profile.medical.emsConsiderations).toEqual(profile.exposures.acuteNotes);
    expect(profile.medical.emsConsiderations).not.toContain('NA');
  });
});
