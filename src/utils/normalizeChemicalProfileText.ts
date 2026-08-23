export const CHEMICAL_PROFILE_EMPTY_STATE = "No Current Data Exists";

export type AeglTimeframeRow = {
  label: "< 1 Hour" | "1-4 Hours" | "4-8 Hours" | "8-12 Hours";
  value: string;
};

const PRESERVED_STATUS = /^(?:No Current Data Exists|Requires Review|Planning Estimate|Needs Verification)\.?$/i;
const EMPTY_PLACEHOLDER = /^(?:none|n\/?a|not available|no data|null|undefined|unknown)$/i;
const CONTINUATION = /^(?:and|or|then|with|when|as|if appropriate)\b/i;
const CONDITIONAL = /^(?:If|When|For|During|After|Before)\b/;
const ACTION = /^(?:remove|move|add|use|place|flush|wash|rinse|decontaminate|ventilate|isolate|evacuate|shelter|monitor|verify|contact|call|provide|administer|maintain|avoid|keep|wear|don|doff|establish|collect|contain|control|treat|support|perform|discontinue|begin|continue|ensure)\b/i;
const PROTECTED_DETAIL = /(?:\d|\b(?:CAS|UN\/?NA|ERG|AEGL|IDLH|REL|PEL|TLV|ERPG|TEEL|ppm|mg\/m[³3]|feet|foot|ft|meter|mile|km|source|warning|caution|danger|limitation)\b)/i;

