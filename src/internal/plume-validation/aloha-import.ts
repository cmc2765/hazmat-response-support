// Developer-only inspection of imported ALOHA benchmark artifacts.
export const ALOHA_IMPORT_STATUSES = ["Not Configured", "Ready", "Imported"] as const;
export type AlohaImportStatus = typeof ALOHA_IMPORT_STATUSES[number];

export interface AlohaImportInput {
  fileName?: string | null;
  format?: "TXT" | "KML" | "KMZ" | "GeoJSON" | null;
  officialAlohaSourceConfirmed?: boolean;
  geometryAvailable?: boolean;
  summaryTextAvailable?: boolean;
}

export interface AlohaImportResult {
  status: AlohaImportStatus;
  display: string;
  imported: boolean;
  officialAlohaSourceConfirmed: boolean;
  geometryAvailable: boolean;
  limitations: string[];
}

export function inspectAlohaImport(input: AlohaImportInput = {}): AlohaImportResult {
  const hasContent = Boolean(input.fileName || input.geometryAvailable || input.summaryTextAvailable);
  const official = input.officialAlohaSourceConfirmed === true;
  const imported = hasContent && official && Boolean(input.geometryAvailable || input.summaryTextAvailable);
  return {
    status: imported ? "Imported" : hasContent ? "Ready" : "Not Configured",
    display: imported ? "Official ALOHA Output Imported" : `Official ALOHA Import: ${hasContent ? "Ready" : "Not Configured"}`,
    imported,
    officialAlohaSourceConfirmed: official,
    geometryAvailable: input.geometryAvailable === true,
    limitations: [
      !official ? "The operator has not confirmed that the content is official ALOHA output." : "",
      !input.geometryAvailable ? "No imported ALOHA geometry is available for map display." : "",
      "HazMatIQ displays imported output and does not recalculate or validate ALOHA results.",
    ].filter(Boolean),
  };
}
