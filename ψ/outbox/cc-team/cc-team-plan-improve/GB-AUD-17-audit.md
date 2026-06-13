<!-- cc-team deliverable
 group: GB (Bug/edge-case audit of critical chat-path modules)
 member: AUD-17 role=audit model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1061,"completion_tokens":3297,"total_tokens":4358,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2918,"image_tokens":0},"cache_creation_input_tokens":0} | 64s
 generated: 2026-06-13T11:15:10.563Z -->
| severity | location | issue | proposed fix |
|---|---|---|---|
| MED | `buildAnswerContract` (freshness logic) | If sources contain both "recent" and "stale" items (but no "live"), the logic falls through to `includes("recent")` and returns "recent", silently masking the presence of "stale" sources. Similarly, "live" + "recent" incorrectly returns purely "live". | Replace boolean flags with a Set to detect any mix: `const unique = new Set(freshnessValues); if (unique.size > 1) freshness = "mixed"; else if (unique.has("live")) freshness = "live"; ...` |
| MED | `buildAnswerContract` (return object) | Arrays (`sources`, `toolsUsed`, `memoryEntities`, `degradedReasons`) are assigned by direct reference from `params`. If the caller mutates these arrays post-creation, the "immutable" contract snapshot is silently altered. | Shallow copy all array properties in the return object (e.g., `sources: [...params.sources]`, `toolsUsed: [...params.toolsUsed]`). |
| LOW | `buildAnswerContract` (params validation) | `confidence` is accepted as any unbounded `number`. Passing values like `-0.5` or `1.2` will silently corrupt downstream analytics, routing, or UI components expecting a normalized 0.0–1.0 range. | Clamp the value during assignment: `confidence: Math.max(0, Math.min(1, params.confidence))` or throw a `RangeError` if strictly validating. |

Overall risk: LOW-MED; aggregate freshness logic masks stale sources and direct array references allow silent post-creation mutation of the contract snapshot.
