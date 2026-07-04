import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../data/ChemicalCompanionDB.db');
console.info(`[chemical-companion] database path: ${dbPath}`);

function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function sortedSearchWords(value: unknown): string {
  return normalizeSearchText(value).split(' ').filter(Boolean).sort().join(' ');
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return [];
    return text.split(/\s*[,;]\s*|\s*\n\s*/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return 'Not available';
  const text = String(value).trim();
  return text || 'Not available';
}

function relatedStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return asList(item);
    if (!item || typeof item !== 'object') return [];
    return Object.entries(item as Record<string, unknown>)
      .filter(([key, field]) => !/^(chemical|revision|.*id$)/i.test(key) && field !== null && field !== '')
      .flatMap(([, field]) => asList(field));
  });
}

function available(values: string[]): string[] {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return unique.length ? unique : ['Not available'];
}

function formatPpeRow(kind: string, row: Record<string, unknown>): string {
  const identity = [row.PpeManufacturer, row.Product, row.PpeMaterial].map(normalizeValue).filter((value) => value !== 'Not available').join(' — ');
  const performance = [
    row.BreakthroughTime ? `breakthrough ${row.BreakthroughTime}` : '',
    row.BreakthroughTimeLow || row.BreakthroughTimeHigh ? `breakthrough ${row.BreakthroughTimeLow ?? '?'}–${row.BreakthroughTimeHigh ?? '?'} min` : '',
    row.Degradation ? `degradation ${row.Degradation}` : '',
    row.PermeationRate ? `permeation ${row.PermeationRate}` : '',
    row.Thickness ? `thickness ${row.Thickness}` : '',
  ].filter(Boolean).join(', ');
  return `${kind}: ${identity || 'listed material'}${performance ? ` (${performance})` : ''}`;
}

function formatMeters(value: unknown): string {
  const meters = Number(value);
  if (!Number.isFinite(meters)) return 'Not available';
  const feet = Math.round(meters * 3.28084);
  return `${feet.toLocaleString('en-US')} ft (${meters.toLocaleString('en-US')} meters)`;
}

function formatKilometers(value: unknown): string {
  const kilometers = Number(value);
  if (!Number.isFinite(kilometers)) return 'Not available';
  const meters = kilometers * 1000;
  const feet = Math.round(meters * 3.28084);
  return `${feet.toLocaleString('en-US')} ft (${meters.toLocaleString('en-US')} meters / ${kilometers.toLocaleString('en-US')} km)`;
}

function findCompanionChemicalRow(db: Database.Database, chemicalId: string | number) {
  const numericId = Number(chemicalId);
  if (!Number.isInteger(numericId) || numericId <= 0) return undefined;
  return db.prepare('SELECT * FROM chemicals WHERE ChemicalID = ?').get(numericId) as Record<string, unknown> | undefined;
}

