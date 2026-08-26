import { safetyLimitationsForDomain } from "./cbrneSafetyGates.js";
import type {
  CbrneActionCard,
  CbrneFieldGroup,
  CbrneMasterRecord,
  CbrneProfile,
  CbrneSourceFact,
} from "./cbrneTypes.js";
import { domainsForCbrneLane, type CbrneSearchLane } from "./searchCbrneRecords.js";
import { hydrateCbrneDatabase } from "./hydrateCbrneDatabase.js";

const SECTION_GROUPS = Object.freeze({
  overviewFacts: ["IDENTITY"] as readonly CbrneFieldGroup[],
  hazardFacts: ["HAZARDS", "SYMPTOMS"] as readonly CbrneFieldGroup[],
  detectionFacts: ["DETECTION", "RADIOLOGICAL_SURVEY"] as readonly CbrneFieldGroup[],
  ppeFacts: ["PPE"] as readonly CbrneFieldGroup[],
  isolationStandoffFacts: ["ISOLATION_STANDOFF", "PROTECTIVE_ACTION"] as readonly CbrneFieldGroup[],
  deconFacts: ["DECON"] as readonly CbrneFieldGroup[],
  medicalFacts: ["MEDICAL"] as readonly CbrneFieldGroup[],
  technicalOperationsFacts: ["TECHNICAL_OPERATIONS", "LIMITATIONS"] as readonly CbrneFieldGroup[],
});

