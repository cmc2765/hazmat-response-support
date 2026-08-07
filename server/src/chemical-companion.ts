import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_NPG } from '../../src/data/all-npg.js';
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
      .filter(([key, field]) => !/^(chemical|revision|.*id$)/i.test(key) && field !== null && field !== '')
      .flatMap(([, field]) => asList(field));
  });
}

function available(values: string[]): string[] {
  const unique = [...new Set(values
    .map((value) => value.trim())
    .filter((value) => value && !/^(?:n\/?a|null|undefined|not available)$/i.test(value)))];
  return unique.length ? unique : ['Not available'];
}

function rankExposureRoutes(physicalStates: string[], evidenceValues: string[], chemical: Record<string, unknown>): string[] {
  const physical = physicalStates.join(' ').toLowerCase();
  const evidence = evidenceValues.join(' ').toLowerCase();
  const scores = new Map<string, { score: number; reason: string }>();
  const add = (route: string, score: number, reason: string) => {
    const current = scores.get(route);
    if (!current || score > current.score) scores.set(route, { score, reason });
  };

  if (/\b(gas|vapou?r|fume|mist|dust|aerosol|airborne)\b/.test(physical)) {
    add('Inhalation', 8, 'the listed physical state supports an airborne exposure');
  }
  if (/\b(inhal|breathe|breathing|respirat|airway|pulmonary|ventilat)/.test(evidence)) {
    add('Inhalation', 7, 'respiratory or inhalation exposure is specifically indicated');
  }
  if (hasAvailableProfileDataForRoute(chemical.VaporPressure)) {
    add('Inhalation', 3, 'vapor pressure data indicates potential for an airborne exposure');
  }
  if (/\b(skin|dermal|cutaneous)\s+(?:absorption|penetration)|absorbed?\s+(?:through|via)\s+(?:the\s+)?skin/.test(evidence)) {
    add('Skin absorption', 9, 'absorption through the skin is specifically indicated');
  } else if (/\b(skin|dermal|cutaneous|decontamination|decon)\b/.test(evidence) || /\b(liquid|solution)\b/.test(physical)) {
    add('Skin contact', 4, 'direct liquid or dermal contact is credible');
  }
  if (/\b(eye|ocular|cornea)/.test(evidence)) add('Eye contact', 4, 'eye exposure is specifically indicated');
  if (/\b(ingest|swallow|oral exposure|stomach)/.test(evidence)) add('Ingestion', 5, 'ingestion is specifically indicated');

  const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score);
  if (!ranked.length) return ['Most likely route: Not established in the available record'];
  return ranked.map(([route, detail], index) => `${index === 0 ? 'Most likely' : 'Also possible'}: ${route} — ${detail.reason}`);
}

function hasAvailableProfileDataForRoute(value: unknown): boolean {
  const text = String(value ?? '').trim();
  return Boolean(text) && !/^(?:not available|not established|n\/a|null)$/i.test(text);
}

function clarifyEmsNote(value: string, chemicalName: unknown): string {
  if (/^calcium\.?$/i.test(value.trim()) && /hydrofluoric|hydrogen fluoride/i.test(String(chemicalName ?? ''))) {
    return 'Calcium gluconate — indicated for hydrofluoric acid skin exposure after water rinsing; apply calcium gluconate gel if available and obtain immediate medical care.';
  }
  return value;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? '').trim()).filter((item) => item && !/^(?:n\/?a|null|undefined|not available)$/i.test(item))
    : [];
}