export function normalizeChemicalProfile(chemical: Record<string, unknown>, related: Record<string, unknown> = {}) {
  const relatedData = related as Record<string, unknown>;
  const synonymRows = Array.isArray(relatedData.synonyms)
    ? relatedData.synonyms.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    : [];
  const synonyms = available([
    ...asList(chemical.ChemicalSynonyms ?? chemical.ChemicalSynonym ?? ''),
    ...synonymRows.flatMap((row) => asList(row.ChemicalSynonym)),
  ]);
  const exposureLimits = asObject(Array.isArray(relatedData.exposureLimits) ? relatedData.exposureLimits[0] : {});
  const isolationDistances = asObject(Array.isArray(relatedData.isolationDistances) ? relatedData.isolationDistances[0] : {});
  const symptomRows = Array.isArray(relatedData.symptoms)
    ? relatedData.symptoms.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    : [];
  const symptoms = asList(symptomRows.map((row) => row.ChemicalSignsSymptom).join(', '));
  const compatibility = available([...asList(chemical.ChemicalClassIncompatibilities), ...asList(relatedData.compatibility), ...relatedStrings(relatedData.incompatibilities), ...relatedStrings(relatedData.classIncompatibilities)]);
  const respirators = Array.isArray(relatedData.respirators) ? relatedData.respirators : [];
  const suits = Array.isArray(relatedData.suits) ? relatedData.suits : [];
  const gloves = Array.isArray(relatedData.gloves) ? relatedData.gloves : [];
  const boots = Array.isArray(relatedData.boots) ? relatedData.boots : [];
  const detectorRows = Array.isArray(relatedData.detectors) ? relatedData.detectors : [];
  const deconRows = Array.isArray(relatedData.decon) ? relatedData.decon : [];
  const protocols = Array.isArray(relatedData.protocols) ? relatedData.protocols : [];
  const physicalStates = relatedStrings(relatedData.physicalStates);
  const odors = relatedStrings(relatedData.odors);
  const characteristics = relatedStrings(relatedData.characteristics);
  const classes = relatedStrings(relatedData.classes);
  const reactiveGroups = relatedStrings(relatedData.reactiveGroups);
  const stabilities = relatedStrings(relatedData.stabilities);
  const persistence = relatedStrings(relatedData.persistence);
  const medicalProtocols = relatedStrings(relatedData.medicalProtocols);
  const emsParadigms = relatedStrings(relatedData.emsParadigms);
  const fireGuidance = relatedStrings(relatedData.fireGuidance);
  const combustion = asObject(relatedData.combustion);
  const deconNotes = relatedStrings(relatedData.deconNotes);
  const symptomCategories = relatedStrings(relatedData.symptomCategories);
  const cartridgeRows = Array.isArray(relatedData.cartridges) ? relatedData.cartridges as Record<string, unknown>[] : [];
  const kapplerMatches = suits
    .filter((row: Record<string, unknown>) => /kappler/i.test(String(row.PpeManufacturer ?? '')))
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const breakthrough = (row: Record<string, unknown>) => Number(String(row.BreakthroughTime ?? '').replace(/[^0-9.]/g, '')) || 0;
      return breakthrough(b) - breakthrough(a);
    });

  const sources = Array.isArray(relatedData.sources)
    ? relatedData.sources.filter((item): item is string => typeof item === 'string')
    : [];
  const header = {
    name: normalizeValue(chemical.ChemicalName || chemical.name),
    cas: normalizeValue(chemical.CasNumber || chemical.cas),
    un: normalizeValue(chemical.UnnaNumber || chemical.un),
    ergGuide: normalizeValue(chemical.ErgNumber || chemical.ergGuide),
    idlh: normalizeValue(exposureLimits.IDLHPpm || exposureLimits.idlh),
    hazard: normalizeValue(chemical.ErgWarning || chemical.ChemicalClass || chemical.hazardClass),
    sources: [...new Set(['Chemical Companion', ...sources])].filter(Boolean),
  };

  const properties = {
    physicalState: normalizeValue(physicalStates.join(', ')),
    molecularWeight: normalizeValue(chemical.MolecularWeight),
    boilingPoint: normalizeValue(chemical.BoilingPoint),
    meltingPoint: normalizeValue(chemical.MeltingPoint),
    vaporPressure: normalizeValue(chemical.VaporPressure),
    vaporDensity: normalizeValue(chemical.VaporDensity),
    specificGravity: normalizeValue(chemical.SpecificGravity),
    waterSolubility: normalizeValue(chemical.WaterSolubility),
    flashPoint: normalizeValue(chemical.FlashPoint),
    ignitionTemperature: normalizeValue(chemical.IgnitionTemp),
    lelUel: [normalizeValue(chemical.LowerExplosiveLimit), normalizeValue(chemical.UpperExplosiveLimit)].join(' / '),
    odorThreshold: normalizeValue([chemical.OdorThreshold, odors.join(', ')].filter(Boolean).join(' — ')),
    ionizationPotential: normalizeValue(chemical.IonizationPoint),
    decompositionPoint: normalizeValue(chemical.DecompositionPoint),
    heatOfVaporization: normalizeValue(chemical.HeatOfVaporization),
    synonyms,
    environmentalPersistence: normalizeValue([chemical.ChemicalEnvironmentalPersistence, ...persistence].filter(Boolean).join(', ')),
    mixtureReactivity: normalizeValue(chemical.ChemicalMixtureReactivity),
    formula: normalizeValue(chemical.ChemicalFormula),
    liquidDensity: normalizeValue(chemical.LiquidDensity),
    evaporationRate: normalizeValue(chemical.EvaporationRate),
    characteristics: available(characteristics),
    commercialUses: normalizeValue(chemical.CommercialUses),
    commercialSources: normalizeValue(chemical.CommercialSources),
  };

  const exposures = {
    idlh: normalizeValue(exposureLimits.IDLHPpm),
    oshaPel: normalizeValue(exposureLimits.PELTWAPpm || exposureLimits.PELCeiling),
    nioshRel: normalizeValue(exposureLimits.RELTWAPpm || exposureLimits.RELSTEL || exposureLimits.RELCeiling),
    acgihTlv: normalizeValue(exposureLimits.TLVTWAPpm || exposureLimits.TLVSTEL || exposureLimits.TLVCeiling),
    routes: available(emsParadigms.filter((value) => /inhal|skin|eye|ingest|exposure|route/i.test(value))),
    symptoms: symptoms.length ? symptoms : ['Not available'],
    targetOrgans: available(symptomCategories),
    acuteNotes: available(emsParadigms),
    monitoringConcerns: available(Object.entries(exposureLimits).filter(([key, value]) => !/^(ChemicalID|revision_id)$/.test(key) && value && normalizeValue(value) !== 'Not established').map(([key, value]) => `${key}: ${value}`)),
  };

  const ppeRespiratory = {
    bestMatch: kapplerMatches.length
      ? [
          kapplerMatches[0].PpeManufacturer,
          kapplerMatches[0].Product,
          kapplerMatches[0].PpeMaterial,
        ].map(normalizeValue).filter((value) => value !== 'Not available' && value !== 'NULL').join(' — ')
      : 'No chemical-specific Kappler HazMatch record available',
    recommendedPpe: available([
      ...(respirators.length ? ['Respiratory protection'] : []),
      ...[...suits, ...gloves, ...boots].map((row: Record<string, unknown>) => formatPpeRow('PPE', row)),
    ]),
    skinEyeProtection: available(deconNotes.filter((value) => /skin|eye|protect/i.test(value))),
    gloveSuitMaterial: available([
      ...suits.map((row: Record<string, unknown>) => formatPpeRow('Suit', row)),
      ...gloves.map((row: Record<string, unknown>) => formatPpeRow('Glove', row)),
      ...boots.map((row: Record<string, unknown>) => formatPpeRow('Boot', row)),
    ]),
    respiratorRecommendations: available(respirators.map((row: Record<string, unknown>) => formatPpeRow('Respirator', row))),
    aprPaprScba: available(emsParadigms.filter((value) => /respirat|scba|papr|apr/i.test(value))),
    escapeRespirator: ['Not available'],
    cartridgeLimitations: available(cartridgeRows.map((row) => `${normalizeValue(row.CartridgeColor)} cartridge — ${normalizeValue(row.ChemicalCategory)}`)),
  };

  const detectors = {
    items: available(detectorRows.map((row: Record<string, unknown>) => `${normalizeValue(row.detector_name || row.type)}${row.measurement_method ? ` (${normalizeValue(row.measurement_method)})` : ''}${row.channel ? ` — channel ${row.channel}` : ''}${row.correction_factor ? `, CF ${row.correction_factor}` : ''}`)),
    pidRelevance: available(detectorRows.filter((row: Record<string, unknown>) => /pid|photoion/i.test(`${row.detector_name} ${row.type} ${row.measurement_method}`)).map((row: Record<string, unknown>) => `${normalizeValue(row.detector_name)}${row.correction_factor ? ` — correction factor ${row.correction_factor}` : ''}`)),
    ionizationPotential: normalizeValue(chemical.IonizationPoint),
    lelMeterRelevance: available(detectorRows.filter((row: Record<string, unknown>) => /lel|combust|flamm/i.test(`${row.detector_name} ${row.type} ${row.measurement_method}`)).map((row: Record<string, unknown>) => normalizeValue(row.detector_name))),
    colorimetricTubes: available(detectorRows.filter((row: Record<string, unknown>) => /tube|color|draeger|dräger|gastec/i.test(`${row.detector_name} ${row.type} ${row.measurement_method}`)).map((row: Record<string, unknown>) => normalizeValue(row.detector_name))),
    electrochemicalSensors: available(detectorRows.filter((row: Record<string, unknown>) => /electro|sensor/i.test(`${row.detector_name} ${row.type} ${row.measurement_method}`)).map((row: Record<string, unknown>) => normalizeValue(row.detector_name))),
    limitations: available(detectorRows.filter((row: Record<string, unknown>) => row.cross_sensitive || row.lower_detection_limit || row.upper_detection_limit).map((row: Record<string, unknown>) => `${normalizeValue(row.detector_name)}: ${row.cross_sensitive ? 'cross-sensitive; ' : ''}${row.lower_detection_limit ?? '?'}–${row.upper_detection_limit ?? '?'} ${row.unit ?? ''}`)),
  };

  const reactivity = {
    incompatibilities: compatibility,
    polymerizationRisk: ['Not available'],
    waterReactivity: ['Not available'],
    oxidizerReducerConcerns: available(reactiveGroups),
    decompositionProducts: available([combustion.major_products, combustion.minor_products, combustion.likely_products].flatMap(asList)),
    chemicalMixtureReactivity: normalizeValue(chemical.ChemicalMixtureReactivity),
    stabilityNotes: normalizeValue([chemical.ChemicalStability, ...stabilities].filter(Boolean).join(', ')),
  };

  const isolationErg = {
    ergGuide: normalizeValue(chemical.ErgNumber),
    initialIsolationDistance: formatMeters(isolationDistances.IsolationDistanceSmallSpillDayNightMeters),
    protectiveActionDistance: available([
      `Small spill, day: ${formatKilometers(isolationDistances.ProtectiveActionZoneSmallSpillDayKilometers)}`,
      `Small spill, night: ${formatKilometers(isolationDistances.ProtectiveActionZoneSmallSpillNightKilometers)}`,
      `Large spill, day: ${formatKilometers(isolationDistances.ProtectiveActionZoneLargeSpillDayKilometers)}`,
      `Large spill, night: ${formatKilometers(isolationDistances.ProtectiveActionZoneLargeSpillNightKilometers)}`,
    ].filter((value) => !value.endsWith('Not available'))),
    smallSpill: formatMeters(isolationDistances.IsolationDistanceSmallSpillDayNightMeters),
    largeSpill: formatMeters(isolationDistances.IsolationDistanceLargeSpillDayNightMeters),
    dayNightValues: available([
      `Small initial isolation: ${formatMeters(isolationDistances.IsolationDistanceSmallSpillDayNightMeters)}`,
      `Large initial isolation: ${formatMeters(isolationDistances.IsolationDistanceLargeSpillDayNightMeters)}`,
    ].filter((value) => !value.endsWith('Not available'))),
    ergTable1: Object.keys(isolationDistances).length ? ['Chemical-specific isolation/protective-action values available above'] : ['Not available'],
    ergTable2: ['Not available'],
    ergTable3: ['Not available'],
    note: normalizeValue(chemical.ErgWarning),
  };

  const medical = {
    signsSymptoms: symptoms.length ? symptoms : ['Not available'],
    firstAid: available(medicalProtocols.filter((value) => /first|basic|wash|flush|remove|airway|oxygen/i.test(value))),
    emsConsiderations: available(emsParadigms),
    antidotes: available(medicalProtocols.filter((value) => /antidot|administer|dose|medication|drug/i.test(value))),
    treatmentNotes: available(medicalProtocols),
    responderHazards: available(characteristics),
    contaminatedPatientHandling: available(deconNotes),
  };

  const fire = {
    flammability: normalizeValue(classes.length ? classes.join(', ') : chemical.ChemicalClass),
    flashPoint: normalizeValue(chemical.FlashPoint),
    lelUel: [normalizeValue(chemical.LowerExplosiveLimit), normalizeValue(chemical.UpperExplosiveLimit)].join(' / '),
    extinguishingMedia: available(fireGuidance),
    firefightingPrecautions: available([normalizeValue(relatedData.extinction)].filter((value) => value !== 'Not available')),
    vaporBehavior: available([`Vapor density: ${normalizeValue(chemical.VaporDensity)}`, `Vapor pressure: ${normalizeValue(chemical.VaporPressure)}`]),
    explosionHazards: available([chemical.ChemicalMixtureReactivity, chemical.MinimumExplosiveConcentration].flatMap(asList)),
    runoffConcerns: available(persistence),
  };

  const decon = {
    preferredMethod: normalizeValue([...deconRows.map((row: Record<string, unknown>) => row.notes), ...deconNotes][0]),
    wetVsDry: available(deconRows.map((row: Record<string, unknown>) => `${normalizeValue(row.state)} / ${normalizeValue(row.type)}: ${normalizeValue(row.notes)}`)),
    waterReactiveCautions: ['Not available'],
    grossDecon: ['Not available'],
    technicalDecon: available(protocols.flatMap((row: Record<string, unknown>) => [normalizeValue(row.DecontaminationProtocol), normalizeValue(row.DecontaminationProtocolInfo)]).filter((value: string) => value !== 'Not available')),
    patientVictimDecon: available(deconNotes),
    equipmentDecon: available(deconRows.map((row: Record<string, unknown>) => normalizeValue(row.notes)).filter((value: string) => value !== 'Not available')),
    runoffContainment: available(persistence),
  };

  return {
    header,
    properties,
    exposures,
    ppeRespiratory,
    detectors,
    reactivity,
    isolationErg,
    medical,
    fire,
    decon,
    sources: header.sources,
  };
}

