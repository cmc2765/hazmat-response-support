export interface ErgImportProvenance {
  sourceId?: string;
  revisionId?: string;
}

export interface NormalizedErgImportBundle {
  sources: Array<{ id: string; name: string; citation: string; license?: string }>;
  revisions: Array<{ id: string; sourceId: string; revisionLabel: string; publishedAt: string }>;
  guidebooks: Array<ErgImportProvenance & { id: string; countryCode: string; edition: string; title: string }>;
  materials: Array<ErgImportProvenance & { id: string; preferredName: string }>;
  unNaIdentifiers: Array<ErgImportProvenance & {
    id: string;
    identifierType: "UN" | "NA";
    identifierValue: string;
    countryCode: string;
  }>;
  materialIdentifiers: Array<ErgImportProvenance & {
    id: string;
    materialId: string;
    unNaIdentifierId: string;
    shippingName?: string;
  }>;
  guides: Array<ErgImportProvenance & { id: string; guidebookId: string; guideNumber: string; title: string }>;
  containers: Array<ErgImportProvenance & { id: string; name: string }>;
  windBands: Array<ErgImportProvenance & {
    id: string;
    name: string;
    minimumSpeedMph?: number;
    maximumSpeedMph?: number;
  }>;
  table1: Array<ErgImportProvenance & {
    id: string;
    materialIdentifierId: string;
    guideId: string;
    spillSize: "small" | "large";
    period: "day" | "night";
    initialIsolationFt: number;
    protectiveActionMi: number;
  }>;
  table2: Array<ErgImportProvenance & {
    id: string;
    materialIdentifierId: string;
    toxicGasProduced: string;
  }>;
  table3: Array<ErgImportProvenance & {
    id: string;
    materialIdentifierId: string;
    containerId: string;
    windBandId: string;
    period: "day" | "night";
    initialIsolationFt: number;
    protectiveActionMi: number;
  }>;
}

export interface NormalizedErgValidationIssue {
  severity: "warning" | "error";
  reason: string;
  table: keyof NormalizedErgImportBundle;
  rowId: string;
  message: string;
}

export interface NormalizedErgValidationReport {
  importedRowsByTable: Record<keyof NormalizedErgImportBundle, number>;
  rejectedRowsByReason: Record<string, number>;
  warningCount: number;
  errorCount: number;
  coverageSummary: {
    materials: number;
    materialsWithIdentifiers: number;
    materialIdentifierCoveragePercent: number;
    unNaIdentifiers: number;
    table1Identifiers: number;
    table2Identifiers: number;
    table3Identifiers: number;
  };
  issues: NormalizedErgValidationIssue[];
  valid: boolean;
}

const tableNames: Array<keyof NormalizedErgImportBundle> = [
  "sources",
  "revisions",
  "guidebooks",
  "materials",
  "unNaIdentifiers",
  "materialIdentifiers",
  "guides",
  "containers",
  "windBands",
  "table1",
  "table2",
  "table3",
];

