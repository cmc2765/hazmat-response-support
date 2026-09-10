#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "../..");
const ARTIFACTS_PATH = resolve(ROOT, "src/data/cbrne/authoritative/generated-source-artifacts.json");
const OUTPUT = resolve(ROOT, "src/data/cbrne/authoritative/generated-radionuclide-physics.json");

const targets = [
  ["cesium-137", "137CS"], ["cobalt-60", "60CO"], ["iridium-192", "192IR"], ["americium-241", "241AM"],
  ["strontium-90", "90SR"], ["iodine-131", "131I"], ["radium-226", "226RA"], ["uranium-235", "235U"],
  ["uranium-238", "238U"], ["plutonium-239", "239PU"],
];

const artifacts = JSON.parse(readFileSync(ARTIFACTS_PATH, "utf8"));
const byId = new Map(artifacts.map((artifact) => [artifact.sourceArtifactId, artifact]));

function acquiredJson(id) {
  const artifact = byId.get(id);
  if (!artifact || artifact.currentStatus !== "ACQUIRED" || !artifact.localSnapshotPath) throw new Error(`Required acquired artifact is missing: ${id}`);
  return { artifact, data: JSON.parse(readFileSync(resolve(ROOT, artifact.localSnapshotPath), "utf8")) };
}

function groundState(levels, identity) {
  const candidates = (levels.results ?? []).filter((level) => level.levelIndex === 0 && level.datasetSummary?.documentType === "adopted");
  return candidates.find((level) => level.datasetSummary?.nuclideId === identity.id) ?? candidates[0] ?? null;
}

function decayRows(decays, identity) {
  const seen = new Set();
  return (decays.results ?? [])
    .filter((decay) => decay.parent?.name === identity.name && Number(decay.parent?.levelEnergy?.value ?? 0) === 0)
    .map((decay) => ({
      decayMode: decay.decayMode,
      daughterCanonicalNuclideId: decay.daughter?.name ? `nuclide:${String(decay.daughter.name).toLowerCase()}` : null,
      daughterNndcName: decay.daughter?.name ?? null,
      qValue: decay.parent?.qValue?.value ?? null,
      qValueUnits: decay.parent?.qValue?.unit ?? null,
      datasetId: decay.datasetSummary?.id ?? null,
      datasetName: decay.datasetSummary?.datasetName ?? null,
      evaluationCutoffDate: decay.datasetSummary?.cutoffDate ?? null,
    }))
    .filter((row) => {
      const key = `${row.decayMode}|${row.daughterNndcName}|${row.datasetId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const records = targets.map(([recordId, nndcName]) => {
  const prefix = `nndc-${nndcName.toLowerCase()}`;
  const identityArtifact = acquiredJson(`${prefix}-identity`);
  const levelsArtifact = acquiredJson(`${prefix}-levels`);
  const decaysArtifact = acquiredJson(`${prefix}-decays`);
  const identity = identityArtifact.data;
  const ground = groundState(levelsArtifact.data, identity);
  if (!ground) throw new Error(`No adopted ground state found for ${nndcName}`);
  const halfLife = ground.halflife ?? null;
  return {
    canonicalRecordId: recordId,
    namespace: "RADIONUCLIDE",
    canonicalNuclideId: `nuclide:${String(identity.elementSymbol).toLowerCase()}-${identity.a}`,
    element: identity.elementName,
    elementSymbol: identity.elementSymbol,
    atomicNumber: identity.z,
    neutronNumber: identity.n,
    massNumber: identity.a,
    metastableState: null,
    nndcName: identity.name,
    nndcNuclideId: identity.id,
    stability: ground.isStable ? "STABLE" : "RADIOACTIVE",
    halfLifeOriginal: halfLife ? `${halfLife.value} ${halfLife.unit}` : null,
    halfLifeValue: halfLife?.value ?? null,
    halfLifeUnits: halfLife?.unit ?? null,
    halfLifeSeconds: ground.halflifeSeconds ?? null,
    halfLifeUncertainty: halfLife?.uncertainty ?? null,
    decayModes: decayRows(decaysArtifact.data, identity),
    branchingInformation: ground.decayBranchingRatios ?? {},
    adoptedDataset: {
      datasetId: ground.datasetSummary?.id ?? null,
      datasetName: ground.datasetSummary?.datasetName ?? null,
      evaluationCutoffDate: ground.datasetSummary?.cutoffDate ?? null,
    },
    sourceArtifacts: [identityArtifact.artifact.sourceArtifactId, levelsArtifact.artifact.sourceArtifactId, decaysArtifact.artifact.sourceArtifactId],
    sourceApi: "ENSDF",
    reviewStatus: "SOURCE_IMPORTED_PENDING_REVIEW",
    limitations: [
      "Evaluated nuclear physics only; this record is not tactical response guidance.",
      "Do not infer shielding, PPE, standoff, evacuation distance, dose, or medical treatment from isotope identity or half-life.",
      "Decay rows retain evaluated dataset identifiers and cutoff dates; disagreements must be reviewed rather than collapsed.",
    ],
  };
});

mkdirSync(dirname(OUTPUT), { recursive: true });
const output = `${JSON.stringify(records, null, 2)}\n`;
if (!existsSync(OUTPUT) || readFileSync(OUTPUT, "utf8") !== output) writeFileSync(OUTPUT, output);
process.stdout.write(`${JSON.stringify({ radionuclides: records.length, output: OUTPUT }, null, 2)}\n`);
