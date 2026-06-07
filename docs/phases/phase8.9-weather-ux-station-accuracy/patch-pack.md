# Phase 8.9 Patch-Pack

_For Implementer (Vit)_

## Target Files & Intent

| File                                                                  | Intent / Reason                                                                                                                                                                                                                                          |
| :-------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `innomcp-node/src/utils/locationResolver.ts`                          | **Bangkok Mapping**: Add explicit rules for `หลักสี่`, `ลาดกระบัง`, `บางเขน`, `พญาไท`. Strip `เขต`/`แขวง` prefix securely. Map alias `กทม` adjacent to these directly to `Bangkok` context.                                                              |
| `innomcp-node/src/utils/weather/weatherPipeline.ts`                   | **Sequential Multi-target**: Ensure `Promise.allSettled` or isolated `for...of` loops apply so one district’s API failure doesn't reject the whole Request Context. Handle `PROVINCE_NOT_FOUND_IN_FORECAST` with an explicit `break/return` to skip NWP. |
| `innomcp-node/src/utils/mcp/tmdTool.ts` (or equivalent API connector) | **Redaction & Budget**: Implement regex stripping for `uid=.*&?` and `ukey=.*&?`. Enforce strict timeout parameter transmission. Delete `requestInfo.headers` before writing to trace.                                                                   |
| `innomcp-node/scripts/verify_phase89_weather.ts`                      | **New Verifier**: Must assert `!output.includes('30°C')`, `!output.includes('uid=')`, and specifically test `หลักสี่` and `ลาดกระบัง` concurrently.                                                                                                      |

## Pseudo-Code: Bangkok District Normalization

```typescript
function normalizeBangkokDistrict(input: string): string {
  const bkkAliases = ["กทม", "กรุงเทพ", "กรุงเทพฯ", "BKK"];
  let normalized = input;
  // Strip prefixes
  normalized = normalized.replace(/เขต|แขวง/g, "").trim();
  // Force BKK context if isolated district names match known core districts
  const knownDistricts = ["หลักสี่", "ลาดกระบัง", "บางเขน", "พญาไท"];
  if (knownDistricts.includes(normalized)) {
    // Append metadata or map to BKK station array lookup
  }
  return normalized;
}
```

## Pseudo-Code: Sequential Multi-Target Budgeting

```typescript
for (const target of targets) {
  try {
    const result = await fetchStationData(target, { signal: abortSignal });
    results.push(result);
  } catch (err) {
    if (err.name === "AbortError") throw err; // Bubble up global timeout
    results.push({ error: `ERR:WX_UPSTREAM for ${target}` }); // Isolate failure
    continue;
  }
}
```

## Strict Implementer Warnings!

- 🚫 **DO NOT** use placeholders (`30°C`, `70%`). Real API data or Operator `ERR:*` tokens ONLY.
- 🚫 **DO NOT** use an LLM (`askOllama` or otherwise) to 'guess' weather or districts.
- 🚫 **DO NOT** let `uid` or `ukey` reach `console.log` or `.log` evidence files.
