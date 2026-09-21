import artifacts from "./generated-source-artifacts.json";
import type { SourceArtifact } from "../../../lib/cbrne/authoritativeSourceTypes.js";

export const CBRNE_SOURCE_ARTIFACTS: readonly SourceArtifact[] = Object.freeze(artifacts as SourceArtifact[]);

export function findSourceArtifact(sourceArtifactId: string) {
  return CBRNE_SOURCE_ARTIFACTS.find((artifact) => artifact.sourceArtifactId === sourceArtifactId) ?? null;
}

export const CBRNE_ACQUIRED_SOURCE_ARTIFACTS = Object.freeze(CBRNE_SOURCE_ARTIFACTS.filter((artifact) => artifact.currentStatus === "ACQUIRED"));
