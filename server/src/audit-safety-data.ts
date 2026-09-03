import Database from 'better-sqlite3';
import { ALL_NPG } from '../../src/data/all-npg.js';
import { hydrateCbrneDatabase } from '../../src/lib/cbrne/hydrateCbrneDatabase.js';
import { SAFETY_DATA_STATUS, safetyDisplayValue } from '../../src/lib/readiness/scientific-validation.js';
import { getCompanionDbPath } from './chemical-companion.js';

type ChemicalRow = {
  ChemicalID: number;
  ChemicalName: string | null;
  CasNumber: string | null;
  UnnaNumber: string | null;
  ErgNumber: string | null;
  IDLHPpm: unknown;
};

const missingStatuses = new Set<string>(Object.values(SAFETY_DATA_STATUS));
const meaningful = (value: unknown) => !missingStatuses.has(safetyDisplayValue(value));
const normalizedCas = (value: unknown) => String(value ?? '').trim();

const npgByCas = new Map(ALL_NPG
  .filter((record) => normalizedCas(record.cas))
  .map((record) => [normalizedCas(record.cas), record]));

const db = new Database(getCompanionDbPath(), { readonly: true });
try {
  const chemicals = db.prepare(`
    SELECT c.ChemicalID, c.ChemicalName, c.CasNumber, c.UnnaNumber, c.ErgNumber, e.IDLHPpm
    FROM chemicals c
    LEFT JOIN chemicals_chemicalexposurelimits e ON e.ChemicalID = c.ChemicalID
    ORDER BY c.ChemicalID
  `).all() as ChemicalRow[];

  const masterIdlh = chemicals.filter((row) => meaningful(row.IDLHPpm));
  const recoveredByNiosh = chemicals.filter((row) => {
    const linked = npgByCas.get(normalizedCas(row.CasNumber));
    return !meaningful(row.IDLHPpm) && meaningful(linked?.exposureLimits?.idlh);
  });
  const linkedNiosh = chemicals.filter((row) => {
    const linked = npgByCas.get(normalizedCas(row.CasNumber));
    return meaningful(linked?.exposureLimits?.idlh);
  });
  const effectiveIdlh = new Set([
    ...masterIdlh.map((row) => row.ChemicalID),
    ...recoveredByNiosh.map((row) => row.ChemicalID),
  ]);

  const hydratedHazards = hydrateCbrneDatabase();
  const verificationStatusCounts = Object.fromEntries([...hydratedHazards.sourceFacts.reduce((counts, fact) => {
    counts.set(fact.verificationStatus, (counts.get(fact.verificationStatus) ?? 0) + 1);
    return counts;
  }, new Map<string, number>())].sort(([a], [b]) => a.localeCompare(b)));

  const report = {
    generatedAt: new Date().toISOString(),
    policy: {
      idlh: 'A value is displayable only from the Chemical Companion master or an exact-CAS linked bundled NIOSH record.',
      missingData: 'An absent or not-established IDLH remains explicit; this audit never invents a threshold.',
      cbrne: 'CBRNE/radiological facts retain their source-pack verification status and are not treated as chemical IDLH values.',
    },
    chemicals: {
      total: chemicals.length,
      identityCoverage: {
        name: chemicals.filter((row) => Boolean(row.ChemicalName?.trim())).length,
        cas: chemicals.filter((row) => Boolean(row.CasNumber?.trim())).length,
        unNa: chemicals.filter((row) => Boolean(row.UnnaNumber?.trim())).length,
        ergGuide: chemicals.filter((row) => Boolean(row.ErgNumber?.trim())).length,
      },
      idlhCoverage: {
        chemicalCompanion: masterIdlh.length,
        exactCasLinkedNiosh: linkedNiosh.length,
        recoveredFromNioshFallback: recoveredByNiosh.length,
        effectiveProfiles: effectiveIdlh.size,
        withoutPublishedValueInBundledSources: chemicals.length - effectiveIdlh.size,
      },
      recoveredProfiles: recoveredByNiosh.map((row) => ({
        chemicalId: row.ChemicalID,
        name: row.ChemicalName,
        cas: row.CasNumber,
        idlh: npgByCas.get(normalizedCas(row.CasNumber))?.exposureLimits?.idlh,
        source: 'NIOSH (exact CAS link)',
      })),
    },
    hazards: {
      records: hydratedHazards.records.length,
      sourceFacts: hydratedHazards.sourceFacts.length,
      validSourcePacks: hydratedHazards.importReports.filter((item) => item.valid).length,
      invalidSourcePacks: hydratedHazards.importReports.filter((item) => !item.valid).length,
      verificationStatusCounts,
      importErrors: hydratedHazards.importReports.flatMap((item) => item.errors.map((error) => `${item.packageId}: ${error}`)),
      warnings: hydratedHazards.warnings,
    },
  };

  console.log(JSON.stringify(report, null, 2));
} finally {
  db.close();
}
