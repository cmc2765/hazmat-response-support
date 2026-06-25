// Molecular weights (g/mol) for chemicals in the bundled subset.
// Used by the plume model to convert ppm ↔ mg/m³.
// Source: standard chemistry references; included for the bundled chemicals.

export const MOLECULAR_WEIGHTS: Record<string, number> = {
  ammonia: 17.03,
  chlorine: 70.90,
  "anhydrous-hydrogen-chloride": 36.46,
  "sulfur-dioxide": 64.07,
  "hydrogen-fluoride": 20.01,
  "nitrogen-dioxide": 46.01,
  "carbon-monoxide": 28.01,
  phosgene: 98.92,
  "hydrogen-cyanide": 27.03,
  "hydrogen-sulfide": 34.08,
  "ethylene-oxide": 44.05,
  "propylene-oxide": 58.08,
  acrylonitrile: 53.06,
  acrolein: 56.06,
  formaldehyde: 30.03,
  benzene: 78.11,
  toluene: 92.14,
  "vinyl-chloride": 62.50,
  "1,3-butadiene": 54.09,
  "methyl-bromide": 94.94,
  "acrylic-acid": 72.06,
  "methyl-isocyanate": 57.05,
  "nitric-acid": 63.01,
  "sodium-cyanide": 49.01,
  epichlorohydrin: 92.52,
  aniline: 93.13,
  phenol: 94.11,
  "carbon-disulfide": 76.14,
  acetonitrile: 41.05,
  "sulfur-trioxide": 80.06,
};

export function molecularWeightOf(chemicalId: string): number | undefined {
  return MOLECULAR_WEIGHTS[chemicalId];
}
