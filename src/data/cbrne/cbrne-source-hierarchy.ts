import type { CbrneDomain } from "../../lib/cbrne/cbrneTypes.js";
import type { CbrneSourceRegistryId } from "./cbrne-source-registry.js";

export type CbrneSourceHierarchyTier = {
  label: string;
  sourceRegistryIds: readonly CbrneSourceRegistryId[];
  availability: "APPROVED" | "WHEN_ADDED" | "ESCALATION" | "EXTERNAL_REFERENCE_ONLY";
};

export const CWA_SOURCE_HIERARCHY: readonly CbrneSourceHierarchyTier[] = Object.freeze([
  { label: "NIOSH ERSH-DB", sourceRegistryIds: ["NIOSH_ERSH_DB"], availability: "APPROVED" },
  { label: "NRT CBRN QRG", sourceRegistryIds: ["NRT_CBRN_QRG"], availability: "APPROVED" },
  { label: "CHEMM", sourceRegistryIds: ["CHEMM", "CHEMM_NERVE_AGENTS", "CHEMM_SARIN_PREHOSPITAL"], availability: "APPROVED" },
  { label: "CAMEO Chemicals", sourceRegistryIds: ["CAMEO_CHEMICALS"], availability: "APPROVED" },
  { label: "EPA AEGL", sourceRegistryIds: ["EPA_AEGL"], availability: "APPROVED" },
  { label: "PHMSA ERG 2024", sourceRegistryIds: ["PHMSA_ERG_2024"], availability: "APPROVED" },
  { label: "OPCW identity/classification", sourceRegistryIds: ["OPCW_SCHEDULED_CHEMICALS", "OPCW_SCHEDULE_1"], availability: "APPROVED" },
  { label: "OSHA/NIOSH CBRN PPE Matrix", sourceRegistryIds: ["OSHA_NIOSH_CBRN_PPE_MATRIX"], availability: "APPROVED" },
]);

export const BIOLOGICAL_SOURCE_HIERARCHY: readonly CbrneSourceHierarchyTier[] = Object.freeze([
  { label: "NIOSH ERSH-DB", sourceRegistryIds: ["NIOSH_ERSH_DB"], availability: "APPROVED" },
  { label: "NRT CBRN QRG", sourceRegistryIds: ["NRT_CBRN_QRG", "NRT_ANTHRAX_QRG"], availability: "APPROVED" },
  { label: "CDC biological/public health pages when added", sourceRegistryIds: [], availability: "WHEN_ADDED" },
  { label: "OSHA/NIOSH CBRN PPE Matrix", sourceRegistryIds: ["OSHA_NIOSH_CBRN_PPE_MATRIX"], availability: "APPROVED" },
  { label: "Public health authority guidance", sourceRegistryIds: [], availability: "ESCALATION" },
  { label: "Manual SME review", sourceRegistryIds: [], availability: "ESCALATION" },
]);

export const RADIOLOGICAL_SOURCE_HIERARCHY: readonly CbrneSourceHierarchyTier[] = Object.freeze([
  { label: "REMM", sourceRegistryIds: ["REMM", "REMM_RADIATION_PPE", "REMM_SURVEY", "REMM_DECON", "REMM_PAG_SUMMARY"], availability: "APPROVED" },
  { label: "EPA PAG", sourceRegistryIds: ["EPA_PAG"], availability: "APPROVED" },
  { label: "IAEA first responder/radiological emergency guidance", sourceRegistryIds: ["IAEA_FIRST_RESPONDER_RAD", "IAEA_GSG2_CORDON"], availability: "APPROVED" },
  { label: "NRT CBRN QRG", sourceRegistryIds: ["NRT_CBRN_QRG"], availability: "APPROVED" },
  { label: "NNDC NuDat / IAEA LiveChart", sourceRegistryIds: ["NNDC_NUDAT", "IAEA_LIVECHART"], availability: "APPROVED" },
  { label: "EPA radionuclide basics when added", sourceRegistryIds: [], availability: "WHEN_ADDED" },
  { label: "49 CFR / ERG Class 7", sourceRegistryIds: ["DOT_49CFR_CLASS7", "PHMSA_ERG_2024"], availability: "APPROVED" },
  { label: "RESRAD-RDD / HotSpot", sourceRegistryIds: ["RESRAD_RDD", "HOTSPOT"], availability: "EXTERNAL_REFERENCE_ONLY" },
]);

export const CBRNE_SOURCE_LIMITATIONS = Object.freeze({
  OPCW: "Identity and classification only; never standalone tactical response guidance.",
  NNDC_NUDAT: "Nuclide identity and nuclear data only; never isolation, PPE, decon, or medical guidance.",
  EPA_PAG: "Dose-based protective-action framework; not isotope identity or a universal distance.",
  IAEA: "Initial guidance requires exact scenario matching, field survey, and radiation-authority direction.",
  RESRAD_RDD: "External model reference only; no static profile facts or implied HazMatIQ validation.",
  HOTSPOT: "External model reference only; no static profile facts or implied HazMatIQ equivalence.",
});

export function sourceHierarchyForDomain(domain: CbrneDomain): readonly CbrneSourceHierarchyTier[] {
  if (domain === "CHEMICAL_WARFARE") return CWA_SOURCE_HIERARCHY;
  if (domain === "BIOLOGICAL") return BIOLOGICAL_SOURCE_HIERARCHY;
  return RADIOLOGICAL_SOURCE_HIERARCHY;
}
