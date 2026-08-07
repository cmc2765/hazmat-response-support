export const CRITICAL_PROVENANCE_FIELDS = [
  "chemical-identity",
  "cas-identifier",
  "un-na-identifier",
  "erg-guide",
  "erg-distance",
  "ppe-suit",
  "medical",
  "protective-action",
] as const;

export type CriticalProvenanceField = typeof CRITICAL_PROVENANCE_FIELDS[number];

export interface ProvenanceDataset {
  id: string;
  path: string;
  fields: CriticalProvenanceField[];
  sourceCitation: string | null;
  revision: string | null;
  licenseOrPermission: string | null;
  sha256: string | null;
  reviewState: "approved" | "requires-review" | "blocked";
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes?: string[];
}

export interface ProvenanceManifest {
  manifestVersion: string;
  generatedAt: string;
  datasets: ProvenanceDataset[];
}

export function validateProvenanceManifest(manifest: ProvenanceManifest) {
  const errors: string[] = [];
  const blockers: string[] = [];
  if (!/^\d+\.\d+\.\d+$/.test(manifest.manifestVersion)) errors.push("manifestVersion must use semantic versioning.");
  const ids = new Set<string>();
  for (const dataset of manifest.datasets) {
    if (!dataset.id.trim() || ids.has(dataset.id)) errors.push(`Dataset id ${dataset.id || "<empty>"} must be unique.`);
    ids.add(dataset.id);
    if (!dataset.path.trim()) errors.push(`${dataset.id} is missing a repository path.`);
    if (!dataset.fields.length) errors.push(`${dataset.id} does not declare field coverage.`);
    for (const property of ["sourceCitation", "revision", "licenseOrPermission", "sha256"] as const) {
      if (!dataset[property]?.trim()) blockers.push(`${dataset.id} requires ${property}.`);
    }
    if (dataset.reviewState !== "approved" || !dataset.reviewedBy || !dataset.reviewedAt) {
      blockers.push(`${dataset.id} has not received attributable approval.`);
    }
  }
  for (const field of CRITICAL_PROVENANCE_FIELDS) {
    if (!manifest.datasets.some((dataset) => dataset.fields.includes(field))) blockers.push(`No dataset covers ${field}.`);
  }
  return { valid: errors.length === 0, releaseReady: errors.length === 0 && blockers.length === 0, errors, blockers };
}
