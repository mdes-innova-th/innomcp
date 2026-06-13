<!-- cc-team deliverable
 group: G2 (Server-node module audit)
 member: SV035 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2755,"completion_tokens":3072,"total_tokens":5827,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2661,"image_tokens":0},"cache_creation_input_tokens":0} | 42s
 generated: 2026-06-13T11:32:45.801Z -->
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | Implicit tool handler (no handler exported) | No handler exported for `type: "hourly"`; schema allows it but no `fetchHourly` exists. Calling with `type="hourly"` will cause silent failure or unhandled error. | Implement `fetchHourlyForecast` function and wire up a dispatcher based on `type`; export the dispatcher as the tool handler. |
| HIGH | Module scope | Zero `export` statements – `fetchCurrentWeather`, `fetchForecast`, etc. are not exported. MCP server registration will fail because these functions are inaccessible. | Add `export` keyword to all functions that are intended for external use. |
| MEDIUM | `fetchCurrentWeather` / `fetchForecast` | `fetch()` called without timeout. A network stall or unresponsive API causes the tool to hang indefinitely, potentially blocking the MCP server. | Pass an `AbortController` with a sensible timeout (e.g. 10 s) to `fetch`. |
| LOW | `formatCurrentWeather` | Accesses `data.weather[0].description` without checking array length. If API returns empty `weather` array, it throws `TypeError` (caught by outer catch but returns a less descriptive error). | Guard with `data.weather?.[0]` or provide a fallback string. |
| LOW | `fetchForecast` – `forEach` body inside `formatForecast` | The truncated code appears to end after `byDate.set(date, []); }` without pushing the item. If the actual file is exactly as shown, the day-grouping map remains empty. | Ensure `byDate.get(date)!.push(item);` is present after the `if` block. |

**Risk verdict:** HIGH – Missing hourly forecast path and lack of module exports render the tool non-functional.
