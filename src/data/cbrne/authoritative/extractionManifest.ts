import manifest from "./generated-extraction-manifest.json";
import type { SourceArtifactExtractionManifest } from "../../../lib/cbrne/authoritativeSourceTypes.js";

type GeneratedExtractionManifest = {
  generatedFile: true;
  generatedBy: string;
  generatedAt: string;
  sourceArtifactCount: number;
  distinctAcquiredArtifactCount: number;
  manifest: SourceArtifactExtractionManifest[];
};

export const CBRNE_EXTRACTION_MANIFEST = Object.freeze((manifest as GeneratedExtractionManifest).manifest);

export function extractionManifestForArtifact(sourceArtifactId: string) {
  return CBRNE_EXTRACTION_MANIFEST.find((item) => item.sourceArtifactId === sourceArtifactId) ?? null;
}

export function extractionManifestCounts() {
  const counts = new Map<string, number>();
  for (const item of CBRNE_EXTRACTION_MANIFEST) counts.set(item.extractionDisposition, (counts.get(item.extractionDisposition) ?? 0) + 1);
  return Object.fromEntries(counts.entries());
}