export function getCompanionDbPath() {
  return dbPath;
}

export function queryChemicalProfile(chemicalId: string | number) {
  const db = new Database(dbPath);
  try {
  const selectedChemicalId = Number(chemicalId);
  if (!Number.isInteger(selectedChemicalId) || selectedChemicalId <= 0) return null;
  const chemicalRow = findCompanionChemicalRow(db, selectedChemicalId);
  if (!chemicalRow) return null;
  const id = Number(chemicalRow.ChemicalID);
  const joined = (linkTable: string, valueTable: string, idColumn: string, valueColumn: string) => db.prepare(`
    SELECT v.${valueColumn}
    FROM ${linkTable} l JOIN ${valueTable} v ON v.${idColumn} = l.${idColumn}
    WHERE l.ChemicalID = ? ORDER BY v.${idColumn}
  `).all(id);

  const synonyms = db.prepare('SELECT ChemicalSynonym FROM chemicalsynonyms WHERE ChemicalID = ? ORDER BY ChemicalSynonymID').all(id);
  const exposureLimit = db.prepare('SELECT * FROM chemicals_chemicalexposurelimits WHERE ChemicalID = ?').get(id);
  const isolationDistances = db.prepare('SELECT * FROM chemicals_isolationprotectiondistances WHERE ChemicalID = ?').get(id);
  const symptoms = db.prepare(`
    SELECT cs.ChemicalSignsSymptom, cat.ChemicalSignsSymptomsCategory
    FROM chemicals_chemicalsignssymptoms ccs
    JOIN chemicalsignssymptoms cs ON cs.ChemicalSignsSymptomID = ccs.ChemicalSignsSymptomID
    LEFT JOIN chemicalsignssymptomscategories cat ON cat.ChemicalSignsSymptomsCategoryID = cs.ChemicalSignsSymptomsCategoryID
    WHERE ccs.ChemicalID = ?
    ORDER BY cs.ChemicalSignsSymptomID
  `).all(id) as Record<string, unknown>[];
  const ppeQuery = (table: string) => db.prepare(`SELECT c.*, m.PpeManufacturer, m.PpeMaterial, m.Product, m.Description FROM ${table} c LEFT JOIN ppemanufacturers m ON m.PpeManufacturerID = c.PpeManufacturerID WHERE c.ChemicalID = ? ORDER BY m.PpeManufacturer, m.Product LIMIT 40`).all(id);
  const respirators = ppeQuery('chemicals_respirators');
  const suits = ppeQuery('chemicals_suits');
  const gloves = ppeQuery('chemicals_gloves');
  const boots = ppeQuery('chemicals_boots');
  const detectorsRows = db.prepare(`
    SELECT d.detector_name, d.type, d.manufacturer, d.measurement_method,
           dc.channel, dc.correction_factor, dc.cross_sensitive,
           dl.lower_detection_limit, dl.upper_detection_limit, dl.unit
    FROM detector_chemical dc
    JOIN detectors d ON d.id = dc.detector_id
    LEFT JOIN detector_limits dl ON dl.detector_id = dc.detector_id AND coalesce(dl.channel, '') = coalesce(dc.channel, '')
    WHERE dc.chemical_id = ?
    ORDER BY d.type, d.detector_name LIMIT 100
  `).all(id);
  const deconRows = db.prepare(`SELECT cd.*, s.state, s.notes AS state_notes, t.DecontaminationPrototocolType AS type
    FROM chemicals_decontamination cd
    LEFT JOIN chemicalsdecontaminationstates s ON s.idchemicalsdecontaminationstates = cd.decontamination_state_id
    LEFT JOIN decontaminationprotocoltypes t ON t.DecontaminationProtocolTypeId = cd.decontamination_type_id
    WHERE cd.chemical_id = ? ORDER BY cd.decontamination_type_id, cd.decontamination_state_id`).all(id);
  const deconProtocols = db.prepare(`
    SELECT dp.DecontaminationProtocol, dp.DecontaminationProtocolInfo
    FROM chemicals_decontaminationprotocols cdp
    JOIN decontaminationprotocols dp ON dp.DecontaminationProtocolID = cdp.DecontaminationProtocolID
    WHERE cdp.ChemicalID = ?
    ORDER BY cdp.DecontaminationProtocolOrder
  `).all(id);
  const medicalProtocols = [
    ...db.prepare(`SELECT 'BLS' AS level, p.BasicLifeSupportProtocol AS protocol FROM chemicals_basiclifesupportprotocols c JOIN basiclifesupportprotocols p ON p.BasicLifeSupportProtocolID=c.BasicLifeSupportProtocolID WHERE c.ChemicalID=? ORDER BY c.BasicLifeSupportProtocolOrder`).all(id),
    ...db.prepare(`SELECT 'ALS' AS level, p.AdvancedLifeSupportProtocol AS protocol FROM chemicals_advancedlifesupportprotocols c JOIN advancedlifesupportprotocols p ON p.AdvancedLifeSupportProtocolID=c.AdvancedLifeSupportProtocolID WHERE c.ChemicalID=? ORDER BY c.AdvancedLifeSupportProtocolOrder`).all(id),
  ];
  const emsParadigms = db.prepare(`SELECT e.EmsParadigm FROM chemicals_emsparadigms c JOIN emsparadigms e ON e.EmsParadigmID=c.EMSParadigmID WHERE c.ChemicalID=? ORDER BY e.EmsParadigmTypeID`).all(id);
  const fireGuidance = db.prepare(`SELECT f.name, f.text, f.type FROM chemicals_fire_extinguishment_phrases c JOIN fire_extinguishment_phrases f ON f.id=c.fire_extinguishment_phrase_id WHERE c.chemical_id=? ORDER BY f.precedence`).all(id);
  const deconNotes = db.prepare(`SELECT n.note FROM chemicals_decontamination_notes c JOIN decontamination_notes n ON n.id=c.note_id WHERE c.chemical_id=? ORDER BY c.id`).all(id);
  const cartridges = db.prepare(`SELECT r.CartridgeColor, r.ChemicalCategory FROM respiratorycartridgeidentifiers_chemicals c JOIN respiratorycartridgeidentifiers r ON r.RespiratoryCartridgeIdentifierId=c.RespiratoryCartridgeIdentifierId WHERE c.ChemicalId=?`).all(id);

  const profile = normalizeChemicalProfile(chemicalRow as Record<string, unknown>, {
    synonyms,
    exposureLimits: exposureLimit ? [exposureLimit] : [],
    isolationDistances: isolationDistances ? [isolationDistances] : [],
    symptoms,
    physicalStates: joined('chemicals_chemicalphysicalstates', 'chemicalphysicalstates', 'ChemicalPhysicalStateID', 'ChemicalPhysicalState'),
    odors: joined('chemicals_chemicalodors', 'chemicalodors', 'ChemicalOdorID', 'ChemicalOdor'),
    characteristics: joined('chemicals_chemicalcharacteristics', 'chemicalcharacteristics', 'ChemicalCharacteristicID', 'ChemicalCharacteristic'),
    classes: joined('chemicals_chemicalclasses', 'chemicalclasses', 'ChemicalClassID', 'ChemicalClass'),
    incompatibilities: joined('chemicals_chemicalincompatibilities', 'chemicalincompatibilities', 'ChemicalIncompatibilityID', 'ChemicalIncompatibility'),
    classIncompatibilities: joined('chemicals_chemicalclassincompatibilities', 'chemicalclassincompatibilities', 'ChemicalClassIncompatibilityID', 'ChemicalClassIncompatibility'),
    reactiveGroups: joined('chemicals_chemicalreactivegroups', 'chemicalreactivegroups', 'ChemicalReactiveGroupID', 'ChemicalReactiveGroup'),
    stabilities: joined('chemicals_chemicalstabilities', 'chemicalstabilities', 'ChemicalStabilityID', 'ChemicalStability'),
    persistence: joined('chemicals_chemicalenvironmentalpersistences', 'chemicalenvironmentalpersistences', 'ChemicalEnvironmentalPersistenceID', 'ChemicalEnvironmentalPersistence'),
    symptomCategories: symptoms.map((row) => row.ChemicalSignsSymptomsCategory),
    respirators,
    suits,
    gloves,
    boots,
    detectors: detectorsRows,
    decon: deconRows,
    protocols: deconProtocols,
    medicalProtocols,
    emsParadigms,
    fireGuidance,
    combustion: db.prepare('SELECT * FROM chemicals_combustion WHERE ChemicalID=?').get(id),
    extinction: (db.prepare('SELECT extinction_advice FROM chemicals_extinction WHERE ChemicalID=?').get(id) as Record<string, unknown> | undefined)?.extinction_advice,
    deconNotes,
    cartridges,
    sources: ['Chemical Companion'],
  });
  console.info('[chemical-companion] profile loaded', {
    selectedChemicalId: id,
    ChemicalName: chemicalRow.ChemicalName,
    sections: Object.keys(profile).filter((key) => !['header', 'sources'].includes(key)),
  });
  return profile;
  } finally {
    db.close();
  }
}

