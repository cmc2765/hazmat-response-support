import type { ThresholdBand } from "@/lib/schema";

export const AEGL_DURATIONS_MINUTES = [10, 30, 60, 240, 480] as const;
export type AeglDurationMinutes = typeof AEGL_DURATIONS_MINUTES[number];

export interface AeglLevelValues {
  aegl1: number;
  aegl2: number;
  aegl3: number;
}

export interface AeglEndpointRecord {
  masterChemicalIds?: string[];
  chemicalId: string;
  chemicalName: string;
  casNumber: string;
  endpointSource: "EPA AEGL";
  endpointStatus: "Final";
  exposureDurations: AeglDurationMinutes[];
  valuesByDurationMinutes: Record<AeglDurationMinutes, AeglLevelValues>;
  units: "ppm";
  sourceVersion: string;
  sourceUrlOrCitationKey: string;
  importedAt: string;
  limitations: string[];
}

export interface SelectedAeglEndpoint {
  chemicalName: string;
  casNumber: string;
  endpointSource: "EPA AEGL";
  endpointStatus: "Final";
  exposureDurations: AeglDurationMinutes[];
  selectedDurationMinutes: AeglDurationMinutes;
  aegl1: number;
  aegl2: number;
  aegl3: number;
  units: "ppm";
  sourceVersion: string;
  sourceUrlOrCitationKey: string;
  importedAt: string;
  limitations: string[];
}

const COMMON_LIMITATIONS = [
  "AEGL values are acute airborne exposure endpoints for the general population; they are not plume-distance predictions.",
  "Endpoint selection does not validate the dispersion model, release assumptions, or weather inputs.",
] as const;

/**
 * Deliberately small, reviewed catalog. Every record below was transcribed from
 * an EPA final AEGL table and is keyed by both the canonical chemical ID and CAS.
 * Additions require the same source review; generic threshold rows are not AEGLs.
 */
export const VERIFIED_EPA_AEGL_ENDPOINTS: readonly AeglEndpointRecord[] = [
  {
    masterChemicalIds: ["10"],
    chemicalId: "ammonia",
    chemicalName: "Ammonia",
    casNumber: "7664-41-7",
    endpointSource: "EPA AEGL",
    endpointStatus: "Final",
    exposureDurations: [10, 30, 60, 240, 480],
    valuesByDurationMinutes: {
      10: { aegl1: 30, aegl2: 220, aegl3: 2700 },
      30: { aegl1: 30, aegl2: 220, aegl3: 1600 },
      60: { aegl1: 30, aegl2: 160, aegl3: 1100 },
      240: { aegl1: 30, aegl2: 110, aegl3: 550 },
      480: { aegl1: 30, aegl2: 110, aegl3: 390 },
    },
    units: "ppm",
    sourceVersion: "EPA AEGL final values",
    sourceUrlOrCitationKey: "https://www.epa.gov/aegl/ammonia-results-aegl-program",
    importedAt: "2026-08-17",
    limitations: [...COMMON_LIMITATIONS],
  },
  {
    masterChemicalIds: ["22"],
    chemicalId: "chlorine",
    chemicalName: "Chlorine",
    casNumber: "7782-50-5",
    endpointSource: "EPA AEGL",
    endpointStatus: "Final",
    exposureDurations: [10, 30, 60, 240, 480],
    valuesByDurationMinutes: {
      10: { aegl1: 0.5, aegl2: 2.8, aegl3: 50 },
      30: { aegl1: 0.5, aegl2: 2.8, aegl3: 28 },
      60: { aegl1: 0.5, aegl2: 2, aegl3: 20 },
      240: { aegl1: 0.5, aegl2: 1, aegl3: 10 },
      480: { aegl1: 0.5, aegl2: 0.71, aegl3: 7.1 },
    },
    units: "ppm",
    sourceVersion: "EPA AEGL final values; EPA chlorine technical support document",
    sourceUrlOrCitationKey: "https://www.epa.gov/sites/default/files/2014-11/documents/tsd56.pdf",
    importedAt: "2026-08-17",
    limitations: [...COMMON_LIMITATIONS],
  },
  {
    masterChemicalIds: ["54"],
    chemicalId: "hydrazine",
    chemicalName: "Hydrazine",
    casNumber: "302-01-2",
    endpointSource: "EPA AEGL",
    endpointStatus: "Final",
    exposureDurations: [10, 30, 60, 240, 480],
    valuesByDurationMinutes: {
      10: { aegl1: 0.1, aegl2: 23, aegl3: 64 },
      30: { aegl1: 0.1, aegl2: 16, aegl3: 45 },
      60: { aegl1: 0.1, aegl2: 13, aegl3: 35 },
      240: { aegl1: 0.1, aegl2: 3.1, aegl3: 8.9 },
      480: { aegl1: 0.1, aegl2: 1.6, aegl3: 4.4 },
    },
    units: "ppm",
    sourceVersion: "EPA AEGL final values; Hydrazine Final AEGL Technical Support Document",
    sourceUrlOrCitationKey: "https://www.epa.gov/aegl/hydrazine-results-aeglprogram",
    importedAt: "2026-08-17",
    limitations: [...COMMON_LIMITATIONS],
  },
  {
    masterChemicalIds: ["56"],
    chemicalId: "anhydrous-hydrogen-chloride",
    chemicalName: "Hydrogen chloride",
    casNumber: "7647-01-0",
    endpointSource: "EPA AEGL",
    endpointStatus: "Final",
    exposureDurations: [10, 30, 60, 240, 480],
    valuesByDurationMinutes: {
      10: { aegl1: 1.8, aegl2: 100, aegl3: 620 },
      30: { aegl1: 1.8, aegl2: 43, aegl3: 210 },
      60: { aegl1: 1.8, aegl2: 22, aegl3: 100 },
      240: { aegl1: 1.8, aegl2: 11, aegl3: 26 },
      480: { aegl1: 1.8, aegl2: 11, aegl3: 26 },
    },
    units: "ppm",
    sourceVersion: "EPA final AEGL values; Hydrogen Chloride Final AEGL Technical Support Document",
    sourceUrlOrCitationKey: "https://www.epa.gov/aegl/hydrogen-chloride-results-aegl-program",
    importedAt: "2026-08-24",
    limitations: [...COMMON_LIMITATIONS],
  },
  {
    masterChemicalIds: ["60"],
    chemicalId: "hydrogen-sulfide",
    chemicalName: "Hydrogen sulfide",
    casNumber: "7783-06-4",
    endpointSource: "EPA AEGL",
    endpointStatus: "Final",
    exposureDurations: [10, 30, 60, 240, 480],
    valuesByDurationMinutes: {
      10: { aegl1: 0.75, aegl2: 41, aegl3: 76 },
      30: { aegl1: 0.6, aegl2: 32, aegl3: 59 },
      60: { aegl1: 0.51, aegl2: 27, aegl3: 50 },
      240: { aegl1: 0.36, aegl2: 20, aegl3: 37 },
      480: { aegl1: 0.33, aegl2: 17, aegl3: 31 },
    },
    units: "ppm",
    sourceVersion: "EPA final AEGL values",
    sourceUrlOrCitationKey: "https://www.epa.gov/aegl/hydrogen-sulfide-results-aegl-program",
    importedAt: "2026-08-24",
    limitations: [...COMMON_LIMITATIONS],
  },
  {
    masterChemicalIds: ["102"],
    chemicalId: "sulfur-dioxide",
    chemicalName: "Sulfur dioxide",
    casNumber: "7446-09-5",
    endpointSource: "EPA AEGL",
    endpointStatus: "Final",
    exposureDurations: [10, 30, 60, 240, 480],
    valuesByDurationMinutes: {
      10: { aegl1: 0.2, aegl2: 0.75, aegl3: 30 },
      30: { aegl1: 0.2, aegl2: 0.75, aegl3: 30 },
      60: { aegl1: 0.2, aegl2: 0.75, aegl3: 30 },
      240: { aegl1: 0.2, aegl2: 0.75, aegl3: 19 },
      480: { aegl1: 0.2, aegl2: 0.75, aegl3: 9.6 },
    },
    units: "ppm",
    sourceVersion: "EPA final AEGL values",
    sourceUrlOrCitationKey: "https://www.epa.gov/aegl/sulfur-dioxide-results-aegl-program",
    importedAt: "2026-08-24",
    limitations: [...COMMON_LIMITATIONS],
  },
] as const;

