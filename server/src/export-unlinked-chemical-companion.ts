import Database from "better-sqlite3";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getCompanionDbPath,
  normalizeTransportationIdentifier,
} from "./chemical-companion.js";
import type {
  LinkageCoverageSnapshot,
  TransportationSourceRelationship,
} from "./chemical-companion/linkage-coverage.js";

interface ShippingRow extends TransportationSourceRelationship {
  identifier: string;
}

export function buildUnlinkedCoverageSnapshot(auditDate = new Date().toISOString().slice(0, 10)): LinkageCoverageSnapshot {
  const db = new Database(getCompanionDbPath(), { readonly: true });
  try {
    const shipping = db.prepare(`SELECT
      p.id AS shippingNameId,
      u.id AS unNaSourceId,
      p.proper_shipping_name AS properShippingName,
      p.unna AS identifier,
      g.id AS guideId,
      u.guide_text_number AS guideNumber,
      b.id AS guideBookId,
      b.version AS guideBookVersion,
      b.country AS country
      FROM emergency_response_proper_shipping_names p
      JOIN emergency_response_guides g ON g.id=p.guide_id
      JOIN emergency_response_guidebooks b
        ON b.id=g.guide_book_id AND b.country='USA' AND b.is_latest=1
      JOIN emergency_response_unna_numbers u
        ON u.unna=p.unna AND u.guide_book_id=b.id
      ORDER BY p.unna, p.id`).all().map((row) => {
        const source = row as Record<string, unknown>;
        return {
          shippingNameId: Number(source.shippingNameId),
          unNaSourceId: Number(source.unNaSourceId),
          properShippingName: String(source.properShippingName),
          identifier: normalizeTransportationIdentifier(source.identifier) ?? String(source.identifier),
          guideId: Number(source.guideId),
          guideNumber: String(source.guideNumber),
          guideBookId: Number(source.guideBookId),
          guideBookVersion: String(source.guideBookVersion),
          country: String(source.country),
        } satisfies ShippingRow;
      });

    const unlinked = new Map<string, TransportationSourceRelationship[]>();
    for (const item of shipping) {
      const relationship: TransportationSourceRelationship = {
        shippingNameId: item.shippingNameId,
        unNaSourceId: item.unNaSourceId,
        properShippingName: item.properShippingName,
        guideId: item.guideId,
        guideNumber: item.guideNumber,
        guideBookId: item.guideBookId,
        guideBookVersion: item.guideBookVersion,
        country: item.country,
      };
      unlinked.set(item.identifier, [...(unlinked.get(item.identifier) ?? []), relationship]);
    }

    const unlinkedRecords = [...unlinked.entries()].map(([identifier, sourceRelationships]) => ({
      sourceId: `erg-unna:${sourceRelationships[0].guideBookId}:${identifier}`,
      identifier: `UN/NA ${identifier}`,
      shippingName: sourceRelationships.map((relationship) => relationship.properShippingName).join(" | "),
      category: "unknown/requires-review" as const,
      resolution: "requires review" as const,
      sourceRelationships,
    }));
    const totalSourceIdentifiers = unlinkedRecords.length;
    const importedIdentifiers = 0;

    return {
      auditDate,
      sourceDatabase: "data/ChemicalCompanionDB.db",
      totalSourceIdentifiers,
      importedIdentifiers,
      unlinkedIdentifiers: unlinkedRecords.length,
      categorizedIdentifiers: 0,
      chemicalLinkableTargets: 0,
      resolvedIdentifiers: importedIdentifiers,
      unresolvedIdentifiers: unlinkedRecords.length,
      percentCoverage: Number(((importedIdentifiers / totalSourceIdentifiers) * 100).toFixed(2)),
      categoryCounts: {
        "chemical-linkable": 0,
        "mixture/product-name": 0,
        "synonym/alias": 0,
        "generic-class": 0,
        "transportation-only-identifier": 0,
        "duplicate/format-variant": 0,
        "deprecated/obsolete": 0,
        "non-chemical-administrative-entry": 0,
        "unknown/requires-review": unlinkedRecords.length,
      },
      unlinkedInventoryComplete: true,
      unlinkedRecords,
      notes: [
        "Every unique US latest-book UN/NA transportation identifier is retained separately with its source relationship rows.",
        "No transportation identifier is treated as a reviewed Chemical Companion master link.",
        "All proposed chemical links require evidence and attributable review before guidance use.",
      ],
    };
  } finally {
    db.close();
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../data/chemical-companion-linkage-coverage.json");
  const snapshot = buildUnlinkedCoverageSnapshot();
  writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.info(`[chemical-companion] exported ${snapshot.unlinkedRecords.length} unlinked identifiers to ${target}`);
}