export function searchCompanionChemicals(query: string) {
  const db = new Database(dbPath);
  try {
    const term = normalizeSearchText(query);
    if (!term) return [];
    console.info(`[chemical-companion] search query: ${query}`);
    const words = term.split(' ').filter(Boolean);
    const rows = db.prepare('SELECT ChemicalID, ChemicalName, CasNumber, UnnaNumber, ErgNumber, coalesce(ChemicalSynonyms, \'\') AS EmbeddedSynonyms FROM chemicals').all() as Record<string, unknown>[];
    const synonymsById = new Map<number, string[]>();
    for (const row of db.prepare('SELECT ChemicalID, ChemicalSynonym FROM chemicalsynonyms').all() as Record<string, unknown>[]) {
      const id = Number(row.ChemicalID);
      synonymsById.set(id, [...(synonymsById.get(id) ?? []), String(row.ChemicalSynonym)]);
    }
    const properNamesByUnna = new Map<string, string[]>();
    for (const row of db.prepare('SELECT DISTINCT cast(unna AS text) AS UnnaNumber, proper_shipping_name FROM emergency_response_proper_shipping_names').all() as Record<string, unknown>[]) {
      const unna = String(row.UnnaNumber);
      properNamesByUnna.set(unna, [...(properNamesByUnna.get(unna) ?? []), String(row.proper_shipping_name)]);
    }

    const ranked = rows.filter((row) => {
      const searchable = normalizeSearchText([
        row.ChemicalName, row.CasNumber, row.UnnaNumber, row.EmbeddedSynonyms,
        ...(synonymsById.get(Number(row.ChemicalID)) ?? []),
        ...(properNamesByUnna.get(String(row.UnnaNumber)) ?? []),
      ].join(' '));
      return words.every((word) => searchable.includes(word));
    }).map((row) => {
      const name = normalizeSearchText(row.ChemicalName);
      const synonyms = [
        ...asList(row.EmbeddedSynonyms),
        ...(synonymsById.get(Number(row.ChemicalID)) ?? []),
      ];
      const normalizedSynonyms = synonyms.map(normalizeSearchText);
      const properNamesRaw = properNamesByUnna.get(String(row.UnnaNumber)) ?? [];
      const properNames = properNamesRaw.map(normalizeSearchText).filter(Boolean);
      let rank = 99;
      let matchReason = 'ERG proper shipping name fallback';
      if (normalizeSearchText(row.CasNumber) === term) [rank, matchReason] = [0, 'Exact CAS number'];
      else if (normalizeSearchText(row.UnnaNumber) === term) [rank, matchReason] = [1, 'Exact UNNA number'];
      else if (name === term) [rank, matchReason] = [2, 'Exact chemical name'];
      else if (normalizedSynonyms.includes(term)) [rank, matchReason] = [3, 'Exact synonym'];
      else if (sortedSearchWords(name) === sortedSearchWords(term) || normalizedSynonyms.some((value) => sortedSearchWords(value) === sortedSearchWords(term))) [rank, matchReason] = [4, 'Normalized exact word match'];
      else if (name.startsWith(term)) [rank, matchReason] = [5, 'Chemical name starts with query'];
      else if (normalizedSynonyms.some((value) => value.startsWith(term))) [rank, matchReason] = [6, 'Synonym starts with query'];
      else if (name.includes(term)) [rank, matchReason] = [7, 'Chemical name contains query'];
      else if (normalizedSynonyms.some((value) => value.includes(term))) [rank, matchReason] = [8, 'Synonym contains query'];
      else if (!properNames.some((value) => value.includes(term) || term.includes(value))) rank = 100;
      return {
        ChemicalID: Number(row.ChemicalID),
        ChemicalName: normalizeValue(row.ChemicalName),
        CasNumber: normalizeValue(row.CasNumber),
        UnnaNumber: normalizeValue(row.UnnaNumber),
        ErgNumber: normalizeValue(row.ErgNumber),
        matchReason,
        synonyms: [...new Set(synonyms)],
        ergProperShippingNames: [...new Set(properNamesRaw)],
        rank,
      };
    }).filter((row) => row.rank < 100)
      .sort((a, b) => a.rank - b.rank || a.ChemicalName.localeCompare(b.ChemicalName) || a.ChemicalID - b.ChemicalID)
      .slice(0, 20)
      .map(({ rank: _rank, ...row }) => row);
    console.info('[chemical-companion] search top result', ranked[0] ?? null);
    return ranked;
  } finally {
    db.close();
  }
}
