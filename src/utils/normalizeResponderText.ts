const APPROVED_ACRONYMS = [
  "PPE", "SCBA", "APR", "PAPR", "IDLH", "AEGL", "ERG", "NIOSH", "CAMEO",
  "ALOHA", "EPA", "OSHA", "ICS", "NIMS",
] as const;

const CONDITIONAL_START = /^(?:If|When|For|During|Unless|After|Before)\b/i;
const LOWERCASE_ACTION = /^(?:remove|move|add|use|place|flush|wash|rinse|decontaminate|ventilate|isolate|evacuate|shelter|monitor|verify|contact|call|provide|administer|maintain|avoid|keep|wear|don|doff|establish|collect|contain|control|treat|support|perform|discontinue|begin|continue|ensure)\b/;
const INDEPENDENT_WARNING = /^(?:warning|caution|danger|note|source|limitation|do not|never|stop)\b/i;

export function normalizeResponderText(text: unknown): string {
  const value = String(text ?? "")
    .replace(/\\(?:r\\n|[nrt])/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/^\s*\*\*(.*?)\*\*\s*$/, "$1")
    .replace(/^\s*__(.*?)__\s*$/, "$1")
    .replace(/^\s*(?:[-*•]+|#{1,6})\s*/, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!value || /^No Current Data Exists\.?$/i.test(value)) return value;
  return APPROVED_ACRONYMS.reduce(
    (result, acronym) => result.replace(new RegExp(`\\b${acronym}\\b`, "gi"), acronym),
    value,
  );
}

export function normalizeSectionHeading(text: unknown): string {
  return normalizeResponderText(text).replace(/[:.]+$/, "");
}

function canMergeConditionalFragment(current: string, next: string): boolean {
  return CONDITIONAL_START.test(current)
    && !/[.!?:;]$/.test(current)
    && current.length <= 160
    && next.length <= 160
    && /^[a-z]/.test(next)
    && LOWERCASE_ACTION.test(next)
    && !INDEPENDENT_WARNING.test(next)
    && !/\d/.test(next)
    && !/^\(?source\b|\bsource\s*:/i.test(next);
}

export function normalizeBulletList(items: readonly unknown[]): string[] {
  const normalized = items
    .flatMap((item) => Array.isArray(item) ? item : [item])
    .map(normalizeResponderText)
    .filter(Boolean);
  const merged: string[] = [];
  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    const next = normalized[index + 1];
    if (next && canMergeConditionalFragment(current, next)) {
      merged.push(`${current}, ${next}`);
      index += 1;
    } else {
      merged.push(current);
    }
  }
  return [...new Set(merged)];
}

export function formatResponderGuidance(items: readonly unknown[]): string[] {
  return normalizeBulletList(items);
}
