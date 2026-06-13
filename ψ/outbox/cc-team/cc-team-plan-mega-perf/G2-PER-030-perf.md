<!-- cc-team deliverable
 group: G2 (perf division)
 member: PER-030 role=perf model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":3465,"completion_tokens":1496,"total_tokens":4961,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 46s
 generated: 2026-06-13T12:05:11.709Z -->
I'll acknowledge the truncated file and perform a performance audit on what's visible. Note: I cannot see the LLM fallback path or callers, so findings are limited to the visible code.

| Severity | Location | Issue | Fix |
|---|---|---|---|
| Medium | `GLOSSARY` array (~70 entries) + `applyGlossary` (inferred) | Linear scan of the full glossary on every call. O(n×m) per prompt with no cache; identical inputs re-scan. | Memoize: `Map<string, AdaptedImagePromptResult>` keyed by `rawPrompt`; or pre-build a single regex alternation sorted by length, executed once per call. |
| Medium | `GLOSSARY` entries like `{ th: "หมา", en: "dog" }` after `{ th: "สุนัข", en: "dog" }`; `{ th: "ป่า", en: "forest" }` after `{ th: "ป่าไม้", en: "forest" }` | Duplicates produce redundant/competing translations and inflate scan cost. Also, short tokens like `หมา`, `ป่า`, `เมือง`, `รถ`, `เรือ`, `เด็ก`, `นก`, `ม้า`, `วัด`, `ถนน` are single words that will false-match inside larger Thai words. | Dedupe by `en`; require word-boundary anchoring (`/(?:^|\s)หมา(?=\s|$)/`) or pre-segment Thai via `Intl.Segmenter` before matching. |
| Medium | `stripImageCommand` — `IMAGE_FILLER_RE` loop (max 2) | Hard-coded `2` iterations is a magic number; filler list is closed, so an explicit alternation is faster and clearer. | Replace loop with single regex `^(?:ของ|เกี่ยวกับ|ที่|ให้|หน่อย|ที|ที่เป็น|แบบ|เป็น|of|about|featuring)(?:\s+(?:ของ|…))+` or two explicit `.replace` calls. |
| Medium | `stripImageCommand` — 3 sequential `.replace` passes on the same string | Each pass re-scans the whole string; for long inputs this is wasted work. | Combine into one alternation regex, or run all three anchored patterns in a single pass. |
| Low | `normalizeThaiQuery` import | Unknown whether `thaiQueryNormalizer` itself allocates per call (caches, maps). If it does, repeated identical inputs in a request burst will re-allocate. | Wrap both `adaptImagePrompt` and `normalizePlannerQuery` with an LRU keyed by `rawPrompt`/`rawQuery`; size ~256. |
| Low | `latencyMs` populated on every call | `Date.now()` × 2 per call; negligible but called in hot paths. | Use `performance.now()` (monotonic) and only compute when an observer is attached, or accept the cost. |
| Low | `reasons: string[]` returned in result | Strings are interned-ish but the array is retained by callers; in long-lived sessions this is GC pressure if results are stashed in logs/traces. | Return `readonly string[]`; document that results are short-lived; avoid pushing into persistent traces. |
| Low | `confidence: number` in result | If callers persist these, you retain references to `originalPrompt` and the result object — equivalent to retaining the user's raw input. | Document short-TTL retention; consider returning a `Symbol`-keyed weak handle if callers cache. |
| Low | `GLOSSARY` defined at module scope | Module load parses ~70 literals — fine, but if the file is reloaded (HMR/test) each load allocates a new array. | None in prod; in tests, freeze the module via Jest reset or extract to a JSON asset loaded once. |
| Low | Regexes `IMAGE_COMMAND_PREFIX_RE`, `IMAGE_COMMAND_REVERSE_RE`, `IMAGE_FILLER_RE` | Not anchored with `i` flag implications; `IMAGE_FILLER_RE` uses `^` only, correct, but case-insensitive Thai isn't meaningful and the `i` flag is wasted work. | Drop `i` from `IMAGE_FILLER_RE` (Thai-only tokens); keep `i` only on the Latin-bearing patterns. |
| Low | `adaptImagePrompt` / `normalizePlannerQuery` are `async`-implied by callers | If these return `Promise` and the body is fully sync, every call site pays a microtask hop. | Return synchronous `T` and let callers `await` only the LLM-fallback branch. |
| Info | `confidence` computation not visible | Likely a heuristic over `reasons.length`; if it iterates the glossary it's O(n) extra. | Compute in the same pass that fills `reasons` to avoid a second scan. |
| Info | LLM fallback path not visible | Cannot audit timeout enforcement, `AbortController` usage, JSON parse failure mode, or whether the LLM response is streamed. | Confirm: `AbortController` with hard `setTimeout`; response body size cap (`Content-Length` + `AbortSignal`); single `.json()` parse; no `await` of the full body before timeout fires. |
| Info | Caller-side (not shown) | N+1 risk: if a batch of prompts is adapted in a loop, each call re-scans glossary and re-normalizes. | Provide a batch API (`adaptImagePrompts(string[]): AdaptedImagePromptResult[]`) sharing one normalization pass. |
| Info | Memory retention | The function holds `originalPrompt` (user input) inside the returned object; if the caller's response object is cached indefinitely (e.g., session memory), PII/prompt content persists. | Add a `dispose()` / zero-out hook, or strip `originalPrompt` after downstream use. |

**Summary of the highest-leverage fixes**, in order:

1. Add an LRU cache (`Map`, cap ~256–1024) keyed by `rawPrompt` / `rawQuery` around both public functions. This single change eliminates repeated glossary scans, regex passes, and `normalizeThaiQuery` re-entry.
2. Collapse the three sequential regex passes in `stripImageCommand` into one anchored alternation.
3. Pre-build one combined glossary regex (alternation sorted by length) and run it once with `matchAll`, instead of iterating entries.
4. Dedupe `GLOSSARY` by `en` value and add word-boundary anchoring for short Thai tokens to prevent false matches and wasted re-runs.
5. Make the public API synchronous on the deterministic path; reserve `Promise` for the LLM branch only.

Send the rest of the file (LLM fallback block and any `applyGlossary`/`translateTerms` helpers) and I can audit the network/timeout/memory path as well.
