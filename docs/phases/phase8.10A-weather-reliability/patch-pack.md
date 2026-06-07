# Phase 8.10A Patch-Pack

_For Implementer (Vit)_

## Target Files & Intent

| File                                                                      | Intent / Reason                                                                                                 | Risk/Watchout                                                                                                                         |
| :------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| `innomcp-node/src/utils/mcp/tmdTool.ts` (or connector adapter)            | **Key-safe logging:** Introduce URL sanitization specifically before writing to the Trace log or console.       | Do not overwrite the URL object passed to `fetch()`. Clone or stringify purely for the log output to preserve the actual credentials. |
| `innomcp-node/src/utils/weather/weatherPipeline.ts` or `stationEngine.ts` | **Station cache requirement:** Wrap the TMD 3H/7D lookup in an in-memory TTL map. Cache key = `StationID_Date`. | Ensure cache size is bounded. Ensure `abortSignal` rejections are NOT cached.                                                         |
| `innomcp-node/evidence/*.log` (Target for Verifier)                       | **Evidence rule:** Assure no secrets exist. Run verifier scripts explicitly asserting this.                     | None. Verifier only.                                                                                                                  |

## Pseudo-Code: Key-Safe Logging

```typescript
function maskTmdUrlForLogging(url: string): string {
  return url
    .replace(/uid=[^&]+/g, "uid=***")
    .replace(/ukey=[^&]+/g, "ukey=***");
}

// In the fetch wrapper:
const realUrl = "https://data.tmd...&uid=" + env.UID;
logger.info(`Fetching WX: ${maskTmdUrlForLogging(realUrl)}`);
const res = await fetch(realUrl, { signal });
```

## Pseudo-Code: Station Cache Requirement

```typescript
const wxCache = new Map<string, { expiresAt: number; data: any }>();

async function getStationDataCached(stationId: string): Promise<any> {
  const key = `station_${stationId}`;
  const cached = wxCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[WeatherCache] HIT ${key}`);
    return cached.data;
  }

  // Fetch...
  console.log(`[WeatherCache] SET ${key}`);
  wxCache.set(key, { expiresAt: Date.now() + 15 * 60000, data: freshData });
  return freshData;
}
```
