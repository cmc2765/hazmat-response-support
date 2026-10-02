export const FRESH_CACHE_MS = 7 * 60 * 1000;
export const STALE_CACHE_MS = 30 * 60 * 1000;

export interface CachedValue<T> {
  fetchedAt: number;
  value: T;
}

export function cacheResult<T>(cache: Map<string, CachedValue<T>>, key: string, value: T): void {
  cache.set(key, { fetchedAt: Date.now(), value });
}

export function readFresh<T>(cache: Map<string, CachedValue<T>>, key: string): CachedValue<T> | null {
  const value = cache.get(key);
  return value && Date.now() - value.fetchedAt <= FRESH_CACHE_MS ? value : null;
}

export function readStale<T>(cache: Map<string, CachedValue<T>>, key: string): CachedValue<T> | null {
  const value = cache.get(key);
  return value && Date.now() - value.fetchedAt <= STALE_CACHE_MS ? value : null;
}

export async function fetchWithTimeout(
  fetchImpl: typeof globalThis.fetch,
  url: string,
  timeoutMs = 12_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json, text/csv" } });
  } finally {
    clearTimeout(timeout);
  }
}
