// Sync client — pulls data from the backend API into Dexie.
//
// On first run (or when the server version differs from the local stamp),
// fetches /api/sync/:clientId and replaces all data tables in Dexie.
// Falls back gracefully to the bundled data if the API is unreachable
// (offline-first: the app works without the server).

import { db } from "@/lib/db";
import { ensureDataLoaded } from "@/lib/seed";

const SYNC_KEY = "last-sync-version";
const CLIENT_ID_KEY = "sync-client-id";

function getClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export type SyncResult =
  | { ok: true; version: string; counts: { chemicals: number; npg: number; erg: number; thresholds: number; facilities: number; facilityChemicals: number } }
  | { ok: false; reason: string };

interface ApiSyncResponse {
  version: string;
  syncedAt: string;
  manifest: Array<{ key: string; edition: string | null; license: string | null; recordCount: number }>;
  chemicals: Array<Record<string, unknown>>;
  npg: Array<Record<string, unknown>>;
  erg: Array<Record<string, unknown>>;
  thresholds: Array<Record<string, unknown>>;
  facilities: Array<Record<string, unknown>>;
  facilityChemicals: Array<Record<string, unknown>>;
}

function parseJsonField<T>(val: unknown, fallback: T): T {
  if (typeof val !== "string") return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}

export async function syncFromServer(): Promise<SyncResult> {
  const clientId = getClientId();
  let res: Response;
  try {
    res = await fetch(`/api/sync/${clientId}`, { cache: "no-cache" });
  } catch {
    return { ok: false, reason: "API unreachable (offline)" };
  }
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };

  const data: ApiSyncResponse = await res.json();

  await db.transaction(
    "rw",
    db.chemicals, db.npg, db.facilities,
    async () => {
      // Chemicals
      await db.chemicals.clear();
      for (const row of data.chemicals) {
        await db.chemicals.put({
          id: String(row.id),
          name: String(row.name),
          synonyms: parseJsonField(row.synonyms, []),
          cas: parseJsonField(row.cas, undefined),
          un: parseJsonField(row.un, undefined),
          na: parseJsonField(row.na, undefined),
          hazardClass: parseJsonField(row.hazardClass, []),
          packingGroup: parseJsonField(row.packingGroup, undefined),
          ergGuide: row.ergGuide ? String(row.ergGuide) : undefined,
          placard: row.placard ? String(row.placard) : undefined,
          ppe: parseJsonField(row.ppe, []),
          isolation: parseJsonField(row.isolation, {}),
          firstAid: parseJsonField(row.firstAid, []),
          reactivity: parseJsonField(row.reactivity, []),
          incompatibilities: parseJsonField(row.incompatibilities, []),
          sdsUrl: row.sdsUrl ? String(row.sdsUrl) : undefined,
          sources: parseJsonField(row.sources, []),
        });
      }

      // NPG
      await db.npg.clear();
      for (const row of data.npg) {
        await db.npg.put({
          id: String(row.id),
          name: String(row.name),
          synonyms: parseJsonField(row.synonyms, []),
          cas: row.cas ? String(row.cas) : undefined,
          rtecs: row.rtecs ? String(row.rtecs) : undefined,
          formula: row.formula ? String(row.formula) : undefined,
          exposureLimits: parseJsonField(row.exposureLimits, { pel: undefined, rel: undefined, idlh: undefined }),
          physical: parseJsonField(row.physical, {}),
          health: parseJsonField(row.health, { symptoms: [], targetOrgans: [], firstAid: [], respiratorSelection: [] }),
          ppe: parseJsonField(row.ppe, { skin: [], eye: [], respiratory: [] }),
          reactivity: parseJsonField(row.reactivity, { incompatibilities: [], waterReactive: false }),
          sources: parseJsonField(row.sources, []),
        });
      }

      // Facilities + chemicals
      await db.facilities.clear();
      for (const row of data.facilities) {
        const facChemicals = data.facilityChemicals
          .filter((fc) => fc.facilityId === row.id)
          .map((fc) => ({
            chemicalId: String(fc.chemicalId),
            maxDailyAmount: {
              value: Number(fc.maxDailyAmountValue),
              unit: String(fc.maxDailyAmountUnit),
            },
            container: fc.container ? String(fc.container) : undefined,
            conditions: fc.conditions ? String(fc.conditions) : undefined,
            lastReportedYear: Number(fc.lastReportedYear),
          }));
        await db.facilities.put({
          id: String(row.id),
          name: String(row.name),
          address: String(row.address),
          lat: row.lat ? Number(row.lat) : undefined,
          lng: row.lng ? Number(row.lng) : undefined,
          dunn: row.dunn ? String(row.dunn) : undefined,
          ehsFlag: Boolean(row.ehsFlag),
          source: String(row.source),
          lastUpdated: String(row.lastUpdated),
          chemicals: facChemicals,
        });
      }
    },
  );

  localStorage.setItem(SYNC_KEY, data.version);

  return {
    ok: true,
    version: data.version,
    counts: {
      chemicals: data.chemicals.length,
      npg: data.npg.length,
      erg: data.erg.length,
      thresholds: data.thresholds.length,
      facilities: data.facilities.length,
      facilityChemicals: data.facilityChemicals.length,
    },
  };
}

export async function ensureDataLoadedWithSync(): Promise<{ source: "bundled" | "synced" | "cached"; version: string }> {
  // Try server sync first.
  const sync = await syncFromServer();
  if (sync.ok) {
    return { source: "synced", version: sync.version };
  }

  // Fall back to bundled data if server is unreachable.
  const result = await ensureDataLoaded();
  if ("alreadyLoaded" in result) {
    return { source: "cached", version: result.version };
  }
  return { source: "bundled", version: result.version };
}

export function getLastSyncVersion(): string | null {
  return localStorage.getItem(SYNC_KEY);
}