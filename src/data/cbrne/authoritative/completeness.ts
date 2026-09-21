import type { ManualAcquisitionQueueItem, SourceFamilyCompleteness } from "../../../lib/cbrne/authoritativeSourceTypes.js";
import { CBRNE_AUTHORITATIVE_SOURCE_FACTS } from "./authoritativeSourceFacts.js";
import { CBRNE_SOURCE_ARTIFACTS } from "./sourceArtifacts.js";

const INDEX_IDS = new Set([
  "epa-nrt-qrg-index", "nrt-biological-index", "nrt-chemical-index", "nrt-radiological-index", "chemm-index", "chemm-sitemap-index",
  "remm-index", "remm-sitemap-index", "epa-pag-index", "cdc-radiation-population-index", "nndc-ensdf-api-index",
  "opcw-handbook-index", "niosh-ersh-index", "niosh-ersh-agent-index", "fbi-terrorism-publications-index", "atf-tools-index",
]);

const families = [...new Set(CBRNE_SOURCE_ARTIFACTS.map((artifact) => artifact.sourceFamily))];

export const CBRNE_SOURCE_COMPLETENESS: readonly SourceFamilyCompleteness[] = Object.freeze(families.map((sourceFamily) => {
  const artifacts = CBRNE_SOURCE_ARTIFACTS.filter((artifact) => artifact.sourceFamily === sourceFamily);
  const current = artifacts.filter((artifact) => !["SUPERSEDED", "OUT_OF_SCOPE"].includes(artifact.currentStatus));
  return {
    sourceFamily,
    officialIndexDiscovered: artifacts.some((artifact) => INDEX_IDS.has(artifact.sourceArtifactId)) || artifacts.length > 0,
    officialChildArtifactsDiscovered: artifacts.filter((artifact) => !INDEX_IDS.has(artifact.sourceArtifactId)).length,
    currentArtifactsExpected: current.length,
    successfullyAcquired: artifacts.filter((artifact) => artifact.currentStatus === "ACQUIRED").length,
    successfullyHashed: artifacts.filter((artifact) => ["ACQUIRED", "DUPLICATE"].includes(artifact.currentStatus) && Boolean(artifact.sha256)).length,
    successfullyParsed: artifacts.filter((artifact) => ["ACQUIRED", "DUPLICATE"].includes(artifact.currentStatus) && artifact.parsed).length,
    factsImported: CBRNE_AUTHORITATIVE_SOURCE_FACTS.filter((fact) => fact.sourceFamily === sourceFamily).length,
    artifactsSuperseded: artifacts.filter((artifact) => artifact.currentStatus === "SUPERSEDED").length,
    artifactsIntentionallyExcluded: artifacts.filter((artifact) => artifact.currentStatus === "OUT_OF_SCOPE").length,
    artifactsRequiringManualAcquisition: artifacts.filter((artifact) => artifact.currentStatus === "MANUAL_ACQUISITION_REQUIRED").length,
    networkAccessFailures: artifacts.filter((artifact) => ["ACCESS_BLOCKED", "FAILED"].includes(artifact.currentStatus)).length,
    silentlySkipped: 0,
  };
}));

const MANUAL_DETAILS: Readonly<Record<string, Pick<ManualAcquisitionQueueItem, "expectedData" | "targetCanonicalRecords" | "priority">>> = Object.freeze({
  "nrt-qrg-chemical-methyl-isocyanate": { expectedData: ["current responder QRG", "document revision", "fact locators"], targetCanonicalRecords: ["methyl-isocyanate"], priority: "HIGH" },
  "nrt-qrg-biological-biotoxin-reference": { expectedData: ["current biotoxin reference PDF", "document revision", "fact locators"], targetCanonicalRecords: ["ricin", "abrin", "botulinum-toxin"], priority: "HIGH" },
  "nrt-qrg-biological-tick-borne-encephalitis": { expectedData: ["listed child QRG", "scientific identity", "document revision"], targetCanonicalRecords: ["tick-borne-encephalitis"], priority: "MEDIUM" },
  "chemm-offline-pwa-package": { expectedData: ["official offline application package", "version", "integrity metadata"], targetCanonicalRecords: ["sarin-gb", "vx", "fourth-generation-agents"], priority: "MEDIUM" },
  "chemm-nerve-agents": { expectedData: ["nerve-agent page content", "revision metadata", "medical fact locators"], targetCanonicalRecords: ["sarin-gb", "vx"], priority: "HIGH" },
  "chemm-nerve-agents-hospital": { expectedData: ["hospital nerve-agent page content", "revision metadata", "medical fact locators"], targetCanonicalRecords: ["sarin-gb", "vx"], priority: "HIGH" },
  "chemm-fga-medical-management": { expectedData: ["fourth-generation agent medical-management content", "revision metadata", "fact locators"], targetCanonicalRecords: ["fourth-generation-agents"], priority: "HIGH" },
  "chemm-medical-countermeasures": { expectedData: ["medical-countermeasure page content", "revision metadata", "fact locators"], targetCanonicalRecords: ["sarin-gb", "vx", "fourth-generation-agents"], priority: "HIGH" },
  "fbi-wmd-index": { expectedData: ["public WMD coordination page snapshot", "revision metadata"], targetCanonicalRecords: ["radiological-dispersal-device", "improvised-nuclear-device"], priority: "LOW" },
  "fbi-crimepi-domestic-2025": { expectedData: ["May 2025 public domestic Crim-Epi handbook", "document identifier", "coordination locators"], targetCanonicalRecords: ["anthrax", "plague", "tularemia", "smallpox", "viral-hemorrhagic-fever"], priority: "HIGH" },
});

export const CBRNE_MANUAL_ACQUISITION_QUEUE: readonly ManualAcquisitionQueueItem[] = Object.freeze(CBRNE_SOURCE_ARTIFACTS
  .filter((artifact) => ["MANUAL_ACQUISITION_REQUIRED", "ACCESS_BLOCKED", "FAILED", "DUPLICATE"].includes(artifact.currentStatus))
  .map((artifact) => {
    const details = MANUAL_DETAILS[artifact.sourceArtifactId];
    if (!details) throw new Error(`Missing manual acquisition queue details for ${artifact.sourceArtifactId}`);
    return {
      sourceArtifactId: artifact.sourceArtifactId,
      agency: artifact.agency,
      title: artifact.title,
      officialUrl: artifact.officialUrl,
      reasonAutomationFailed: artifact.failureReason ?? artifact.notes ?? artifact.currentStatus,
      expectedArtifactType: artifact.artifactType,
      ...details,
    };
  }));