function cleanDeconText(value: unknown): string {
  return normalizeValue(value).replace(/,\s*\d+\s*$/, '').trim();
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
  const emsParadigms = relatedStrings(relatedData.emsParadigms)
    .map((value) => clarifyEmsNote(value, chemical.ChemicalName || chemical.name));
  const fireGuidance = relatedStrings(relatedData.fireGuidance);
  const combustion = asObject(relatedData.combustion);
  const deconNotes = relatedStrings(relatedData.deconNotes);
  const npg = asObject(relatedData.npg);
  const npgHealth = asObject(npg.health);
  const npgReactivity = asObject(npg.reactivity);
  const npgFirstAid = stringArray(npgHealth.firstAid);
  const ergFirstAid = stringArray(relatedData.ergFirstAid);
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
    idlh: normalizeConcentration(exposureLimits.IDLHPpm || exposureLimits.idlh),
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
    idlh: normalizeConcentration(exposureLimits.IDLHPpm),
    oshaPel: normalizeConcentration(exposureLimits.PELTWAPpm || exposureLimits.PELCeiling || exposureLimits.PELSTEL),
    nioshRel: normalizeConcentration(exposureLimits.RELTWAPpm || exposureLimits.RELSTEL || exposureLimits.RELCeiling),
    acgihTlv: normalizeConcentration(exposureLimits.TLVTWAPpm || exposureLimits.TLVSTEL || exposureLimits.TLVCeiling),
    routes: rankExposureRoutes(physicalStates, [...emsParadigms, ...symptoms, ...deconNotes], chemical),
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
      : 'Kappler HazMatch — no chemical-specific suit record',
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
    explosionHazards: available([
      ...asList(chemical.ChemicalMixtureReactivity),
      normalizeMinimumExplosiveConcentration(chemical.MinimumExplosiveConcentration),
    ]),
    runoffConcerns: available(persistence),
  };

  const identityText = `${chemical.ChemicalName ?? chemical.name ?? ''} ${chemical.UnnaNumber ?? chemical.un ?? ''}`.toLowerCase();
  const physicalText = physicalStates.join(' ').toLowerCase()
    || (/\b(solution|aqueous)\b|\b1790\b/.test(identityText) ? 'liquid' : '')
    || (/\b(anhydrous gas|compressed gas)\b|\b1052\b/.test(identityText) ? 'gas' : '');
  const stateMatches = (row: Record<string, unknown>) => {
    const state = String(row.state ?? '').toLowerCase();
    if (!physicalText) return true;
    if (/gas|vapou?r/.test(physicalText)) return state.includes('gas');
    if (/liquid|solution|aerosol/.test(physicalText)) return state.includes('liquid');
    if (/solid|powder|dust|particulate/.test(physicalText)) return state.includes('solid');
    return true;
  };
  const applicableDeconRows = deconRows.filter(stateMatches);
  const rowsForGuidance = applicableDeconRows.length ? applicableDeconRows : deconRows;
  const methodsFor = (type: RegExp) => [...new Set(rowsForGuidance
    .filter((row: Record<string, unknown>) => type.test(String(row.type ?? '')))
    .map((row: Record<string, unknown>) => cleanDeconText(row.method))
    .filter((value: string) => value !== 'Not available'))];
  const peopleMethods = methodsFor(/people/i);
  const objectMethods = methodsFor(/objects/i);
  const applicableStates = [...new Set(rowsForGuidance.map((row: Record<string, unknown>) => normalizeValue(row.state)).filter((value: string) => value !== 'Not available'))];
  const npgDecon = npgFirstAid.filter((value) => /flush|wash|irrigat|decontam|contaminated clothing|remove clothing|skin|eye/i.test(value));
  const ergDecon = ergFirstAid.filter((value) => /flush|rinse|contaminated clothing|skin contact|decontamination|avoid spreading/i.test(value));
  const chemicalSpecificErg = ergDecon.filter((value) => /\b(?:UN|hydrofluoric|hydrogen fluoride)\b/i.test(value));
  const waterReactive = npgReactivity.waterReactive === true
    || [...reactiveGroups, ...compatibility].some((value) => /water[- ]react|reacts? (?:violently )?with water/i.test(value));
  const stateLabel = applicableStates.length ? applicableStates.join(', ') : 'listed physical state';
  const findMethod = (pattern: RegExp) => peopleMethods.find((method) => pattern.test(method));
  const selectedPersonnelMethod = (
    (/gas|vapou?r/.test(physicalText) && findMethod(/^air$/i))
    || (/solid|powder|dust|particulate/.test(physicalText) && findMethod(/^dry$/i))
    || ((npgDecon.length || ergDecon.length || /liquid|solution|aerosol/.test(physicalText)) && findMethod(/^water\/detergent$/i))
    || ((npgDecon.length || ergDecon.length || /liquid|solution|aerosol/.test(physicalText)) && findMethod(/^water$/i))
    || findMethod(/^dry$/i)
    || findMethod(/^air$/i)
    || peopleMethods[0]
  );
  const methodSummary = selectedPersonnelMethod
    ? `Designated HazMat personnel method: ${selectedPersonnelMethod} (${stateLabel})`
    : normalizeValue([...deconNotes, ...npgDecon, ...ergDecon][0]);
  const applicationStep = selectedPersonnelMethod === 'Air'
    ? 'Use enhanced ventilation in the warm zone while personnel remain on respiratory protection; confirm the suit exterior is free of condensed liquid or particulate before doffing.'
    : selectedPersonnelMethod === 'Dry'
      ? 'Remove surface contamination with HEPA vacuuming or compatible absorbent cloth; do not brush material into the air.'
      : selectedPersonnelMethod === 'Water/Detergent'
        ? 'Wash the PPE exterior with low-pressure water and compatible detergent, working from the highest contaminated area downward; then rinse completely.'
        : selectedPersonnelMethod === 'Water'
          ? 'Rinse the PPE exterior with low-pressure water, working from the highest contaminated area downward and preventing splash onto clean areas.'
          : `Apply the Chemical Companion-listed ${selectedPersonnelMethod || 'approved'} method under the incident decon plan.`;

  const decon = {
    preferredMethod: methodSummary,
    hazmatPersonnelProcedure: available([
      'Enter the decon corridor on supplied-air respiratory protection; keep respiratory protection in place through final rinse and initial doffing.',
      applicationStep,
      'A decon attendant shall check seams, gloves, boots, and closures; repeat the designated method where visible contamination remains.',
      'Use controlled assisted doffing to prevent contact with the suit exterior; bag and label disposable PPE and isolate reusable equipment.',
      'Collect decon runoff, wipes, and disposable PPE as contaminated waste under the incident disposal plan.',
    ]),
    wetVsDry: available(rowsForGuidance.map((row: Record<string, unknown>) => {
      const method = cleanDeconText(row.method);
      const note = cleanDeconText(row.notes);
      return `${normalizeValue(row.state)} — ${normalizeValue(row.type)}: ${method}${note !== 'Not available' ? ` (${note})` : ''}`;
    })),
    waterReactiveCautions: waterReactive
      ? ['Water-reactive material: follow chemical-specific emergency flushing instructions for exposed people, but do not use water for bulk-spill neutralization unless directed by the incident safety plan.']
      : ['No water-reactivity restriction is identified in the matched NIOSH record; use the chemical-specific methods below.'],
    grossDecon: available([
      'Move out of the contaminated area and isolate contaminated clothing and equipment.',
      peopleMethods.length ? `Initial people decon: ${peopleMethods.join(' / ')}.` : '',
      ...ergDecon.filter((value) => !chemicalSpecificErg.includes(value)),
    ]),
    technicalDecon: available([
      ...protocols.flatMap((row: Record<string, unknown>) => [normalizeValue(row.DecontaminationProtocol), normalizeValue(row.DecontaminationProtocolInfo)]),
      ...rowsForGuidance.map((row: Record<string, unknown>) => cleanDeconText(row.notes)),
      peopleMethods.length ? `Technical people decon: use the Chemical Companion-approved ${peopleMethods.join(' / ')} method(s) for ${stateLabel}; verify contact time and completion criteria with the incident safety plan.` : '',
      objectMethods.length ? `Technical equipment decon: use ${objectMethods.join(' / ')} only after checking material compatibility; isolate equipment that cannot be safely decontaminated.` : '',
    ]),
    patientVictimDecon: available([...chemicalSpecificErg, ...npgDecon, ...deconNotes]),
    equipmentDecon: available([
      objectMethods.length ? `Chemical Companion methods for equipment (${stateLabel}): ${objectMethods.join(' / ')}` : '',
      ...rowsForGuidance.filter((row: Record<string, unknown>) => /objects/i.test(String(row.type ?? ''))).map((row: Record<string, unknown>) => cleanDeconText(row.notes)),
    ]),
    runoffContainment: available([
      waterReactive ? 'Contain decon runoff and keep it separate from the bulk product; water contact may create heat or hazardous vapors.' : 'Contain and collect decon runoff for disposal under the incident waste plan.',
      ...persistence,
    ]),
    sourceBasis: available([
      deconRows.length ? 'Chemical Companion decontamination method matrix' : '',
      npgFirstAid.length ? 'NIOSH Pocket Guide first-aid data' : '',
      ergFirstAid.length ? `PHMSA ERG 2024 Guide ${normalizeValue(chemical.ErgNumber || chemical.ergGuide)}` : '',
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
    npg,
    ergFirstAid: ergGuides[guideNumber]?.emergencyResponse?.firstAid ?? [],
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

type SearchRecord = {
  ChemicalID: number | null; ChemicalName: string; PrimaryChemicalName: string; ProperShippingName?: string;
  CasNumber: string; UnnaNumber: string; IdentifierType: 'UN' | 'NA'; ErgNumber: string;
  HazardClass: string; matchTerms: string[]; synonyms: string[]; sourceIdentifierId?: number;
  recordType: 'master-chemical' | 'transportation-identifier';
  reviewStatus: 'master-record' | 'requires_review';
  guidanceEligible: boolean;
  sourceBadges: string[];
};

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
      const synonyms = [...new Set([...asList(row.EmbeddedSynonyms), ...(synonymsById.get(id) ?? [])])];
      return {
        ChemicalID: id, ChemicalName: String(row.ChemicalName), PrimaryChemicalName: String(row.ChemicalName),
        CasNumber: String(row.CasNumber), UnnaNumber: normalizeTransportationIdentifier(row.UnnaNumber) ?? String(row.UnnaNumber),
        IdentifierType: 'UN', ErgNumber: String(row.ErgNumber ?? ''), HazardClass: String(row.HazardClass ?? ''),
        matchTerms: [String(row.ChemicalName), String(row.CasNumber), String(row.UnnaNumber), ...synonyms], synonyms,
        recordType: 'master-chemical', reviewStatus: 'master-record', guidanceEligible: true,
        sourceBadges: ['Chemical Companion Master'],
      };
    });
    const transportationIdentifiers = new Set<string>();
    for (const item of shipping) {
      const un = normalizeTransportationIdentifier(item.unna);
      if (!un) continue;
      transportationIdentifiers.add(un);
      records.push({
        ChemicalID: null, ChemicalName: String(item.proper_shipping_name),
        PrimaryChemicalName: 'Transportation identifier requires review',
        ProperShippingName: String(item.proper_shipping_name), CasNumber: 'Not available', UnnaNumber: un,
        IdentifierType: 'UN', ErgNumber: String(item.guide_text_number ?? ''),
        HazardClass: 'Not available', sourceIdentifierId: Number(item.id),
        matchTerms: [String(item.proper_shipping_name), un, `UN ${un}`, `NA ${un}`], synonyms: [],
        recordType: 'transportation-identifier', reviewStatus: 'requires_review', guidanceEligible: false,
        sourceBadges: ['Transportation Identifier', 'Linked ERG', 'Requires Review'],
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
      reviewedTransportationLinkTotal: 0,
      unlinkedTransportationIdentifiers: transportationIdentifiers.size,
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
        : [1, `Exact ${row.IdentifierType} transportation identifier · Requires Review`];
    }
    else if (exactTransportation) return { ...row, rank, matchReason };
    else if (exactCas && normalizeCasIdentifier(row.CasNumber) === exactCas && !row.ProperShippingName) [rank, matchReason] = [1, 'Exact CAS number'];
    else if (exactCas) return { ...row, rank, matchReason };
    else if (name === term && row.recordType === 'master-chemical') [rank, matchReason] = [2, 'Exact Chemical Companion master name'];
    else if (primaryName === term && row.recordType === 'master-chemical') [rank, matchReason] = [2, 'Exact Chemical Companion master name'];
    else if (row.synonyms.map(normalizeSearchText).includes(term) && row.recordType === 'master-chemical') [rank, matchReason] = [3, 'Exact master synonym'];
    else if (name === term && row.recordType === 'transportation-identifier') [rank, matchReason] = [8, 'Exact transportation shipping name · Requires Review'];
    else if (sortedSearchWords(name) === sortedSearchWords(term)) [rank, matchReason] = [row.recordType === 'master-chemical' ? 4 : 8, 'Normalized exact word match'];
    else if (name.startsWith(term)) [rank, matchReason] = [row.recordType === 'master-chemical' ? 5 : 9, 'Name starts with query'];
    else if (terms.some((value) => value.includes(term)) && words.every((word) => terms.some((value) => value.includes(word)))) [rank, matchReason] = [row.recordType === 'master-chemical' ? 7 : 10, 'Identifier or alias contains query'];
    return { ...row, rank, matchReason };
  }).filter((row) => row.rank < 100)
    .sort((a, b) => a.rank - b.rank || a.ChemicalName.localeCompare(b.ChemicalName) || Number(a.ChemicalID) - Number(b.ChemicalID))
    .filter((row, index, all) => all.findIndex((other) => other.recordType === row.recordType
      && other.ChemicalID === row.ChemicalID && other.UnnaNumber === row.UnnaNumber
      && other.ChemicalName === row.ChemicalName) === index)
    .map(({ rank: _rank, matchTerms: _terms, ...row }) => row);
  console.info('[chemical-companion] search', { query, normalizedTransportation: exactTransportation, normalizedCas: exactCas, resultTotal: ranked.length, top: ranked[0] ?? null });
  return ranked;
}
