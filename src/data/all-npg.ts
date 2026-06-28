// Generates the full NPG array by merging hand-curated records (from npg.ts) with
// bulk-imported records (from compact-npg.ts, ingested by scripts/niosh/index.js).
// The hand-curated records take precedence — compact records only fill in chemicals
// not already hand-curated, matched by CAS number (NPG records don't share an id
// namespace the way Chemical/CompactChemical do).

import type { NPGRecord } from "@/lib/schema";
import { NPG as HAND_CURATED } from "./npg.js";
import { COMPACT_NPG, type CompactNpgRecord } from "./compact-npg.js";

const SRC_COMPACT = [
  {
    source:
      "Lucas LK, Whittaker C, Bailer AJ. J Occup Environ Hyg. 2024;21(1):47-57. doi:10.1080/15459624.2023.2267098 (CC BY 4.0), derived from the NIOSH Pocket Guide to Chemical Hazards",
  },
];

function expandCompact(c: CompactNpgRecord): NPGRecord {
  return {
    id: c.id,
    name: c.name,
    synonyms: c.synonyms ?? [],
    cas: c.cas,
    rtecs: c.rtecs,
    formula: c.formula,
    exposureLimits: {
      pel: c.exposureLimits?.pel,
      rel: c.exposureLimits?.rel,
      idlh: c.exposureLimits?.idlh,
    },
    physical: {
      mw: c.physical?.mw,
    },
    health: {
      symptoms: c.health?.symptoms ?? [],
      targetOrgans: c.health?.targetOrgans ?? [],
      firstAid: [],
      respiratorSelection: [],
    },
    ppe: { skin: [], eye: [], respiratory: [] },
    reactivity: { incompatibilities: [], waterReactive: false },
    sources: SRC_COMPACT,
  };
}

const existingCas = new Set(HAND_CURATED.map((n) => n.cas).filter(Boolean));
const expanded = COMPACT_NPG.filter((c) => !c.cas || !existingCas.has(c.cas)).map(expandCompact);

// Ensure all records have a sources array (R allows undefined, NPGRecord requires it).
export const ALL_NPG: NPGRecord[] = [...HAND_CURATED, ...expanded].map((n) => ({
  ...n,
  sources: n.sources ?? [],
}));
