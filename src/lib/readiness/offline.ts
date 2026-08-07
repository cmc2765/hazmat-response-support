export type CacheFreshness = "Current" | "Recent" | "Stale" | "Expired" | "Unknown";

export interface CacheRecordMetadata {
  sourceId: string;
  sourceRevision: string;
  retrievedAt: string;
  observedAt: string | null;
  currentForMs: number;
  recentForMs: number;
  expiresAfterMs: number;
  checksumVerified: boolean;
}

export function evaluateCacheFreshness(record: CacheRecordMetadata, at = new Date()): {
  freshness: CacheFreshness;
  usableAsVerified: boolean;
} {
  const observed = record.observedAt ? Date.parse(record.observedAt) : Number.NaN;
  if (!Number.isFinite(observed)) return { freshness: "Unknown", usableAsVerified: false };
  const age = at.getTime() - observed;
  const freshness: CacheFreshness = age < 0 || age > record.expiresAfterMs
    ? "Expired"
    : age <= record.currentForMs
      ? "Current"
      : age <= record.recentForMs
        ? "Recent"
        : "Stale";
  return { freshness, usableAsVerified: freshness === "Current" && record.checksumVerified };
}
