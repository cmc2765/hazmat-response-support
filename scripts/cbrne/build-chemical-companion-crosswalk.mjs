#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DB = resolve(ROOT, "data/ChemicalCompanionDB.db");
const OUTPUT = resolve(ROOT, "src/data/cbrne/authoritative/generated-chemical-companion-crosswalk.json");

const chemicals = {
  "sarin-gb": ["107-44-8"], vx: ["50782-69-9"], "tabun-ga": ["77-81-6"], "soman-gd": ["96-64-0"],
  "cyclosarin-gf": ["329-99-7"], "fourth-generation-agents": [], "sulfur-mustard-hd": ["505-60-2"],
  "lewisite-l": ["541-25-3"], "mustard-lewisite-hl": [], "nitrogen-mustard-hn1": ["538-07-8"],
  "nitrogen-mustard-hn2": ["51-75-2"], "nitrogen-mustard-hn3": ["555-77-1"], "phosgene-oxime-cx": ["1794-86-1"],
  "hydrogen-cyanide-ac": ["74-90-8"], "cyanogen-chloride-ck": ["506-77-4"], "arsine-sa": ["7784-42-1"],
  "phosgene-cg": ["75-44-5"], "chlorine-cl": ["7782-50-5"], "chloropicrin-ps": ["76-06-2"],
  ammonia: ["7664-41-7"], "hydrogen-sulfide": ["7783-06-4"], phosphine: ["7803-51-2"],
  fentanyl: ["437-38-7"], tets: ["80-12-6"],
};
const biological = {
  anthrax: ["Anthrax"], plague: ["Plague"], tularemia: ["Tularemia"], smallpox: ["Smallpox"],
  "viral-hemorrhagic-fever": ["Viral Hemorrhagic Fever"], ricin: ["Ricin"], abrin: ["Abrin"],
  "botulinum-toxin": ["Botulinum"], brucellosis: ["Brucellosis"], "q-fever": ["Q Fever"],
  glanders: ["Glanders"], melioidosis: ["Melioidosis"], "hantavirus-pulmonary-syndrome": ["Hantavirus Pulmonary Syndrome"],
};
const nuclides = {
  "cesium-137": "Cesium-137", "cobalt-60": "Cobalt-60", "iridium-192": "Iridium-192",
  "americium-241": "Americium-241", "strontium-90": "Strontium-90", "iodine-131": "Iodine-131",
  "radium-226": "Radium-226", "uranium-235": "Uranium-235", "uranium-238": "Uranium-238", "plutonium-239": "Plutonium-239",
};
const scenarios = ["type-a-package", "type-b-package", "radiological-dispersal-device", "improvised-nuclear-device"];

function query(sql) {
  return database.prepare(sql).all();
}

const database = new DatabaseSync(DB, { readOnly: true });
const chemicalRows = query("select ChemicalID, CasNumber from chemicals where CasNumber is not null");
const biologicalRows = query("select id, name from biotoxins");
const nuclideRows = query("select id, name from radioisotopes");
database.close();

const records = [];
for (const [canonicalRecordId, cas] of Object.entries(chemicals)) {
  const matches = chemicalRows.filter((row) => cas.includes(row.CasNumber));
  records.push({
    canonicalRecordId, identityNamespace: "CWA_CHEMICAL", companionTable: "chemicals",
    companionIds: matches.map((row) => row.ChemicalID).sort((a, b) => a - b), matchBasis: cas.length ? "CAS" : "NONE",
    identityStatus: matches.length ? "MATCHED_TO_AUTHORITY" : cas.length ? "SOURCE_UNPROVEN" : "IDENTITY_AMBIGUOUS",
    operationalDataStatus: "SOURCE_UNPROVEN",
    notes: [
      matches.length ? "Identity-only crosswalk established using authoritative CAS." : "No authoritative identity match was established.",
      "Chemical Companion operational values are quarantined from the authoritative fact layer until independently sourced and reviewed.",
    ],
  });
}
for (const [canonicalRecordId, names] of Object.entries(biological)) {
  const matches = biologicalRows.filter((row) => names.some((name) => name.toLowerCase() === row.name.toLowerCase()));
  records.push({
    canonicalRecordId, identityNamespace: canonicalRecordId === "ricin" || canonicalRecordId === "abrin" || canonicalRecordId === "botulinum-toxin" ? "BIOLOGICAL_TOXIN" : "BIOLOGICAL",
    companionTable: "biotoxins", companionIds: matches.map((row) => row.id).sort((a, b) => a - b), matchBasis: "TYPED_BIOLOGICAL_NAME",
    identityStatus: matches.length ? "MATCHED_TO_AUTHORITY" : "SOURCE_UNPROVEN", operationalDataStatus: "SOURCE_UNPROVEN",
    notes: [matches.length ? "Typed toxin-name identity crosswalk established." : "No typed biological identity match exists in the biotoxins table.", "No molecular weight or solubility value is promoted into the authoritative fact layer."],
  });
}
for (const [canonicalRecordId, name] of Object.entries(nuclides)) {
  const matches = nuclideRows.filter((row) => row.name.toLowerCase() === name.toLowerCase());
  records.push({
    canonicalRecordId, identityNamespace: "RADIONUCLIDE", companionTable: "radioisotopes",
    companionIds: matches.map((row) => row.id).sort((a, b) => a - b), matchBasis: "ELEMENT_MASS_METASTABLE",
    identityStatus: matches.length === 1 ? "MATCHED_TO_AUTHORITY" : matches.length ? "IDENTITY_AMBIGUOUS" : "SOURCE_UNPROVEN",
    operationalDataStatus: "SOURCE_UNPROVEN",
    notes: [matches.length === 1 ? "Exact element and ground-state mass-number identity crosswalk established." : "No unique exact ground-state nuclide identity match was established.", "Chemical Companion radiation level and emission values are quarantined; NNDC ENSDF remains the physics authority."],
  });
}
for (const canonicalRecordId of scenarios) records.push({
  canonicalRecordId, identityNamespace: "RAD_NUCLEAR_SCENARIO", companionTable: null, companionIds: [], matchBasis: "NONE",
  identityStatus: "NOT_APPLICABLE", operationalDataStatus: "NOT_APPLICABLE",
  notes: ["Operational scenarios are not chemical, biotoxin, or radionuclide identities."],
});

records.sort((a, b) => a.canonicalRecordId.localeCompare(b.canonicalRecordId));
const output = `${JSON.stringify(records, null, 2)}\n`;
if (!existsSync(OUTPUT) || readFileSync(OUTPUT, "utf8") !== output) writeFileSync(OUTPUT, output);
process.stdout.write(`${JSON.stringify({ crosswalks: records.length, output: OUTPUT }, null, 2)}\n`);
