import { inArray, notInArray, sql } from "drizzle-orm";
import { ALL_NPG } from "../../src/data/all-npg.js";
import type { DbClient } from "./db.js";
import * as schema from "./schema.js";

const NIOSH_NPG_SOURCE = {
  key: "nioshNpg",
  edition: "2024-10",
  license: "Public Domain (CDC/NIOSH)",
};

function validateCanonicalNpg(): void {
  const ids = new Set<string>();
  const casOwners = new Map<string, string>();

  for (const record of ALL_NPG) {
    if (ids.has(record.id)) {
      throw new Error(`[npg] canonical source contains duplicate record ID: ${record.id}`);
    }
    ids.add(record.id);

    const cas = record.cas?.trim();
    if (!cas) continue;
    const previousId = casOwners.get(cas);
    if (previousId) {
      throw new Error(`[npg] canonical source contains duplicate CAS ${cas}: ${previousId}, ${record.id}`);
    }
    casOwners.set(cas, record.id);
  }
}

/**
 * Reconcile the SQLite NPG reference projection from the canonical bundled
 * source. All changes are limited to npg_records and its manifest row.
 */
export function reconcileNpgProjection(db: DbClient): number {
  validateCanonicalNpg();

  return db.transaction((tx) => {
    const canonicalIds = ALL_NPG.map((record) => record.id);
    tx.delete(schema.npgRecords).where(notInArray(schema.npgRecords.id, canonicalIds)).run();

    // Stage existing CAS values out of the unique index so a legitimate CAS
    // rotation between two canonical records cannot fail based on update order.
    tx.update(schema.npgRecords).set({ cas: null }).where(inArray(schema.npgRecords.id, canonicalIds)).run();

    for (const record of ALL_NPG) {
      tx.insert(schema.npgRecords).values({
        id: record.id,
        name: record.name,
        synonyms: JSON.stringify(record.synonyms ?? []),
        cas: record.cas ?? null,
        rtecs: record.rtecs ?? null,
        formula: record.formula ?? null,
        exposureLimits: JSON.stringify(record.exposureLimits ?? {}),
        physical: JSON.stringify(record.physical ?? {}),
        health: JSON.stringify(record.health ?? {}),
        ppe: JSON.stringify(record.ppe ?? {}),
        reactivity: JSON.stringify(record.reactivity ?? {}),
        sources: JSON.stringify(record.sources ?? []),
      }).onConflictDoUpdate({
        target: schema.npgRecords.id,
        set: {
          name: record.name,
          synonyms: JSON.stringify(record.synonyms ?? []),
          cas: record.cas ?? null,
          rtecs: record.rtecs ?? null,
          formula: record.formula ?? null,
          exposureLimits: JSON.stringify(record.exposureLimits ?? {}),
          physical: JSON.stringify(record.physical ?? {}),
          health: JSON.stringify(record.health ?? {}),
          ppe: JSON.stringify(record.ppe ?? {}),
          reactivity: JSON.stringify(record.reactivity ?? {}),
          sources: JSON.stringify(record.sources ?? []),
          updatedAt: sql`(datetime('now'))`,
        },
      }).run();
    }

    tx.insert(schema.dataSources).values({
      ...NIOSH_NPG_SOURCE,
      recordCount: ALL_NPG.length,
    }).onConflictDoUpdate({
      target: schema.dataSources.key,
      set: {
        edition: NIOSH_NPG_SOURCE.edition,
        license: NIOSH_NPG_SOURCE.license,
        recordCount: ALL_NPG.length,
        updatedAt: sql`(datetime('now'))`,
      },
    }).run();

    return ALL_NPG.length;
  });
}

export function npgProjectionSource() {
  return { ...NIOSH_NPG_SOURCE, recordCount: ALL_NPG.length };
}
