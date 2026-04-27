/**
 * Simple Map-based TTL cache for slow TMD endpoints.
 *
 * Five TMD observation endpoints query 100s of weather stations and take
 * 28–52s per call (live verification 2026-04-27). Caching shaves the
 * second/third call to <1ms while keeping freshness windows aligned with
 * upstream observation cadence (3-hourly or 7am daily).
 *
 * Deliberately not Redis: single-node MCP server, no cross-instance
 * coordination needed. Keep it tiny — no LRU eviction; entries auto-evict
 * lazily on get when expired.
 */

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function tmdCacheGet(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function tmdCacheSet(key: string, data: unknown, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// Test-only helper — not exported via a barrel.
export function _tmdCacheClearForTests(): void {
  cache.clear();
}

// Per-tool TTLs. Tools missing here are NOT cached (default behavior preserves
// existing freshness for fast endpoints like by-province queries).
export const TMD_CACHE_TTL_MS: Readonly<Record<string, number>> = Object.freeze({
  tmd_weather_today_07am_all_stations: 300_000, // 5 min
  tmd_weather_3hours_all_stations: 180_000,     // 3 min
  tmd_weather_today_by_hydro_07am: 300_000,
  tmd_weather_today_by_agro_07am: 300_000,
  tmd_weather_today_by_synop_07am: 300_000,
});

export function getTmdCacheTtlMs(toolName: string): number | null {
  return TMD_CACHE_TTL_MS[toolName] ?? null;
}
