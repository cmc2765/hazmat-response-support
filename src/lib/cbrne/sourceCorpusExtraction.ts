import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { inflateRawSync, inflateSync } from "node:zlib";
import type { PdfFailureCategory, PdfPageExtraction, PdfPageTextBlock, SourceArtifact } from "./authoritativeSourceTypes.js";

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
  pdfPages: PdfPageExtraction[];
  failureCategory: PdfFailureCategory | null;
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
  return { parser: "HTML_DOCUMENT", usableContentBytes: bytes.length, pages: null, sections, lists, tables, records: [], textSample: text.slice(0, 500), warnings, parserLimitations: [], pdfPages: [], failureCategory: null };
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
  return { parser: "STRUCTURED_JSON", usableContentBytes: bytes.length, pages: null, sections: [], lists: [], tables: [], records: [...new Set(records)], textSample: JSON.stringify(parsed ?? "").slice(0, 500), warnings, parserLimitations: [], pdfPages: [], failureCategory: null };
}

type PdfObject = { objectNumber: number; body: Buffer; dictionary: string };

function parsePdfObjects(bytes: Buffer) {
  const source = bytes.toString("latin1");
  const objects = new Map<number, PdfObject>();
  for (const match of source.matchAll(/(\d+)\s+(\d+)\s+obj\b/g)) {
    const bodyStart = (match.index ?? 0) + match[0].length;
    const bodyEnd = source.indexOf("endobj", bodyStart);
    if (bodyEnd < 0) continue;
    const body = bytes.subarray(bodyStart, bodyEnd);
    const streamIndex = body.indexOf("stream");
    const dictionary = (streamIndex >= 0 ? body.subarray(0, streamIndex) : body).toString("latin1");
    objects.set(Number(match[1]), { objectNumber: Number(match[1]), body, dictionary });
  }
  return objects;
}

function streamBytes(object: PdfObject) {
  const source = object.body.toString("latin1");
  const marker = source.indexOf("stream");
  if (marker < 0) return null;
  let start = marker + "stream".length;
  if (object.body[start] === 13 && object.body[start + 1] === 10) start += 2;
  else if (object.body[start] === 10) start += 1;
  const end = source.indexOf("endstream", start);
  if (end < 0) return null;
  const compressed = object.body.subarray(start, end);
  if (!/\/FlateDecode\b/.test(object.dictionary)) return compressed;
  try { return inflateSync(compressed); } catch {
    try { return inflateRawSync(compressed); } catch { return null; }
  }
}

function decodePdfLiteral(value: string) {
  return value
    .replace(/\\([nrtbf()\\])/g, (_, code: string) => ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[code] ?? code))
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)));
}

function decodePdfHex(value: string) {
  const normalized = value.replace(/\s+/g, "");
  const padded = normalized.length % 2 ? `${normalized}0` : normalized;
  const bytes = Buffer.from(padded, "hex");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const codeUnits: number[] = [];
    for (let index = 2; index + 1 < bytes.length; index += 2) codeUnits.push(bytes.readUInt16BE(index));
    return String.fromCharCode(...codeUnits);
  }
  return bytes.toString("latin1");
}

function pdfStringTokens(value: string) {
  const tokens: string[] = [];
  for (const match of value.matchAll(/\(((?:\\.|[^\\)])*)\)|<([0-9a-f\s]+)>/gi)) {
    tokens.push(match[1] !== undefined ? decodePdfLiteral(match[1]) : decodePdfHex(match[2]));
  }
  return tokens;
}

