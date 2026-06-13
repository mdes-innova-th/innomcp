<!-- cc-team deliverable
 group: G2 (perf division)
 member: PER-029 role=perf model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1570,"completion_tokens":2960,"total_tokens":4530,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2591,"image_tokens":0},"cache_creation_input_tokens":0} | 41s
 generated: 2026-06-13T12:04:26.023Z -->
| severity | location | issue | fix |
|----------|----------|-------|-----|
| Medium | `reapStaleEntries()` scheduled interval (line ~100–112) | O(N) linear scan across all projects and all user entries every 30 s, which can cause CPU spikes if the active user/project count grows large. | Replace in-memory linear scan with a priority queue keyed on expiration timestamp, or maintain a separate sorted list of entries by `lastPingAt` to prune only expired ones. |
| Low | `join()` function, refresh branch (line ~60) | Creates a new object `{ ...existing, displayName, lastPingAt: now }` on every presence refresh, generating unnecessary allocations under frequent pings. | Mutate the existing entry directly: `existing.displayName = displayName; existing.lastPingAt = now;` |
| Low | `broadcast()` function (line ~87) | No size guard on the input `message` before `JSON.stringify`. A very large object can produce an enormous string, causing long synchronous serialization time and large memory allocation that blocks the event loop. | Enforce a configurable payload size limit (e.g., 64 KB) and reject or truncate if exceeded; if streaming is needed, chunk the send or offload serialization. |
| Low | `join()` function, timestamp creation (line ~58) | `new Date().toISOString()` creates a new string on every join/ping. Under very high call frequency this generates GC pressure. | Store a numeric `lastPingAtTimestamp` (e.g., `Date.now()`) and only format to ISO‑8601 string inside `getPresence()` when responding to API clients. |
