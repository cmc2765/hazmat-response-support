import { describe, expect, it } from 'vitest';
import { getCompanionDiagnostics, groupChemicalSearchResults, normalizeChemicalProfile, normalizeTransportationIdentifier, queryChemicalProfile, searchCompanionChemicals } from '../server/src/chemical-companion.js';

describe('normalizeChemicalProfile', () => {
  it.each(['2312', 'UN2312', 'UN 2312', 'UN-2312', 'NA2312', 'NA 2312'])(
    'keeps unresolved transportation identifier %s separate from master identity', (query) => {
      expect(normalizeTransportationIdentifier(query)).toBe('2312');
      expect(searchCompanionChemicals(query)[0]).toMatchObject({
        ChemicalID: null, ChemicalName: 'Phenol, molten', UnnaNumber: '2312', ErgNumber: '153',
        recordType: 'transportation-identifier', reviewStatus: 'requires_review', guidanceEligible: false,
        sourceBadges: ['Transportation Identifier', 'Linked ERG', 'Requires Review'],
      });
    },
  );

  it.each([
    ['Phenol', 479], ['108-95-2', 479], ['chlorine', 22], ['1017', 22],
    ['ammonia', 10], ['1005', 10],
  ])('resolves required regression query %s', (query, id) => {
    expect(searchCompanionChemicals(query)[0]?.ChemicalID).toBe(id);
  });

  it.each([
    ['57-14-7', 1], ['74-93-1', 70], ['124-40-3', 140], ['100-63-0', 280],
    ['75-20-7', 350], ['1333-74-0', 420], ['7722-64-7', 490], ['13746-89-9', 560],
    ['110-65-6', 700], ['3054-95-3', 770], ['110-66-7', 840], ['75-61-6', 910],
    ['144-62-7', 980], ['526-73-8', 1050], ['283-66-9', 1120], ['137-32-6', 1190],
    ['129-66-8', 1260], ['64057-70-1', 1330], ['13147-09-6', 1400], ['16774-21-3', 1582],
  ])('searches distributed source chemical CAS %s', (cas, id) => {
    expect(searchCompanionChemicals(cas).some((row) => row.ChemicalID === id)).toBe(true);
  });

  it('keeps the complete source and derived index above coverage floors', () => {
    const coverage = getCompanionDiagnostics();
    expect(coverage.sourceChemicalTotal).toBe(1459);
    expect(coverage.importedCanonicalTotal).toBe(coverage.sourceChemicalTotal);
    expect(Number(coverage.sourceUnNaIdentifierTotal)).toBeGreaterThan(3000);
    expect(coverage.importedUnNaIdentifierTotal).toBe(0);
    expect(coverage.reviewedTransportationLinkTotal).toBe(0);
    expect(coverage.transportationIdentifierTotal).toBe(1980);
    expect(coverage.unlinkedTransportationIdentifiers).toBe(1980);
    expect(Number(coverage.sourceCasIdentifierTotal)).toBeGreaterThan(1300);
    expect(coverage.importedCasIdentifierTotal).toBe(coverage.sourceCasIdentifierTotal);
    expect(Number(coverage.sourceAliasTotal)).toBeGreaterThan(13000);
    expect(coverage.importedAliasTotal).toBe(coverage.sourceAliasTotal);
    expect(Number(coverage.searchIndexTotal)).toBeGreaterThanOrEqual(Number(coverage.sourceChemicalTotal));
  });

  it('ranks a Chemical Companion master above the separate transport record for a shared UN', () => {
    const results = searchCompanionChemicals('1017');
    expect(results[0]).toMatchObject({
      ChemicalID: 22,
      ChemicalName: 'Chlorine',
      recordType: 'master-chemical',
      guidanceEligible: true,
      sourceBadges: ['Chemical Companion Master'],
    });
    expect(results).toContainEqual(expect.objectContaining({
      ChemicalID: null,
      recordType: 'transportation-identifier',
      reviewStatus: 'requires_review',
      resultType: 'Transportation Identifier — Requires Review',
      guidanceEligible: false,
    }));
  });

  it('groups repeated Chemical Companion master names only when verified CAS identity also matches', () => {
    const results = searchCompanionChemicals('Trimethoxysilane');
    const exactMasters = results.filter((row) => row.ChemicalName === 'Trimethoxysilane' && row.recordType === 'master-chemical');
    expect(exactMasters).toHaveLength(1);
    expect(exactMasters[0]).toMatchObject({
      resultType: 'Chemical Companion Master',
      sourceStatus: 'Verified',
      groupedRecordCount: 2,
      groupedMasterChemicalIds: [1060, 1062],
    });
    expect(exactMasters[0].linkedIdentifiers).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'UN/NA', value: '9269' }),
      expect.objectContaining({ type: 'UN/NA', value: '3286' }),
    ]));
  });

  it('groups an approved attributable transport link under its master result', () => {
    const base = {
      CasNumber: '7782-50-5', IdentifierType: 'UN' as const, ErgNumber: '124', HazardClass: '',
      matchTerms: ['Chlorine'], synonyms: [], sourceBadges: [], rank: 0, matchReason: 'Exact match',
    };
    const grouped = groupChemicalSearchResults([
      {
        ...base, ChemicalID: 22, ChemicalName: 'Chlorine', PrimaryChemicalName: 'Chlorine', UnnaNumber: '1017',
        recordType: 'master-chemical', reviewStatus: 'master-record', guidanceEligible: true,
      },
      {
        ...base, ChemicalID: null, ChemicalName: 'Chlorine', PrimaryChemicalName: 'Chlorine', ProperShippingName: 'Chlorine',
        CasNumber: 'Not available', UnnaNumber: '1017', sourceIdentifierId: 1, recordType: 'transportation-identifier',
        reviewStatus: 'requires_review', guidanceEligible: false, masterChemicalId: 22,
        linkType: 'exact_chemical_match', linkReviewStatus: 'approved', reviewedBy: 'reviewer:1', reviewedAt: '2026-08-17T00:00:00.000Z',
      },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ ChemicalID: 22, masterChemicalId: 22, guidanceEligible: true });
    expect(grouped[0].linkedIdentifiers).toContainEqual(expect.objectContaining({
      type: 'Transport', value: '1017', reviewStatus: 'verified',
    }));
  });
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

  it('fails closed when Kappler has no chemical-specific suit record', () => {
    const profile = queryChemicalProfile(54);

    expect(profile?.ppeRespiratory.bestMatch).toBe('No Current Data Exists');
  });

  it('displays only direct Chemical Companion decon records for hydrofluoric acid', () => {
    const profile = queryChemicalProfile(58);

    expect(profile?.decon.preferredMethod).toBe('Air');
    expect(profile?.decon.hazmatPersonnelProcedure).not.toContain(expect.stringContaining('controlled assisted doffing'));
    expect(profile?.decon.patientVictimDecon).not.toContain(expect.stringContaining('water flush ≥30 min'));
    expect(profile?.decon.sourceBasis).toEqual([
      'Chemical Companion decontamination method matrix',
      'Chemical Companion decontamination notes',
    ]);
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
    expect(profile.exposures.routes).toEqual(['No Current Data Exists']);
    expect(profile.ppeRespiratory.recommendedPpe).not.toContain('Respiratory protection');
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

  it('preserves standalone medical source text without expanding it', () => {
    const profile = normalizeChemicalProfile({ ChemicalName: 'Hydrofluoric acid' }, {
      emsParadigms: [{ EmsParadigm: 'Calcium' }, { EmsParadigm: 'NA' }],
    });

    expect(profile.exposures.acuteNotes).toEqual(['Calcium']);
    expect(profile.medical.emsConsiderations).toEqual(profile.exposures.acuteNotes);
    expect(profile.medical.emsConsiderations).not.toContain('NA');
  });
});