function textOperators(source: string): PdfPageTextBlock[] {
  const operators: Array<{ index: number; operator: "Tj" | "TJ"; text: string }> = [];
  for (const match of source.matchAll(/(\(((?:\\.|[^\\)])*)\)|<([0-9a-f\s]+)>)\s*Tj\b/gi)) {
    operators.push({ index: match.index ?? 0, operator: "Tj", text: match[2] !== undefined ? decodePdfLiteral(match[2]) : decodePdfHex(match[3]) });
  }
  for (const match of source.matchAll(/\[((?:\\.|[^\]])*)\]\s*TJ\b/gi)) {
    operators.push({ index: match.index ?? 0, operator: "TJ", text: pdfStringTokens(match[1]).join("") });
  }
  return operators
    .sort((left, right) => left.index - right.index)
    .map((item, index) => ({ order: index, operator: item.operator, text: item.text, role: "BODY" as const }))
    .filter((item) => item.text.trim());
}

function compactTextBlocks(blocks: PdfPageTextBlock[]) {
  const compacted: PdfPageTextBlock[] = [];
  for (const block of blocks) {
    const previous = compacted.at(-1);
    if (previous && previous.role === block.role && previous.text.length + block.text.length <= 256) {
      previous.text += block.text;
      continue;
    }
    compacted.push({ ...block, order: compacted.length });
  }
  return compacted;
}

function contentReferences(page: PdfObject) {
  const contents = page.dictionary.match(/\/Contents\s+(\[[\s\S]*?\]|\d+\s+\d+\s+R)/);
  return contents ? [...contents[1].matchAll(/(\d+)\s+\d+\s+R/g)].map((match) => Number(match[1])) : [];
}

function classifyPdfFailure(bytes: Buffer, pages: PdfPageExtraction[], decodedTextOperatorCount: number): PdfFailureCategory | null {
  const source = bytes.toString("latin1");
  if (/\/Encrypt\b/.test(source)) return "J_ENCRYPTED_OR_PROTECTED";
  if (/\/XFA\b|\/AcroForm\b/.test(source)) return "I_FORM_XFA_PDF";
  const hasImages = /\/Subtype\s*\/Image\b/i.test(source);
  const textBlockCount = pages.reduce((total, page) => total + page.quality.nonWhitespaceTextBlockCount, 0);
  if (textBlockCount === 0) return hasImages ? "F_SCANNED_IMAGE_PDF" : "E_TEXT_LAYER_EMPTY";
  if (hasImages) return "G_MIXED_TEXT_AND_IMAGE";
  if (decodedTextOperatorCount > textBlockCount * 2) return "M_PARSER_OUTPUT_TOO_NOISY";
  return "A_EMBEDDED_TEXT_AVAILABLE_BUT_LAYOUT_COMPLEX";
}

