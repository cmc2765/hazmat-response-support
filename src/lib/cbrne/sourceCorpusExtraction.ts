import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { inflateRawSync, inflateSync } from "node:zlib";
import type { SourceArtifact } from "./authoritativeSourceTypes.js";

export type LocalDocumentStructure = {
  parser: SourceArtifact["parseMethod"];
  usableContentBytes: number;
  pages: number | null;
  sections: string[];
  lists: string[];
  tables: string[][];
  records: string[];
  textSample: string;
  warnings: string[];
  parserLimitations: string[];
};

function decodeHtml(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_, hex, decimal) => String.fromCodePoint(Number.parseInt(hex ?? decimal, hex ? 16 : 10)))
    .replace(/\s+/g, " ")
    .trim();
}

function extractHtml(bytes: Buffer): LocalDocumentStructure {
  const html = bytes.toString("utf8");
  const sections = [...html.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)].map((match) => decodeHtml(match[1])).filter(Boolean);
  const lists = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((match) => decodeHtml(match[1])).filter(Boolean);
  const tables = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => [...row[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) => decodeHtml(cell[1])).filter(Boolean)).filter((row) => row.length > 0);
  const text = decodeHtml(html);
  const warnings = [
    ...(sections.length === 0 ? ["HTML document has no heading locator."] : []),
    ...(/(?:page not found|access denied|error occurred|enable javascript)/i.test(text) ? ["Possible placeholder, access, or error-page content requires review."] : []),
  ];
  return { parser: "HTML_DOCUMENT", usableContentBytes: bytes.length, pages: null, sections, lists, tables, records: [], textSample: text.slice(0, 500), warnings, parserLimitations: [] };
}

function extractJson(bytes: Buffer): LocalDocumentStructure {
  const warnings: string[] = [];
  let parsed: unknown;
  try { parsed = JSON.parse(bytes.toString("utf8")); } catch { parsed = null; warnings.push("Structured artifact is not valid JSON."); }
  const records: string[] = [];
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    const row = value as Record<string, unknown>;
    const identifier = row.recordId ?? row.id ?? row.nuclideId ?? row.name;
    if (typeof identifier === "string" || typeof identifier === "number") records.push(String(identifier));
    Object.values(row).forEach(walk);
  };
  walk(parsed);
  return { parser: "STRUCTURED_JSON", usableContentBytes: bytes.length, pages: null, sections: [], lists: [], tables: [], records: [...new Set(records)], textSample: JSON.stringify(parsed ?? "").slice(0, 500), warnings, parserLimitations: [] };
}

function pdfTextOperators(bytes: Buffer) {
  const strings: string[] = [];
  const text = bytes.toString("latin1");
  let cursor = 0;
  while (cursor >= 0) {
    const filter = text.indexOf("/FlateDecode", cursor);
    if (filter < 0) break;
    const startMarker = text.indexOf("stream\n", filter);
    if (startMarker < 0 || startMarker - filter > 500) { cursor = filter + 12; continue; }
    const start = startMarker + "stream\n".length;
    const end = text.indexOf("endstream", start);
    if (end < 0) break;
    const stream = bytes.subarray(start, end);
    const header = text.slice(Math.max(0, filter - 300), filter);
    // Skip image streams; their bytes are not document text.
    if (/\/Subtype\s*\/Image\b/i.test(header)) { cursor = end + 9; continue; }
    let decoded = stream;
    try { decoded = inflateSync(stream); } catch {
      try { decoded = inflateRawSync(stream); } catch { /* uncompressed or unsupported PDF filter */ }
    }
    const source = decoded.toString("latin1");
    for (const match of source.matchAll(/\(((?:\\.|[^()])*)\)\s*(?:T[jJ]|TJ)/g)) {
      strings.push(match[1].replace(/\\([()\\])/g, "$1"));
    }
    cursor = end + 9;
  }
  return strings;
}

function extractPdf(bytes: Buffer): LocalDocumentStructure {
  const pageCount = [...bytes.toString("latin1").matchAll(/\/Type\s*\/Page\b/g)].length || null;
  const textStrings = pdfTextOperators(bytes);
  const textSample = textStrings.join(" ").replace(/\s+/g, " ").trim();
  const warnings = [...(textStrings.length === 0 ? ["No embedded PDF text operators were extracted."] : [])];
  const parserLimitations = textStrings.length === 0
    ? ["OCR was not attempted; image-only PDF content remains explicitly review-gated."]
    : ["PDF table geometry is retained as source bytes; column semantics require document-specific review."];
  return { parser: "PDF_STRUCTURE", usableContentBytes: bytes.length, pages: pageCount, sections: [], lists: [], tables: [], records: [], textSample: textSample.slice(0, 500), warnings, parserLimitations };
}

export function extractLocalArtifact(artifact: SourceArtifact, repositoryRoot: string): LocalDocumentStructure {
  if (!artifact.localSnapshotPath || !artifact.sha256) throw new Error(`${artifact.sourceArtifactId} has no local authoritative snapshot.`);
  const bytes = readFileSync(`${repositoryRoot}/${artifact.localSnapshotPath}`);
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== artifact.sha256) throw new Error(`${artifact.sourceArtifactId} SHA-256 mismatch; extraction refused.`);
  if (artifact.artifactType === "WEB_PAGE") return extractHtml(bytes);
  if (artifact.artifactType === "JSON_API" || artifact.artifactType === "DATASET") return extractJson(bytes);
  return extractPdf(bytes);
}
