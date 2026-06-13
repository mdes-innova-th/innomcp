<!-- cc-team deliverable
 group: G2 (serverdeep division)
 member: SERV-048 role=audit model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":2220,"completion_tokens":5000,"total_tokens":7220,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 116s
 generated: 2026-06-13T12:25:52.156Z -->
The user wants a deep bug audit of the provided TypeScript code for a World Bank MCP tool. I need to analyze it for:

1. Unhandled rejections
2. Missing timeouts
3. Race conditions
4. Resource leaks
5. Error envelope correctness
6. MCP protocol edge cases

Let me carefully review the code.

**Code Analysis:**

1. **fetchWorldBankData function:**
   - Uses `fetch(url)` without any timeout. This is a classic missing timeout issue. `fetch` in Node.js will hang indefinitely if the server doesn't respond.
   - No AbortController signal passed to fetch.
   - The `response.ok` check happens, but if response is not OK, it throws. However, what if the response body is malformed JSON? `await response.json()` could throw.
   - Actually, looking at the flow: if `!response.ok`, it throws before `response.json()`. But if response is OK but JSON parsing fails, the catch block handles it.
   - Wait, the code does `const data = await response.json();` after checking `response.ok`. But what about HTTP 204 or empty body? World Bank API returns JSON, but edge cases exist.

2. **Error handling:**
   - The catch block catches errors and returns a JSON string with `success: false`. But is this correct for MCP protocol?
   - MCP tools should return errors in a specific way. The code returns a stringified JSON as the tool result. MCP expects tool results to be either content array or error object depending on SDK version. But looking at the code, it seems to return a string. If the MCP SDK expects `{ content: [...] }` or throws to signal tool error, this might be wrong.
   - Actually, in MCP, tools should return `{ content: [{ type: 'text', text: '...' }] }` or similar structure, not just a raw string. But the code returns a string from `fetchWorldBankData` and that gets used as... wait, the tool definition is truncated. But typically MCP tools in the TypeScript SDK return an object with `content` array.
   - However, the prompt asks specifically about "error envelope correctness". If the tool returns a stringified JSON with `success: false` inside it, that's not an MCP error envelope. It's a success response containing an error description. The MCP protocol has `isError` flag or throws McpError. Returning a string with internal JSON error is not the standard way.

3. **Zod schema validation:**
   - The schema is defined but I don't see `.safeParse()` or `.parse()` in the visible code. Since the tool definition is truncated, I can't see if validation happens. But if validation fails and `.parse()` is used, it throws. If the tool handler doesn't catch Zod errors, it becomes an unhandled rejection or uncaught exception depending on async handling.

4. **Resource leaks:**
   - `fetch` response body might not be consumed if `response.ok` is false? Actually, if `response.ok` is false, the code throws before reading the body. In Node.js fetch, not consuming the body might not be a huge leak, but it's better to cancel/abort. However, the main issue is no timeout.

5. **Race conditions:**
   - Not obvious in this single-file code. But if multiple requests happen, there's no deduplication or request caching. Not necessarily a race condition bug.

6. **MCP protocol edge cases:**
   - The tool returns a plain string. MCP expects structured content. If the tool result is just a string, the MCP SDK might wrap it, but if not, it's a protocol issue.
   - Error handling: MCP distinguishes between transport errors, protocol errors, and tool execution errors. Tool execution errors should set `isError: true` in the result object (in MCP 2024-11-05 schema). Just returning a string with JSON error doesn't set the protocol-level error flag.
   - Also, the `formatWorldBankData` function can throw if `latest` is undefined? Wait, it checks `if (sorted.length === 0)` and returns early. But what if `values` is empty? That's handled. What if `values` has items but all have `value === null`? Then `sorted` is empty, handled.
   - What if `latest.country` or `latest.indicator` is undefined? The World Bank API might return malformed objects. Accessing `latest.country.value` without null checks could throw.

