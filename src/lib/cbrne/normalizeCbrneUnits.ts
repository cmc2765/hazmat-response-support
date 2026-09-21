export type NormalizedUnitValue = {
  valueOriginal: number;
  unitsOriginal: string;
  valueNormalized: number;
  unitsNormalized: string;
  normalizationMethod: string;
};

type UnitDimension = "ACTIVITY" | "COUNT_RATE" | "DOSE_RATE" | "MASS_CONCENTRATION" | "TIME";

const UNIT_FACTORS: Readonly<Record<string, { dimension: UnitDimension; factor: number; canonical: string }>> = Object.freeze({
  bq: { dimension: "ACTIVITY", factor: 1, canonical: "Bq" },
  ci: { dimension: "ACTIVITY", factor: 3.7e10, canonical: "Bq" },
  cps: { dimension: "COUNT_RATE", factor: 1, canonical: "cps" },
  cpm: { dimension: "COUNT_RATE", factor: 1 / 60, canonical: "cps" },
  "µr/h": { dimension: "DOSE_RATE", factor: 1, canonical: "µR/h" },
  "ur/h": { dimension: "DOSE_RATE", factor: 1, canonical: "µR/h" },
  "mr/h": { dimension: "DOSE_RATE", factor: 1000, canonical: "µR/h" },
  "r/h": { dimension: "DOSE_RATE", factor: 1e6, canonical: "µR/h" },
  "µsv/h": { dimension: "DOSE_RATE", factor: 1, canonical: "µSv/h" },
  "usv/h": { dimension: "DOSE_RATE", factor: 1, canonical: "µSv/h" },
  "msv/h": { dimension: "DOSE_RATE", factor: 1000, canonical: "µSv/h" },
  "sv/h": { dimension: "DOSE_RATE", factor: 1e6, canonical: "µSv/h" },
  "mg/l": { dimension: "MASS_CONCENTRATION", factor: 1000, canonical: "mg/m³" },
  "mg/m3": { dimension: "MASS_CONCENTRATION", factor: 1, canonical: "mg/m³" },
  "mg/m³": { dimension: "MASS_CONCENTRATION", factor: 1, canonical: "mg/m³" },
  s: { dimension: "TIME", factor: 1, canonical: "s" },
  sec: { dimension: "TIME", factor: 1, canonical: "s" },
  min: { dimension: "TIME", factor: 60, canonical: "s" },
  h: { dimension: "TIME", factor: 3600, canonical: "s" },
  d: { dimension: "TIME", factor: 86400, canonical: "s" },
  day: { dimension: "TIME", factor: 86400, canonical: "s" },
});

function unitKey(value: string) {
  return value.trim().toLocaleLowerCase().replace(/μ/g, "µ").replace(/\s+/g, "");
}

export function normalizeCbrneUnitValue(value: number, unitsOriginal: string, unitsNormalized?: string): NormalizedUnitValue {
  if (!Number.isFinite(value)) throw new Error("Cannot normalize a non-finite value.");
  const source = UNIT_FACTORS[unitKey(unitsOriginal)];
  if (!source) throw new Error(`Unsupported source unit: ${unitsOriginal}`);
  const targetKey = unitsNormalized ? unitKey(unitsNormalized) : source.canonical.toLocaleLowerCase();
  const target = UNIT_FACTORS[targetKey];
  if (!target) throw new Error(`Unsupported target unit: ${unitsNormalized}`);
  if (source.dimension !== target.dimension) {
    throw new Error(`Incompatible unit dimensions: ${unitsOriginal} and ${unitsNormalized ?? target.canonical}`);
  }
  return {
    valueOriginal: value,
    unitsOriginal,
    valueNormalized: value * source.factor / target.factor,
    unitsNormalized: target.canonical,
    normalizationMethod: `${unitsOriginal} → ${target.canonical}; deterministic ${source.dimension} conversion`,
  };
}

export function normalizeCbrneUnitValueOrNull(value: number | null, unitsOriginal: string | null, unitsNormalized?: string | null) {
  if (value === null || unitsOriginal === null) return null;
  return normalizeCbrneUnitValue(value, unitsOriginal, unitsNormalized ?? undefined);
}
