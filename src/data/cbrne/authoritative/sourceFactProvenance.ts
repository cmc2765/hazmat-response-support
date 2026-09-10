import type { CbrneNormalizedImportPackage } from "../../../lib/cbrne/cbrneImportTypes.js";
import { findSourceArtifact } from "./sourceArtifacts.js";

const PACKAGE_ARTIFACTS: Readonly<Record<string, string>> = Object.freeze({
  "nrt-anthrax-qrg-2022": "nrt-qrg-biological-anthrax",
  "niosh-ersh-vx-card": "niosh-ersh-vx",
  "niosh-ersh-sarin-card": "niosh-ersh-sarin",
  "niosh-ersh-sulfur-mustard-card": "niosh-ersh-sulfur-mustard",
  "niosh-ersh-ricin-card": "niosh-ersh-ricin",
  "chemm-nerve-agent-toxidrome": "chemm-nerve-agents",
  "opcw-schedule-1-identities": "opcw-schedule-1",
  "remm-radiation-ppe": "remm-radiation-ppe",
  "remm-radiation-survey": "remm-howtosurvey",
  "remm-external-contamination-decon": "remm-ext-contamination",
  "epa-pag-response-framework": "epa-pag-2017",
});

const NUCLIDE_ARTIFACTS: Readonly<Record<string, string>> = Object.freeze({
  "cesium-137": "nndc-137cs-identity",
  "cobalt-60": "nndc-60co-identity",
  "iridium-192": "nndc-192ir-identity",
  "americium-241": "nndc-241am-identity",
  "strontium-90": "nndc-90sr-identity",
  "iodine-131": "nndc-131i-identity",
  "radium-226": "nndc-226ra-identity",
  "uranium-235": "nndc-235u-identity",
  "uranium-238": "nndc-238u-identity",
  "plutonium-239": "nndc-239pu-identity",
});

export function sourceArtifactIdForImport(packageData: CbrneNormalizedImportPackage, recordId: string) {
  if (packageData.packageId === "nndc-priority-nuclide-identities") return NUCLIDE_ARTIFACTS[recordId] ?? null;
  return PACKAGE_ARTIFACTS[packageData.packageId] ?? null;
}

export function sourceFactProvenanceForImport(packageData: CbrneNormalizedImportPackage, recordId: string) {
  const sourceArtifactId = sourceArtifactIdForImport(packageData, recordId);
  const artifact = sourceArtifactId ? findSourceArtifact(sourceArtifactId) : null;
  if (!artifact || artifact.currentStatus !== "ACQUIRED") return null;
  return {
    sourceArtifactId,
    sourceUrl: artifact.officialUrl,
    extractionMethod: artifact.artifactType === "JSON_API" ? "STRUCTURED_API" as const
      : artifact.artifactType === "WEB_PAGE" ? "WEB_PAGE_REVIEW" as const
        : "DOCUMENT_REVIEW" as const,
    detailedReviewStatus: "SOURCE_IMPORTED_PENDING_REVIEW" as const,
  };
}
