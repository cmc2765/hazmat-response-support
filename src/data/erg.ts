// ERG 2024 Table 1 — Initial isolation and protective action distances.
//
// Source: U.S. DOT/PHMSA Emergency Response Guidebook 2024 (public domain).
// This file holds the most commonly encountered hazmat UN/NA numbers for a
// fire department: toxics, water-reactives, oxidizers, flammables, and the
// few "guide-by-substance" entries that responders actually look up.
//
// Distances are in feet and follow Table 1's (small spill / large spill) x
// (day / night) structure. PA = protective action distance.

export interface ErgEntry {
  un: string;
  name: string;
  guide: string;
  // Distances in feet. Day/night × small/large × initial-isolation / protective-action.
  smallInitialDayFt: number;
  smallProtectiveDayMi: number;
  largeInitialDayFt: number;
  largeProtectiveDayMi: number;
  smallInitialNightFt?: number;
  smallProtectiveNightMi?: number;
  largeInitialNightFt?: number;
  largeProtectiveNightMi?: number;
  isWaterReactive?: boolean;
  // ERG Table 2 material name when water-reactive
  waterReactiveName?: string;
  tih?: boolean; // toxic by inhalation
}

export interface ErgAdditionalTable {
  table: 2 | 3;
  title: string;
  detail: string;
}

export interface ErgContainerDistance {
  container: string;
  initialIsolationFt: number;
  dayLowWindMi: string;
  dayModerateWindMi: string;
  dayHighWindMi: string;
  nightLowWindMi: string;
  nightModerateWindMi: string;
  nightHighWindMi: string;
}

const table3Row = (
  container: string,
  initialIsolationFt: number,
  dayLowWindMi: string,
  dayModerateWindMi: string,
  dayHighWindMi: string,
  nightLowWindMi: string,
  nightModerateWindMi: string,
  nightHighWindMi: string,
): ErgContainerDistance => ({
  container,
  initialIsolationFt,
  dayLowWindMi,
  dayModerateWindMi,
  dayHighWindMi,
  nightLowWindMi,
  nightModerateWindMi,
  nightHighWindMi,
});

// ERG 2024 Table 3. Protective-action distances are miles; a trailing "+"
// means the distance can be larger in certain atmospheric conditions.
export const ERG_TABLE_3: Record<string, ErgContainerDistance[]> = {
  "1005": [
    table3Row("Rail tank car", 1000, "1.0", "0.8", "0.6", "2.6", "1.3", "0.8"),
    table3Row("Highway tank truck or trailer", 500, "0.5", "0.3", "0.3", "1.1", "0.4", "0.4"),
    table3Row("Agricultural nurse tank", 200, "0.3", "0.2", "0.2", "0.9", "0.2", "0.2"),
    table3Row("Multiple small cylinders", 100, "0.2", "0.1", "0.1", "0.5", "0.2", "0.1"),
  ],
  "1017": [
    table3Row("Rail tank car", 3000, "6.0", "3.9", "3.2", "7.0+", "5.6", "4.1"),
    table3Row("Highway tank truck or trailer", 2000, "3.5", "2.1", "1.6", "4.0", "2.9", "2.4"),
    table3Row("Multiple ton cylinders", 1000, "1.2", "0.8", "0.6", "2.2", "1.4", "0.8"),
    table3Row("Multiple small cylinders or single ton cylinder", 500, "0.9", "0.5", "0.3", "1.5", "0.8", "0.4"),
  ],
  "1040": [
    table3Row("Rail tank car", 600, "1.0", "0.5", "0.4", "1.8", "0.9", "0.5"),
    table3Row("Highway tank truck or trailer", 300, "0.6", "0.3", "0.3", "1.3", "0.4", "0.3"),
    table3Row("Multiple small cylinders or single ton cylinder", 100, "0.3", "0.1", "0.1", "0.5", "0.2", "0.1"),
  ],
  "1050": [
    table3Row("Rail tank car", 1500, "2.3", "1.3", "1.1", "6.1", "2.1", "1.4"),
    table3Row("Highway tank truck or trailer", 600, "0.9", "0.5", "0.4", "2.3", "0.9", "0.5"),
    table3Row("Multiple ton cylinders", 100, "0.3", "0.1", "0.1", "0.6", "0.2", "0.1"),
    table3Row("Multiple small cylinders or single ton cylinder", 100, "0.2", "0.1", "0.1", "0.6", "0.2", "0.1"),
  ],
  "1052": [
    table3Row("Rail tank car", 1500, "2.1", "1.3", "1.1", "4.0", "1.9", "1.2"),
    table3Row("Highway tank truck or trailer", 700, "1.2", "0.7", "0.6", "2.3", "1.0", "0.6"),
    table3Row("Multiple small cylinders or single ton cylinder", 300, "0.5", "0.2", "0.2", "1.1", "0.3", "0.2"),
  ],
  "1079": [
    table3Row("Rail tank car", 3000, "7.0+", "7.0+", "4.3", "7.0+", "7.0+", "6.0"),
    table3Row("Highway tank truck or trailer", 3000, "7.0+", "3.8", "3.3", "7.0+", "5.1", "3.9"),
    table3Row("Multiple ton cylinders", 1500, "3.3", "1.4", "1.1", "4.3", "2.5", "1.7"),
    table3Row("Multiple small cylinders or single ton cylinder", 600, "1.9", "0.9", "0.7", "3.5", "1.5", "0.9"),
  ],
};

