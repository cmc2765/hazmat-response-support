import type { AuthoritativeFactKind } from "../../../lib/cbrne/authoritativeSourceTypes.js";

export type DomainSourcePrecedenceRule = {
  domain: "CWA_IDENTITY" | "CHEMICAL_RESPONSE" | "CHEMICAL_MEDICAL" | "BIOLOGICAL_RESPONSE" | "BIOLOGICAL_CRIMINAL_PUBLIC_HEALTH" | "RADIONUCLIDE_PHYSICS" | "RADIOLOGICAL_MEDICAL" | "RADIOLOGICAL_POPULATION_MONITORING" | "RADIOLOGICAL_PROTECTIVE_ACTION" | "NUCLEAR_DETONATION_COMMAND" | "FEDERAL_COORDINATION" | "EXPLOSIVES_COORDINATION";
  orderedSourceFamilies: string[];
  allowedFactKinds: AuthoritativeFactKind[];
  restrictions: string[];
};

export const CBRNE_DOMAIN_SOURCE_PRECEDENCE: readonly DomainSourcePrecedenceRule[] = Object.freeze([
  {
    domain: "CWA_IDENTITY",
    orderedSourceFamilies: ["OPCW_CWA_IDENTITY", "EPA_NRT_QRG", "CHEMM", "NIOSH_ERSH_LEGACY"],
    allowedFactKinds: ["SOURCE_DERIVED_FACT"],
    restrictions: ["OPCW classification is identity evidence, not responder tactics.", "NIOSH ERSH is legacy/supplemental and cannot override a current official source."],
  },
  {
    domain: "CHEMICAL_RESPONSE",
    orderedSourceFamilies: ["EPA_NRT_QRG", "CHEMM", "NIOSH_ERSH_LEGACY"],
    allowedFactKinds: ["SOURCE_DERIVED_FACT", "REQUIRES_FIELD_MEASUREMENT", "REQUIRES_SME_AGENCY_COORDINATION"],
    restrictions: ["No single value is promoted without scenario, units, and locator review.", "Chemical Companion values are quarantined until provenance is independently established."],
  },
  {
    domain: "CHEMICAL_MEDICAL",
    orderedSourceFamilies: ["CHEMM", "EPA_NRT_QRG", "NIOSH_ERSH_LEGACY"],
    allowedFactKinds: ["SOURCE_DERIVED_FACT", "REQUIRES_SME_AGENCY_COORDINATION"],
    restrictions: ["Medication dosing and medical orders require medical authority and are not synthesized by this corpus."],
  },
  {
    domain: "BIOLOGICAL_RESPONSE",
    orderedSourceFamilies: ["EPA_NRT_QRG", "FEMA_CBRNE_DOCTRINE", "NIOSH_ERSH_LEGACY"],
    allowedFactKinds: ["SOURCE_DERIVED_FACT", "SOURCE_DERIVED_COORDINATION_GUIDANCE", "REQUIRES_SME_AGENCY_COORDINATION"],
    restrictions: ["Clinical recognition is not laboratory confirmation.", "Public-health and criminal-investigation coordination remain separate authorities."],
  },
  {
    domain: "BIOLOGICAL_CRIMINAL_PUBLIC_HEALTH",
    orderedSourceFamilies: ["FBI_PUBLIC_WMD", "FEMA_CBRNE_DOCTRINE", "EPA_NRT_QRG"],
    allowedFactKinds: ["SOURCE_DERIVED_COORDINATION_GUIDANCE", "REQUIRES_SME_AGENCY_COORDINATION"],
    restrictions: ["The May 2025 public Crim-Epi handbook remains access-blocked and cannot be represented by a stale edition.", "Coordination facts do not become toxicology or clinical facts."],
  },
  {
    domain: "RADIONUCLIDE_PHYSICS",
    orderedSourceFamilies: ["NNDC_ENSDF"],
    allowedFactKinds: ["SOURCE_DERIVED_FACT"],
    restrictions: ["Evaluated isotope physics cannot be converted into dose, distance, shielding, PPE, or treatment guidance without incident measurements and an applicable model."],
  },
  {
    domain: "RADIOLOGICAL_MEDICAL",
    orderedSourceFamilies: ["REMM", "CDC_RADIATION_POPULATION_MONITORING"],
    allowedFactKinds: ["SOURCE_DERIVED_FACT", "REQUIRES_SME_AGENCY_COORDINATION"],
    restrictions: ["Medical countermeasures require isotope, exposure pathway, timing, measurement, and medical-authority context."],
  },
  {
    domain: "RADIOLOGICAL_POPULATION_MONITORING",
    orderedSourceFamilies: ["CDC_RADIATION_POPULATION_MONITORING", "REMM", "FEDERAL_RAD_SUPPORT"],
    allowedFactKinds: ["SOURCE_DERIVED_FACT", "SOURCE_DERIVED_COORDINATION_GUIDANCE", "REQUIRES_FIELD_MEASUREMENT", "REQUIRES_SME_AGENCY_COORDINATION"],
    restrictions: ["Screening, contamination, exposure, registration, and medical referral retain distinct meanings."],
  },
  {
    domain: "RADIOLOGICAL_PROTECTIVE_ACTION",
    orderedSourceFamilies: ["EPA_PAG", "FEMA_NUCLEAR_RESPONSE", "CDC_RADIATION_POPULATION_MONITORING", "REMM", "FEDERAL_RAD_SUPPORT", "EPA_NRT_QRG"],
    allowedFactKinds: ["SOURCE_DERIVED_FACT", "SOURCE_DERIVED_COORDINATION_GUIDANCE", "REQUIRES_FIELD_MEASUREMENT", "REQUIRES_SME_AGENCY_COORDINATION"],
    restrictions: ["Exposure and contamination remain distinct concepts.", "Protective-action decisions require scenario context, measurements, and responsible authority."],
  },
  {
    domain: "NUCLEAR_DETONATION_COMMAND",
    orderedSourceFamilies: ["FEMA_NUCLEAR_RESPONSE", "EPA_NRT_QRG", "EPA_PAG", "CDC_RADIATION_POPULATION_MONITORING", "FEDERAL_RAD_SUPPORT"],
    allowedFactKinds: ["SOURCE_DERIVED_FACT", "SOURCE_DERIVED_COORDINATION_GUIDANCE", "REQUIRES_FIELD_MEASUREMENT", "REQUIRES_SME_AGENCY_COORDINATION"],
    restrictions: ["High-level doctrine is not converted into universal fixed distances or automatic protective-action decisions."],
  },
  {
    domain: "FEDERAL_COORDINATION",
    orderedSourceFamilies: ["FBI_PUBLIC_WMD", "FEMA_CBRNE_DOCTRINE", "FEDERAL_RAD_SUPPORT"],
    allowedFactKinds: ["SOURCE_DERIVED_COORDINATION_GUIDANCE", "REQUIRES_SME_AGENCY_COORDINATION"],
    restrictions: ["Only public coordination doctrine is represented; restricted threat-assessment procedures are excluded."],
  },
  {
    domain: "EXPLOSIVES_COORDINATION",
    orderedSourceFamilies: ["ATF_PUBLIC_EXPLOSIVES", "FBI_PUBLIC_WMD", "FEMA_NUCLEAR_RESPONSE"],
    allowedFactKinds: ["SOURCE_DERIVED_COORDINATION_GUIDANCE", "REQUIRES_SME_AGENCY_COORDINATION"],
    restrictions: ["BATS and other controlled law-enforcement systems are excluded.", "Public role descriptions do not create tactical render-safe procedures."],
  },
]);

export function sourcePrecedenceForDomain(domain: DomainSourcePrecedenceRule["domain"]) {
  return CBRNE_DOMAIN_SOURCE_PRECEDENCE.find((rule) => rule.domain === domain) ?? null;
}
