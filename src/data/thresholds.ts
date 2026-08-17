// AEGL (EPA), ERPG (AIHA), TEEL (DOE) acute exposure thresholds.
// Concentrations in ppm unless noted. Source: public-domain federal values.
//
// Values are derived from the publicly published AEGL/ERPG/TEEL tables for
// each chemical. "—" indicates the agency did not publish a value for that
// level. Where the agency publishes multiple durations, the 1-hour AEGL and
// the ERPG-2 default duration are used.

export interface ThresholdSet {
  chemicalId: string;
  aegl?: { "1": number; "2": number; "3": number };
  erpg?: { "1": number; "2": number; "3": number };
  teel?: { "0": number; "1": number; "2": number; "3": number };
  notes?: string;
}

export const THRESHOLDS: ThresholdSet[] = [
  {
    chemicalId: "ammonia",
    aegl: { "1": 30, "2": 160, "3": 1100 },
    erpg: { "1": 25, "2": 150, "3": 1500 },
    teel: { "0": 25, "1": 25, "2": 150, "3": 1500 },
    notes: "1-hr AEGL values; sharp upper-airway irritant.",
  },
  {
    chemicalId: "chlorine",
    aegl: { "1": 0.5, "2": 2.0, "3": 20 },
    erpg: { "1": 1, "2": 3, "3": 20 },
    teel: { "0": 0.5, "1": 1, "2": 3, "3": 20 },
  },
  {
    chemicalId: "hydrazine",
    aegl: { "1": 0.1, "2": 13, "3": 35 },
    notes: "1-hr final EPA AEGL values; CAS 302-01-2.",
  },
  {
    chemicalId: "anhydrous-hydrogen-chloride",
    aegl: { "1": 1.8, "2": 22, "3": 100 },
    erpg: { "1": 3, "2": 20, "3": 100 },
    teel: { "0": 1.8, "1": 3, "2": 20, "3": 100 },
  },
  {
    chemicalId: "sulfur-dioxide",
    aegl: { "1": 0.2, "2": 0.75, "3": 30 },
    erpg: { "1": 0.3, "2": 3, "3": 15 },
    teel: { "0": 0.2, "1": 0.3, "2": 3, "3": 15 },
  },
  {
    chemicalId: "hydrogen-fluoride",
    aegl: { "1": 1, "2": 24, "3": 44 },
    erpg: { "1": 1, "2": 10, "3": 25 },
    teel: { "0": 0.82, "1": 1, "2": 10, "3": 25 },
  },
  {
    chemicalId: "nitrogen-dioxide",
    aegl: { "1": 0.5, "2": 12, "3": 34 },
    erpg: { "1": 1, "2": 15, "3": 30 },
    teel: { "0": 0.5, "1": 1, "2": 15, "3": 30 },
  },
  {
    chemicalId: "carbon-monoxide",
    aegl: { "1": 24, "2": 68, "3": 330 },
    erpg: { "1": 50, "2": 400, "3": 1000 },
    teel: { "0": 24, "1": 50, "2": 400, "3": 1000 },
  },
  {
    chemicalId: "phosgene",
    aegl: { "1": 0.06, "2": 0.3, "3": 0.75 },
    erpg: { "1": 0.1, "2": 0.5, "3": 1 },
    teel: { "0": 0.06, "1": 0.1, "2": 0.5, "3": 1 },
  },
  {
    chemicalId: "hydrogen-cyanide",
    aegl: { "1": 2, "2": 7.1, "3": 15 },
    erpg: { "1": 2, "2": 10, "3": 25 },
    teel: { "0": 2, "1": 2, "2": 10, "3": 25 },
  },
  {
    chemicalId: "hydrogen-sulfide",
    aegl: { "1": 0.51, "2": 27, "3": 50 },
    erpg: { "1": 0.1, "2": 30, "3": 100 },
    teel: { "0": 0.51, "1": 0.1, "2": 30, "3": 100 },
  },
  {
    chemicalId: "ethylene-oxide",
    aegl: { "1": 4.5, "2": 45, "3": 200 },
    erpg: { "1": 5, "2": 50, "3": 500 },
    teel: { "0": 4.5, "1": 5, "2": 50, "3": 500 },
  },
  {
    chemicalId: "propylene-oxide",
    aegl: { "1": 21, "2": 130, "3": 530 },
    erpg: { "1": 25, "2": 250, "3": 1000 },
    teel: { "0": 21, "1": 25, "2": 250, "3": 1000 },
  },
  {
    chemicalId: "sulfur-trioxide",
    aegl: { "1": 0.2, "2": 2.7, "3": 16 },
    erpg: { "1": 0.2, "2": 2, "3": 10 },
    teel: { "0": 0.2, "1": 0.2, "2": 2, "3": 10 },
  },
  {
    chemicalId: "formaldehyde",
    aegl: { "1": 0.9, "2": 14, "3": 100 },
    erpg: { "1": 1, "2": 10, "3": 40 },
    teel: { "0": 0.9, "1": 1, "2": 10, "3": 40 },
  },
  {
    chemicalId: "acrolein",
    aegl: { "1": 0.03, "2": 0.18, "3": 2.3 },
    erpg: { "1": 0.05, "2": 0.5, "3": 3 },
    teel: { "0": 0.03, "1": 0.05, "2": 0.5, "3": 3 },
  },
  {
    chemicalId: "acrylonitrile",
    aegl: { "1": 1.5, "2": 13, "3": 75 },
    erpg: { "1": 1, "2": 10, "3": 60 },
    teel: { "0": 1.5, "1": 1, "2": 10, "3": 60 },
  },
  {
    chemicalId: "benzene",
    aegl: { "1": 52, "2": 290, "3": 1700 },
    erpg: { "1": 50, "2": 250, "3": 1000 },
    teel: { "0": 52, "1": 50, "2": 250, "3": 1000 },
  },
  {
    chemicalId: "toluene",
    aegl: { "1": 130, "2": 530, "3": 4000 },
    erpg: { "1": 50, "2": 300, "3": 1000 },
    teel: { "0": 130, "1": 50, "2": 300, "3": 1000 },
  },
  {
    chemicalId: "vinyl-chloride",
    aegl: { "1": 180, "2": 1200, "3": 7200 },
    erpg: { "1": 100, "2": 500, "3": 5000 },
    teel: { "0": 180, "1": 100, "2": 500, "3": 5000 },
  },
  {
    chemicalId: "1,3-butadiene",
    aegl: { "1": 54, "2": 670, "3": 4400 },
    erpg: { "1": 10, "2": 100, "3": 5000 },
    teel: { "0": 54, "1": 10, "2": 100, "3": 5000 },
  },
  {
    chemicalId: "methyl-bromide",
    aegl: { "1": 24, "2": 130, "3": 720 },
    erpg: { "1": 25, "2": 100, "3": 1000 },
    teel: { "0": 24, "1": 25, "2": 100, "3": 1000 },
  },
  {
    chemicalId: "acrylic-acid",
    aegl: { "1": 1.5, "2": 21, "3": 250 },
    erpg: { "1": 1, "2": 10, "3": 100 },
    teel: { "0": 1.5, "1": 1, "2": 10, "3": 100 },
  },
  {
    chemicalId: "methyl-isocyanate",
    aegl: { "1": 0.025, "2": 0.34, "3": 1.2 },
    erpg: { "1": 0.025, "2": 0.25, "3": 1.5 },
    teel: { "0": 0.025, "1": 0.025, "2": 0.25, "3": 1.5 },
  },
  {
    chemicalId: "nitric-acid",
    aegl: { "1": 0.16, "2": 24, "3": 92 },
    erpg: { "1": 1, "2": 10, "3": 100 },
    teel: { "0": 0.16, "1": 1, "2": 10, "3": 100 },
  },
  {
    chemicalId: "sodium-cyanide",
    aegl: { "1": 2.0, "2": 7.1, "3": 15 },
    erpg: { "1": 2, "2": 10, "3": 25 },
    teel: { "0": 2, "1": 2, "2": 10, "3": 25 },
  },
  {
    chemicalId: "epichlorohydrin",
    aegl: { "1": 0.65, "2": 16, "3": 51 },
    erpg: { "1": 1, "2": 5, "3": 50 },
    teel: { "0": 0.65, "1": 1, "2": 5, "3": 50 },
  },
  {
    chemicalId: "aniline",
    aegl: { "1": 7.5, "2": 35, "3": 100 },
    erpg: { "1": 3, "2": 30, "3": 100 },
    teel: { "0": 7.5, "1": 3, "2": 30, "3": 100 },
  },
  {
    chemicalId: "phenol",
    aegl: { "1": 6.6, "2": 53, "3": 200 },
    erpg: { "1": 5, "2": 50, "3": 200 },
    teel: { "0": 6.6, "1": 5, "2": 50, "3": 200 },
  },
  {
    chemicalId: "carbon-disulfide",
    aegl: { "1": 13, "2": 160, "3": 800 },
    erpg: { "1": 1, "2": 50, "3": 500 },
    teel: { "0": 13, "1": 1, "2": 50, "3": 500 },
  },
  {
    chemicalId: "acetonitrile",
    aegl: { "1": 13, "2": 130, "3": 670 },
    erpg: { "1": 25, "2": 200, "3": 1000 },
    teel: { "0": 13, "1": 25, "2": 200, "3": 1000 },
  },
];

export function getThresholds(chemicalId: string): ThresholdSet | undefined {
  return THRESHOLDS.find((t) => t.chemicalId === chemicalId);
}
