#!/usr/bin/env node

// Convert PubChem's ERG 2024 guide summary into the compact JSON used by the
// browser UI. PubChem reproduces the public-domain PHMSA guide text in a
// predictable heading structure.

import { readFileSync, writeFileSync } from "node:fs";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  throw new Error("Usage: node scripts/erg/parse-guides.js INPUT.html OUTPUT.json");
}

const wantedGuides = new Set([
  "115", "116", "117", "118", "119", "120", "121", "122", "124", "125", "126",
  "127", "128", "129", "130", "131", "132", "133", "136", "137", "138", "139",
  "140", "141", "143", "151", "152", "153", "154", "155", "156", "157", "160",
  "171", "172",
]);

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function cleanLines(fragment) {
  return decodeHtml(fragment)
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*[·•]\s*/, "").trim())
    .filter(Boolean);
}

function section(block, start, end) {
  const startIndex = block.indexOf(start);
  if (startIndex < 0) return [];
  const bodyStart = startIndex + start.length;
  const endIndex = end ? block.indexOf(end, bodyStart) : -1;
  return cleanLines(block.slice(bodyStart, endIndex < 0 ? undefined : endIndex));
}

const html = readFileSync(inputPath, "utf8");
const guidePattern = /<h2 id="(\d+)">GUIDE \d+[\s\S]*?<\/h2>([\s\S]*?)(?=<h2 id="\d+">GUIDE|<hr>|$)/g;
const guides = {};

for (const match of html.matchAll(guidePattern)) {
  const guide = match[1];
  if (!wantedGuides.has(guide)) continue;
  const block = match[2];
  const titleEnd = block.indexOf("<h3>POTENTIAL HAZARDS</h3>");
  const titleLines = cleanLines(block.slice(0, titleEnd));
  const title = titleLines.find((line) => line !== `GUIDE ${guide}`) || `ERG Guide ${guide}`;

  guides[guide] = {
    guide,
    title,
    potentialHazards: {
      fireOrExplosion: section(block, "<h4>FIRE OR EXPLOSION</h4>", "<h4>HEALTH</h4>"),
      health: section(block, "<h4>HEALTH</h4>", "<h3>PUBLIC SAFETY</h3>"),
    },
    publicSafety: {
      general: section(block, "<h3>PUBLIC SAFETY</h3>", "<h4>PROTECTIVE CLOTHING</h4>"),
      protectiveClothing: section(block, "<h4>PROTECTIVE CLOTHING</h4>", "<h4>EVACUATION</h4>"),
      evacuation: section(block, "<h4>EVACUATION</h4>", "<h3>EMERGENCY RESPONSE</h3>"),
    },
    emergencyResponse: {
      fire: section(block, "<h4>FIRE</h4>", "<h4>SPILL OR LEAK</h4>"),
      spillOrLeak: section(block, "<h4>SPILL OR LEAK</h4>", "<h4>FIRST AID</h4>"),
      firstAid: section(block, "<h4>FIRST AID</h4>"),
    },
  };
}

const missing = [...wantedGuides].filter((guide) => !guides[guide]);
if (missing.length) throw new Error(`Missing ERG guides: ${missing.join(", ")}`);

writeFileSync(outputPath, `${JSON.stringify({ edition: "2024", guides }, null, 2)}\n`);
console.log(`[erg] wrote ${Object.keys(guides).length} guides to ${outputPath}`);
