// Generates the full CHEMICALS array by merging hand-curated records
// (from chemicals.ts) with compact records (from compact-chemicals.ts).
// The hand-curated records take precedence — compact records only fill gaps.

import type { Chemical } from "@/lib/schema";
import { CHEMICALS as HAND_CURATED } from "./chemicals.js";
import { COMPACT_CHEMICALS, type CompactChemical } from "./compact-chemicals.js";

const SRC_COMPACT = [{ source: "NOAA CAMEO Chemicals (compact)" }, { source: "PHMSA ERG 2024" }];

function expandCompact(c: CompactChemical): Chemical {
  return {
    id: c.id,
    name: c.name,
    synonyms: c.synonyms ?? [],
    cas: c.cas ? [c.cas] : undefined,
    un: c.un && c.un !== "—" ? [c.un] : undefined,
    na: undefined,
    hazardClass: c.hazardClass,
    packingGroup: undefined,
    ergGuide: c.ergGuide && c.ergGuide !== "—" ? c.ergGuide : undefined,
    placard: c.placard,
    ppe: c.ppe ?? ["SCBA", "Chemical-resistant PPE per ERG guide"],
    isolation: {
      initial: `Per ERG Guide ${c.ergGuide ?? "—"}`,
      protective: `Per ERG Guide ${c.ergGuide ?? "—"}`,
    },
    firstAid: c.firstAid ?? ["Move to fresh air.", "Flush skin/eyes with water.", "Obtain medical evaluation."],
    reactivity: c.reactivity ?? [],
    incompatibilities: c.incompatibilities ?? [],
    sdsUrl: c.sdsUrl,
    sources: SRC_COMPACT,
  };
}

const existingIds = new Set(HAND_CURATED.map((c) => c.id));
const expanded = COMPACT_CHEMICALS
  .filter((c) => !existingIds.has(c.id))
  .map(expandCompact);

// Ensure all records have a sources array (Chex allows undefined, Chemical requires it).
const ALL: Chemical[] = [...HAND_CURATED, ...expanded].map((c) => ({
  ...c,
  sources: c.sources ?? [],
}));

export const ALL_CHEMICALS: Chemical[] = ALL;

export function lookupChemicalByUnAll(un: string): Chemical | undefined {
  return ALL_CHEMICALS.find((c) => c.un?.includes(un) || c.na?.includes(un));
}