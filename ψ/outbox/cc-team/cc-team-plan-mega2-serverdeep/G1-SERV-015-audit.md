<!-- cc-team deliverable
 group: G1 (serverdeep division)
 member: SERV-015 role=audit model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":3359,"completion_tokens":2491,"total_tokens":5850,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 56s
 generated: 2026-06-13T12:13:16.309Z -->
# Deep Bug Audit: `calculatorTool.ts`

| Severity | Location | Issue | Fix |
|----------|----------|-------|-----|
| **CRITICAL** | `import` line 4 | `const { create, all } = require("mathjs")` mixes CJS in an ESM file; in pure ESM contexts `require` is undefined → unhandled rejection at module load. | Use `import { create, all } from "mathjs"`; switch to dynamic `import()` if `mathjs` is CJS-only. |
| **CRITICAL** | `try { … }` block, `math.evaluate(cleanExpression)` | **No timeout on evaluation.** Adversarial / pathological expressions (e.g. `9999999^9999999`, deep recursion via `mathjs` parser) can hang the worker indefinitely, exhausting the event loop and blocking all MCP requests. No `AbortController`/timeout is wired. | Wrap evaluation in a `Promise.race` with a timeout (e.g. 500 ms) or run in a worker thread; abort and return `isError: true` on timeout. |
| **CRITICAL** | `expandProductNotation` regex | Regex `\((\d+)\^3[+\-]\d+\)…\((\d+)\^3[+\-]\d+\)` plus unbounded `for (let i = start; i <= end; i++)` allows OOM / DoS. A user-supplied `(1^3+1)...(1000000^3+1)` produces a multi-MB string and minutes of CPU. | Validate `end - start <= MAX_TERMS` (e.g. 10_000) and `end < 10^6`; cap string length pre- and post-expansion. |
| **HIGH** | `inputSchema: z.object({…}) as any` | Schema only validates `expression` as `z.string()` — no `.max(N)` length cap. Combined with the previous issue, this is the primary DoS vector. | Add `z.string().min(1).max(2000)`; also assert no control chars. |
| **HIGH** | `convertUnit` dispatch path | `convertMatch[1]` parsed via `parseFloat` accepts only `[0-9.]+` — silently rejects scientific notation, hex, negatives. More importantly, `result.toFixed(4)` truncates BigNumber precision and round-trips through `Number` losing accuracy. | Parse via `BigNumber(convertMatch[1])`; if conversion uses raw `number` math, document the loss or keep BigNumber end-to-end. |
| **HIGH** | `result` handling (`typeof result === "number"`) | `math.evaluate` with `BigNumber` config returns a `BigNumber` instance whose `typeof` is `"object"`, *not* `"number"`. Branch correctly falls through to the object branch — but the resulting `formattedResult` is a BigNumber string that is then… truncated in the missing code. Also, `result.toString` in the truncated region is unfinished code (broken file). | Complete the formatter; explicitly test for `BigNumber`, `Fraction`, `Complex`, `Matrix`, `Unit`, and `boolean` (comparisons) — return `isError` for unsupported types. |
| **HIGH** | `async (args: any) => { … }` | `args` is not validated. If the client sends the wrong shape (e.g. `{ expr: "1+1" }`) `input.expression` is `undefined`, hits the empty-string check, and the tool returns a generic Error — fine — but the **error envelope is non-MCP-compliant** (see next row). | After schema validation, use `args.expression` directly; remove the `as any` cast and trust the Zod parse. |
| **HIGH** | All `throw new Error(...)` / catch site | Errors are returned as `{ content: [{ type: "text", text: "Error: …" }] }` **without** `isError: true`. MCP clients distinguish success vs failure by `isError`; this breaks protocol contract and will be mis-rendered as success by some hosts. | Return `{ content: […], isError: true }` for all caught errors, and prefer `toolResult` error code per MCP spec. |
| **HIGH** | Logger call: `mcpLog('INFO', \`[MathTool] Expression: ${expression.substring(0,100)}…\`)` | User input is interpolated into logs without sanitization. Newlines / control chars can spoof log lines; PII / secrets in expressions will be persisted. | Sanitize (`JSON.stringify` or strip `\r\n\t`); truncate by bytes, not chars (grapheme safety). |
| **MEDIUM** | `expandProductNotation` while-loop | Uses `productPattern.exec` with `/g` flag but **does not reset `lastIndex`** and does not break on zero-length matches → potential infinite loop in edge cases. Also mutates `expanded` while iterating `expr`. | Refactor to `expr.matchAll(productPattern)` (no `g` flag needed) and build replacement via a single `replace` callback. |
| **MEDIUM** | `cleanExpression.replace(/(\d)\(/g, '$1*(')` etc. | Implicit-multiplication heuristic runs **after** `convert` is matched, but more importantly it also rewrites tokens inside string literals if they ever appear (currently no strings allowed, but future-proofing). It also breaks decimals like `1.5(2+3)` → `1.5*(2+3)` (correct) but `(.)(2)` → `*(2)`. | Constrain to known-safe patterns; reject expressions that, after rewrite, still fail to parse — which the current code does, but the rewrite itself can produce syntactically invalid mathjs input that yields a confusing "Unexpected token" error. |
| **MEDIUM** | Implicit multiplication regexes | No whitespace-awareness: `2 sin(x)` is **not** rewritten to `2*sin(x)`, so `2 sin(0)` fails while the docstring claims trig is supported. | Add `.replace(/(\d)\s+([a-zA-Z(])/g, '$1*$2')` or call `math.parse(expr, {implicit: 'show'})`. |
| **MEDIUM** | `math.evaluate(cleanExpression)` | No try/catch around the **evaluation only** — but the whole block is inside one try. Fine, except the catch cannot distinguish "syntax error" from "type error" from "timeout". | Re-throw with classified `code`; map to user-friendly messages and `isError: true`. |
| **MEDIUM** | BigNumber config `precision: 64` | 64-digit precision combined with no operation-count cap means a single `100!` (158 digits) is fine, but iterative factorials or matrix ops can blow heap. | Cap `precision` to 32 (still huge for any real use) and/or cap result-string length at e.g. 4096 chars. |
| **MEDIUM** | `mcpLog`/`logBoth` imports | `logBoth` is imported but never used → dead import. | Remove. |
| **LOW** | `convertUnit` table | Hard-coded conversion table; no alias support (`°F`, `c`, `kg`, `lbs`, `meters`). Will throw and return `isError` (post-fix) for valid colloquial input. | Add alias map + symbol normalization. |
| **LOW** | `convertUnit` temperature | `fromUnit.toLowerCase()` then exact-match — `°C` won't match `celsius`. | Normalize via alias table. |
| **LOW** | `result.toFixed(4)` in `convertUnit` | Uses native `Number.toFixed` (rounding-banker's? no — IEEE round-half-to-even in V8, but still lossy). For scientific/engineering workflows this silently loses precision. | Use `math.format(result, {notation: 'fixed', precision: 4})` for consistency with BigNumber config. |
| **LOW** | `const { create, all } = require("mathjs") as any` | `as any` discards all type safety on the mathjs instance — `math.evaluate` returns `any`, propagating unsafety through the whole file. | Type as `import("mathjs").MathJsInstance` or a narrow interface `{ evaluate: (e: string) => unknown }`. |
| **LOW** | Tool description (string literal) | 60+ lines of marketing copy in the `description` field. Some MCP hosts truncate descriptions; others charge per token at registration. | Move prose to a separate `docs/` file; keep `description` to ≤ 1024 chars. |
| **LOW** | `startTime = Date.now()` | Uses wall-clock instead of `performance.now()` — affected by NTP adjustments, lower resolution. | `performance.now()`. |
| **LOW** | `Date.now()` timing log | Logs `⚡ Computed in 0ms (instant!)` for any sub-ms eval, which is misleading and floods logs. | Only log timings above a threshold (e.g. > 50 ms) or use `DEBUG` level for fast path. |
| **INFO** | Module-level `const math = create(all, …)` | Created once — good. But `all` imports the entire mathjs library (~hundreds of functions) including I/O, parser, etc., increasing attack surface and memory. | `import { create, all as needed } from "mathjs"` with an explicit `dependencies` allowlist. |
| **INFO** | `registerTool` | No `outputSchema` declared, so `structuredContent` is unvalidated by the SDK. Clients may silently ignore it. | Add an `outputSchema` matching the `structuredContent` shape. |
| **INFO** | `async (args: any)` | Return type is implicit; tool handlers in newer MCP SDK versions should return `{ content, structuredContent, isError? }` typed. | Annotate return type to catch protocol drift at compile time. |
| **INFO** | `expandProductNotation` | Returns the original expression if no match — fine — but doesn't handle a single `(n^3+1)` or ranges with non-integer endpoints. | Document limitation or reject non-integer / single-term inputs. |

---

## Top-3 priority fixes (implement first)

1. **Evaluation timeout** (CRITICAL) — wrap `math.evaluate` in a `Promise.race` with `setTimeout` + `AbortController`; reject with `isError: true` after ~500 ms. This single change mitigates the majority of DoS scenarios.
2. **DoS guards on `expression`** (CRITICAL/HIGH) — add `z.string().max(2000)`, cap `expandProductNotation` term count, cap `end - start`, and bound the post-expansion string length.
3. **MCP error envelope** (HIGH) — every catch path must return `{ content: [...], isError: true }`. Update the central `try/catch` return site accordingly.

## Secondary hardening

- Replace `require("mathjs")` with a real ESM import (fixes a class of "module not found" rejections on Node ≥ 22 ESM-strict).
- Reset/restore `productPattern.lastIndex` or use `String.prototype.matchAll` (avoids a latent infinite loop).
- Strip control chars and bound-length on the log line that interpolates user input.
- Trim unused `logBoth` import and tighten the implicit-multiplication regex set (e.g. add the `2 sin(x)` case).