7. **Date range logic bug:**
   ```typescript
   const dateRange = params.startYear && params.endYear 
     ? `${params.startYear}:${params.endYear}`
     : params.startYear 
     ? `${params.startYear}:${new Date().getFullYear()}`
     : "";
   ```
   If `startYear` is 0 (but Zod prevents this since min is 1960), but more importantly, if `endYear` is provided without `startYear`, `dateRange` becomes empty string. This means you can't query with only endYear. Not necessarily a bug, but an API limitation. However, the logic `params.startYear && params.endYear` is fine since Zod ensures numbers.

8. **URL construction:**
   - `countryCode` is user input trimmed. If it contains slashes or special chars, URL injection is possible. E.g., `params.country = "US/indicator/foo"` could manipulate the URL path. No URL encoding.
   - `indicatorCode` comes from user input (or resolved). No URL encoding either.
   - This is a security/robustness issue.

9. **Unhandled rejections:**
   - If `fetch` rejects (network error), it's caught by the try/catch. Good.
   - But what about `logBoth`? If `logBoth` throws or rejects (if it's async and not awaited), but it's awaited? No, `logBoth` is called synchronously-looking but if it's async and returns a promise that's not awaited, it's unhandled. The code shows `logBoth("INFO", ...)` without await. If `logBoth` is async, that's an unhandled rejection. The import is from `../../utils/mcpLogger`. Since we can't see the implementation, but the name suggests it might be async (logging to both console and MCP). If it's async and not awaited, that's a bug.

10. **Error envelope correctness:**
    - The function returns a string. In MCP, tool handlers should return `{ content: [{ type: 'text', text: result }] }` or similar. Returning a raw string might not conform to the expected envelope.
    - For errors, MCP has specific error codes. The code returns a success-false JSON string instead of throwing an `McpError` or returning `isError: true`.

11. **Missing timeouts:**
    - `fetch` has no timeout. Node.js fetch defaults to no timeout (or system TCP timeout which can be very long).

12. **Type safety:**
    - `error: any` in catch block. Not a runtime bug but `error.message` might fail if error is not an Error object. Though `String(error)` is used in log, the return uses `error.message || "Unknown error"`. If error is null/undefined, `error.message` throws. Wait, `error` is typed as `any`, so `error.message` won't throw at compile time, but at runtime if error is `null`, it would throw. But `fetch` and `response.json()` throw Error objects. However, if a user throws a string or null somewhere, it could fail. But this is minor.

13. **JSON parsing of World Bank API:**
    - World Bank API returns `[metadata, data]`. The code checks `!Array.isArray(data) || data.length < 2`. But what if `data[1]` is null? Then `values: IndicatorValue[] = data[1]` could be null, and `values.length` would throw. The code checks `if (!values || values.length === 0)` after casting, which handles null. Good.

14. **formatNumber precision:**
    - `value.toFixed(2)` on large numbers? No, the large number branches handle it before. But what about `value = 999999` (less than 1e6)? It goes to `toLocaleString`. Good.

15. **resolveIndicatorCode:**
    - Partial match logic: `if (upper.includes(key))`. If indicator is "GDP_GROWTH", upper is "GDP_GROWTH". It matches "GDP" first in iteration? Object.entries order is insertion order. "GDP" is before "GDP_GROWTH". So "GDP_GROWTH" would match "GDP" first and return the wrong code. This is a logic bug.
    - Example: input "GDP_GROWTH" -> upper is "GDP_GROWTH". Direct match exists? Yes, "GDP_GROWTH" is a key. So direct match works. But what if input is "GDP GROWTH"? Upper is "GDP GROWTH". Direct match fails. Partial match: "GDP" is included in "GDP GROWTH", so it returns GDP code instead of GDP_GROWTH code. This is ambiguous but maybe acceptable. However, the order of COMMON_INDICATORS matters. If someone passes "GDP", it matches "GDP". If someone passes "GDP_GROWTH", direct match catches it before partial. But if someone passes "GROWTH", it might match "GDP_GROWTH" because "GROWTH" is in "GDP_GROWTH"? No, `upper.includes(key)` checks if the input includes the key. So "GROWTH" does not include "GDP_GROWTH". But "GDP" includes "GDP". So partial matching is input.includes(key), not key.includes(input). So it's safer. But still, "GDP" would match before "GDP_GROWTH" if the input was something like "GDP AND GROWTH" (weird). Not a major bug.

16. **Country code injection:**
    - `params.country` is used directly in URL. No validation that it's actually a country code vs path traversal. Zod only checks min length 2. A country like "all" or "US;CN" or "../.." could be passed. World Bank API might handle it, but it's risky.

17. **Missing AbortController / cleanup:**
    - If the MCP tool call is cancelled by the client, there's no way to propagate the cancellation to the fetch request. The request continues in the background, wasting resources.

18. **Truncated code:**
    - The tool definition is truncated. I should assume the handler uses this fetch function and returns its result. I need to audit what's visible.

Let me structure the findings into a table: severity | location | issue | fix.

Severity levels: Critical, High, Medium, Low.

Issues found:

1. **Critical - Missing fetch timeout** - `fetch(url)` hangs indefinitely. Fix: Use AbortController with setTimeout.
2. **High - URL injection / unencoded path segments** - `countryCode` and `indicatorCode` interpolated directly into URL path without encodeURIComponent. Fix: Use encodeURIComponent.
3. **High - Potential unhandled rejection from async logger** - `logBoth` may be async but is called without await. Fix: await logBoth or ensure it's sync.
4. **High - MCP error envelope violation** - Returning stringified JSON error instead of proper MCP tool error envelope (isError: true + content array). Fix: Return proper MCP result object with isError flag and content array.
5. **Medium - Missing response body consumption on error** - When response.ok is false, throw before reading body. In some fetch implementations, this can leave connections hanging. Fix: Cancel/abort or drain response.body.
6. **Medium - No request cancellation propagation** - No AbortController signal linked to MCP request lifecycle. Fix: Accept signal from MCP handler and pass to fetch.
7. **Medium - Unsafe property access on API response** - `latest.country.value`, `latest.indicator.value` assume nested objects exist. Fix: Add optional chaining and validation.
8. **Medium - Error object assumption** - `error.message` assumes caught error is an Error instance. Fix: Use `error instanceof Error ? error.message : String(error)`.
9. **Low - Date range logic ignores endYear-only queries** - If endYear provided without startYear, dateRange is empty. Fix: Support endYear-only or validate mutually.
10. **Low - Partial indicator match ambiguity** - Partial matching order could cause wrong indicator resolution for compound names. Fix: Prefer exact match, then prefix, then fuzzy; or remove partial matching.

Wait, I need to be careful about MCP protocol specifics. In the MCP TypeScript SDK, a tool handler typically returns an object like:
```typescript
return {
  content: [{ type: "text", text: result }],
  isError: boolean // optional in some versions, but in 2024-11-05 it's part of CallToolResult
};
```

If the code returns just a string from `fetchWorldBankData`, and the tool handler returns that string directly, it's wrong. But I can only see up to the tool definition start. The truncation shows `export const worldBankTool = { name: "worldbank", description: "Access ...`. I don't see the handler. However, the prompt asks to audit the module. I should flag the return type mismatch.

Actually, looking at the code, `fetchWorldBankData` returns a `Promise<string>`. If the tool handler returns this string as the tool result, it's likely incorrect because MCP expects structured content. But some SDKs might accept a string? No, the protocol expects JSON-RPC with result object containing `content`.

Let me also consider the `formatWorldBankData` function. It does:
```typescript
const sorted = values
  .filter(v => v.value !== null)
  .sort((a, b) => parseInt(b.date) - parseInt(a.date));
```
If `b.date` is not a valid year string, `parseInt` returns NaN, and sorting becomes unstable. But that's minor.

Also, `parseInt(b.date)` - if date is "2020Q1" or something, parseInt returns 2020, which might be okay. But World Bank API usually returns years.

Another issue: The `COMMON_INDICATORS` partial match uses `Object.entries`. The order is:
1. GDP
2. GDP_GROWTH
3. POPULATION
...
If someone passes indicator "GDP_GROWTH", direct match works. If someone passes "MY_GDP", upper is "MY_GDP". Direct match fails. Partial: "GDP" is included in "MY_GDP"? No, "MY_GDP".includes("GDP") is true. So it returns GDP. That's fine. But if someone passes "GDP_GROWTH_FOO", it includes "GDP" first, so returns GDP instead of GDP_GROWTH. This is a logic bug in partial matching. But since direct match is checked first, only weird cases hit this.

Let me think about "Unhandled rejections" specifically. The `fetch` is awaited inside try/catch, so network rejections are caught. But what if `logBoth` is async and returns a promise? The code doesn't await it. If `logBoth` rejects, it's an unhandled rejection. This is a strong candidate.

Also, `response.json()` on a large response could be slow, but no timeout there either (though fetch timeout would cover it if implemented).

Race conditions: Not really any shared mutable state. The module-level constants are read-only. No race condition bugs visible.

Resource leaks: The main one is fetch without timeout/abort. Also, if the tool is called many times, there's no connection pooling control, but that's Node.js fetch default.

MCP protocol edge cases:
- The tool returns a stringified JSON with `success: false` for errors. This means the MCP layer sees a successful tool execution with text output. The client won't know it's an error at the protocol level. The correct way is to return `isError: true` in the result object, or throw an McpError with appropriate code.
- Also, if the input validation fails (Zod), and if the handler uses `.parse()`, it throws. If the MCP server doesn't catch Zod errors and convert them to INVALID_PARAMS errors, that's a protocol issue. But I can't see the handler.

Let me draft the table entries:

| severity | location | issue | fix |
|---|---|---|---|
| Critical | `fetchWorldBankData` (`fetch(url)`) | No timeout on `fetch`; request can hang indefinitely if World Bank API stalls, leaking the tool call and potentially the server process. | Pass an `AbortController` signal with `setTimeout` to `fetch`, or wrap with `Promise.race` against a timeout promise. |
| High | `fetchWorldBankData` (URL construction) | Raw user input (`countryCode`, `indicatorCode`) interpolated into URL path without `encodeURIComponent`, enabling path traversal and request manipulation. | Wrap path segments with `encodeURIComponent(countryCode)` and `encodeURIComponent(indicatorCode)`. |
| High | `logBoth` calls | `logBoth` is invoked without `await`; if the utility is async and rejects, it creates an unhandled promise rejection that can crash the Node process depending on `--unhandled-rejections` policy. | `await logBoth(...)` in all locations, or ensure the utility is synchronous. |
| High | `fetchWorldBankData` catch block / return value | Errors are returned as a plain JSON string with `success: false`, violating MCP protocol error envelopes. The MCP layer treats this as a successful tool result instead of a tool execution error. | Return an MCP-compliant result object: `{ content: [{ type: 'text', text: jsonError }], isError: true }` (or throw `McpError`). |
| Medium | `fetchWorldBankData` (`response.ok` check) | On non-OK HTTP status, the response body is never read/cancelled, which can leave underlying TCP connections in a half-closed state until GC. | Cancel the AbortController or consume/drain `response.body` before throwing. |
| Medium | `fetchWorldBankData` (API response parsing) | Unsafe deep property access (`latest.country.value`, `latest.indicator.value`) assumes World Bank never returns malformed/empty nested objects, risking unhandled runtime exceptions. | Use optional chaining (`latest?.country?.value`) and validate shape before formatting. |
| Medium | `fetchWorldBankData` (error catch) | Caught value typed as `any`; accessing `error.message` fails if a non-Error value is thrown (e.g., string, null), causing a secondary exception. | Normalize: `const msg = error instanceof Error ? error.message : String(error)`. |
| Medium | Tool handler envelope (implied by `fetchWorldBankData` return type) | Function returns `Promise<string>`, but MCP tool handlers must return a structured result object (`{ content: [...] }`). Returning a raw string breaks the JSON-RPC content envelope. | Ensure the tool handler wraps the string: `return { content: [{ type: 'text', text: result }] }`. |
| Low | `dateRange` construction | If only `endYear` is provided without `startYear`, the date range is silently dropped, ignoring the user's end boundary. | Build range logic that handles `endYear`-only: `${startYear || 1960}:${endYear || currentYear}`. |
| Low | `resolveIndicatorCode` | Partial substring match (`upper.includes(key)`) over `Object.entries` iterates in insertion order; compound indicators like "GDP_GROWTH" could incorrectly resolve to "GDP" if direct match were ever bypassed. | Remove partial matching or rank matches by specificity (exact > prefix > substring). |

Wait, the prompt says "Deep bug audit (server-node MCP): unhandled rejections, missing timeouts, race conditions, resource leaks, error envelope correctness, MCP protocol edge cases."

I should make sure I cover all these categories.

- Unhandled rejections: logBoth not awaited. Also if Zod parse is used in handler (not visible). I'll stick to visible code.
- Missing timeouts: fetch timeout.
- Race conditions: None obvious, but I could mention lack of request deduplication? No, that's not a race condition bug per se. Maybe the lack of AbortController means concurrent requests can pile up? Not exactly a race condition. I'll skip if none.
- Resource leaks: fetch without abort/timeout leaks the socket/connection. Also response body not consumed.
- Error envelope correctness: The success:false JSON string instead of MCP isError.
- MCP protocol edge cases: The raw string return instead of content array. Also no propagation of client cancellation.

Let me refine the table to be concise and accurate.

One more thing: In `formatWorldBankData`, the `sorted` array is filtered for `v.value !== null`. Then `latest` is `sorted[0]`. The check `if (sorted.length === 0)` handles empty. Good.

But what about `values` being undefined? The code does `const values: IndicatorValue[] = data[1];`. If `data[1]` is undefined, `values` is undefined. Then `if (!values || values.length === 0)` catches it. Good.

What about `data[0]`? It's typed but not really used except cast. Fine.

What about `countryCode = (params.country || "TH").trim()`. Zod schema says `min(2)`, so `params.country` should be at least 2 chars. But if it's whitespace? Zod `.min(2)` counts characters, not trimmed length. So `"  "` (2 spaces) passes Zod but becomes empty after trim. Then URL has empty country. This is a bug! The trim happens after defaulting. If `params.country` is `"  "`, Zod passes (length 2), but `("  " || "TH").trim()` becomes `""`. Then URL is `https://api.worldbank.org/v2/country//indicator/...`. That's bad. Should trim before Zod validation or use `.transform(v => v.trim()).pipe(z.string().min(2))`.

Actually, Zod string min(2) doesn't trim by default. So this is a validation bypass.

Let me add this.

Also, `startYear` and `endYear`: Zod validates them, but what if `startYear > endYear`? The code doesn't validate the range relationship. World Bank API might error or return empty. Not a critical bug but edge case.

Another MCP edge case: The tool description is truncated in the export. Not relevant.

Let me also think about the `fetch` response. World Bank API sometimes returns XML if `format=json` is omitted, but here it's included. However, if the API returns a single object instead of array for errors (e.g., `{ message: [...] }`), the `!Array.isArray(data)` check catches it. Good.

What about the `per_page=100`? If there are more than 100 results, pagination is ignored. The metadata has `pages`. The code doesn't handle pagination. It just takes the first 100. For long time series, this might be okay (100 years), but for multiple countries it could truncate. The tool is for one country/indicator, so 100 years is fine. Not a bug.

Let me finalize the table. I'll include 8-10 items covering all requested categories.

Refined list:

1. **Critical**: fetch timeout missing.
2. **High**: URL path injection (no encodeURIComponent).
3. **High**: logBoth unhandled rejection (async fire-and-forget).
4. **High**: MCP error envelope incorrect (returning stringified JSON error instead
