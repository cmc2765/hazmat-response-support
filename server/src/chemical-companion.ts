import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_NPG } from '../../src/data/all-npg.js';
import { CHEMICALS } from '../../src/data/chemicals.js';
import {
  REVIEWED_TRANSPORTATION_LINKS,
  REVIEWED_MASTER_ALIASES,
  reviewedSourceLinksForMaster,
} from './chemical-companion/reviewed-source-links.js';
import { buildPpeRecommendation } from '../../src/lib/ppe/ppeRecommendationEngine.js';
import {
  SAFETY_DATA_STATUS,
  primarySafetyValue,
  resolveSafetyValues,
  safetyDisplayValue,
  type ApprovedSourceRecord,
  type SafetyCriticalField,
} from '../../src/lib/readiness/scientific-validation.js';
import ergGuideData from '../public/data/erg-guides-2024.json';

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

export function normalizeTransportationIdentifier(value: unknown): string | null {
  const compact = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '');
  const numeric = compact.replace(/^(?:UN|NA)/, '');
  return /^\d{4}$/.test(numeric) ? numeric : null;
}

export function normalizeCasIdentifier(value: unknown): string | null {
  const compact = String(value ?? '').trim().toUpperCase().replace(/^CAS\s*/i, '').replace(/[\s-]+/g, '');
  return /^\d{5,10}$/.test(compact) ? compact : null;
}

function asList(value: unknown): string[] {
  const meaningful = (item: string) => Boolean(item) && !/^(?:n\/?a|null|undefined)$/i.test(item);
  if (Array.isArray(value)) return value.filter(Boolean).map(String).map((item) => item.trim()).filter(meaningful);
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return [];
    return text.split(/\s*[,;]\s*|\s*\n\s*/).map((item) => item.trim()).filter(meaningful);
  }
  return [];
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return 'Not available';
  const text = String(value).trim();
  return !text || /^(?:n\/?a|null|undefined)$/i.test(text) ? 'Not available' : text;
}

function normalizeConcentration(value: unknown): string {
  const text = normalizeValue(value);
  if (text === 'Not available' || /(?:\b(?:ppm|ppb|percent)\b|\b(?:[µμu]?g|mg|kg)\s*[/-]\s*m(?:\^?3|³)|%(?:\s*(?:LEL|UEL))?)/i.test(text)) {
    return text;
  }
  return /^([<>≤≥~]?\s*\d[\d,.]*(?:\s*[-–]\s*\d[\d,.]*)?)(\s*.*)$/.test(text)
    ? text.replace(/^([<>≤≥~]?\s*\d[\d,.]*(?:\s*[-–]\s*\d[\d,.]*)?)(\s*.*)$/, '$1 ppm$2')
    : text;
}

function normalizeMinimumExplosiveConcentration(value: unknown): string {
  const text = normalizeValue(value);
  if (text === 'Not available' || /g\s*\/\s*m(?:\^?3|³)/i.test(text)) return text;
  return /^([<>≤≥~]?\s*\d[\d.]*(?:\s*[-–]\s*\d[\d.]*)?)(\s*.*)$/.test(text)
    ? text.replace(/^([<>≤≥~]?\s*\d[\d.]*(?:\s*[-–]\s*\d[\d.]*)?)(\s*.*)$/, '$1 g/m³$2')
    : text;
}

function relatedStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return asList(item);
    if (!item || typeof item !== 'object') return [];
    return Object.entries(item as Record<string, unknown>)
      .filter(([key, field]) => !/^(?:chemicalid|revision(?:_id)?|.*id)$/i.test(key) && field !== null && field !== '')
      .flatMap(([, field]) => asList(field));
  });
}

function available(values: string[]): string[] {
  const unique = [...new Set(values
    .map((value) => value.trim())
    .filter(Boolean)
    .map(safetyDisplayValue))];
  return unique.length ? unique : [SAFETY_DATA_STATUS.NO_CURRENT_DATA];
}

function cleanDeconText(value: unknown): string {
  return normalizeValue(value).replace(/,\s*\d+\s*$/, '').trim();
}

function deconStateKinds(physicalStates: string[]): Set<string> {
  const kinds = new Set<string>();
  physicalStates.forEach((state) => {
    if (/solid/i.test(state)) kinds.add('solid');
    if (/liquid/i.test(state)) kinds.add('liquid');
    if (/gas|vapor/i.test(state)) kinds.add('gas');
  });
  return kinds;
}

function deconRowMatchesPhysicalState(row: Record<string, unknown>, physicalStates: string[]): boolean {
  const kinds = deconStateKinds(physicalStates);
  if (!kinds.size) return true;
  const state = String(row.state ?? '');
  return (kinds.has('solid') && /solid/i.test(state))
    || (kinds.has('liquid') && /liquid/i.test(state))
    || (kinds.has('gas') && /gas/i.test(state));
}

function deconMethodOrder(method: string): number {
  // This is presentation order, not an invented effectiveness ranking. The
  // database supplies applicable routes but does not assign preference scores.
  if (/water\s*\/\s*detergent/i.test(method)) return 0;
  if (/^water$/i.test(method)) return 1;
  if (/^dry$/i.test(method)) return 2;
  if (/^air$/i.test(method)) return 8;
  if (/no decon/i.test(method)) return 9;
  return 4;
}

