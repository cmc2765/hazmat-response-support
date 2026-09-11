import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { SourceArtifact, SourceArtifactCandidate } from "./authoritativeSourceTypes.js";

const OFFICIAL_DOMAINS = [
  "epa.gov", "nrt.org", "hhs.gov", "cdc.gov", "fema.gov", "bnl.gov", "opcw.org",
  "fbi.gov", "atf.gov", "nrc.gov", "energy.gov", "frmac.gov",
] as const;

export function isApprovedOfficialDomain(hostname: string) {
  const normalized = hostname.toLocaleLowerCase();
  return OFFICIAL_DOMAINS.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
}

export function validateSourceArtifactCandidate(candidate: SourceArtifactCandidate) {
  const errors: string[] = [];
  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(candidate.officialUrl);
  } catch {
    errors.push("officialUrl must be a valid absolute URL");
  }
  if (parsedUrl?.protocol !== "https:") errors.push("officialUrl must use HTTPS");
  if (parsedUrl && parsedUrl.hostname !== candidate.officialDomain) errors.push("officialDomain must match officialUrl hostname");
  if (parsedUrl && !isApprovedOfficialDomain(parsedUrl.hostname)) errors.push("officialUrl must use an approved first-party domain");
  if (!candidate.sourceArtifactId.trim()) errors.push("sourceArtifactId is required");
  if (!candidate.agency.trim()) errors.push("agency is required");
  if (!candidate.sourceFamily.trim()) errors.push("sourceFamily is required");
  if (!candidate.title.trim()) errors.push("title is required");
  if (candidate.acquisitionMethod !== "MANUAL_ONLY" && !candidate.localSnapshotPath) errors.push("acquired candidates require localSnapshotPath");
  return errors;
}

export function sha256File(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function validateArtifactIntegrity(artifact: SourceArtifact, repositoryRoot: string) {
  const errors: string[] = [];
  if (artifact.currentStatus !== "ACQUIRED" && artifact.currentStatus !== "DUPLICATE") return errors;
  if (!artifact.localSnapshotPath || !artifact.sha256 || !artifact.contentType || !artifact.fileSize) {
    errors.push(`${artifact.sourceArtifactId} is missing acquired-file metadata`);
    return errors;
  }
  const filePath = `${repositoryRoot}/${artifact.localSnapshotPath}`;
  let bytes: Buffer;
  try {
    bytes = readFileSync(filePath);
  } catch {
    errors.push(`${artifact.sourceArtifactId} local snapshot is not readable`);
    return errors;
  }
  if (bytes.length === 0) errors.push(`${artifact.sourceArtifactId} has no usable content`);
  const calculated = createHash("sha256").update(bytes).digest("hex");
  if (calculated !== artifact.sha256) errors.push(`${artifact.sourceArtifactId} SHA-256 mismatch`);
  if (artifact.fileSize !== bytes.length) errors.push(`${artifact.sourceArtifactId} file size does not match the registry`);
  if (artifact.fileSize < 256 && artifact.contentType !== "application/json") errors.push(`${artifact.sourceArtifactId} is implausibly small`);
  const expectedContentType = artifact.artifactType === "PDF" ? "application/pdf"
    : artifact.artifactType === "JSON_API" || artifact.artifactType === "DATASET" ? "application/json"
      : "text/html";
  if (artifact.contentType !== expectedContentType) errors.push(`${artifact.sourceArtifactId} content type does not match ${artifact.artifactType}`);
  if (artifact.artifactType === "PDF" && bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    errors.push(`${artifact.sourceArtifactId} does not contain a PDF signature`);
  }
  if (artifact.artifactType === "JSON_API" || artifact.artifactType === "DATASET") {
    try {
      JSON.parse(bytes.toString("utf8"));
    } catch {
      errors.push(`${artifact.sourceArtifactId} is not valid JSON`);
    }
  }
  if (artifact.artifactType === "WEB_PAGE" && !/<html[\s>]/i.test(bytes.toString("utf8"))) {
    errors.push(`${artifact.sourceArtifactId} does not contain recognizable HTML`);
  }
  if (!artifact.parsed || artifact.parseMethod === "NOT_PARSED") errors.push(`${artifact.sourceArtifactId} did not pass format parsing`);
  if (artifact.currentStatus === "DUPLICATE" && !artifact.duplicateOf) errors.push(`${artifact.sourceArtifactId} does not identify its canonical duplicate`);
  return errors;
}
