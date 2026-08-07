export const linkageCategories = [
  "chemical-linkable",
  "mixture/product-name",
  "synonym/alias",
  "generic-class",
  "transportation-only-identifier",
  "duplicate/format-variant",
  "deprecated/obsolete",
  "non-chemical-administrative-entry",
  "unknown/requires-review",
] as const;

export type LinkageCategory = typeof linkageCategories[number];

export interface TransportationSourceRelationship {
  shippingNameId: number;
  unNaSourceId: number;
  properShippingName: string;
  guideId: number;
  guideNumber: string;
  guideBookId: number;
  guideBookVersion: string;
  country: string;
}

export interface UnlinkedTransportationIdentifier {
  sourceId: string;
  identifier: string;
  shippingName?: string;
  category: LinkageCategory;
  resolution: "linked" | "not-linkable" | "requires review";
  linkedChemicalId?: string;
  evidence?: string;
  sourceRelationships?: TransportationSourceRelationship[];
}

export interface LinkageCoverageSnapshot {
  auditDate: string;
  sourceDatabase: string;
  totalSourceIdentifiers: number;
  importedIdentifiers: number;
  unlinkedIdentifiers: number;
  categorizedIdentifiers: number;
  chemicalLinkableTargets: number;
  resolvedIdentifiers: number;
  unresolvedIdentifiers: number;
  percentCoverage: number;
  categoryCounts: Record<LinkageCategory, number>;
  unlinkedInventoryComplete: boolean;
  unlinkedRecords: UnlinkedTransportationIdentifier[];
  notes: string[];
}

export interface LinkageCoverageValidation {
  valid: boolean;
  readyForEnforcement: boolean;
  errors: string[];
  warnings: string[];
  calculatedPercentCoverage: number;
  sourceIdentifiersOutsideCurrentMetrics: number;
}

export function validateLinkageCoverage(snapshot: LinkageCoverageSnapshot): LinkageCoverageValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const countFields: Array<keyof Pick<LinkageCoverageSnapshot,
    | "totalSourceIdentifiers"
    | "importedIdentifiers"
    | "unlinkedIdentifiers"
    | "categorizedIdentifiers"
    | "chemicalLinkableTargets"
    | "resolvedIdentifiers"
    | "unresolvedIdentifiers">> = [
      "totalSourceIdentifiers",
      "importedIdentifiers",
      "unlinkedIdentifiers",
      "categorizedIdentifiers",
      "chemicalLinkableTargets",
      "resolvedIdentifiers",
      "unresolvedIdentifiers",
    ];
  countFields.forEach((field) => {
    if (!Number.isInteger(snapshot[field]) || snapshot[field] < 0) errors.push(`${field} must be a non-negative integer.`);
  });

  const calculatedPercentCoverage = snapshot.totalSourceIdentifiers
    ? Number(((snapshot.importedIdentifiers / snapshot.totalSourceIdentifiers) * 100).toFixed(2))
    : 0;
  if (Math.abs(calculatedPercentCoverage - snapshot.percentCoverage) > 0.01) {
    errors.push(`percentCoverage must equal ${calculatedPercentCoverage}.`);
  }
  if (snapshot.categorizedIdentifiers > snapshot.unlinkedIdentifiers) {
    errors.push("categorizedIdentifiers cannot exceed unlinkedIdentifiers.");
  }
  if (snapshot.chemicalLinkableTargets > snapshot.unlinkedIdentifiers) {
    errors.push("chemicalLinkableTargets cannot exceed unlinkedIdentifiers.");
  }
  const categoryTotal = linkageCategories.reduce(
    (total, category) => total + snapshot.categoryCounts[category],
    0,
  );
  const reviewedCategoryTotal = categoryTotal
    - snapshot.categoryCounts["unknown/requires-review"];
  if (categoryTotal !== snapshot.unlinkedIdentifiers) {
    errors.push(
      `Category counts must retain all ${snapshot.unlinkedIdentifiers} unlinked identifiers; found ${categoryTotal}.`,
    );
  }
  if (reviewedCategoryTotal !== snapshot.categorizedIdentifiers) {
    errors.push(`categorizedIdentifiers must equal reviewed category counts (${reviewedCategoryTotal}).`);
  }
  if (snapshot.categoryCounts["chemical-linkable"] !== snapshot.chemicalLinkableTargets) {
    errors.push("chemicalLinkableTargets must equal the chemical-linkable category count.");
  }

  const sourceIdentifiersOutsideCurrentMetrics = Math.max(
    0,
    snapshot.totalSourceIdentifiers - snapshot.importedIdentifiers - snapshot.unlinkedIdentifiers,
  );
  if (sourceIdentifiersOutsideCurrentMetrics > 0) {
    warnings.push(
      `${sourceIdentifiersOutsideCurrentMetrics} source identifier rows are outside the current imported/unlinked metrics; reconcile source populations before treating coverage as complete.`,
    );
  }

  const knownCategories = new Set<string>(linkageCategories);
  const sourceIds = new Set<string>();
  const recordCategoryCounts = Object.fromEntries(
    linkageCategories.map((category) => [category, 0]),
  ) as Record<LinkageCategory, number>;
  snapshot.unlinkedRecords.forEach((record) => {
    if (!knownCategories.has(record.category)) errors.push(`Unknown category for ${record.sourceId}.`);
    if (sourceIds.has(record.sourceId)) errors.push(`Duplicate unlinked sourceId ${record.sourceId}.`);
    sourceIds.add(record.sourceId);
    recordCategoryCounts[record.category] += 1;
    if (record.category === "unknown/requires-review" && record.resolution !== "requires review") {
      errors.push(`${record.sourceId} must remain marked requires review.`);
    }
    if (record.resolution === "linked" && !record.linkedChemicalId) {
      errors.push(`${record.sourceId} is marked linked without a linkedChemicalId.`);
    }
    if (record.resolution !== "requires review" && !record.evidence?.trim()) {
      errors.push(`${record.sourceId} requires evidence before it can be resolved.`);
    }
    if (snapshot.unlinkedInventoryComplete && !record.sourceRelationships?.length) {
      errors.push(`${record.sourceId} is missing source relationship evidence.`);
    }
  });

  if (snapshot.unlinkedInventoryComplete && snapshot.unlinkedRecords.length !== snapshot.unlinkedIdentifiers) {
    errors.push(
      `Complete unlinked inventory must contain ${snapshot.unlinkedIdentifiers} records; found ${snapshot.unlinkedRecords.length}.`,
    );
  }
  if (snapshot.unlinkedInventoryComplete) {
    linkageCategories.forEach((category) => {
      if (recordCategoryCounts[category] !== snapshot.categoryCounts[category]) {
        errors.push(
          `${category} category count is ${snapshot.categoryCounts[category]}, but the complete inventory contains ${recordCategoryCounts[category]}.`,
        );
      }
    });
  }
  if (!snapshot.unlinkedInventoryComplete) {
    warnings.push(
      "Individual unlinked transportation identifiers have not been exported into the review inventory; future imports must not discard them.",
    );
  }
  const unknownCount = snapshot.categoryCounts["unknown/requires-review"];
  if (unknownCount > 0) {
    warnings.push(`${unknownCount} exported identifiers still require human review.`);
  }

  return {
    valid: errors.length === 0,
    readyForEnforcement: errors.length === 0
      && snapshot.unlinkedInventoryComplete
      && unknownCount === 0
      && sourceIdentifiersOutsideCurrentMetrics === 0,
    errors,
    warnings,
    calculatedPercentCoverage,
    sourceIdentifiersOutsideCurrentMetrics,
  };
}