function missingFact(recordId: string, fieldName: string, notes: string): CbrneSourceFact {
  return {
    id: `${recordId}-missing-${fieldName.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    recordId,
    sourceRegistryId: "MANUAL_REVIEW",
    sourceName: "Manual Review",
    sourceDocumentTitle: "No imported authoritative source fact",
    fieldGroup: "LIMITATIONS",
    fieldName,
    value: null,
    verificationStatus: "No Current Data Exists",
    notes,
  };
}

function factsForSection(
  record: CbrneMasterRecord,
  facts: readonly CbrneSourceFact[],
  groups: readonly CbrneFieldGroup[],
  label: string,
) {
  const matches = facts.filter((fact) => groups.includes(fact.fieldGroup));
  return matches.length ? matches : [missingFact(record.id, label, "No authoritative source fact has been imported for this section.")];
}

function actionCard(title: string, facts: readonly CbrneSourceFact[]): CbrneActionCard {
  const available = facts.filter((fact) => fact.value !== null);
  const verified = available.length > 0 && available.every((fact) => fact.verificationStatus === "Verified");
  return {
    title,
    status: !available.length ? "No Current Data Exists" : verified ? "Source Backed" : "Requires SME Review",
    summary: !available.length
      ? "No Current Data Exists"
      : `Review ${available.length} source-backed fact${available.length === 1 ? "" : "s"} and fact-level verification status.`,
  };
}

function actionTitles(record: CbrneMasterRecord) {
  if (record.id === "anthrax") return [
    "Identify / Verify Biological Threat",
    "Isolate Suspected Area",
    "PPE / Respiratory",
    "Sampling / Detection Coordination",
    "Decon / Contamination Control",
    "Medical / Public Health Notification",
    "Evidence / Chain of Custody",
    "Report / Export",
  ];
  return [
    "Identify / Verify", "Isolate / Deny Entry", "PPE / Respiratory", "Detection / Monitoring",
    "Decon", "Medical / EMS", "Notifications", "Report / Export",
  ];
}

export function adaptCbrneProfile(
  record: CbrneMasterRecord,
  facts: readonly CbrneSourceFact[] = hydrateCbrneDatabase().sourceFacts.filter((fact) => fact.recordId === record.id),
  lane?: CbrneSearchLane,
): CbrneProfile {
  const selectedLane = lane ?? (record.domain === "RADIOLOGICAL" || record.domain === "NUCLEAR" || record.category === "RADIOLOGICAL_DISPERSAL_DEVICE"
    ? "RADIOLOGICAL"
    : "CBRNE_CWA");
  const sections = {
    overviewFacts: factsForSection(record, facts, SECTION_GROUPS.overviewFacts, "Overview"),
    hazardFacts: factsForSection(record, facts, SECTION_GROUPS.hazardFacts, "Hazards"),
    detectionFacts: factsForSection(record, facts, SECTION_GROUPS.detectionFacts, selectedLane === "RADIOLOGICAL" ? "Detection / Survey" : "Detection / Recognition"),
    ppeFacts: factsForSection(record, facts, SECTION_GROUPS.ppeFacts, selectedLane === "RADIOLOGICAL" ? "PPE / Contamination Control" : "PPE"),
    isolationStandoffFacts: factsForSection(record, facts, SECTION_GROUPS.isolationStandoffFacts, selectedLane === "RADIOLOGICAL" ? "Isolation / Standoff / Dose-Rate" : "Isolation / Standoff"),
    deconFacts: factsForSection(record, facts, SECTION_GROUPS.deconFacts, "Decon"),
    medicalFacts: factsForSection(record, facts, SECTION_GROUPS.medicalFacts, selectedLane === "RADIOLOGICAL" ? "Medical / Radiation EMS" : "Medical / EMS"),
    technicalOperationsFacts: factsForSection(record, facts, SECTION_GROUPS.technicalOperationsFacts, "Technical Operations"),
  };
  const actionSources = [
    sections.overviewFacts,
    sections.isolationStandoffFacts,
    sections.ppeFacts,
    sections.detectionFacts,
    sections.deconFacts,
    sections.medicalFacts,
    sections.technicalOperationsFacts,
    facts,
  ];
  const sourceFacts = facts.length
    ? [...facts]
    : [missingFact(record.id, "Sources", "No authoritative source facts have been imported for this starter identity.")];
  const sectionFactGroups = Object.values(sections);
  const missingFieldCount = sectionFactGroups.filter((sectionFacts) => sectionFacts.every((fact) => fact.value === null)).length;
  const availableFacts = facts.filter((fact) => fact.value !== null);
  const sourceNames = [...new Set(availableFacts.map((fact) => fact.sourceName))];
  const requiresSmeReviewCount = availableFacts.filter((fact) => fact.verificationStatus === "Requires SME Review").length;
  const conflictingSourcesCount = availableFacts.filter((fact) => fact.verificationStatus === "Conflicting Sources").length;
  const dataStatusBadges = [...new Set([
    ...availableFacts.map((fact) => fact.verificationStatus),
    ...(missingFieldCount ? ["No Current Data Exists" as const] : []),
  ])];
  const database = hydrateCbrneDatabase();
  const profileVerificationStatus = availableFacts.some((fact) => fact.verificationStatus === "Conflicting Sources")
    ? "Conflicting Sources"
    : requiresSmeReviewCount
      ? "Requires SME Review"
      : availableFacts.length
        ? "Source Imported"
        : "No Current Data Exists";
  return {
    id: record.id,
    lane: selectedLane,
    domain: record.domain,
    displayName: record.displayName,
    scientificName: record.scientificName,
    category: record.category,
    verificationStatus: profileVerificationStatus,
    identifiers: {
      scientificName: record.scientificName ?? null,
      aliases: [...new Set([...record.commonNames, ...record.aliases])],
      agentCodes: record.agentCodes ?? [],
      cas: record.cas ?? [],
      unNaNumbers: record.unNaNumbers ?? [],
      radionuclideSymbol: record.radionuclideSymbol ?? null,
      isotopeMassNumber: record.isotopeMassNumber ?? null,
      opcwSchedule: record.opcwSchedule ?? null,
    },
    ...sections,
    sourceFacts,
    actionCards: actionTitles(record).map((title, index) => actionCard(title, actionSources[index])),
    limitations: [...safetyLimitationsForDomain(record.domain)],
    dataStatusBadges,
    sourceStatus: {
      sourcePacksLoaded: database.importReports.filter((report) => report.valid && report.recordIds.includes(record.id)).length,
      sourceFactCount: availableFacts.length,
      sourceNames,
      requiresSmeReviewCount,
      conflictingSourcesCount,
      missingFieldCount,
      lastImportUpdate: record.updatedAt,
      warnings: [...database.warnings],
    },
  };
}

export function cbrneProfileById(lane: CbrneSearchLane, id: string): CbrneProfile | null {
  const database = hydrateCbrneDatabase();
  const record = database.records.find((candidate) => candidate.id === id) ?? null;
  if (!record || !domainsForCbrneLane(lane).includes(record.domain)) return null;
  return adaptCbrneProfile(record, database.sourceFacts.filter((fact) => fact.recordId === record.id), lane);
}