function deconMatrixSummary(rows: Record<string, unknown>[], physicalStates: string[], target: 'People' | 'Objects'): string[] {
  const scoped = rows.filter((row) => new RegExp(target, 'i').test(String(row.type ?? '')) && deconRowMatchesPhysicalState(row, physicalStates));
  const grouped = new Map<string, string[]>();
  scoped.forEach((row) => {
    const state = normalizeValue(row.state);
    const method = cleanDeconText(row.method);
    if (state === 'Not available' || method === 'Not available') return;
    grouped.set(state, [...new Set([...(grouped.get(state) ?? []), method])]);
  });
  return [...grouped.entries()].map(([state, methods]) => {
    const ordered = [...methods].sort((a, b) => deconMethodOrder(a) - deconMethodOrder(b) || a.localeCompare(b));
    return `${state} — ${target}: ${ordered.join(' / ')}`;
  });
}

function technicalDeconSteps(rows: Record<string, unknown>[], physicalStates: string[]): string[] {
  return rows
    .filter((row) => /objects/i.test(String(row.type ?? '')) && deconRowMatchesPhysicalState(row, physicalStates))
    .map((row) => {
      const method = cleanDeconText(row.method);
      const information = cleanDeconText(row.method_info);
      const notes = cleanDeconText(row.notes);
      const stateNotes = cleanDeconText(row.state_notes);
      const process = [information, notes].filter((value) => value !== 'Not available').join('; ')
        || 'Process detail unavailable from current source';
      const context = stateNotes === 'Not available' ? '' : `; State context: ${stateNotes}`;
      return `${normalizeValue(row.state)} — ${method}: ${process}${context}`;
    });
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
  if (!identity && !performance) return SAFETY_DATA_STATUS.NO_CURRENT_DATA;
  return `${kind}: ${identity || performance}${identity && performance ? ` (${performance})` : ''}`;
}

function directMeasurement(value: unknown, unit: string): string {
  const display = safetyDisplayValue(value);
  if (Object.values(SAFETY_DATA_STATUS).includes(display as typeof SAFETY_DATA_STATUS[keyof typeof SAFETY_DATA_STATUS])) return display;
  return /[a-z%]/i.test(display) ? display : `${display} ${unit}`;
}

function asApprovedSourceRecords(value: unknown): ApprovedSourceRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ApprovedSourceRecord => Boolean(item)
    && typeof item === 'object'
    && typeof (item as ApprovedSourceRecord).field === 'string'
    && typeof (item as ApprovedSourceRecord).sourceName === 'string'
    && typeof (item as ApprovedSourceRecord).sourceRecordId === 'string');
}

function findCompanionChemicalRow(db: Database.Database, chemicalId: string | number) {
  const numericId = Number(chemicalId);
  if (!Number.isInteger(numericId) || numericId <= 0) return undefined;
  return db.prepare('SELECT * FROM chemicals WHERE ChemicalID = ?').get(numericId) as Record<string, unknown> | undefined;
}

