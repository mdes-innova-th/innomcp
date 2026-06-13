<!-- cc-team deliverable
 group: G1 (Server-node module audit)
 member: SV004 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3770,"completion_tokens":2162,"total_tokens":5932,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1879,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-13T11:20:24.200Z -->
| Severity | Location                                              | Issue                                                                     | Proposed Fix                                                                                                  |
|----------|-------------------------------------------------------|---------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| HIGH     | `getProvinceCoords` function, after `name.trim()`     | Blank/whitespace-only input (e.g. `"   "`) is not caught after trimming; `normalized` becomes `""`, which makes `k.toLowerCase().includes("")` true for all entries, returning the province with the shortest key (e.g., "กทม" → Bangkok) silently. | Add an early return after trimming: `const normalized = name.trim().toLowerCase(); if (!normalized) return undefined;` (before existing `if (!name)`). |
| MED      | `getProvinceCoords` function, partial match fallback  | Ambiguous partial match (e.g. "ชัย") returns arbitrary province (ชัยนาท) because sorting by shortest key does not guarantee the intended location; no indication of multiple matches.                 | When multiple partial matches exist, return `undefined` (or log a warning) to avoid silent incorrect results. Optionally, use exact substring match with strict criteria. |

**1-line risk verdict:** Silent return of wrong coordinates for blank input and unresolved ambiguities can feed invalid locations to downstream APIs, leading to incorrect weather data and potential decision errors.