export function validateNormalizedErgImport(bundle: NormalizedErgImportBundle): NormalizedErgValidationReport {
  const issues: NormalizedErgValidationIssue[] = [];
  const rejectedRowsByReason: Record<string, number> = {};
  const issue = (
    severity: NormalizedErgValidationIssue["severity"],
    reason: string,
    table: keyof NormalizedErgImportBundle,
    rowId: string,
    message: string,
  ) => {
    issues.push({ severity, reason, table, rowId, message });
    rejectedRowsByReason[reason] = (rejectedRowsByReason[reason] ?? 0) + 1;
  };

  const sources = new Set(bundle.sources.map((row) => row.id));
  const revisions = new Set(bundle.revisions.map((row) => row.id));
  const guidebooks = new Set(bundle.guidebooks.map((row) => row.id));
  const materials = new Set(bundle.materials.map((row) => row.id));
  const unNaIdentifiers = new Set(bundle.unNaIdentifiers.map((row) => row.id));
  const materialIdentifiers = new Set(bundle.materialIdentifiers.map((row) => row.id));
  const guides = new Set(bundle.guides.map((row) => row.id));
  const containers = new Set(bundle.containers.map((row) => row.id));
  const windBands = new Set(bundle.windBands.map((row) => row.id));

  bundle.sources.forEach((row) => {
    if (!row.name.trim() || !row.citation.trim()) {
      issue("error", "incomplete-source", "sources", row.id, "Source name and citation are required.");
    }
    if (!row.license?.trim()) {
      issue("warning", "missing-source-license", "sources", row.id, "Source license or permission status requires review.");
    }
  });
  bundle.revisions.forEach((row) => {
    if (!sources.has(row.sourceId)) {
      issue("error", "orphaned-revision-source", "revisions", row.id, `Unknown source ${row.sourceId}.`);
    }
    if (!row.revisionLabel.trim() || !row.publishedAt.trim()) {
      issue("error", "incomplete-revision", "revisions", row.id, "Revision label and publication date are required.");
    }
  });

  const provenanceRows = tableNames
    .filter((name) => !["sources", "revisions"].includes(name))
    .flatMap((name) => bundle[name].map((row) => ({ table: name, row })));
  provenanceRows.forEach(({ table, row }) => {
    const record = row as ErgImportProvenance & { id: string };
    if (!record.sourceId || !sources.has(record.sourceId)) {
      issue("error", "missing-or-invalid-source", table, record.id, "A valid source reference is required.");
    }
    if (!record.revisionId || !revisions.has(record.revisionId)) {
      issue("error", "missing-or-invalid-revision", table, record.id, "A valid revision reference is required.");
    }
  });

  bundle.materials.forEach((row) => {
    if (!row.preferredName.trim()) {
      issue("error", "missing-material-name", "materials", row.id, "Material preferred name is required.");
    }
  });
  const seenTransportationIdentifiers = new Set<string>();
  bundle.unNaIdentifiers.forEach((row) => {
    const key = `${row.identifierType}:${row.identifierValue}:${row.countryCode}`.toUpperCase();
    if (seenTransportationIdentifiers.has(key)) {
      issue("error", "duplicate-un-na-identifier", "unNaIdentifiers", row.id, `Duplicate transportation identifier ${key}.`);
    }
    seenTransportationIdentifiers.add(key);
    if (!/^\d{4}$/.test(row.identifierValue)) {
      issue("error", "invalid-un-na-format", "unNaIdentifiers", row.id, "UN/NA identifier must contain four digits.");
    }
  });
  bundle.materialIdentifiers.forEach((row) => {
    if (!materials.has(row.materialId)) {
      issue("error", "orphaned-material-identifier", "materialIdentifiers", row.id, `Unknown material ${row.materialId}.`);
    }
    if (!unNaIdentifiers.has(row.unNaIdentifierId)) {
      issue("error", "invalid-identifier-reference", "materialIdentifiers", row.id, `Unknown identifier ${row.unNaIdentifierId}.`);
    }
  });
  bundle.guides.forEach((row) => {
    if (!row.guideNumber.trim()) {
      issue("error", "missing-guide-number", "guides", row.id, "Guide number is required.");
    }
    if (!guidebooks.has(row.guidebookId)) {
      issue("error", "orphaned-guide-reference", "guides", row.id, `Unknown guidebook ${row.guidebookId}.`);
    }
  });
  bundle.table1.forEach((row) => {
    if (!materialIdentifiers.has(row.materialIdentifierId)) {
      issue("error", "invalid-table-reference", "table1", row.id, `Unknown material identifier ${row.materialIdentifierId}.`);
    }
    if (!guides.has(row.guideId)) {
      issue("error", "orphaned-guide-reference", "table1", row.id, `Unknown guide ${row.guideId}.`);
    }
  });
  bundle.table2.forEach((row) => {
    if (!materialIdentifiers.has(row.materialIdentifierId)) {
      issue("error", "invalid-table-reference", "table2", row.id, `Unknown material identifier ${row.materialIdentifierId}.`);
    }
    if (!row.toxicGasProduced.trim()) {
      issue("error", "missing-table-2-product", "table2", row.id, "Table 2 toxic gas product is required.");
    }
  });
  bundle.table3.forEach((row) => {
    if (!materialIdentifiers.has(row.materialIdentifierId)) {
      issue("error", "invalid-table-reference", "table3", row.id, `Unknown material identifier ${row.materialIdentifierId}.`);
    }
    if (!containers.has(row.containerId)) {
      issue("error", "invalid-container-reference", "table3", row.id, `Unknown container ${row.containerId}.`);
    }
    if (!windBands.has(row.windBandId)) {
      issue("error", "invalid-wind-band-reference", "table3", row.id, `Unknown wind band ${row.windBandId}.`);
    }
  });

  const identifiedMaterials = new Set(bundle.materialIdentifiers
    .filter((row) => materials.has(row.materialId) && unNaIdentifiers.has(row.unNaIdentifierId))
    .map((row) => row.materialId));
  const tableIdentifierCount = (rows: Array<{ materialIdentifierId: string }>) =>
    new Set(rows.filter((row) => materialIdentifiers.has(row.materialIdentifierId)).map((row) => row.materialIdentifierId)).size;
  const importedRowsByTable = Object.fromEntries(
    tableNames.map((name) => [name, bundle[name].length]),
  ) as Record<keyof NormalizedErgImportBundle, number>;
  const warningCount = issues.filter((entry) => entry.severity === "warning").length;
  const errorCount = issues.filter((entry) => entry.severity === "error").length;
  return {
    importedRowsByTable,
    rejectedRowsByReason,
    warningCount,
    errorCount,
    coverageSummary: {
      materials: bundle.materials.length,
      materialsWithIdentifiers: identifiedMaterials.size,
      materialIdentifierCoveragePercent: bundle.materials.length
        ? Number(((identifiedMaterials.size / bundle.materials.length) * 100).toFixed(2))
        : 0,
      unNaIdentifiers: bundle.unNaIdentifiers.length,
      table1Identifiers: tableIdentifierCount(bundle.table1),
      table2Identifiers: tableIdentifierCount(bundle.table2),
      table3Identifiers: tableIdentifierCount(bundle.table3),
    },
    issues,
    valid: errorCount === 0,
  };
}