export function extractPdfBytes(bytes: Buffer): LocalDocumentStructure {
  const source = bytes.toString("latin1");
  const objects = parsePdfObjects(bytes);
  const pageObjects = [...objects.values()].filter((object) => /\/Type\s*\/Page\b/.test(object.dictionary));
  const pageCount = pageObjects.length || [...source.matchAll(/\/Type\s*\/Page\b/g)].length || null;
  const pdfPages: PdfPageExtraction[] = pageObjects.map((page, pageIndex) => {
    const textBlocks = contentReferences(page).flatMap((reference) => {
      const content = objects.get(reference);
      const stream = content ? streamBytes(content) : null;
      return stream ? textOperators(stream.toString("latin1")) : [];
    }).map((block, order) => ({ ...block, order }));
    const text = textBlocks.map((block) => block.text).join(" ").replace(/\s+/g, " ").trim();
    const hasControlCharacter = [...text].some((character) => {
      const code = character.charCodeAt(0);
      return (code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31);
    });
    const suspiciousTokens = [
      ...(text.includes("�") ? ["Unicode replacement character present."] : []),
      ...(hasControlCharacter ? ["Control character present in extracted text; review notation and units."] : []),
      ...(/\b(?:ppm|mg\/m[³3]|mSv\/h|µSv\/h|Bq|Ci)\b/i.test(text) && (hasControlCharacter || text.includes("�")) ? ["Technical notation appears alongside suspicious encoding; do not auto-correct safety values."] : []),
    ];
    return {
      pdfPageIndex: pageIndex,
      humanPageNumber: pageIndex + 1,
      parser: "PDF_STRUCTURE",
      extractionMethod: "EMBEDDED_TEXT",
      textBlocks,
      text,
      quality: { nonWhitespaceTextBlockCount: textBlocks.length, repeatedHeaderFooterBlockCount: 0, suspiciousTokens, warnings: suspiciousTokens.length ? ["Review suspicious extracted tokens before fact admission."] : [] },
    };
  });
  const repeatedBlockPages = new Map<string, Set<number>>();
  for (const page of pdfPages) for (const block of page.textBlocks) {
    const key = block.text.replace(/\s+/g, " ").trim().toLocaleLowerCase();
    if (key.length >= 8 && key.length <= 220) repeatedBlockPages.set(key, new Set([...(repeatedBlockPages.get(key) ?? []), page.pdfPageIndex]));
  }
  const repeatedThreshold = Math.max(3, Math.ceil(pdfPages.length * 0.6));
  for (const page of pdfPages) {
    let repeatedHeaderFooterBlockCount = 0;
    for (const block of page.textBlocks) {
      const key = block.text.replace(/\s+/g, " ").trim().toLocaleLowerCase();
      if ((repeatedBlockPages.get(key)?.size ?? 0) >= repeatedThreshold && !/\b(?:warning|danger|emergency|do not|immediately|contaminat)/i.test(block.text)) {
        block.role = "REPEATED_HEADER_FOOTER";
        repeatedHeaderFooterBlockCount += 1;
      }
    }
    page.textBlocks = compactTextBlocks(page.textBlocks);
    page.quality.repeatedHeaderFooterBlockCount = repeatedHeaderFooterBlockCount;
    page.quality.nonWhitespaceTextBlockCount = page.textBlocks.length;
    page.text = page.textBlocks.filter((block) => block.role === "BODY").map((block) => block.text).join(" ").replace(/\s+/g, " ").trim();
  }
  const decodedTextOperatorCount = pdfPages.reduce((total, page) => total + page.textBlocks.length, 0);
  const textSample = pdfPages.map((page) => page.text).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const failureCategory = classifyPdfFailure(bytes, pdfPages, decodedTextOperatorCount);
  const warnings = [
    ...(decodedTextOperatorCount === 0 ? ["No embedded PDF text operators were extracted."] : []),
    ...(pageObjects.length === 0 ? ["PDF page tree could not be mapped to page content streams."] : []),
  ];
  const parserLimitations = [
    ...(decodedTextOperatorCount === 0 ? ["Embedded text is unavailable or unusable; OCR remains explicitly review-gated."] : []),
    ...(pageObjects.length === 0 ? ["Page locator mapping failed because the page tree is unavailable or stored in an unsupported object structure."] : []),
  ];
  if (decodedTextOperatorCount > 0) parserLimitations.push("PDF table geometry and column semantics are retained in page/block order; document-specific fact review remains required.");
  return { parser: "PDF_STRUCTURE", usableContentBytes: bytes.length, pages: pageCount, sections: [], lists: [], tables: [], records: [], textSample: textSample.slice(0, 500), warnings, parserLimitations, pdfPages, failureCategory };
}

export function extractLocalArtifact(artifact: SourceArtifact, repositoryRoot: string): LocalDocumentStructure {
  if (!artifact.localSnapshotPath || !artifact.sha256) throw new Error(`${artifact.sourceArtifactId} has no local authoritative snapshot.`);
  const bytes = readFileSync(`${repositoryRoot}/${artifact.localSnapshotPath}`);
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== artifact.sha256) throw new Error(`${artifact.sourceArtifactId} SHA-256 mismatch; extraction refused.`);
  if (artifact.artifactType === "WEB_PAGE") return extractHtml(bytes);
  if (artifact.artifactType === "JSON_API" || artifact.artifactType === "DATASET") return extractJson(bytes);
  return extractPdfBytes(bytes);
}