export function getErgContainerDistances(un: string): ErgContainerDistance[] {
  return ERG_TABLE_3[un] || [];
}

export function getErgAdditionalTables(entry: ErgEntry): ErgAdditionalTable[] {
  const tables: ErgAdditionalTable[] = [];
  if (entry.isWaterReactive) {
    tables.push({
      table: 2,
      title: "Water-reactive materials that produce toxic gases",
      detail: `${entry.waterReactiveName || entry.name} is associated with ERG Table 2. Keep the material dry and consult the current table for toxic-gas response information.`,
    });
  }
  return tables;
}

export const ERG_TABLE_1: ErgEntry[] = [
  { un: "1005", name: "Ammonia, anhydrous", guide: "125",
    smallInitialDayFt: 100, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 500, largeProtectiveDayMi: 1.0,
    smallInitialNightFt: 100, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 1000, largeProtectiveNightMi: 2.3,
    tih: true },
  { un: "1005", name: "Ammonia solutions", guide: "154",
    smallInitialDayFt: 100, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 500, largeProtectiveDayMi: 1.0,
    smallInitialNightFt: 100, smallProtectiveNightMi: 0.2,
    largeInitialNightFt: 1000, largeProtectiveNightMi: 2.3,
    tih: true },
  { un: "1017", name: "Chlorine", guide: "124",
    smallInitialDayFt: 200, smallProtectiveDayMi: 0.2,
    largeInitialDayFt: 1500, largeProtectiveDayMi: 4.1,
    smallInitialNightFt: 200, smallProtectiveNightMi: 0.9,
    largeInitialNightFt: 4500, largeProtectiveNightMi: 7.5,
    tih: true },
  { un: "1050", name: "Hydrogen chloride, anhydrous", guide: "125",
    smallInitialDayFt: 100, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 1000, largeProtectiveDayMi: 2.3,
    smallInitialNightFt: 100, smallProtectiveNightMi: 0.2,
    largeInitialNightFt: 1800, largeProtectiveNightMi: 3.4,
    tih: true },
  { un: "1052", name: "Hydrogen fluoride, anhydrous", guide: "125",
    smallInitialDayFt: 100, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 1000, largeProtectiveDayMi: 1.8,
    smallInitialNightFt: 100, smallProtectiveNightMi: 0.3,
    largeInitialNightFt: 1800, largeProtectiveNightMi: 3.4,
    tih: true },
  { un: "1079", name: "Sulfur dioxide", guide: "125",
    smallInitialDayFt: 300, smallProtectiveDayMi: 0.4,
    largeInitialDayFt: 1000, largeProtectiveDayMi: 3.1,
    smallInitialNightFt: 300, smallProtectiveNightMi: 1.6,
    largeInitialNightFt: 1800, largeProtectiveNightMi: 5.7,
    tih: true },
  { un: "1016", name: "Carbon monoxide, compressed", guide: "119",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 300, largeProtectiveDayMi: 0.6,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.2,
    largeInitialNightFt: 1000, largeProtectiveNightMi: 1.9,
    tih: true },
  { un: "1076", name: "Phosgene", guide: "125",
    smallInitialDayFt: 150, smallProtectiveDayMi: 0.4,
    largeInitialDayFt: 1500, largeProtectiveDayMi: 4.2,
    smallInitialNightFt: 600, smallProtectiveNightMi: 1.4,
    largeInitialNightFt: 4500, largeProtectiveNightMi: 7.5,
    tih: true },
  { un: "1051", name: "Hydrogen cyanide, stabilized", guide: "117",
    smallInitialDayFt: 100, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 1000, largeProtectiveDayMi: 1.4,
    smallInitialNightFt: 100, smallProtectiveNightMi: 0.2,
    largeInitialNightFt: 1800, largeProtectiveNightMi: 3.0,
    tih: true },
  { un: "1053", name: "Hydrogen sulfide", guide: "117",
    smallInitialDayFt: 100, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 1000, largeProtectiveDayMi: 2.0,
    smallInitialNightFt: 100, smallProtectiveNightMi: 0.3,
    largeInitialNightFt: 1800, largeProtectiveNightMi: 4.3,
    tih: true },
  { un: "1040", name: "Ethylene oxide", guide: "119P",
    smallInitialDayFt: 100, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 300, largeProtectiveDayMi: 0.7,
    smallInitialNightFt: 100, smallProtectiveNightMi: 0.2,
    largeInitialNightFt: 1000, largeProtectiveNightMi: 2.2,
    tih: true },
  { un: "1280", name: "Propylene oxide", guide: "127P",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 300, largeProtectiveDayMi: 0.6,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.2,
    largeInitialNightFt: 1000, largeProtectiveNightMi: 1.8,
    tih: true },
  { un: "1006", name: "Argon, compressed", guide: "121",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 100, largeProtectiveDayMi: 0.2,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 100, largeProtectiveNightMi: 0.2 },
  { un: "1013", name: "Carbon dioxide", guide: "120",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 100, largeProtectiveDayMi: 0.2,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 100, largeProtectiveNightMi: 0.2 },
  { un: "1971", name: "Methane, compressed", guide: "115",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 100, largeProtectiveDayMi: 0.2,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 100, largeProtectiveNightMi: 0.2 },
  { un: "1075", name: "Liquefied petroleum gas", guide: "115",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 200, largeProtectiveDayMi: 0.3,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 600, largeProtectiveNightMi: 0.8 },
  { un: "1011", name: "Butane", guide: "115",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 200, largeProtectiveDayMi: 0.3,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 600, largeProtectiveNightMi: 0.8 },
  { un: "1965", name: "Hydrocarbon gas mixture, liquefied, n.o.s.", guide: "115",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 200, largeProtectiveDayMi: 0.3,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 600, largeProtectiveNightMi: 0.8 },
  { un: "1170", name: "Ethanol", guide: "127",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 300, largeProtectiveDayMi: 0.7,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 1000, largeProtectiveNightMi: 1.9 },
  { un: "1090", name: "Acetone", guide: "127",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 300, largeProtectiveDayMi: 0.7,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 1000, largeProtectiveNightMi: 1.9 },
  { un: "1230", name: "Methanol", guide: "131",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 300, largeProtectiveDayMi: 0.7,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 1000, largeProtectiveNightMi: 1.9 },
  { un: "1114", name: "Benzene", guide: "130",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 300, largeProtectiveDayMi: 0.7,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.2,
    largeInitialNightFt: 1000, largeProtectiveNightMi: 2.0,
    tih: true },
  { un: "1294", name: "Toluene", guide: "130",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 300, largeProtectiveDayMi: 0.7,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 1000, largeProtectiveNightMi: 1.7 },
  { un: "1086", name: "Vinyl chloride, stabilized", guide: "116P",
    smallInitialDayFt: 150, smallProtectiveDayMi: 0.3,
    largeInitialDayFt: 1000, largeProtectiveDayMi: 2.1,
    smallInitialNightFt: 300, smallProtectiveNightMi: 0.7,
    largeInitialNightFt: 2500, largeProtectiveNightMi: 4.5,
    tih: true },
  { un: "1010", name: "1,3-Butadiene, stabilized", guide: "116P",
    smallInitialDayFt: 150, smallProtectiveDayMi: 0.3,
    largeInitialDayFt: 1000, largeProtectiveDayMi: 2.1,
    smallInitialNightFt: 300, smallProtectiveNightMi: 0.7,
    largeInitialNightFt: 2500, largeProtectiveNightMi: 4.5 },
  { un: "1062", name: "Methyl bromide", guide: "126",
    smallInitialDayFt: 100, smallProtectiveDayMi: 0.2,
    largeInitialDayFt: 1000, largeProtectiveDayMi: 1.8,
    smallInitialNightFt: 150, smallProtectiveNightMi: 0.4,
    largeInitialNightFt: 1800, largeProtectiveNightMi: 3.0,
    tih: true },
  { un: "2218", name: "Acrylic acid, stabilized", guide: "132P",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 300, largeProtectiveDayMi: 0.7,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 1000, largeProtectiveNightMi: 1.8 },
  { un: "2480", name: "Methyl isocyanate", guide: "155P",
    smallInitialDayFt: 150, smallProtectiveDayMi: 0.4,
    largeInitialDayFt: 1000, largeProtectiveDayMi: 2.1,
    smallInitialNightFt: 300, smallProtectiveNightMi: 0.7,
    largeInitialNightFt: 1800, largeProtectiveNightMi: 3.4,
    tih: true },
  { un: "2031", name: "Nitric acid", guide: "157",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 100, largeProtectiveDayMi: 0.3,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 150, largeProtectiveNightMi: 0.4 },
  { un: "1689", name: "Sodium cyanide", guide: "157",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 100, largeProtectiveDayMi: 0.3,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 150, largeProtectiveNightMi: 0.4 },
  { un: "2023", name: "Epichlorohydrin", guide: "131P",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 300, largeProtectiveDayMi: 0.5,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 600, largeProtectiveNightMi: 1.3,
    tih: true },
  { un: "1547", name: "Aniline", guide: "153",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 300, largeProtectiveDayMi: 0.5,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.2,
    largeInitialNightFt: 600, largeProtectiveNightMi: 1.3 },
  { un: "1671", name: "Phenol, molten", guide: "153",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 100, largeProtectiveDayMi: 0.2,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 150, largeProtectiveNightMi: 0.3 },
  { un: "1131", name: "Carbon disulfide", guide: "129",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 300, largeProtectiveDayMi: 0.7,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 1000, largeProtectiveNightMi: 1.9 },
  { un: "1648", name: "Acetonitrile", guide: "127",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 300, largeProtectiveDayMi: 0.5,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 600, largeProtectiveNightMi: 1.3 },
  { un: "1198", name: "Formaldehyde, solutions (flammable)", guide: "132P",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 300, largeProtectiveDayMi: 0.7,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.1,
    largeInitialNightFt: 1000, largeProtectiveNightMi: 1.8 },
  { un: "1093", name: "Acrylonitrile, stabilized", guide: "131P",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 300, largeProtectiveDayMi: 0.7,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0.2,
    largeInitialNightFt: 1000, largeProtectiveNightMi: 2.2,
    tih: true },
  { un: "1092", name: "Acrolein, stabilized", guide: "131P",
    smallInitialDayFt: 150, smallProtectiveDayMi: 0.5,
    largeInitialDayFt: 1500, largeProtectiveDayMi: 4.5,
    smallInitialNightFt: 750, smallProtectiveNightMi: 1.8,
    largeInitialNightFt: 4500, largeProtectiveNightMi: 8.0,
    tih: true },
  // Water-reactive (Table 2) — initial isolation only, no PA distance.
  { un: "1428", name: "Sodium", guide: "138",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0,
    largeInitialDayFt: 150, largeProtectiveDayMi: 0,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0,
    largeInitialNightFt: 150, largeProtectiveNightMi: 0,
    isWaterReactive: true, waterReactiveName: "Sodium" },
  { un: "1418", name: "Magnesium powder", guide: "138",
    smallInitialDayFt: 50, smallProtectiveDayMi: 0,
    largeInitialDayFt: 150, largeProtectiveDayMi: 0,
    smallInitialNightFt: 50, smallProtectiveNightMi: 0,
    largeInitialNightFt: 150, largeProtectiveNightMi: 0,
    isWaterReactive: true, waterReactiveName: "Magnesium" },
  { un: "1242", name: "Methyldichlorosilane", guide: "139",
    smallInitialDayFt: 100, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 600, largeProtectiveDayMi: 1.3,
    smallInitialNightFt: 150, smallProtectiveNightMi: 0.3,
    largeInitialNightFt: 1000, largeProtectiveNightMi: 2.2,
    isWaterReactive: true, waterReactiveName: "Methyldichlorosilane",
    tih: true },
  { un: "1250", name: "Methyltrichlorosilane", guide: "155",
    smallInitialDayFt: 100, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 600, largeProtectiveDayMi: 1.0,
    smallInitialNightFt: 100, smallProtectiveNightMi: 0.3,
    largeInitialNightFt: 1000, largeProtectiveNightMi: 1.8,
    isWaterReactive: true, waterReactiveName: "Methyltrichlorosilane",
    tih: true },
  { un: "1295", name: "Trichlorosilane", guide: "139",
    smallInitialDayFt: 100, smallProtectiveDayMi: 0.1,
    largeInitialDayFt: 600, largeProtectiveDayMi: 1.0,
    smallInitialNightFt: 100, smallProtectiveNightMi: 0.3,
    largeInitialNightFt: 1000, largeProtectiveNightMi: 1.8,
    isWaterReactive: true, waterReactiveName: "Trichlorosilane",
    tih: true },
];

export function lookupErg(un: string): ErgEntry | undefined {
  return ERG_TABLE_1.find((e) => e.un === un);
}
