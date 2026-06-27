// Data loader: validates bundled data with Zod and seeds Dexie on first run
// (or when the bundled data version changes).

import { Chemical, NPGRecord, Facility } from "@/lib/schema";
import { db } from "@/lib/db";
import { ALL_CHEMICALS } from "@/data/all-chemicals";
import { NPG } from "@/data/npg";
import { FACILITIES } from "@/data/facilities";

export const DATA_VERSION = "2025-01-01";
const DATA_STAMP_KEY = "data-loaded-version";

export interface SeedResult {
  chemicals: number;
  npg: number;
  facilities: number;
  version: string;
}

function validate<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ path: Array<string | number>; message: string }> } } }, raw: unknown, label: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`[seed] ${label} failed validation: ${issue.path.join(".")} — ${issue.message}`);
  }
  return result.data;
}

export async function isDataLoaded(): Promise<boolean> {
  const v = await db.meta?.get(DATA_STAMP_KEY);
  return v?.value === DATA_VERSION;
}

export async function markDataLoaded(): Promise<void> {
  await db.meta.put({ key: DATA_STAMP_KEY, value: DATA_VERSION, at: new Date().toISOString() });
}

export async function loadBundledData(): Promise<SeedResult> {
  const chemicals = ALL_CHEMICALS.map((c) => validate(Chemical, c, `chemical ${c.id}`));
  const npg = NPG.map((n) => validate(NPGRecord, n, `npg ${n.id}`));
  const facilities = FACILITIES.map((f) => validate(Facility, f, `facility ${f.id}`));

  await db.transaction("rw", db.chemicals, db.npg, db.facilities, async () => {
    await db.chemicals.clear();
    await db.npg.clear();
    await db.facilities.clear();
    await db.chemicals.bulkAdd(chemicals);
    await db.npg.bulkAdd(npg);
    await db.facilities.bulkAdd(facilities);
  });

  await markDataLoaded();

  return {
    chemicals: chemicals.length,
    npg: npg.length,
    facilities: facilities.length,
    version: DATA_VERSION,
  };
}

export async function ensureDataLoaded(): Promise<SeedResult | { alreadyLoaded: true; version: string }> {
  if (await isDataLoaded()) {
    return { alreadyLoaded: true, version: DATA_VERSION };
  }
  return loadBundledData();
}
