<!-- cc-team deliverable
 group: GB (Bug/edge-case audit of critical chat-path modules)
 member: AUD-23 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1670,"completion_tokens":3116,"total_tokens":4786,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2690,"image_tokens":0},"cache_creation_input_tokens":0} | 40s
 generated: 2026-06-13T11:16:48.897Z -->
| severity | location (function or approx line) | issue | proposed fix |
|----------|-----------------------------------|-------|---------------|
| HIGH | `route(intent: GeoIntentResult)` – start of method | No null/undefined guard on `intent`. Calling `intent.domain` throws a runtime TypeError if `intent` is `null` or `undefined`. | Add: `if (intent == null) return null;` before destructuring. |
| HIGH | `route` – line `const { features, subdomain } = intent;` | No check that `intent.features` exists. Accessing `features.has_coords` will throw if `features` is missing or null. | Add guard: `const features = intent.features; if (!features) return null;` before using `features`. |
| MEDIUM | `route` – confidence check `intent.confidence < 0.6` | When `intent.confidence` is `undefined`, the expression evaluates to `false`, so the request is **not** rejected and proceeds as if confidence is high. This bypasses the low‑confidence guard. | Store confidence in a variable and treat missing as `0` (e.g. `const conf = intent.confidence ?? 0; if (conf < 0.6) return null;`). |
| LOW | `route` – `const place = features.location_terms.join(" ");` | If `location_terms` contains empty strings or whitespace‑only elements, `place` can become a whitespace‑only string (e.g. `"   "`). Downstream tool calls would receive an invalid location/place value. | Filter out empty/whitespace terms: `features.location_terms.filter(t => t.trim()).join(" ")` and recheck `hasPlace` based on the filtered array. |

**Overall risk verdict:** Moderate – lacking input guards on `intent` and `features` may lead to unhandled runtime crashes; otherwise routing logic is straightforward.