export function selectVerifiedAeglEndpoint(
  chemicalId: string,
  casNumber: string,
  durationMinutes: AeglDurationMinutes = 60,
  masterChemicalId?: string | number | null,
): SelectedAeglEndpoint | null {
  const canonicalId = chemicalId.trim().toLowerCase();
  const canonicalCas = casNumber.trim();
  if (!canonicalId || !canonicalCas) return null;
  const casMatches = VERIFIED_EPA_AEGL_ENDPOINTS.filter((candidate) => candidate.casNumber === canonicalCas);
  const normalizedMasterId = String(masterChemicalId ?? "").trim();
  const masterLinkedRecord = normalizedMasterId
    ? casMatches.find((candidate) => candidate.masterChemicalIds?.includes(normalizedMasterId))
    : undefined;
  const canonicalRecord = casMatches.find((candidate) => candidate.chemicalId === canonicalId);
  // A supplied master ID must match an explicitly reviewed master link. Without
  // master context, both canonical chemical ID and CAS must match; CAS alone is
  // not enough because solutions and physical forms can share an identifier.
  const record = normalizedMasterId ? masterLinkedRecord : canonicalRecord;
  const values = record?.valuesByDurationMinutes[durationMinutes];
  if (!record || !values) return null;
  return {
    chemicalName: record.chemicalName,
    casNumber: record.casNumber,
    endpointSource: record.endpointSource,
    endpointStatus: record.endpointStatus,
    exposureDurations: [...record.exposureDurations],
    selectedDurationMinutes: durationMinutes,
    ...values,
    units: record.units,
    sourceVersion: record.sourceVersion,
    sourceUrlOrCitationKey: record.sourceUrlOrCitationKey,
    importedAt: record.importedAt,
    limitations: [...record.limitations],
  };
}

export function aeglThresholdBands(endpoint: SelectedAeglEndpoint): ThresholdBand[] {
  return [
    { kind: "AEGL", level: 3, valuePpm: endpoint.aegl3, label: `AEGL-3 (${endpoint.selectedDurationMinutes} min)`, durationMinutes: endpoint.selectedDurationMinutes, source: endpoint.endpointSource },
    { kind: "AEGL", level: 2, valuePpm: endpoint.aegl2, label: `AEGL-2 (${endpoint.selectedDurationMinutes} min)`, durationMinutes: endpoint.selectedDurationMinutes, source: endpoint.endpointSource },
    { kind: "AEGL", level: 1, valuePpm: endpoint.aegl1, label: `AEGL-1 (${endpoint.selectedDurationMinutes} min)`, durationMinutes: endpoint.selectedDurationMinutes, source: endpoint.endpointSource },
  ];
}
