<!-- cc-team deliverable
 group: GB (Bug/edge-case audit of critical chat-path modules)
 member: AUD-14 role=audit model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":2201,"completion_tokens":2816,"total_tokens":5017,"prompt_tokens_details":{"cached_tokens":2176,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1952,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 23s
 generated: 2026-06-13T11:16:08.907Z -->
| severity | location | issue | proposed fix |
|---|---|---|---|
| HIGH | `trigToDeg` | Nested trig calls produce malformed output: `sin(cos(45))` → `sin(cos(45)))` (extra `)`). The `[^)]+` capture stops at the first `)`, splitting the match incorrectly and injecting a stray paren on reassembly. | Use a recursive/balanced-paren parser instead of `[^)]+`, or at minimum skip conversion when the argument contains unmatched parens / nested calls. |
| MED | `DEFAULT_OPTS` | `Number(process.env.FASTPATH_MAX_TEXT_LEN \|\| 400)` — the `\|\|` treats env value `"0"` as falsy, falling back to `400`. Same for all other numeric env vars (`FASTPATH_MAX_WORK_MS`, `FASTPATH_EXTRA_TTL_MS`, etc.). | Use nullish coalescing: `Number(process.env.FASTPATH_MAX_TEXT_LEN ?? 400)` or parse first then default: `const v = Number(process.env...); isNaN(v) ? 400 : v`. |
| MED | `tryReadExtraFromFile` | Synchronous `fs.existsSync` + `fs.readFileSync` blocks the Node event loop inside an `async` function, defeating the purpose of async and adding latency to every cache refresh under load. | Replace with `fs.promises.access`/`fs.promises.readFile` (or `fs.promises.readFile` with try/catch for ENOENT). |
| MED | `handleFastPathMessage` (rate-limit block) | Rate limiting is gated on `if (clientIp)` — an empty string `""` (falsy) bypasses rate limiting entirely. Depends on caller always passing a non-empty string, which is fragile. | Change to `if (clientIp != null)` or validate that `clientIp` is a non-empty string before skipping. |
| LOW | `cleanFloat` | For `NaN` input, `Math.round(NaN * 1e10)` → `NaN`; `Number.isInteger(NaN)` → `false`; returns string `"NaN"` with no error signal. | Guard: `if (!Number.isFinite(val)) return String(val);` or throw/return a sentinel. |
| LOW | `getExtraPhrases` | Module-level `extraCache` singleton has no concurrency guard — two concurrent calls past TTL both refresh and write; the second overwrites the first. Data is valid so this is benign, but it causes duplicate I/O. | Use a single in-flight Promise (dedup pattern): store the refresh Promise and `await` it on concurrent calls. |
| LOW | `trigToDeg` | `mathjs.evaluate` is imported but the truncated code likely passes `trigToDeg` output to it. If `trigToDeg` produces a malformed string (see HIGH), `evaluate` will throw an unhandled parse error downstream. | Ensure the downstream evaluate call is wrapped in try/catch, and fix `trigToDeg` nesting bug. |

**Overall risk verdict: The `trigToDeg` nested-paren corruption is a real bug that will produce wrong output or crash downstream math evaluation; the `\|\|` vs `??` env-var default is a latent defect that silently ignores zero values.**
