import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  tmdCacheGet,
  tmdCacheSet,
  _tmdCacheClearForTests,
  getTmdCacheTtlMs,
  TMD_CACHE_TTL_MS,
} from "../utils/tmdCache";

beforeEach(() => {
  _tmdCacheClearForTests();
});

test("tmdCacheGet returns null for cache miss", () => {
  assert.equal(tmdCacheGet("nope:no-such-key"), null);
});

test("tmdCacheGet returns stored value within TTL", () => {
  const key = "tmd:test:hit";
  const payload = { ok: true, data: { stations: 100 } };
  tmdCacheSet(key, payload, 60_000); // 1 minute
  assert.deepEqual(tmdCacheGet(key), payload);
});

test("tmdCacheGet returns null for expired entry", async () => {
  const key = "tmd:test:expired";
  tmdCacheSet(key, { stale: true }, 5); // 5ms TTL
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(tmdCacheGet(key), null);
});

test("getTmdCacheTtlMs returns spec'd TTL for the 5 slow endpoints", () => {
  assert.equal(getTmdCacheTtlMs("tmd_weather_today_07am_all_stations"), 300_000);
  assert.equal(getTmdCacheTtlMs("tmd_weather_3hours_all_stations"), 180_000);
  assert.equal(getTmdCacheTtlMs("tmd_weather_today_by_hydro_07am"), 300_000);
  assert.equal(getTmdCacheTtlMs("tmd_weather_today_by_agro_07am"), 300_000);
  assert.equal(getTmdCacheTtlMs("tmd_weather_today_by_synop_07am"), 300_000);
});

test("getTmdCacheTtlMs returns null for non-cached tools", () => {
  assert.equal(getTmdCacheTtlMs("tmd_weather_forecast_7days_by_province"), null);
  assert.equal(getTmdCacheTtlMs("unknown_tool"), null);
});

test("TMD_CACHE_TTL_MS is frozen (immutable spec)", () => {
  assert.ok(Object.isFrozen(TMD_CACHE_TTL_MS));
});
