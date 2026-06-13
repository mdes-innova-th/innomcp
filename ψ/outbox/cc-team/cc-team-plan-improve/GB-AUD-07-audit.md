<!-- cc-team deliverable
 group: GB (Bug/edge-case audit of critical chat-path modules)
 member: AUD-07 role=audit model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2745,"completion_tokens":5024,"total_tokens":7769,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4661,"image_tokens":0},"cache_creation_input_tokens":0} | 93s
 generated: 2026-06-13T11:13:22.220Z -->
| severity (HIGH/MED/LOW) | location (function or approx line) | issue | proposed fix |
|---|---|---|---|
| MED | `evidenceMatch` | The exclusion regex `/machine learning\|url encoding\|url คืออะไร/` applies unconditionally to ALL evidence hits. If a message contains strong evidence keywords (e.g., "forensic", "evidence") but also mentions "url encoding", it incorrectly returns `null`. | Move the exclusion regex inside the `if (["machine", "url", "traffic"]...)` block, or restrict it to only apply when `hit` is one of those ambiguous keywords. |
| LOW | `containsAny` | `k.toLowerCase()` is called inside the loop on every iteration. Since the keyword lists are static constants, this causes redundant string allocations and CPU work on every classification. | Pre-compute lowercase keywords when defining the constant arrays, or map them to lowercase once at module load. |
| LOW | `evidenceMatch` | The `hasOfficerSignal` regex is recompiled on every function invocation. | Extract the regex to a module-level `const` to avoid repeated compilation overhead. |
| LOW | Module scope / `classifyIntent` | `looksLikeSystemInventoryQuestion` is imported and `toolHint` parameter is declared, but neither is used in the visible logic (dead code/unused bindings). | Remove the unused import and parameter if they are truly unused in the truncated portion, or implement the intended logic. |

Overall risk: LOW — The module is a straightforward keyword matcher, but the overly broad regex exclusion in `evidenceMatch` can cause silent intent misclassification for valid forensic/evidence queries.
