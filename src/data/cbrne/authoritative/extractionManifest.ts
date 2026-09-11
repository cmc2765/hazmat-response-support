import manifest from "./generated-extraction-manifest.json";
import type { CbrneExtractionCheckpoint, SourceArtifactExtractionManifest } from "../../../lib/cbrne/authoritativeSourceTypes.js";

type GeneratedExtractionManifest = {
  generatedFile: true;
  generatedBy: string;
  generatedAt: string;
  sourceArtifactCount: number;
  distinctAcquiredArtifactCount: number;
  checkpoint?: CbrneExtractionCheckpoint;
  manifest: SourceArtifactExtractionManifest[];
};

const generatedManifest = manifest as GeneratedExtractionManifest;

export const CBRNE_EXTRACTION_MANIFEST = Object.freeze(generatedManifest.manifest);
export const CBRNE_EXTRACTION_CHECKPOINT: CbrneExtractionCheckpoint = Object.freeze(generatedManifest.checkpoint ?? {
  status: "COMPLETE",
  completedArtifactCount: generatedManifest.manifest.length,
  lastCompletedArtifactId: generatedManifest.manifest.at(-1)?.sourceArtifactId ?? null,
});

export function extractionManifestForArtifact(sourceArtifactId: string) {
  return CBRNE_EXTRACTION_MANIFEST.find((item) => item.sourceArtifactId === sourceArtifactId) ?? null;
}

export function extractionManifestCounts() {
  const counts = new Map<string, number>();
  for (const item of CBRNE_EXTRACTION_MANIFEST) counts.set(item.extractionDisposition, (counts.get(item.extractionDisposition) ?? 0) + 1);
  return Object.fromEntries(counts.entries());
}