export function normalizeChemicalProfile(chemical: Record<string, unknown>, related: Record<string, unknown> = {}) {
  const relatedData = related as Record<string, unknown>;
  const nfpaHazard = asObject(Array.isArray(relatedData.nfpaHazards) ? relatedData.nfpaHazards[0] : relatedData.nfpaHazards);
  const nfpaRating = (value: unknown) => {
    const rating = Number(value);
    return Number.isInteger(rating) && rating >= 0 && rating <= 4
      ? String(rating)
      : SAFETY_DATA_STATUS.NO_CURRENT_DATA;
  };
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
  const masterRecordId = String(chemical.ChemicalID ?? chemical.id ?? 'inline-master-record');
  const companionRecord = (field: SafetyCriticalField, value: unknown): ApprovedSourceRecord => ({
    field,
    value,
    sourceName: 'Chemical Companion',
    sourceRecordId: masterRecordId,
    approved: true,
    isCurrent: true,
    sourceLocator: `chemicals:${masterRecordId}`,
  });
  const safetyRecords: ApprovedSourceRecord[] = [
    companionRecord('idlh', exposureLimits.IDLHPpm ?? exposureLimits.idlh),
    companionRecord('exposure_limit', exposureLimits.PELTWAPpm ?? exposureLimits.PELCeiling ?? exposureLimits.PELSTEL),
    companionRecord('exposure_limit', exposureLimits.RELTWAPpm ?? exposureLimits.RELSTEL ?? exposureLimits.RELCeiling),
    companionRecord('exposure_limit', exposureLimits.TLVTWAPpm ?? exposureLimits.TLVSTEL ?? exposureLimits.TLVCeiling),
    companionRecord('lel', chemical.LowerExplosiveLimit),
    companionRecord('uel', chemical.UpperExplosiveLimit),
    companionRecord('flash_point', chemical.FlashPoint),
    companionRecord('isolation_distance', isolationDistances.IsolationDistanceSmallSpillDayNightMeters),
    companionRecord('isolation_distance', isolationDistances.IsolationDistanceLargeSpillDayNightMeters),
    companionRecord('protective_action_distance', isolationDistances.ProtectiveActionZoneSmallSpillDayKilometers),
    companionRecord('protective_action_distance', isolationDistances.ProtectiveActionZoneSmallSpillNightKilometers),
    companionRecord('protective_action_distance', isolationDistances.ProtectiveActionZoneLargeSpillDayKilometers),
    companionRecord('protective_action_distance', isolationDistances.ProtectiveActionZoneLargeSpillNightKilometers),
    ...respirators.map((row) => companionRecord('respiratory_protection', formatPpeRow('Respirator', row))),
    ...suits.map((row) => companionRecord('suit_compatibility', formatPpeRow('Suit', row))),
    ...[...suits, ...gloves, ...boots].map((row) => companionRecord('ppe', formatPpeRow('PPE', row))),
    ...medicalProtocols.map((row) => companionRecord('medical', relatedStrings([row]).join('; '))),
    ...emsParadigms.map((value) => companionRecord('medical', value)),
    ...deconRows.map((row) => companionRecord('decon', [cleanDeconText(row.method), cleanDeconText(row.notes)].filter((value) => value !== 'Not available').join(' — '))),
    ...deconNotes.map((value) => companionRecord('decon', value)),
    ...asApprovedSourceRecords(relatedData.safetyCriticalRecords),
  ];
  const idlhValues = resolveSafetyValues('idlh', safetyRecords).map((record) => ({
    ...record,
    value: normalizeConcentration(record.value),
  }));
  const idlh = idlhValues[0]?.value ?? SAFETY_DATA_STATUS.NO_CURRENT_DATA;
  const flashPoint = primarySafetyValue('flash_point', safetyRecords);
  const lel = directMeasurement(primarySafetyValue('lel', safetyRecords), '%');
  const uel = directMeasurement(primarySafetyValue('uel', safetyRecords), '%');
  const header = {
    name: normalizeValue(chemical.ChemicalName || chemical.name),
    cas: normalizeValue(chemical.CasNumber || chemical.cas),
    un: normalizeValue(chemical.UnnaNumber || chemical.un),
    ergGuide: normalizeValue(chemical.ErgNumber || chemical.ergGuide),
    idlh,
    hazard: normalizeValue(chemical.ErgWarning || chemical.ChemicalClass || chemical.hazardClass),
    sources: [...new Set(['Chemical Companion', ...sources])].filter(Boolean),
    nfpa704: {
      health: nfpaRating(nfpaHazard.health),
      flammability: nfpaRating(nfpaHazard.flammability),
      instability: nfpaRating(nfpaHazard.instability),
      special: normalizeValue(nfpaHazard.special),
      healthDescription: normalizeValue(nfpaHazard.healthDescription),
      flammabilityDescription: normalizeValue(nfpaHazard.flammabilityDescription),
      instabilityDescription: normalizeValue(nfpaHazard.instabilityDescription),
      specialDescription: normalizeValue(nfpaHazard.specialDescription),
      source: 'Chemical Companion NFPA hazard record',
    },
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
    flashPoint,
    ignitionTemperature: normalizeValue(chemical.IgnitionTemp),
    lelUel: `${lel} / ${uel}`,
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
    idlh,
    idlhValues,
    oshaPel: normalizeConcentration(safetyDisplayValue(exposureLimits.PELTWAPpm ?? exposureLimits.PELCeiling ?? exposureLimits.PELSTEL)),
    nioshRel: normalizeConcentration(safetyDisplayValue(exposureLimits.RELTWAPpm ?? exposureLimits.RELSTEL ?? exposureLimits.RELCeiling)),
    acgihTlv: normalizeConcentration(safetyDisplayValue(exposureLimits.TLVTWAPpm ?? exposureLimits.TLVSTEL ?? exposureLimits.TLVCeiling)),
    routes: available(relatedStrings(relatedData.exposureRoutes)),
    symptoms: symptoms.length ? symptoms : [SAFETY_DATA_STATUS.NO_CURRENT_DATA],
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
      : SAFETY_DATA_STATUS.NO_CURRENT_DATA,
    recommendedPpe: available([
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
    escapeRespirator: [SAFETY_DATA_STATUS.NO_CURRENT_DATA],
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
    initialIsolationDistance: directMeasurement(isolationDistances.IsolationDistanceSmallSpillDayNightMeters, 'meters'),
    protectiveActionDistance: available([
      `Small spill, day: ${directMeasurement(isolationDistances.ProtectiveActionZoneSmallSpillDayKilometers, 'kilometers')}`,
      `Small spill, night: ${directMeasurement(isolationDistances.ProtectiveActionZoneSmallSpillNightKilometers, 'kilometers')}`,
      `Large spill, day: ${directMeasurement(isolationDistances.ProtectiveActionZoneLargeSpillDayKilometers, 'kilometers')}`,
      `Large spill, night: ${directMeasurement(isolationDistances.ProtectiveActionZoneLargeSpillNightKilometers, 'kilometers')}`,
    ].filter((value) => !value.endsWith(SAFETY_DATA_STATUS.NO_CURRENT_DATA))),
    smallSpill: directMeasurement(isolationDistances.IsolationDistanceSmallSpillDayNightMeters, 'meters'),
    largeSpill: directMeasurement(isolationDistances.IsolationDistanceLargeSpillDayNightMeters, 'meters'),
    dayNightValues: available([
      `Small initial isolation: ${directMeasurement(isolationDistances.IsolationDistanceSmallSpillDayNightMeters, 'meters')}`,
      `Large initial isolation: ${directMeasurement(isolationDistances.IsolationDistanceLargeSpillDayNightMeters, 'meters')}`,
    ].filter((value) => !value.endsWith(SAFETY_DATA_STATUS.NO_CURRENT_DATA))),
    ergTable1: Object.keys(isolationDistances).length ? ['Chemical-specific isolation/protective-action values available above'] : [SAFETY_DATA_STATUS.NO_CURRENT_DATA],
    ergTable2: [SAFETY_DATA_STATUS.NO_CURRENT_DATA],
    ergTable3: [SAFETY_DATA_STATUS.NO_CURRENT_DATA],
    note: normalizeValue(chemical.ErgWarning),
  };

  const medical = {
    signsSymptoms: symptoms.length ? symptoms : [SAFETY_DATA_STATUS.NO_CURRENT_DATA],
    firstAid: available(medicalProtocols.filter((value) => /first|basic|wash|flush|remove|airway|oxygen/i.test(value))),
    emsConsiderations: available(emsParadigms),
    antidotes: available(medicalProtocols.filter((value) => /antidot|administer|dose|medication|drug/i.test(value))),
    treatmentNotes: available(medicalProtocols),
    responderHazards: available(characteristics),
    contaminatedPatientHandling: available(deconNotes),
  };

  const fire = {
    flammability: normalizeValue(classes.length ? classes.join(', ') : chemical.ChemicalClass),
    flashPoint,
    lelUel: `${lel} / ${uel}`,
    extinguishingMedia: available(fireGuidance),
    firefightingPrecautions: available([normalizeValue(relatedData.extinction)].filter((value) => value !== 'Not available')),
    vaporBehavior: available([`Vapor density: ${normalizeValue(chemical.VaporDensity)}`, `Vapor pressure: ${normalizeValue(chemical.VaporPressure)}`]),
    explosionHazards: available([
      ...asList(chemical.ChemicalMixtureReactivity),
      normalizeMinimumExplosiveConcentration(chemical.MinimumExplosiveConcentration),
    ]),
    runoffConcerns: available(persistence),
  };

  const personnelDeconMatrix = deconMatrixSummary(deconRows, physicalStates, 'People');
  const objectDeconMatrix = deconMatrixSummary(deconRows, physicalStates, 'Objects');
  const decon = {
    preferredMethod: available(personnelDeconMatrix),
    hazmatPersonnelProcedure: available([...personnelDeconMatrix, ...deconNotes]),
    wetVsDry: available(deconRows.filter((row: Record<string, unknown>) => deconRowMatchesPhysicalState(row, physicalStates)).map((row: Record<string, unknown>) => {
      const method = cleanDeconText(row.method);
      const note = cleanDeconText(row.notes);
      return `${normalizeValue(row.state)} — ${normalizeValue(row.type)}: ${method}${note !== 'Not available' ? ` (${note})` : ''}`;
    })),
    waterReactiveCautions: available(relatedStrings(relatedData.deconWaterReactiveCautions)),
    grossDecon: available(deconNotes),
    technicalDecon: available([
      ...protocols.flatMap((row: Record<string, unknown>) => [normalizeValue(row.DecontaminationProtocol), normalizeValue(row.DecontaminationProtocolInfo)]),
      ...objectDeconMatrix,
      ...technicalDeconSteps(deconRows, physicalStates),
    ]),
    patientVictimDecon: available(deconNotes),
    equipmentDecon: available([
      ...objectDeconMatrix,
      ...technicalDeconSteps(deconRows, physicalStates),
    ]),
    runoffContainment: available(relatedStrings(relatedData.deconRunoffContainment)),
    sourceBasis: available([
      deconRows.length ? 'Chemical Companion decontamination method matrix' : '',
      deconNotes.length ? 'Chemical Companion decontamination notes' : '',
      protocols.length ? 'Chemical Companion decontamination protocols' : '',
    ]),
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
    safetyCritical: {
      records: safetyRecords.filter((record) => record.approved).map((record) => ({
        ...record,
        value: safetyDisplayValue(record.value),
      })),
      rule: 'Direct approved source records only; missing values fail closed.',
    },
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
  const deconRows = db.prepare(`SELECT cd.*, dp.DecontaminationProtocol AS method,
      dp.DecontaminationProtocolInfo AS method_info, s.state, s.notes AS state_notes,
      t.DecontaminationPrototocolType AS type
    FROM chemicals_decontamination cd
    LEFT JOIN decontaminationprotocols dp ON dp.DecontaminationProtocolID = cd.decontamination_id
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
  const nfpaHazard = db.prepare(`
    SELECT n.NfpaHealthHazardID AS health,
           n.NfpaFlammabilityHazardID AS flammability,
           n.NfpaReactivityHazardID AS instability,
           s.NfpaSpecialConcernAbbreviation AS special,
           h.NfpaHealthHazard AS healthDescription,
           f.NfpaFlammabilityHazard AS flammabilityDescription,
           r.NfpaReactivityHazard AS instabilityDescription,
           s.NfpaSpecialConcern AS specialDescription
    FROM chemicals_nfpahazards n
    LEFT JOIN nfpahealthhazards h ON h.NfpaHealthHazardID = n.NfpaHealthHazardID
    LEFT JOIN nfpaflammabilityhazards f ON f.NfpaFlammabilityHazardID = n.NfpaFlammabilityHazardID
    LEFT JOIN nfpareactivityhazards r ON r.NfpaReactivityHazardID = n.NfpaReactivityHazardID
    LEFT JOIN nfpaspecialconcerns s ON s.NfpaSpecialConcernID = n.NfpaSpecialConcernID
    WHERE n.ChemicalID = ?
  `).get(id);
  const npg = ALL_NPG.find((record) => record.cas === String(chemicalRow.CasNumber ?? '').trim());
  const guideNumber = String(chemicalRow.ErgNumber ?? '').trim();
  const ergGuides = (ergGuideData as { guides: Record<string, { emergencyResponse?: { firstAid?: string[] } }> }).guides;

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
    nfpaHazards: nfpaHazard ? [nfpaHazard] : [],
    npg,
    ergFirstAid: ergGuides[guideNumber]?.emergencyResponse?.firstAid ?? [],
    sources: ['Chemical Companion'],
  });
  const supportingChemical = CHEMICALS.find((record) => record.cas?.includes(String(chemicalRow.CasNumber ?? '').trim()));
  const supportingSources = supportingChemical?.sources?.map((source) => source.source) ?? [];
  const npgRecord = npg as unknown as Record<string, unknown> | undefined;
  const npgHealth = asObject(npgRecord?.health);
  const npgPpe = asObject(npgRecord?.ppe);
  const ergGuide = (ergGuideData as {
    guides: Record<string, { publicSafety?: { protectiveClothing?: string[] } }>;
  }).guides[guideNumber];
  const approvedSafetyRecords = profile.safetyCritical.records.filter((record) => record.approved !== false);
  const ppeRecommendation = buildPpeRecommendation({
    masterLinked: true,
    chemicalId: id,
    chemicalName: profile.header.name,
    approvedSourceFacts: {
      'Chemical Companion': [
        profile.ppeRespiratory.aprPaprScba,
        profile.ppeRespiratory.skinEyeProtection,
        approvedSafetyRecords
          .filter((record) => /^Chemical Companion$/i.test(record.sourceName)
            && /^(?:respiratory_protection|ppe|suit_compatibility)$/.test(record.field))
          .map((record) => record.value),
      ],
      NIOSH: [npgHealth.respiratorSelection, npgPpe.respiratory, npgPpe.skin, npgPpe.eye],
      CAMEO: supportingSources.some((source) => /CAMEO/i.test(source)) ? supportingChemical?.ppe : [],
      ERG: ergGuide?.publicSafety?.protectiveClothing ?? [],
      'Manual Review': approvedSafetyRecords
        .filter((record) => /manual review/i.test(record.sourceName))
        .map((record) => record.value),
    },
    hiddenRawOptions: {
      manufacturerMatches: [profile.ppeRespiratory.bestMatch, profile.ppeRespiratory.recommendedPpe],
      suitAndGloveMaterials: profile.ppeRespiratory.gloveSuitMaterial,
      respiratorOptions: profile.ppeRespiratory.respiratorRecommendations,
      cartridgeOptions: profile.ppeRespiratory.cartridgeLimitations,
    },
  });
  const profileWithRecommendation = { ...profile, ppeRecommendation };
  console.info('[chemical-companion] profile loaded', {
    selectedChemicalId: id,
    ChemicalName: chemicalRow.ChemicalName,
    sections: Object.keys(profileWithRecommendation).filter((key) => !['header', 'sources'].includes(key)),
  });
  return profileWithRecommendation;
  } finally {
    db.close();
  }
}

type LinkedSearchIdentifier = {
  type: 'CAS' | 'UN/NA' | 'ERG' | 'Alias' | 'Transport';
  value: string;
  label: string;
  reviewStatus: 'verified' | 'requires_review';
};

type SearchRecord = {
  ChemicalID: number | null; ChemicalName: string; PrimaryChemicalName: string; ProperShippingName?: string;
  CasNumber: string; UnnaNumber: string; IdentifierType: 'UN' | 'NA'; ErgNumber: string;
  HazardClass: string; matchTerms: string[]; synonyms: string[]; sourceIdentifierId?: number;
  recordType: 'master-chemical' | 'transportation-identifier';
  reviewStatus: 'master-record' | 'approved' | 'requires_review';
  guidanceEligible: boolean;
  sourceBadges: string[];
  masterChemicalId?: number;
  linkType?: string;
  linkReviewStatus?: 'approved' | 'requires_review' | 'rejected';
  reviewedBy?: string | null;
  reviewedAt?: string | null;
};

type RankedSearchRecord = SearchRecord & { rank: number; matchReason: string };

const approvedTransportLinkTypes = new Set(['exact_chemical_match', 'synonym_or_alias']);

function hasApprovedMasterLink(row: SearchRecord): boolean {
  return row.recordType === 'transportation-identifier'
    && Number.isInteger(row.masterChemicalId)
    && row.linkReviewStatus === 'approved'
    && approvedTransportLinkTypes.has(String(row.linkType || ''))
    && Boolean(row.reviewedBy?.trim())
    && Boolean(row.reviewedAt?.trim());
}

function linkedIdentifier(type: LinkedSearchIdentifier['type'], value: unknown, label: string, reviewStatus: LinkedSearchIdentifier['reviewStatus']): LinkedSearchIdentifier | null {
  const normalized = String(value ?? '').trim();
  if (!normalized || /^(?:not available|null|undefined)$/i.test(normalized)) return null;
  return { type, value: normalized, label, reviewStatus };
}

function isGenericTransportName(value: unknown): boolean {
  return /\b(?:n\.?o\.?s\.?|not otherwise specified|generic)\b/i.test(String(value ?? ''));
}

export function groupChemicalSearchResults(results: RankedSearchRecord[]) {
  type ResultGroup = { primary: RankedSearchRecord; members: RankedSearchRecord[]; masterIds: Set<number> };
  const masterGroups: ResultGroup[] = [];
  const masterGroupById = new Map<number, ResultGroup>();
  const masterGroupByVerifiedCasAndName = new Map<string, ResultGroup>();

  results.filter((row) => row.recordType === 'master-chemical').forEach((row) => {
    const chemicalId = Number(row.ChemicalID);
    const cas = normalizeCasIdentifier(row.CasNumber);
    const name = normalizeSearchText(row.ChemicalName);
    const casNameKey = cas && name ? `${cas}:${name}` : '';
    let group = masterGroupById.get(chemicalId) || (casNameKey ? masterGroupByVerifiedCasAndName.get(casNameKey) : undefined);
    if (!group) {
      group = { primary: row, members: [], masterIds: new Set<number>() };
      masterGroups.push(group);
      if (casNameKey) masterGroupByVerifiedCasAndName.set(casNameKey, group);
    }
    group.members.push(row);
    if (Number.isInteger(chemicalId)) {
      group.masterIds.add(chemicalId);
      masterGroupById.set(chemicalId, group);
    }
    if (row.rank < group.primary.rank) group.primary = row;
  });

  const unresolvedGroups = new Map<string, ResultGroup>();
  results.filter((row) => row.recordType === 'transportation-identifier').forEach((row) => {
    const linkedGroup = hasApprovedMasterLink(row) ? masterGroupById.get(Number(row.masterChemicalId)) : undefined;
    if (linkedGroup) {
      linkedGroup.members.push(row);
      return;
    }
    const unresolvedKey = [
      normalizeSearchText(row.ChemicalName),
      normalizeTransportationIdentifier(row.UnnaNumber) || '',
      String(row.ErgNumber || '').trim(),
    ].join(':');
    let group = unresolvedGroups.get(unresolvedKey);
    if (!group) {
      group = { primary: row, members: [], masterIds: new Set<number>() };
      unresolvedGroups.set(unresolvedKey, group);
    }
    group.members.push(row);
    if (row.rank < group.primary.rank) group.primary = row;
  });

  return [...masterGroups, ...unresolvedGroups.values()].map((group) => {
    const primary = group.primary;
    const isMaster = primary.recordType === 'master-chemical';
    const aliases = [...new Set(group.members.flatMap((row) => row.synonyms || []).map((value) => value.trim()).filter(Boolean))];
    const sourceBadges = [...new Set(group.members.flatMap((row) => row.sourceBadges || []))];
    const identifiers = group.members.flatMap((row) => {
      const status = row.recordType === 'master-chemical' || hasApprovedMasterLink(row) ? 'verified' : 'requires_review';
      return [
        linkedIdentifier('CAS', row.CasNumber, `CAS ${row.CasNumber}`, status),
        linkedIdentifier(row.recordType === 'transportation-identifier' ? 'Transport' : 'UN/NA', row.UnnaNumber,
          `${row.IdentifierType}${row.UnnaNumber}${row.ProperShippingName ? ` — ${row.ProperShippingName}` : ''}`, status),
        linkedIdentifier('ERG', row.ErgNumber, `ERG ${row.ErgNumber}`, status),
        ...(row.recordType === 'master-chemical'
          ? (row.synonyms || []).map((alias) => linkedIdentifier('Alias', alias, alias, 'verified'))
          : []),
      ].filter((item): item is LinkedSearchIdentifier => Boolean(item));
    });
    const linkedIdentifiers = [...new Map(identifiers.map((item) => [`${item.type}:${normalizeSearchText(item.value)}`, item])).values()];
    const matchReasons = [...new Set(group.members.map((row) => row.matchReason).filter(Boolean))];
    const masterChemicalId = isMaster ? Number(primary.ChemicalID) : undefined;
    return {
      ...primary,
      ChemicalID: isMaster ? primary.ChemicalID : null,
      masterChemicalId,
      aliases,
      synonyms: aliases,
      sourceBadges,
      linkedIdentifiers,
      matchedBy: matchReasons,
      matchReason: matchReasons.join(' · '),
      resultType: isMaster
        ? 'Chemical Companion Master'
        : (isGenericTransportName(primary.ChemicalName)
          ? 'Generic Transport Class — Requires Review'
          : 'Transportation Identifier — Requires Review'),
      sourceStatus: isMaster ? 'Verified' : 'Requires Review',
      groupedRecordCount: group.members.length,
      groupedMasterChemicalIds: [...group.masterIds],
      reviewWarning: isMaster ? '' : 'This transport identifier has not been verified against a Chemical Companion master chemical record. Do not use it for IDLH, PPE, plume, decon, or medical guidance until reviewed.',
      guidanceEligible: isMaster,
    };
  }).sort((a, b) => a.rank - b.rank || a.ChemicalName.localeCompare(b.ChemicalName));
}

let searchIndex: SearchRecord[] | null = null;
let diagnostics: Record<string, number | string> | null = null;

export function rebuildCompanionSearchIndex() {
  const db = new Database(dbPath, { readonly: true });
  try {
    const chemicals = db.prepare(`SELECT ChemicalID, ChemicalName, CasNumber, UnnaNumber, ErgNumber,
      coalesce(ChemicalClass, '') HazardClass, coalesce(ChemicalSynonyms, '') EmbeddedSynonyms FROM chemicals`).all() as Record<string, unknown>[];
    const synonymsById = new Map<number, string[]>();
    for (const row of db.prepare('SELECT ChemicalID, ChemicalSynonym FROM chemicalsynonyms').all() as Record<string, unknown>[]) {
      const id = Number(row.ChemicalID);
      synonymsById.set(id, [...(synonymsById.get(id) ?? []), String(row.ChemicalSynonym)]);
    }
    const shipping = db.prepare(`SELECT p.id, p.proper_shipping_name, p.unna, u.guide_text_number
      FROM emergency_response_proper_shipping_names p
      JOIN emergency_response_guides g ON g.id=p.guide_id
      JOIN emergency_response_guidebooks b ON b.id=g.guide_book_id AND b.country='USA' AND b.is_latest=1
      JOIN emergency_response_unna_numbers u ON u.unna=p.unna AND u.guide_book_id=b.id`).all() as Record<string, unknown>[];

    const records: SearchRecord[] = chemicals.map((row) => {
      const id = Number(row.ChemicalID);
      const reviewedAliases = REVIEWED_MASTER_ALIASES.find((link) => link.masterChemicalId === id
        && link.casNumber === String(row.CasNumber).trim())?.aliases ?? [];
      const synonyms = [...new Set([...asList(row.EmbeddedSynonyms), ...(synonymsById.get(id) ?? []), ...reviewedAliases])];
      const linkedSources = reviewedSourceLinksForMaster(id);
      const linkedSourceBadges = linkedSources.map((link) => link.sourceName === 'EPA AEGL'
        ? 'Linked EPA AEGL'
        : link.sourceName === 'CAMEO Chemicals' ? 'Linked CAMEO' : link.sourceName === 'ERG' ? 'Linked ERG' : '');
      return {
        ChemicalID: id, ChemicalName: String(row.ChemicalName).trim(), PrimaryChemicalName: String(row.ChemicalName).trim(),
        CasNumber: String(row.CasNumber), UnnaNumber: normalizeTransportationIdentifier(row.UnnaNumber) ?? String(row.UnnaNumber),
        IdentifierType: 'UN', ErgNumber: String(row.ErgNumber ?? ''), HazardClass: String(row.HazardClass ?? ''),
        matchTerms: [String(row.ChemicalName), String(row.CasNumber), String(row.UnnaNumber), ...synonyms], synonyms,
        recordType: 'master-chemical', reviewStatus: 'master-record', guidanceEligible: true,
        sourceBadges: ['Chemical Companion Master', ...linkedSourceBadges.filter(Boolean)],
      };
    });
    const transportationIdentifiers = new Set<string>();
    for (const item of shipping) {
      const un = normalizeTransportationIdentifier(item.unna);
      if (!un) continue;
      transportationIdentifiers.add(un);
      const reviewedLink = REVIEWED_TRANSPORTATION_LINKS.find((link) => link.sourceIdentifierId === Number(item.id)
        && link.identifierValue === un
        && normalizeSearchText(link.properShippingName) === normalizeSearchText(item.proper_shipping_name));
      records.push({
        ChemicalID: null, ChemicalName: String(item.proper_shipping_name),
        PrimaryChemicalName: reviewedLink ? String(item.proper_shipping_name).trim() : 'Transportation identifier requires review',
        ProperShippingName: String(item.proper_shipping_name), CasNumber: 'Not available', UnnaNumber: un,
        IdentifierType: 'UN', ErgNumber: String(item.guide_text_number ?? ''),
        HazardClass: 'Not available', sourceIdentifierId: Number(item.id),
        matchTerms: [String(item.proper_shipping_name), un, `UN ${un}`, `NA ${un}`], synonyms: [],
        recordType: 'transportation-identifier', reviewStatus: 'requires_review', guidanceEligible: false,
        sourceBadges: reviewedLink
          ? ['Transportation Identifier', 'Linked ERG']
          : ['Transportation Identifier', 'Linked ERG', 'Requires Review'],
        ...(reviewedLink ? {
          reviewStatus: 'approved' as const,
          masterChemicalId: reviewedLink.masterChemicalId,
          linkType: reviewedLink.linkType,
          linkReviewStatus: reviewedLink.reviewStatus,
          reviewedBy: reviewedLink.reviewedBy,
          reviewedAt: reviewedLink.reviewedAt,
        } : {}),
      });
    }
    searchIndex = records;
    diagnostics = {
      activeDatabasePath: dbPath, sourceChemicalTotal: chemicals.length,
      sourceUnNaIdentifierTotal: Number((db.prepare('SELECT count(*) total FROM emergency_response_unna_numbers').get() as { total: number }).total),
      sourceCasIdentifierTotal: chemicals.filter((row) => normalizeCasIdentifier(row.CasNumber)).length,
      sourceAliasTotal: Number((db.prepare('SELECT count(*) total FROM chemicalsynonyms').get() as { total: number }).total),
      importedCanonicalTotal: chemicals.length, importedUnNaIdentifierTotal: 0,
      importedCasIdentifierTotal: chemicals.filter((row) => normalizeCasIdentifier(row.CasNumber)).length,
      importedAliasTotal: [...synonymsById.values()].reduce((sum, values) => sum + values.length, 0),
      searchIndexTotal: records.length,
      transportationIdentifierTotal: transportationIdentifiers.size,
      reviewedTransportationLinkTotal: REVIEWED_TRANSPORTATION_LINKS.length,
      unlinkedTransportationIdentifiers: Math.max(0, transportationIdentifiers.size - REVIEWED_TRANSPORTATION_LINKS.length),
    };
    if (process.env.NODE_ENV !== 'production') console.info('[chemical-companion] development diagnostics', diagnostics);
    return diagnostics;
  } finally { db.close(); }
}

export function getCompanionDiagnostics() { return diagnostics ?? rebuildCompanionSearchIndex(); }

export function searchCompanionChemicals(query: string) {
  const term = normalizeSearchText(query);
  if (!term) return [];
  const exactTransportation = normalizeTransportationIdentifier(query);
  const exactCas = normalizeCasIdentifier(query);
  const words = term.split(' ').filter(Boolean);
  const ranked = (searchIndex ?? (rebuildCompanionSearchIndex(), searchIndex!)).map((row) => {
    const name = normalizeSearchText(row.ChemicalName);
    const primaryName = normalizeSearchText(row.PrimaryChemicalName);
    const terms = row.matchTerms.map(normalizeSearchText);
    let rank = 100;
    let matchReason = '';
    if (exactTransportation && row.UnnaNumber === exactTransportation) {
      [rank, matchReason] = row.recordType === 'master-chemical'
        ? [0, `Exact Chemical Companion master ${row.IdentifierType} number`]
        : [1, hasApprovedMasterLink(row)
          ? `Exact reviewed ${row.IdentifierType} transportation identifier`
          : `Exact ${row.IdentifierType} transportation identifier · Requires Review`];
    }
    else if (exactTransportation) return { ...row, rank, matchReason };
    else if (exactCas && normalizeCasIdentifier(row.CasNumber) === exactCas && !row.ProperShippingName) [rank, matchReason] = [1, 'Exact CAS number'];
    else if (exactCas) return { ...row, rank, matchReason };
    else if (name === term && row.recordType === 'master-chemical') [rank, matchReason] = [2, 'Exact Chemical Companion master name'];
    else if (primaryName === term && row.recordType === 'master-chemical') [rank, matchReason] = [2, 'Exact Chemical Companion master name'];
    else if (row.synonyms.map(normalizeSearchText).includes(term) && row.recordType === 'master-chemical') [rank, matchReason] = [3, 'Exact master synonym'];
    else if (name === term && row.recordType === 'transportation-identifier') [rank, matchReason] = [8,
      hasApprovedMasterLink(row) ? 'Exact reviewed transportation shipping name' : 'Exact transportation shipping name · Requires Review'];
    else if (sortedSearchWords(name) === sortedSearchWords(term)) [rank, matchReason] = [row.recordType === 'master-chemical' ? 4 : 8, 'Normalized exact word match'];
    else if (name.startsWith(term)) [rank, matchReason] = [row.recordType === 'master-chemical' ? 5 : 9, 'Name starts with query'];
    else if (terms.some((value) => value.includes(term)) && words.every((word) => terms.some((value) => value.includes(word)))) [rank, matchReason] = [row.recordType === 'master-chemical' ? 7 : 10, 'Identifier or alias contains query'];
    return { ...row, rank, matchReason };
  }).filter((row) => row.rank < 100)
    .sort((a, b) => a.rank - b.rank || a.ChemicalName.localeCompare(b.ChemicalName) || Number(a.ChemicalID) - Number(b.ChemicalID))
    .filter((row, index, all) => all.findIndex((other) => other.recordType === row.recordType
      && other.ChemicalID === row.ChemicalID && other.UnnaNumber === row.UnnaNumber
      && other.ChemicalName === row.ChemicalName) === index);
  const grouped = groupChemicalSearchResults(ranked)
    .map(({ rank: _rank, matchTerms: _terms, ...row }) => row);
  console.info('[chemical-companion] search', { query, normalizedTransportation: exactTransportation, normalizedCas: exactCas, resultTotal: grouped.length, top: grouped[0] ?? null });
  return grouped;
}
