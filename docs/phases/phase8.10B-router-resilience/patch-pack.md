# Phase 8.10B Patch-Pack

_For Implementer (Vit)_

## Target Files & Intent

| File                                                                   | Intent / Reason                                                                                                                                                                                                        | Risk/Watchout                                                                                                                  |
| :--------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `innomcp-node/src/utils/router/keywordDb.ts` (or similar DB connector) | **Snapshot Fallback & Circuit Breaker**: If `query()` throws, catch it instantly. Set a boolean flag `isDbDown = true` and `nextRetryTime = Date.now() + 60000`. Return data from a local JSON snapshot array instead. | Make sure the snapshot parsing happens synchronously or is cached at startup. Do not read the file off disk on every fallback. |
| `innomcp-node/src/utils/router/intentRouter.ts`                        | **Meta Tagging**: Append `keywordSource: "snapshot"                                                                                                                                                                    | "db"` to the final returned Intent object so the tracing logger can record it.                                                 | Ensure the property is optional or cleanly merged to avoid breaking downstream strict types. |
| `innomcp-node/scripts/verify_phase810b_router.ts`                      | **New Verifier**: Inject a mock DB failure, and assert the output logic proceeds unhindered with the `"snapshot"` tag.                                                                                                 | Do not accidentally leave the real instance corrupted.                                                                         |

## Pseudo-Code: Circuit Breaker + Snapshot

```typescript
let isDbDown = false;
let retryAfter = 0;
const snapshotCache = require("./keywords.snapshot.json"); // Loaded once

async function fetchKeywords() {
  if (isDbDown && Date.now() < retryAfter) {
    return { data: snapshotCache, source: "snapshot" };
  }

  try {
    const result = await db.query("SELECT ...");
    // If recovered:
    isDbDown = false;
    return { data: result, source: "db" };
  } catch (err) {
    console.warn("[KeywordDB] Connection failed. Dropping to snapshot.");
    isDbDown = true;
    retryAfter = Date.now() + 60000; // 60s circuit breaker
    return { data: snapshotCache, source: "snapshot" };
  }
}
```