export function normalizeChemicalProfileText(text: unknown): string {
  const value = String(text ?? "")
    .normalize("NFKC")
    .replace(/\\(?:r\\n|[nrt])/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^\s*(?:#{1,6}|[-*•]+)\s*/, "")
    .replace(/([.!?])["']\s*\.\s*$/, "$1")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!value) return "";
  if (/^No Current Data Exists\.?$/i.test(value)) return CHEMICAL_PROFILE_EMPTY_STATE;
  return value;
}

export function normalizeEmptyState(value: unknown): string {
  const normalized = normalizeChemicalProfileText(value);
  return !normalized || EMPTY_PLACEHOLDER.test(normalized)
    ? CHEMICAL_PROFILE_EMPTY_STATE
    : normalized;
}

function isPlaceholder(value: unknown): boolean {
  const normalized = normalizeChemicalProfileText(value);
  return !normalized || EMPTY_PLACEHOLDER.test(normalized) || /^No Current Data Exists\.?$/i.test(normalized);
}

function comparisonKey(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function finishGuidanceSentence(value: string): string {
  let result = value.trim();
  if (ACTION.test(result) && /^[a-z]/.test(result)) {
    result = result[0].toUpperCase() + result.slice(1);
  }
  if ((ACTION.test(result) || CONDITIONAL.test(result))
    && !PROTECTED_DETAIL.test(result)
    && !/[.!?;:]$/.test(result)) {
    result += ".";
  }
  return result;
}

export function mergeBrokenGuidanceFragments(items: readonly unknown[]): string[] {
  const normalized = items
    .flatMap((item) => Array.isArray(item) ? item : [item])
    .map(normalizeChemicalProfileText)
    .filter((item) => !isPlaceholder(item));
  const merged: string[] = [];

  normalized.forEach((current) => {
    const currentKey = comparisonKey(current);
    if (!currentKey) return;
    if (merged.some((item) => comparisonKey(item) === currentKey)) return;

    const words = currentKey.split(" ");
    if (words.length <= 2 && ACTION.test(current) && merged.some((item) => {
      const priorWords = comparisonKey(item).split(" ");
      return words.every((word) => priorWords.includes(word));
    })) return;

    const previous = merged.at(-1);
    if (previous && CONTINUATION.test(current) && !PROTECTED_DETAIL.test(current)) {
      merged[merged.length - 1] = `${previous.replace(/[.;:]$/, "")} ${current}`;
      return;
    }
    if (previous
      && CONDITIONAL.test(previous)
      && !/[.!?:;]$/.test(previous)
      && ACTION.test(current)
      && /^[a-z]/.test(current)
      && !PROTECTED_DETAIL.test(current)) {
      merged[merged.length - 1] = `${previous}, ${current}`;
      return;
    }
    merged.push(current);
  });

  return merged.map(finishGuidanceSentence);
}

export function removeContradictoryEmptyStates(items: readonly unknown[]): string[] {
  const meaningful = items
    .flatMap((item) => Array.isArray(item) ? item : [item])
    .map(normalizeChemicalProfileText)
    .filter((item) => !isPlaceholder(item));
  return meaningful.length ? meaningful : [CHEMICAL_PROFILE_EMPTY_STATE];
}

export function normalizeGuidanceItems(items: readonly unknown[]): string[] {
  return removeContradictoryEmptyStates(mergeBrokenGuidanceFragments(items));
}

export function normalizeHeading(text: unknown): string {
  return normalizeChemicalProfileText(text).replace(/[:.]+$/, "");
}

export function normalizeSourceLabel(text: unknown): string {
  const normalized = normalizeChemicalProfileText(text)
    .replace(/^Linked\s+/i, "")
    .replace(/^Chemical Companion Master$/i, "Chemical Companion");
  return normalizeEmptyState(normalized);
}

export function isChemicalProfileEmpty(value: unknown): boolean {
  return isPlaceholder(value);
}

export function isPreservedChemicalProfileStatus(value: unknown): boolean {
  return PRESERVED_STATUS.test(normalizeChemicalProfileText(value));
}

const AEGL_TIMEFRAMES: Array<{
  label: AeglTimeframeRow["label"];
  includes: (minutes: number) => boolean;
}> = [
  { label: "< 1 Hour", includes: (minutes) => minutes < 60 },
  { label: "1-4 Hours", includes: (minutes) => minutes >= 60 && minutes <= 240 },
  { label: "4-8 Hours", includes: (minutes) => minutes > 240 && minutes <= 480 },
  { label: "8-12 Hours", includes: (minutes) => minutes > 480 && minutes <= 720 },
];

function parseAeglConcern(value: unknown): { level: number; minutes: number; value: string; concentration: number } | null {
  const [rawKey, ...valueParts] = String(value ?? "").split(":");
  const match = rawKey.trim().match(/^AEGL([123])[_\s-]?(\d+(?:\.\d+)?)(min|hr|hour|hours)$/i);
  const displayValue = valueParts.join(":").trim();
  if (!match || !displayValue || isPlaceholder(displayValue)) return null;
  const duration = Number(match[2]);
  const minutes = /^min$/i.test(match[3]) ? duration : duration * 60;
  const numeric = displayValue.match(/(\d+(?:\.\d+)?)(?:\s*[x×]\s*10\^?\s*([+-]?\d+))?/i);
  const concentration = numeric
    ? Number(numeric[1]) * (numeric[2] ? 10 ** Number(numeric[2]) : 1)
    : Number.NaN;
  return { level: Number(match[1]), minutes, value: displayValue, concentration };
}

/**
 * Collapses source AEGL duration rows for profile display only. The lowest
 * concentration in each level/time band is retained as the conservative value.
 */
export function groupAeglByTimeframe(values: readonly unknown[]): AeglTimeframeRow[] {
  const entries = values.map(parseAeglConcern).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  if (!entries.length) return [];
  return AEGL_TIMEFRAMES.map((timeframe) => {
    const levels = [1, 2, 3].map((level) => {
      const candidates = entries.filter((entry) => entry.level === level && timeframe.includes(entry.minutes));
      const comparable = candidates.filter((entry) => Number.isFinite(entry.concentration));
      const selected = comparable.length
        ? comparable.reduce((lowest, entry) => entry.concentration < lowest.concentration ? entry : lowest)
        : candidates[0];
      return `AEGL-${level}: ${selected?.value || CHEMICAL_PROFILE_EMPTY_STATE}`;
    });
    return { label: timeframe.label, value: levels.join(" · ") };
  });
}
