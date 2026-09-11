import { describe, expect, it } from 'vitest';
import app from '../server/src/app.js';
import { getCompanionDiagnostics, groupChemicalSearchResults, NIOSH_IDENTITY_STATUS, normalizeChemicalProfile, normalizeTransportationIdentifier, queryChemicalProfile, searchCompanionChemicals } from '../server/src/chemical-companion.js';

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
    expect(coverage.reviewedTransportationLinkTotal).toBe(1);
    expect(coverage.transportationIdentifierTotal).toBe(1980);
    expect(coverage.unlinkedTransportationIdentifiers).toBe(1979);
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

  it('shows one verified anhydrous hydrogen chloride master with reviewed AEGL, CAMEO, and ERG links', () => {
    const results = searchCompanionChemicals('Hydrogen Chloride, anhydrous');
    const hcl = results.filter((row) => row.ChemicalID === 56);
    expect(hcl).toHaveLength(1);
    expect(hcl[0]).toMatchObject({
      CasNumber: '7647-01-0',
      UnnaNumber: '1050',
      ErgNumber: '125',
      groupedRecordCount: 2,
      guidanceEligible: true,
    });
    expect(hcl[0].sourceBadges).toEqual(expect.arrayContaining([
      'Chemical Companion Master', 'Linked EPA AEGL', 'Linked CAMEO', 'Linked ERG',
    ]));
    expect(hcl[0].ChemicalName.trim()).toBe('Hydrogen chloride, anhydrous');
    expect(hcl[0].linkedIdentifiers).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'CAS', value: '7647-01-0' }),
      expect.objectContaining({ type: 'UN/NA', value: '1050' }),
      expect.objectContaining({ type: 'ERG', value: '125' }),
      expect.objectContaining({ type: 'Transport', value: '1050', reviewStatus: 'verified' }),
    ]));
  });

  it.each(['Hydrogen chloride', 'HCl', 'Hydrochloric acid gas', 'Anhydrous hydrogen chloride'])(
    'resolves reviewed anhydrous hydrogen chloride alias %s to master 56', (alias) => {
      expect(searchCompanionChemicals(alias)[0]).toMatchObject({ ChemicalID: 56, CasNumber: '7647-01-0' });
    },
  );

  it('keeps the same-CAS hydrochloric acid solution as a distinct master record', () => {
    const anhydrous = queryChemicalProfile(56)?.header;
    expect(anhydrous).toMatchObject({ cas: '7647-01-0', un: '1050' });
    expect(anhydrous?.name.trim()).toBe('Hydrogen chloride, anhydrous');
    expect(queryChemicalProfile(965)?.header).toMatchObject({ name: 'Hydrochloric acid', cas: '7647-01-0', un: '1789' });
  });

  it('resolves sulfur dioxide NIOSH identity and IDLH through the Chemical Companion profile', () => {
    const profile = queryChemicalProfile(102);

    expect(profile?.header).toMatchObject({ name: 'Sulfur dioxide', cas: '7446-09-5', un: '1079', idlh: '100 ppm' });
    expect(profile?.exposures.idlh).toBe('100 ppm');
    expect(profile?.niosh).toEqual({
      status: NIOSH_IDENTITY_STATUS.VERIFIED_NIOSH,
      sourceRecordId: 'sulfur-dioxide',
      masterCas: '7446-09-5',
      sourceCas: '7446-09-5',
      matchBasis: 'CAS',
    });
    expect(profile?.sources).toContain('NIOSH Pocket Guide');
  });

  it('returns the NIOSH-linked sulfur dioxide profile from the API', async () => {
    const response = await app.request('/api/chemicals/102/profile');
    expect(response.status).toBe(200);
    const profile = await response.json();

    expect(profile).toMatchObject({
      selectedChemicalId: 102,
      header: { name: 'Sulfur dioxide', cas: '7446-09-5', un: '1079', ergGuide: '125', idlh: '100 ppm' },
      niosh: {
        status: NIOSH_IDENTITY_STATUS.VERIFIED_NIOSH,
        sourceRecordId: 'sulfur-dioxide',
        matchBasis: 'CAS',
      },
    });
    expect(profile.sourceLinks).toContainEqual(expect.objectContaining({
      sourceName: 'NIOSH', sourceRecordId: 'sulfur-dioxide', sourceIdentifierType: 'CAS',
    }));
  });

  it.each([
    ['sulfur dioxide', 'Exact Chemical Companion master name'],
    ['7446-09-5', 'Exact CAS number'],
    ['1079', 'Exact Chemical Companion master UN number'],
  ])('resolves sulfur dioxide by %s through the public search route', async (query, matchReason) => {
    const response = await app.request(`/api/chemicals/search?q=${encodeURIComponent(query)}`);
    expect(response.status).toBe(200);
    const results = (await response.json()).chemicals;
    expect(results[0]).toMatchObject({
      ChemicalID: 102,
      ChemicalName: 'Sulfur dioxide',
      CasNumber: '7446-09-5',
      UnnaNumber: '1079',
      ErgNumber: '125',
      matchReason,
      guidanceEligible: true,
    });
  });

  it('keeps Chemical Companion IDs out of the NPG identifier namespace', async () => {
    const response = await app.request('/api/npg/102');
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('separate') });
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
    expect(profile?.exposures.monitoringConcerns).toEqual(expect.arrayContaining([
      expect.stringContaining('AEGL1_10min'),
      expect.stringContaining('AEGL3_8hr'),
    ]));
    expect(profile?.ppeRecommendation.displayLabel).toBe('Level B w/ SCBA');
    expect(profile?.medical.emsConsiderations.length).toBeGreaterThan(0);
    expect(profile?.decon.preferredMethod.length).toBeGreaterThan(0);
    expect(profile?.decon.technicalDecon.length).toBeGreaterThan(0);
    expect(queryChemicalProfile('Hydrazine')).toBeNull();
  });

  it.each([1, 70, 140, 280, 350, 420, 490, 560, 700, 770, 840, 910, 980, 1050, 1120, 1190, 1260, 1330, 1400, 1582])(
    'returns every display section for distributed master chemical %s', (id) => {
      const profile = queryChemicalProfile(id);
      expect(profile).not.toBeNull();
      expect(profile).toEqual(expect.objectContaining({
        properties: expect.any(Object),
        exposures: expect.any(Object),
        ppeRecommendation: expect.any(Object),
        medical: expect.any(Object),
        decon: expect.any(Object),
      }));
    },
  );

  it('hydrates sparse Chemical Companion sections from linked NIOSH and ERG sources', () => {
    const profile = queryChemicalProfile(374);
    const sparseDeconProfile = queryChemicalProfile(813);

    expect(profile?.header.name).toBe('Cyanamide');
    expect(profile?.sources).toEqual(expect.arrayContaining(['NIOSH Pocket Guide', 'ERG 2024']));
    expect(profile?.medical.firstAid).toContain('Call 911 or emergency medical service.');
    expect(sparseDeconProfile?.decon.sourceBasis).toContain('ERG 2024 first-aid contamination-control guidance');
  });

  it.each([
    [56, 'Hydrogen chloride, anhydrous', 'HCl', '50 ppm', 'Vapor Protective Level A w/ SCBA'],
    [22, 'Chlorine', 'Cl2', '10 ppm', 'Vapor Protective Level A w/ SCBA'],
    [10, 'Ammonia (anhydrous)', 'H3N', '300 ppm', 'Vapor Protective Level A w/ SCBA'],
    [515, 'Sodium Hydroxide', 'NaOH', '10 mg/m^3', 'Level B w/ SCBA'],
  ])('hydrates all operational profile sections for master chemical %s', (id, name, formula, idlh, ppe) => {
    const profile = queryChemicalProfile(id);

    expect(profile?.header.name).toBe(name);
    expect(profile?.header.nfpa704).toEqual(expect.objectContaining({
      health: expect.stringMatching(/^[0-4]$/),
      flammability: expect.stringMatching(/^[0-4]$/),
      instability: expect.stringMatching(/^[0-4]$/),
    }));
    expect(profile?.properties.formula).toBe(formula);
    expect(profile?.properties.physicalState).not.toMatch(/No Current Data|Not available/i);
    expect(profile?.exposures.idlh).toBe(idlh);
    expect(profile?.exposures.oshaPel).not.toMatch(/No Current Data|Not listed|Not available/i);
    expect(profile?.ppeRecommendation.displayLabel).toBe(ppe);
    expect(profile?.response.publicSafety).not.toEqual(['No Current Data Exists']);
    expect(profile?.response.spillOrLeak).not.toEqual(['No Current Data Exists']);
    expect(profile?.medical.firstAid).not.toEqual(['No Current Data Exists']);
    expect(profile?.decon.preferredMethod).not.toEqual(['No Current Data Exists']);
    expect(profile?.sources).toEqual(expect.arrayContaining(['Chemical Companion', 'ERG 2024']));
  });

  it('preserves HCl AEGL durations and maps ceiling limits instead of discarding them', () => {
    const profile = queryChemicalProfile(56);

    expect(profile?.exposures.oshaPel).toBe('Ceiling: 5 ppm');
    expect(profile?.exposures.nioshRel).toBe('Ceiling: 5 ppm');
    expect(profile?.exposures.acgihTlv).toBe('Ceiling: 2 ppm');
    expect(profile?.exposures.monitoringConcerns).toEqual(expect.arrayContaining([
      'AEGL1_10min: 1.8',
      'AEGL2_60min: 22',
      'AEGL3_8hr: 26',
    ]));
  });

  it('loads the selected chemical NFPA 704 ratings from the companion NFPA tables', () => {
    const profile = queryChemicalProfile(22);

    expect(profile?.header.name).toBe('Chlorine');
    expect(profile?.header.nfpa704).toMatchObject({
      health: '4',
      flammability: '0',
      instability: '0',
      special: 'OX',
      source: 'Chemical Companion NFPA hazard record',
    });
  });

  it('populates the PPE Best Match from a known Kappler HazMatch suit record', () => {
    const profile = queryChemicalProfile(10);

    expect(profile?.header.name).toBe('Ammonia (anhydrous)');
    expect(profile?.ppeRespiratory.bestMatch).toMatch(/^Kappler USA, Inc\. — /);
    expect(profile?.ppeRespiratory.bestMatch).toContain('Frontline® 300');
  });

  it('attaches one export-ready source-backed PPE recommendation without deleting raw options', () => {
    const profile = queryChemicalProfile(10);

    expect(profile?.ppeRecommendation).toMatchObject({
      chemicalId: 10,
      chemicalName: 'Ammonia (anhydrous)',
      selectedLevel: 'LEVEL_A_VAPOR_PROTECTIVE_SCBA',
      displayLabel: 'Vapor Protective Level A w/ SCBA',
      recommendationStatus: 'SOURCE_BACKED_RECOMMENDATION',
      scbaRequired: true,
      aprAllowed: false,
      levelCAllowed: false,
    });
    expect(profile?.ppeRecommendation.sourcesReviewed).toEqual(expect.arrayContaining(['Chemical Companion', 'NIOSH', 'CAMEO', 'ERG']));
    expect(profile?.ppeRecommendation.hiddenRawOptions.manufacturerMatches.length).toBeGreaterThan(0);
    expect(profile?.ppeRespiratory.respiratorRecommendations.length).toBeGreaterThan(0);
  });

  it('fails closed when Kappler has no chemical-specific suit record', () => {
    const profile = queryChemicalProfile(54);

    expect(profile?.ppeRespiratory.bestMatch).toBe('No Current Data Exists');
  });

  it('displays only direct Chemical Companion decon records for hydrofluoric acid', () => {
    const profile = queryChemicalProfile(58);

    expect(profile?.properties.physicalState).toContain('Liquid');
    expect(profile?.decon.preferredMethod).toEqual(['Liquid — People: Water / Dry / Air']);
    expect(profile?.decon.technicalDecon).toEqual(expect.arrayContaining([
      'Liquid — Objects: Water / Dry / Base / Air',
      expect.stringContaining('Liquid — Dry: HEPA Vacuum/Cloth'),
      expect.stringContaining('Liquid — Water: Process detail unavailable from current source'),
    ]));
    expect(profile?.decon.technicalDecon).not.toEqual(expect.arrayContaining([expect.stringContaining('Gas (')]));
    expect(profile?.decon.technicalDecon).not.toEqual(expect.arrayContaining([expect.stringContaining('Solid —')]));
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
      nfpaHazards: [{ health: 3, flammability: 3, instability: 2, special: 'W' }],
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
    expect(profile.header.nfpa704).toMatchObject({ health: '3', flammability: '3', instability: '2', special: 'W' });
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

  it('uses an exact-CAS linked NIOSH IDLH when the master says it is not established', () => {
    const profile = normalizeChemicalProfile({ ChemicalID: 414, CasNumber: '76-44-8' }, {
      exposureLimits: [{ IDLHPpm: 'Not established' }],
      npg: { id: 'heptachlor', cas: '76-44-8', exposureLimits: { idlh: '35 mg-m3 (Ca)' } },
    });

    expect(profile.header.idlh).toBe('35 mg/m³ (Ca)');
    expect(profile.exposures.idlh).toBe('35 mg/m³ (Ca)');
    expect(profile.exposures.idlhValues[0]).toMatchObject({
      value: '35 mg/m³ (Ca)',
      source: 'NIOSH',
      sourceRecordId: 'heptachlor',
    });
  });

  it('does not treat an NIOSH em dash as an IDLH measurement', () => {
    const profile = normalizeChemicalProfile({ ChemicalID: 1, CasNumber: '12-34-5' }, {
      exposureLimits: [{ IDLHPpm: 'Not established' }],
      npg: { id: 'no-idlh', cas: '12-34-5', exposureLimits: { idlh: '—' } },
    });

    expect(profile.header.idlh).toBe('Not listed by current source');
    expect(profile.exposures.idlhValues.every(({ value }) => !value.includes('—'))).toBe(true);
  });

  it('rejects a NIOSH IDLH when the CAS link does not match the master record', () => {
    const profile = normalizeChemicalProfile({ ChemicalID: 1, CasNumber: '12-34-5' }, {
      exposureLimits: [{ IDLHPpm: null }],
      npg: { id: 'wrong-record', cas: '98-76-5', exposureLimits: { idlh: '10 ppm' } },
    });

    expect(profile.header.idlh).toBe('No Current Data Exists');
    expect(profile.exposures.idlhValues).toHaveLength(1);
    expect(profile.niosh).toMatchObject({ status: NIOSH_IDENTITY_STATUS.IDENTITY_MATCH_FAILED, sourceRecordId: 'wrong-record' });
  });

  it('uses canonical CAS identity for a verified NIOSH link', () => {
    const profile = normalizeChemicalProfile({ ChemicalID: 102, CasNumber: 'CAS 7446 09 5' }, {
      npg: { id: 'sulfur-dioxide', cas: '7446-09-5', exposureLimits: { idlh: '100 ppm' } },
    });

    expect(profile.niosh).toMatchObject({
      status: NIOSH_IDENTITY_STATUS.VERIFIED_NIOSH,
      sourceRecordId: 'sulfur-dioxide',
      matchBasis: 'CAS',
    });
    expect(profile.exposures.idlh).toBe('100 ppm');
  });

  it('does not select the first NIOSH constituent for a multi-CAS mixture', () => {
    const profile = normalizeChemicalProfile({ ChemicalID: 248, CasNumber: '67-66-3; 8013-54-5' }, {
      npg: { id: 'chloroform', cas: '67-66-3', exposureLimits: { idlh: '500 ppm' } },
    });

    expect(profile.niosh).toMatchObject({
      status: NIOSH_IDENTITY_STATUS.SOURCE_DATA_INCOMPLETE,
      sourceRecordId: null,
      matchBasis: null,
    });
    expect(profile.exposures.idlh).toBe('No Current Data Exists');
  });

  it('distinguishes a valid CAS with no local NIOSH record from incomplete identity data', () => {
    const unavailable = normalizeChemicalProfile({ ChemicalID: 999, CasNumber: '99999-99-9' });
    const incomplete = normalizeChemicalProfile({ ChemicalID: 1000, CasNumber: 'Mixture: component identities pending' });

    expect(unavailable.niosh).toMatchObject({ status: NIOSH_IDENTITY_STATUS.NIOSH_NOT_AVAILABLE });
    expect(incomplete.niosh).toMatchObject({ status: NIOSH_IDENTITY_STATUS.SOURCE_DATA_INCOMPLETE });
  });

  it.each([
    [414, '35 mg/m³ (Ca)'],
    [453, '4 ppm'],
    [482, '5 mg/m³'],
    [648, '2000 ppm'],
    [1207, '1100 ppm ([10%LEL])'],
    [1208, '1100 ppm ([10%LEL])'],
    [1497, '30 ppm'],
    [1580, '100 mg/m³ (as Sn)'],
  ])('hydrates missing master IDLH from the exact-CAS NIOSH record for chemical %s', (chemicalId, expectedIdlh) => {
    const profile = queryChemicalProfile(chemicalId);
    expect(profile?.header.idlh).toBe(expectedIdlh);
    expect(profile?.exposures.idlhValues[0]?.source).toBe('NIOSH');
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
