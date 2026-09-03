import { CHEMICAL_PROFILE_FIELD_ALIASES, type ChemicalProfileField } from './chemicalProfileFieldAliases.js';

type UnknownRecord = Record<string, unknown>;
type SourceFact = UnknownRecord & { field?: unknown; fieldName?: unknown; fieldGroup?: unknown; value?: unknown };

export type ChemicalProfileInput = {
  chemical: unknown;
  sourceFacts?: unknown[];
  linkedFacts?: unknown[];
  approvedSources?: unknown[];
};

export type ExtractedChemicalProfileFacts = {
  identity: Record<string, string>;
  nfpa: { health?: string; fire?: string; reactivity?: string; special?: string };
  properties: Record<string, string>;
  exposures: Record<string, string>;
  isolation: Record<string, string>;
  ppeMonitoring: Record<string, string>;
  response: Record<string, string>;
  medical: Record<string, string>;
  decon: Record<string, string>;
  sources: string[];
  missing: string[];
};

const PLACEHOLDER = /^(?:n\/?a|not available|not established|no data|null|undefined|unknown|no current data exists)$/i;
const recordOf = (value: unknown): UnknownRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
const text = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const result = Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined).map(String).join(' · ') : String(value).trim();
  return result && !PLACEHOLDER.test(result) ? result : undefined;
};
const keyName = (value: unknown) => String(value).replace(/[^a-z0-9]/gi, '').toLowerCase();

function directPath(record: unknown, alias: string): unknown {
  return alias.split('.').reduce<unknown>((current, key) => recordOf(current)[key], record);
}

function recursiveValues(record: unknown, aliases: readonly string[]): unknown[] {
  const wanted = new Set(aliases.map(keyName));
  const values: unknown[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    Object.entries(value as UnknownRecord).forEach(([key, child]) => {
      if (wanted.has(keyName(key))) values.push(child);
      visit(child);
    });
  };
  visit(record);
  return values;
}

export function getValueByAliases(record: unknown, aliases: readonly string[]): string | undefined {
  for (const alias of aliases) {
    const value = text(directPath(record, alias));
    if (value) return value;
  }
  return recursiveValues(record, aliases).map(text).find(Boolean);
}

export function getSourceFactByAliases(sourceFacts: unknown[] = [], aliases: readonly string[]): SourceFact | undefined {
  const terms = aliases.map(keyName).filter(Boolean);
  return sourceFacts.map(recordOf).find((fact) => {
    const field = keyName(fact.fieldName ?? fact.field);
    const group = keyName(fact.fieldGroup);
    const value = text(fact.value);
    return Boolean(value) && terms.some((term) => field === term || field.includes(term) || (group && group.includes(term)));
  });
}

export function getBestAvailableValue(record: unknown, sourceFacts: unknown[] = [], aliases: readonly string[] = []) {
  const direct = getValueByAliases(record, aliases);
  if (direct) return { value: direct, source: 'record' as const };
  const fact = getSourceFactByAliases(sourceFacts, aliases);
  return fact ? { value: text(fact.value) as string, source: String(fact.sourceName || fact.source || 'source fact') } : null;
}

function field(record: unknown, sourceFacts: unknown[], name: ChemicalProfileField): string | undefined {
  return getBestAvailableValue(record, sourceFacts, CHEMICAL_PROFILE_FIELD_ALIASES[name])?.value;
}

function section(record: unknown, sourceFacts: unknown[], fields: Record<string, ChemicalProfileField>) {
  return Object.fromEntries(Object.entries(fields).flatMap(([label, alias]) => {
    const value = field(record, sourceFacts, alias);
    return value ? [[label, value]] : [];
  }));
}

export function extractChemicalProfileFacts(input: ChemicalProfileInput): ExtractedChemicalProfileFacts {
  const record = input.chemical;
  const sourceFacts = [...(input.sourceFacts || []), ...(input.linkedFacts || []), ...(input.approvedSources || [])];
  const identity = section(record, sourceFacts, { name: 'ergGuide', ergGuide: 'ergGuide' });
  const properties = section(record, sourceFacts, {
    vaporDensity: 'vaporDensity', vaporPressure: 'vaporPressure', specificGravity: 'specificGravity', molecularWeight: 'molecularWeight',
    boilingPoint: 'boilingPoint', flashPoint: 'flashPoint', lel: 'lel', uel: 'uel',
  });
  const exposures = section(record, sourceFacts, { idlh: 'idlh', aegl: 'aegl', pel: 'pel', rel: 'rel' });
  const isolation = section(record, sourceFacts, { ergGuide: 'ergGuide', initialIsolation: 'isolationDistance', protectiveAction: 'protectiveActionDistance' });
  const nfpa = {
    health: field(record, sourceFacts, 'nfpaHealth'), fire: field(record, sourceFacts, 'nfpaFire'),
    reactivity: field(record, sourceFacts, 'nfpaReactivity'), special: field(record, sourceFacts, 'nfpaSpecial'),
  };
  const missing = ['IDLH', 'ERG guide', 'Initial isolation distance', 'Protective action distance']
    .filter((label) => ![...Object.keys(exposures), ...Object.keys(isolation)].some((key) => key.toLowerCase().includes(label.toLowerCase().split(' ')[0])));
  return {
    identity,
    nfpa,
    properties,
    exposures,
    isolation,
    ppeMonitoring: section(record, sourceFacts, { ppe: 'nfpaHealth' }),
    response: isolation,
    medical: {},
    decon: {},
    sources: sourceFacts.map((fact) => text(recordOf(fact).sourceName || recordOf(fact).source)).filter((value): value is string => Boolean(value)),
    missing,
  };
}