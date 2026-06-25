// Build a normalized record from any source's CAS string.
// CAS regex: 2-7 digits - 2 digits - 1 digit, with checksum.

export function normalizeCas(input) {
  if (!input) return null;
  const m = String(input).trim().match(/^(\d{2,7})-(\d{2})-(\d)$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function joinNames(name, synonyms = []) {
  const out = new Set();
  if (name) out.add(String(name).trim());
  for (const s of synonyms) {
    if (s) out.add(String(s).trim());
  }
  return [...out].filter(Boolean);
}

export function nowIso() {
  return new Date().toISOString();
}
