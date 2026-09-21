import type { CbrneImportRecord, CbrneNormalizedImportPackage } from "./cbrneImportTypes.js";
import type { CbrneSourceFact } from "./cbrneTypes.js";
import { sourceFactProvenanceForImport } from "../../data/cbrne/authoritative/sourceFactProvenance.js";

function slug(value: string) {
  return value.toLocaleLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const NON_TACTICAL_GROUPS = new Set(["IDENTITY", "SOURCES", "LIMITATIONS"]);

export function normalizeCbrneSourceFacts(
  packageData: CbrneNormalizedImportPackage,
  record: CbrneImportRecord,
  recordId: string,
): CbrneSourceFact[] {
  const provenance = sourceFactProvenanceForImport(packageData, recordId);
  return record.sourceFacts.map((fact, index) => {
    const isMissing = fact.value === null && fact.verificationStatus === "No Current Data Exists";
    const isTactical = !NON_TACTICAL_GROUPS.has(fact.fieldGroup);
    return {
      ...fact,
      id: `${slug(packageData.packageId)}-${slug(recordId)}-${slug(fact.fieldName)}-${index + 1}`,
      recordId,
      sourceRegistryId: packageData.sourceRegistryId,
      sourceName: fact.sourceName || packageData.sourceName,
      sourceDocumentTitle: fact.sourceDocumentTitle || packageData.sourceDocumentTitle,
      sourceUrl: fact.sourceUrl || packageData.sourceUrl,
      sourceArtifactId: provenance?.sourceArtifactId,
      sourceLocator: fact.sourcePage,
      extractionMethod: provenance?.extractionMethod,
      detailedReviewStatus: provenance?.detailedReviewStatus,
      factKind: isMissing ? "UNVERIFIED_NOT_AVAILABLE" : "SOURCE_DERIVED_FACT",
      limitations: fact.notes ? [fact.notes] : [],
      sourceDate: fact.sourceDate || packageData.sourceDate,
      verificationStatus: isMissing
        ? "No Current Data Exists"
        : isTactical || fact.sourceName === "Manual Review"
          ? "Requires SME Review"
          : "Source Imported",
    };
  });
}
