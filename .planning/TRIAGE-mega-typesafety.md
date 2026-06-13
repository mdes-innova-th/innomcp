_34 findings consolidated, 1 missing._

# TRIAGE — mega-typesafety

> typesafety lens (provider=0): Type-safety audit: find `as any`, unsafe casts, non-null assertions (!), implici

> Generated for mother-Sonnet review. provider=0 deliverables.


---

## TYP-001 — typesafe — `innomcp-node/src/services/agentLoop.ts` [deepseek/deepseek-v4-pro]
| severity | location | unsafe pattern | safer fix |
|----------|----------|----------------|------------|
| High | `for` loop iterating `assistantMessage.tool_calls` via `as { id: string; name: string; arguments: string; }[]` | Unsafe type assertion (`as`) without runtime checks that `tool_calls` is an array of objects with the expected shape. | Validate with `Array.isArray()` and check each item has `id`, `name`, `arguments` of type `string` before use (type guard / runtime validation). |
| Medium | `input = JSON.parse(toolCall.arguments) as unknown;` inside tool execution branch | Unsafe `JSON.parse` returns `any`, then widens to `unknown` without structure validation; the parsed value is trusted blindly. | Use a safe JSON parse helper (e.g., Zod) to validate the parsed result against a known input schema, or at minimum assert `input` is a non-null object. |

---

## TYP-002 — typesafe — `innomcp-node/src/services/analyticsService.ts` [Qwen/Qwen3.7-Max]
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| High | `loadSnapshot` | `JSON.parse(data)` returns `any`, allowing unsafe property access and passing unvalidated data structures to the `Map` constructor. | Define a strict snapshot interface and validate the parsed JSON using a schema library (e.g., Zod) or runtime type guards before assignment. |
| Medium | `track` | Using user-controlled strings (`model`, `toolName`) as keys in a plain object (`Record<string, number>`) risks prototype pollution (e.g., if `model` is `__proto__`). | Change `modelCounts` and `toolCounts` to `Map<string, number>`, or initialize them with `Object.create(null)` to remove prototype inheritance. |
| Medium | `track` | Type narrowing via `'key' in event` lacks a strict discriminant, risking misclassification if runtime objects have overlapping properties. | Add a `type: 'message' \| 'tool' \| 'error'` discriminant field to the event interfaces and use `switch (event.type)` for exhaustive, safe narrowing. |
| Low | `loadSnapshot` | `catch { ... }` silently swallows all exceptions without logging, masking unexpected runtime errors, JSON syntax errors, or validation failures. | Catch the error as `unknown`, log it, and differentiate between expected errors (e.g., `ENOENT`) and unexpected failures. |

---

## TYP-003 — typesafe — `innomcp-node/src/services/answerContract.ts` [moonshotai/Kimi-K2.6]
| severity | location | unsafe pattern | safer fix |

---

## TYP-004 — typesafe — `innomcp-node/src/services/artifactService.ts` [zai-org/GLM-5.1]
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| High | `getArtifact` -> `artifact.name/mime/content` | Missing null/undefined guard | Check `if (!artifact) throw new Error("Artifact not found");` before accessing properties |
| Medium | `getArtifact` method signature | Implicit any / missing return type | Add explicit return type: `Promise<{ name: string; mimeType: string; buffer: Buffer }>` |

---

## TYP-005 — typesafe — `innomcp-node/src/services/auditLogger.ts` [deepseek/deepseek-v4-pro]
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| High | `getEntries()`: `const entry = JSON.parse(line) as AuditEntry;` | Unsafe cast of `JSON.parse` result to `AuditEntry` | Parse to `unknown`, then validate with a type guard (e.g., check required fields `id`, `timestamp`, `action`, `details`, `success`) before assigning |
| High | `clear()`: `const entry = JSON.parse(line) as AuditEntry;` | Unsafe cast of `JSON.parse` result to `AuditEntry` | Same as above: use a validation function and discard or keep entries only if shape matches |
| Medium | `log()`: `catch (err)` | Untyped catch variable (implicit `any`) | Use `catch (err: unknown)` and perform a type check before accessing any properties or logging |

---

## TYP-006 — typesafe — `innomcp-node/src/services/backpressureHandler.ts` [deepseek/deepseek-v4-flash]
| severity | location | unsafe pattern | safer fix |
|----------|----------|----------------|------------|
| medium | `processNext()` line: `const item = this.queue.shift()!;` | Non-null assertion (`!`) on `shift()` result, which returns `undefined` if queue empty | Replace with a guard: `const item = this.queue.shift(); if (!item) { // should never happen but handle safely }` or restructure loop to ensure element exists before shift |
| low | `processNext()` line: `(error) => { ... }` in `.then()` error callback | Implicit `any` on the `error` parameter, as the callback expects `(reason: any) => void` from `Promise.then` | Explicitly type the parameter as `unknown` and narrow inside: `(error: unknown) => { ... item.deferred.reject(error); }` |

---

## TYP-007 — typesafe — `innomcp-node/src/services/cacheManager.ts` [Qwen/Qwen3.7-Max]
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| High | `get<T>` | `as LinkedNode<T>` unsafe cast from `LinkedNode<unknown>`. Bypasses compile-time type checking, risking runtime errors if the cached value's actual type doesn't match `T`. | Use a strongly-typed cache key (e.g., `interface CacheKey<T> { key: string; __type?: T }`) to enforce type safety, or return `unknown` and force the caller to validate the type. |
| Medium | `set<T>` | `as LinkedNode<T>` unnecessary and unsafe cast. | Remove the cast. `this.entries.get(key)` returns `LinkedNode<unknown>`. Assigning `value: T` to `existing.value: unknown` is natively type-safe in TypeScript without casting. |

---

## TYP-008 — typesafe — `innomcp-node/src/services/coldRetriever.ts` [moonshotai/Kimi-K2.6]
The user wants a type-safety audit of the provided TypeScript code. I need to find specific unsafe patterns:
1. `as any`
2. Unsafe casts
3. Non-null assertions (`!`)
4. Implicit `any`
5. Missing null/undefined guards
6. Unsafe `JSON.parse`
7. Untyped `catch`

I need to output a table with columns: severity | location | unsafe pattern | safer fix

Let me carefully analyze the code.

Looking at the code:

1. `catch (err)` in `loadCorpus` method - this is an untyped catch clause. In modern TypeScript, `catch` clauses default to `unknown`, but if there's no type annotation and the code treats it as having properties, that's unsafe. Here it's just logged with `console.warn`, which is actually fine since `console.warn` accepts any type. But wait, in TypeScript before a certain version, catch clauses were implicitly `any`. However, in strict TypeScript, catch variables are `unknown`. The code shows `catch (err)` and then `console.warn(..., err)` - logging is safe for unknown. But is this considered "untyped catch"? The pattern is `catch (err)` without typing. In strict TS, `err` is `unknown`, so it's actually typed. But if the project uses older TS or non-strict, it might be `any`. However, the user asked for "untyped catch" - this might qualify as a catch without explicit typing, but actually in strict mode it's `unknown`. Let me check if there are other issues.

Wait, looking more carefully at the code:

2. `const headingMatch = content.match(/^#\s+(.+)$/m);` - `match` returns `RegExpMatchArray | null`. Then `if (headingMatch) return headingMatch[1].trim();` - this is safe because of the null check.

3. `const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);` - same, safe with null check.

4. `const tagsMatch = fmMatch[1].match(/tags:\s*\[([^\]]+)\]/);` - Wait, `fmMatch` is checked in the outer `if (fmMatch)`, so `fmMatch[1]` is safe.

5. `const stat = fs.statSync(file);` - `fs.statSync` can throw if file doesn't exist, but it's inside a try-catch. That's fine.

6. `options?.maxResults ?? 5` - safe.

7. `domainFilter && doc.metadata.domain !== domainFilter` - safe.

8. `scored.sort((a, b) => b.score - a.score);` - safe.

9. `getRegistry(): Array<{` - the code is truncated. But I should only audit what's visible.

Wait, let me look for implicit any. Are there any function parameters or variables that would be implicit any?

- `chunkText(text: string, docId: string)` - typed
- `extractTitle(content: string, filePath: string)` - typed
- `extractTags(content: string, filePath: string)` - typed
- `inferDomain(tags: string[], filePath: string)` - typed
- `tokenize(text: string)` - typed
- `computeTFIDF(query: string, chunk: string, idfMap: Map<string, number>)` - typed
- `loadCorpus(corpusDir: string)` - typed
- `search(query: string, options?: { maxResults?: number; domain?: string })` - typed
- `listFiles(corpusDir: string)` - wait, this method is called but not defined in the visible code. The code says `const files = this.listFiles(corpusDir);` but `listFiles` is not shown. However, I can only audit what's visible.

Wait, looking at `catch (err)` - if the TypeScript target is strict, `err` is `unknown`. But the user specifically listed "untyped catch" as something to find. In many codebases, `catch (e)` is considered untyped/implicit any if not using strict mode. But actually, the user might want me to flag it if `err` is used in a way that assumes properties. Here it's just passed to `console.warn`, which accepts `unknown`. So it's actually safe.

But wait, is there any non-null assertion? I don't see `!` used anywhere.

Is there any `as any`? I don't see any.

Is there any unsafe cast? I don't see `as` used at all.

Is there any unsafe JSON.parse? No JSON.parse in the code.

Is there any implicit any? Let me check:
- `for (const file of files)` - `files` is inferred from `listFiles` return. Since `listFiles` isn't shown, we can't tell, but assuming it's typed.
- `const allowedExts = [".md", ".txt"];` - inferred as string[], fine.


---

## TYP-009 — typesafe — `innomcp-node/src/services/contextManager.ts` [deepseek/deepseek-v4-pro]
| severity | location                                 | unsafe pattern                                          | safer fix                                                                                                                 |
|----------|------------------------------------------|---------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| Medium   | `trim` method, line 63: `otherMessages.shift()!;` | Non-null assertion (`!`) on `Array.shift()` return value | Use explicit check before using the result: `const removed = otherMessages.shift(); if (removed) totalTokens -= this.countTokens(removed.content);` |

---

## TYP-010 — typesafe — `innomcp-node/src/services/dataAnalysisTool.ts` [MiniMaxAI/MiniMax-M3]
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| medium | `analyzeData` input branch: `const safePath = path.resolve(input.workspaceRoot, input.path.replace(...))` | No null check on `input.path` / `input.workspaceRoot`; `input.path` may be empty string causing `path.resolve(workspaceRoot, "")` to equal `workspaceRoot` | Validate `input.path` is non-empty; check `fs.stat` resolves to a regular file inside root before reading |
| high | `analyzeData` input branch: `text = await fs.readFile(safePath, "utf-8")` | No catch on `ENOENT`/`EACCES`; raw rejection bubbles as un-typed error | Wrap in `try/catch`, rethrow as `Error("read failed: ${(e as NodeJS.ErrnoException).code}")` |
| high | `analyzeData` aggregate loop: `aggr.get(k)!.push(v)` | Non-null assertion `!` — relies on the `if (!aggr.has(k))` invariant; `noUncheckedIndexedAccess`/refactor can break it | `const arr = aggr.get(k); if (arr) arr.push(v);` (or `aggr.set(k, [...(aggr.get(k) ?? []), v])`) |
| medium | `analyzeData` input object: `input: string \| { path: string; workspaceRoot: string }` | Implicit `any` risk if caller passes object missing fields; no runtime narrowing | Use a discriminated union (`{ kind: "inline"; text: string } \| { kind: "file"; ... }`) or zod schema; narrow with `typeof` and validate required keys |
| medium | `parseCSV` `headers`/`rows` | Assumes `lines[0]` exists; if `filter` is empty, returns early — OK, but cell arity is unchecked; `r[ci]` is `string \| undefined` under `noUncheckedIndexedAccess` | Default: `const v = r[ci] ?? ""` (already used in `cellVals`, but `numVals` uses `Number(undefined)` → `NaN` — fine) — also normalize row width to `headers.length` |
| low | `numStats` return `{ min: sorted[0], max: sorted[sorted.length-1] }` | Indexed access returns `number \| undefined` under strict settings; would need `!` or fallback | `const last = sorted.at(-1)!;` or guard with `if (sorted.length === 0) return {};` (already handled, but TS still types as `T \| undefined`) |
| low | `analyzeData` `opts: { workspaceRoot: string; maxRows?: number } = { workspaceRoot: "" }` | Default `workspaceRoot: ""` defeats the `safePath.startsWith` check (any path resolves inside `""`) and silently disables artifact writing | Make `workspaceRoot` required when needed; if optional, branch on its presence before path math |
| low | `barChartSvg` template literals: `${lbl.slice(0,8)}` etc. | Unsanitized user data injected into SVG → potential script/attribute injection if CSV cells contain `"` or `</text>` | Escape with an `escapeXml(s)` helper for `& < > " '` before interpolation |
| low | `columns` numeric branch: `...numStats(numVals)` spread | `numStats` returns `Pick<ColumnStats, ...>` but its return type is widened to `{}` when empty (typed as `{}` due to `if (vals.length === 0) return {};`) | Type the empty branch explicitly: `const EMPTY: Pick<ColumnStats,...> = {}; return EMPTY;` |
| low | `summary` build: `c.min`, `c.max`, `c.mean?.toFixed(2)` | Optional fields used with no guard beyond `?.`; fine, but if `isNumeric` and `numStats` returned `{}`, values are `undefined` and render as `"undefined"` | Coalesce: `${c.min ?? "n/a"}`; or assert non-empty `numVals` before computing |
| low | `analyzeData` artifact dir: `path.resolve(opts.workspaceRoot, "artifacts", "charts")` | No check that `artifactPath` stays under `workspaceRoot` (symlink/escape via crafted `Date.now()` unlikely but `fname` is predictable) | Sanitize: assert `artifactPath.startsWith(opts.workspaceRoot + path.sep)` before write; or use `path.join` with validated segments |
| low | `analyzeData` return `chartSvg?: string` | Builder only sets `chartSvg` if ≥2 entries; type correctly `string \| undefined` — OK | None — already safe |
| info | No `JSON.parse`, no `catch (e)`, no `as any`, no `as unknown as` in this module | — | — |

---

## TYP-011 — typesafe — `innomcp-node/src/services/eventBus.ts` [deepseek/deepseek-v4-flash]
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|---|
| medium | `on` method: `const handlers = this.listeners.get(event)!;` (line after `if` block) | Non-null assertion (`!`) | Replace with guard: `let handlers = this.listeners.get(event); if (!handlers) { handlers = new Set(); this.listeners.set(event, handlers); }` |
| medium | `emit` method: `catch (error)` | Untyped catch (implicit `any`) | Use `catch (error: unknown)` and add type guard before accessing `error` |

---

## TYP-012 — typesafe — `innomcp-node/src/services/fastPathHandler.ts` [Qwen/Qwen3.7-Max]
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| High | `FastPathDecision` interface | `any` type (`structuredContent?: any`) | Use `unknown` or define a specific type/union for structured content. |
| High | `Responder` type alias | `any` type (`payload: any`) | Use `unknown` or a strictly typed payload interface. |
| Medium | `DEFAULT_OPTS` object | Unsafe cast (`process.env.FASTPATH_MODE as FastPathMode`) | Validate env var against allowed values (`"on" \| "off"`) before assignment. |
| Medium | `mergeExtra` function | Unsafe cast (`base[k] as string[]`) | Filter array elements at runtime: `.filter((x): x is string => typeof x === 'string')`. |
| High | `tryReadExtraFromFile` | Unsafe `JSON.parse` (returns implicit `any`) | Type result as `unknown` and validate object structure before accessing properties. |
| Medium | `tryReadExtraFromFile` | `any` in catch clause (`catch (e: any)`) | Use `catch (e: unknown)` and narrow type via `e instanceof Error`. |
| High | `tryReadExtraFromUrl` | Explicit `any` type (`const parsed: any = ...`) | Type as `unknown` and use type guards or a schema validator (e.g., Zod) before use. |
| Low | `tryReadExtraFromUrl` | Untyped/ignored catch clause (`catch { ... }`) | Use `catch (e: unknown)` to safely log or handle the error without implicit `any`. |

---

## TYP-013 — typesafe — `innomcp-node/src/services/generalGate.ts` [deepseek/deepseek-v4-pro]
| severity | location | unsafe pattern | safer fix |
|----------|----------|----------------|-----------|

---

## TYP-015 — typesafe — `innomcp-node/src/services/hotRetriever.ts` [MiniMaxAI/MiniMax-M3]
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| high | `normalizeWeatherFacts` parameter `toolResult: any` (line 18) | implicit-`any` propagation from caller; entire function body assumes unconstrained shape | Type as `unknown` (or a `WeatherToolResult` discriminated union) and narrow with type guards before accessing `.result`/`.data` |
| high | `normalizeEvidenceFacts` parameter `toolResult: any` (line 81) | same — unvalidated `.result`/`.data` chain | Replace `any` with `unknown`; narrow via `is PlainObject` guard before property access |
| high | `normalizeDeterministicFact` parameter `result: any` (line 125) | `String(result)` on `any` can produce `"[object Object]"` or throw on Symbol | Type as `unknown` and use a `stringifySafe(value: unknown): string` helper that handles primitives/objects/errors |
| medium | `toolResult.result \|\| toolResult.data \|\| toolResult` (lines 27, 86) | if `toolResult` is `any`, `result`/`data` can be any type; result also typed implicitly as `any` | Narrow `toolResult` first (see above) so the fallback chain is type-checked; if all branches are objects, declare a local `unknown` and validate |
| medium | `item.province \|\| item.location` (line 31) | `item` is implicitly `any` from the untyped `results` array | After `Array.isArray`, type `item: Record<string, unknown>` (or a `WeatherItem` interface) and assert/validate string fields |
| medium | `JSON.stringify(item)` / `JSON.stringify(results)` (lines 38, 53) | throws `TypeError` on circular refs or `BigInt`; unsafe on `any` | Wrap in `try { return JSON.stringify(value) } catch { return "[unserializable]" }` after narrowing `value: unknown` |
| low | `extractWeatherEntities` / `extractISP` parameters not annotated in any risky way — but `extractISP` returns `m[1].toUpperCase()` | `m[1]` is `string` (typed by `match`), but union with `undefined` if `noUncheckedIndexedAccess` is on | Enable `noUncheckedIndexedAccess` and handle `m[1] === undefined` explicitly |
| low | `nextFactId` uses module-level mutable `factCounter` | not a type-safety bug, but global state; flag for review | Encapsulate in a factory class if used across modules |
| low | `confidence: 0.9` / `0.95` / `1.0` literals | not enforced to be within `0..1`; consumers may assume invariant | Add a branded type `Confidence = number & { readonly __brand: 'Confidence' }` with a constructor that clamps/validates |
| info | no `as any`, non-null `!`, `JSON.parse`, or `catch (e)` present in this module | n/a | n/a — but `JSON.stringify` on untrusted shapes is the equivalent risk here |

**Recommended primary refactor:** replace the three `: any` parameters with `: unknown`, add a small `isPlainObject(x: unknown): x is Record<string, unknown>` guard, and introduce explicit `WeatherToolResult` / `EvidenceToolResult` interfaces for the shapes the rest of the codebase actually produces. This eliminates the `any` blast radius without changing runtime behavior.

---

## TYP-016 — typesafe — `innomcp-node/src/services/imageGenService.ts` [deepseek/deepseek-v4-flash]
| severity | location | unsafe pattern | safer fix |
|----------|----------|---------------|-----------|
| **High** | `callImageGen` – gateway fallback (≈ line 128) | `catch (err: any)` – the `any` type bypasses all type checks and suppresses error shape safety | Use `catch (err: unknown)` and narrow with `instanceof Error` to access `.message` safely |
| **High** | `callImageGen` – pollinations fallback (≈ line 140) | `catch (err: any)` – same as above | Change to `catch (err: unknown)` and narrow before reading `.message` |
| **Medium** | `callGateway` – `await res.json()` (≈ line 70) | `res.json()` returns `Promise<any>`, making `json` implicitly `any` with no compile‑time shape guarantees | Declare an interface for the expected JSON response (e.g. `GatewayResponse`) and cast: `const json = await res.json() as GatewayResponse` |
| **Low** | `callImageGen` – adapted prompt guard (≈ line 108) | `opts.adaptedPromptEn && opts.adaptedPromptEn.trim()…` – treats empty string (falsy) as missing, may drop a valid zero‑length adapted prompt | Explicitly test `typeof opts.adaptedPromptEn === 'string' && opts.adaptedPromptEn.trim().length > 0` |

---

## TYP-017 — typesafe — `innomcp-node/src/services/intentClassifier.ts` [deepseek/deepseek-v4-pro]
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|---|
|  |  |  |  |

---

## TYP-018 — typesafe — `innomcp-node/src/services/leaderboardMetrics.ts` [moonshotai/Kimi-K2.6]
The user wants a type-safety audit of the provided TypeScript code. I need to find:
1. `as any` - none visible
2. unsafe casts - none visible explicitly, but need to check implicit ones
3. non-null assertions (!) - I see `result.get(intent)!.set(providerId, count)` in `getIntentWinsSnapshot`
4. implicit any - need to check for untyped parameters or variables that would be implicit any. The catch blocks: `catch ()` and `catch ()` - these are untyped catch clauses. In modern TS, catch variables are implicitly `unknown` if not typed, but if the code uses older TS or has implicit any settings, they might be `any`. Actually, looking at the code: `.catch(() => {` - this is fine, it's a promise rejection handler with no parameter. But wait, there are `catch` blocks: `Promise.resolve(operation()).catch(() => {` and `.catch(() => {` - these don't bind the error parameter, so no implicit any there.
5. missing null/undefined guards - need to check places where values could be null/undefined but aren't guarded.
   - `computeP95`: `samples.length` - samples is number[], ok. But `sorted[Math.max(0, idx)]` - idx could be negative? `Math.ceil(samples.length * 0.95) - 1`. If length is 1, ceil(0.95)-1 = 1-1 = 0. If length is 0, returns early. So ok.
   - `getProviderStats`: `raw.requests` used as divisor. `raw.requests` is number, initialized to at least 0, but could be 0. Guarded in some places (`raw.requests > 0`) but not in `avgLatency: Math.round(raw.totalLatency / raw.requests)` - if requests is 0, this would be Infinity or NaN. But can requests be 0 here? Looking at `store.set` in `recordProviderWin`, requests can be 0. So if a provider is added via `recordProviderWin` without any calls, `raw.requests` could be 0, leading to division by zero in `avgLatency`. However, `recordProviderWin` sets requests: 0. Then `getProviderStats` iterates over store entries. If a provider only has wins but no requests (possible via `recordProviderWin`), then `raw.requests` is 0 and `raw.totalLatency` is 0, so `0/0` = NaN. This is a runtime issue but also a type-safety/null-undefined guard issue? Not exactly null/undefined, but missing guard for zero.
   - `topIntent`: `Object.entries(raw.intentWins).sort(...)[0][0]` - if length > 0, safe due to check.
   - `getIntentWinsSnapshot`: `result.get(intent)!.set(...)` - non-null assertion. Could use `const intentMap = result.get(intent) ?? new Map(); result.set(intent, intentMap); intentMap.set(...)`
   - `recordProviderCall`: `responseChars != null` checks are present.
   - `persistLeaderboardStats`: takes `operation: () => void | Promise<void>` - typed.
   - `withDbConnection`: imported, not shown, but usage seems typed via callback.

Wait, the user also mentioned "untyped catch". The code has `.catch(() => {` - no error parameter, so it's not untyped catch with implicit any, it's just ignoring the error. But if they meant catch blocks that don't type the error variable, there are none with variables. However, `try/catch` isn't used, only `.catch()`.

Also "unsafe JSON.parse" - none visible.

"implicit any" - need to check if there are any variables/parameters without types that would be implicit any. Looking at the code:
- `providerId: string`, `latencyMs: number`, `success: boolean`, `responseChars?: number` - all typed.
- `operation: () => void | Promise<void>` - typed.
- `samples: number[]` - typed.
- `n = 10` - inferred as number.
- `id, raw` in `for...of` - inferred from Map types.
- `intent, count` in `Object.entries` - entries returns [string, number], so typed.

Wait, there is a truncated part at the end: `[pr` - seems like `[providerId` but truncated. Not much to audit there.

Let me look again carefully.

Non-null assertion:
- `result.get(intent)!.set(providerId, count)` in `getIntentWinsSnapshot` - definite non-null assertion.

Missing null/undefined guards:
- `avgLatency: Math.round(raw.totalLatency / raw.requests)` - if `raw.requests` is 0, division by zero. This happens when a provider is inserted

---

## TYP-019 — typesafe — `innomcp-node/src/services/mcpClient.ts` [zai-org/GLM-5.1]
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| High | `callTool` catch block | Untyped catch / Unsafe cast: `catch (err) { const e = err as { name?: string; status?: number; message?: string }` | Type `err` as `unknown` and use type guards: `const message = err instanceof Error ? err.message : String(err); const status = typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number' ? err.status : undefined;` |
| High | `requestOnce` | Unsafe cast: `new Error(...) as Error & { status: number }` | Define a custom error class: `class McpHttpError extends Error { readonly status: number; constructor(msg: string, status: number) { super(msg); this.status = status; } }` and throw it |
| Medium | `requestOnce` | Unsafe JSON parse / implicit any: `(await resp.json()) as T` | Parse via `JSON.parse(await resp.text())` and validate the payload against a runtime schema (e.g., Zod) before assigning to `T`, or return `McpToolResult<unknown>` and let callers assert |
| Low | `isAvailable`, `safeReadText` | Untyped catch: `catch { return false; }` / `catch { return ""; }` | Bind the error explicitly as `catch (err: unknown)` and log it before swallowing, ensuring network failures aren't silently dropped during debugging |

---

## TYP-020 — typesafe — `innomcp-node/src/services/mdesModelCache.ts` [MiniMaxAI/MiniMax-M3]
| Severity | Location | Unsafe Pattern | Safer Fix |
|----------|----------|----------------|-----------|
| Medium | `mdesModelCache.ts:64` (`getModels`) | Untyped `catch (error)` — `error` is implicit `unknown`/untyped; relies on runtime `console.warn` only, no type discrimination. | Use `catch (error: unknown)` explicitly, then narrow via `error instanceof Error ? error.message : String(error)`. |
| Medium | `mdesModelCache.ts:48-50` (`getModels`) | `response.json()` result is cast directly to `OllamaTagsResponse` with no runtime validation. A malformed/extra-malicious payload can violate the type. | Parse as `unknown`, then validate with a schema (e.g., Zod / `valibot`) or hand-written type guard before assigning to `OllamaTagsResponse`. |
| Low | `mdesModelCache.ts:46-47` (`getModels`) | Only `!response.ok` is checked; no `Content-Type`/body-size guard. A non-JSON HTML error page would be parsed and likely throw, falling into the cache path silently for stale data. | Inspect `response.headers.get('content-type')` and bail out before `response.json()` if not `application/json`. |
| Low | `mdesModelCache.ts:48` (`getModels`) | `const models = data.models ?? [];` silently masks missing `models` key; no validation that each entry conforms to `MDESModel` (e.g., `name` present, `details` shape). | After parsing, filter/map with a type predicate ensuring `typeof m.name === 'string'`, etc.; drop invalid entries. |
| Low | `mdesModelCache.ts:56-62` (`getModels` catch) | Throws a new `Error` while discarding original cause; stack from upstream `fetch`/`JSON.parse` is lost. | `throw new Error("…", { cause: error })` to preserve the underlying error. |
| Low | `mdesModelCache.ts:31-37` (`getModels` cache read) | Returns `this.cache` by reference; callers can mutate internal state, and a concurrent refresh can swap the array mid-iteration. | Return `Object.freeze([...this.cache])` or a defensive copy; consider a versioned/atomic swap. |
| Low | `mdesModelCache.ts:33` (`getModels`) | TTL/freshness is not thread-safe; concurrent first-callers can issue duplicate `fetch` requests (no in-flight de-duplication). | Track an in-flight `Promise<MDESModel[]>` and `await` it on overlapping calls. |
| Low | `mdesModelCache.ts:96-99` (`getModelFamilies`) | Iterates raw `this.cache` without checking for `name` validity post-parse; relies on prior runtime filtering that doesn't exist. | Same validator as above; drop entries lacking required fields. |
| Low | `mdesModelCache.ts:135-138` (`getBestModelForTask` / `sizeValue`) | `parseFloat` on regex-captured string with no `Number.isFinite` check; `sizeValue` silently returns `Infinity` for malformed input, which can mis-rank models. | After `parseFloat`, guard: `const v = parseFloat(...); return Number.isFinite(v) ? v : Infinity;` |
| Low | `mdesModelCache.ts:160` (`getBestModelForTask` "fast") | `parseInt(m.details.quantization_level, 10) \|\| 0` coerces `0` quant levels to `0` (fine) but also masks `NaN` from non-numeric strings into `0`, polluting scoring. | `const q = Number.isFinite(parsed) ? parsed : 0;` |
| Low | `mdesModelCache.ts:176` (`getBestModelForTask` fallback) | `sorted[0].name` — relies on non-empty `models`, but the `length === 0` guard is in the same function; still a latent non-null assumption if refactored. | After sort, `const top = sorted[0]; if (!top) throw new Error("No models available"); return top.name;` |
| Low | `mdesModelCache.ts:18` (`MDESModelCache` fields) | `private cache: MDESModel[] = []` is mutable from within and externally via `getModels`'s returned reference; not `readonly`. | `private cache: readonly MDESModel[] = [];` and replace immutably on refresh. |
| Info | `mdesModelCache.ts:5` (`MDES_OLLAMA_URL`) | No URL validation; an env var set to a non-URL will cause `fetch` to throw at call time only. | Validate with `new URL(MDES_OLLAMA_URL)` at module load. |
| Info | `mdesModelCache.ts:184-190` (`getStats`) | `this.lastFetch > 0` uses `0` as sentinel for "neve

---

## TYP-021 — typesafe — `innomcp-node/src/services/memoryRagHook.ts` [deepseek/deepseek-v4-pro]
| severity | location | unsafe pattern | safer fix |
|----------|----------|----------------|------------|
| high | `recordTurnAndGetMeta` (retrievalMode ternary) | Unsafe cast `plan.decision as RetrievalMode` without runtime validation that the remaining value actually fits `RetrievalMode` | Replace with a type‑safe mapping: `const modeMap: Record<string, RetrievalMode> = { hot: "hot", cold: "both", both: "both" }; retrievalMode: modeMap[plan.decision] ?? "none"`. |
| medium | `extractEntities` parameter `toolResult?: any` | Explicit `any` type loses all type safety; value is never used but could be passed unsafely | Change to `toolResult?: unknown` so callers must narrow before use. |
| medium | `recordTurnAndGetMeta` parameter `toolResult?: any` | Same explicit `any` (unused) | Change to `toolResult?: unknown`. |
| medium | `enrichGroundedContract` parameter `structuredContent: any` | Parameter is typed `any`, bypassing checks on the object shape beyond the first guard | Change to `structuredContent: unknown` and use a type predicate or `in` guard: `typeof structuredContent === "object" && structuredContent !== null && "__groundedContract" in structuredContent`. |

---

## TYP-022 — typesafe — `innomcp-node/src/services/metricsCollector.ts` [Qwen/Qwen3.7-Max]
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| High | `Counter.exportLines`, `Gauge.exportLines`, `Histogram.exportLines` | `JSON.parse(key) as string[]` (Unsafe JSON.parse & unsafe cast) | Wrap `JSON.parse` in `try/catch`. Validate the result using `Array.isArray(parsed) && parsed.every(v => typeof v === 'string')` instead of using `as string[]`. |
| Medium | `Metric.getOrCreate` | `this.labelMap.get(k)!` (Non-null assertion) | Store the result of `createFn()` in a local variable, call `this.labelMap.set(k, val)`, and return the local variable to avoid the `!` assertion. |
| Medium | `MetricsCollector.metrics` | `Metric<any>` (Explicit `any` type) | Replace `any` with `unknown` or a specific union type (e.g., `Metric<number \| { buckets: number[]; count: number; sum: number; bucketCounts: number[] }>`). |

---

## TYP-023 — typesafe — `innomcp-node/src/services/modelLoadBalancer.ts` [moonshotai/Kimi-K2.6]
The user wants a type-safety audit of the provided TypeScript code. I need to find:
1. `as any` - none visible
2. unsafe casts - none visible
3. non-null assertions (`!`) - I see `const state = this.models.get(config.id)!;` in `addModel`
4. implicit any - need to check for untyped parameters or variables that would be implicit any. The `reduce` callbacks have typed parameters? Let's check:
   - `eligible.reduce((best, curr) => ...)` - `best` and `curr` are inferred from `eligible` which is `ModelState[]`, so they are typed.
   - `best.latencyWindow.reduce((a, b) => a + b, 0)` - `a` and `b` are inferred as `number` from the array type and initial value.
   - `eligible.reduce((sum, m) => ...)` - `sum` inferred as number from initial value `0`, `m` inferred from array.
   - `st.latencyWindow.reduce((a, b) => a + b, 0)` - inferred as number.
   - `Array.from(this.models.values()).map((st) => ...)` - `st` is inferred.
   - `for (const state of this.models.values())` - `state` is inferred.
   - `probes.push(this.probeModel(state));` - `state` is inferred.
   - `setInterval(() => this.runHealthProbes(), 30_000)` - fine.
   - `EventEmitter` import - fine.
   - `NodeJS.Timeout` - this is a global type reference. In some strict setups this might be an issue if `@types/node` isn't installed, but assuming it is, it's fine. However, `NodeJS.Timeout` is a type from Node.js namespace. If not imported or declared, it could be implicit any if types are missing, but usually it's available. I'll note it as a potential implicit any if `@types/node` is missing, but the user likely has it. Actually, looking carefully, there might be no implicit any issues.

5. missing null/undefined guards:
   - `addModel`: `const state = this.models.get(config.id)!;` uses non-null assertion instead of guard.
   - `selectModel`: `if (st.disabledUntil && st.disabledUntil > now)` - `disabledUntil` is `number | null`, so `&&` handles null fine (null is falsy). But wait, `0` is also falsy. If `disabledUntil` is `0`, it would be treated as disabled. But `Date.now()` is never 0 in practice, so this is technically a logic issue but not a type-safety missing guard per se. However, the pattern `st.disabledUntil && st.disabledUntil > now` is actually safe for null/undefined because null coerces to false. But the type is `number | null`, so this is fine.
   - `selectModel`: `if (st.config.maxConcurrent && st.activeRequests >= st.config.maxConcurrent)` - `maxConcurrent` is `number | undefined`. `undefined && ...` is false, so safe. But if `maxConcurrent` is 0, it would be falsy and not trigger. That's a logic bug but not a missing null guard type issue.
   - `recordLatency`: `const state = this.models.get(modelId); if (!state) return;` - good guard.
   - `recordError`: same, good guard.
   - `runHealthProbes`: `if (state.disabledUntil && state.disabledUntil <= now)` - same as above, null safe.

6. unsafe JSON.parse - none visible.

7. untyped catch - none visible (no try/catch blocks shown).

Wait, I need to look at the truncated part? The user says `/* …truncated… */` at the end. I should only audit what's shown.

Let me re-examine for non-null assertions:
- `const state = this.models.get(config.id)!;` in `addModel` - definite non-null assertion.

Are there any other issues?
- `this.healthProbeTimer = setInterval(() => this.runHealthProbes(), 30_000);` - `setInterval` returns `NodeJS.Timeout` in Node.js types, but if this code runs in a browser environment (though it says Node), it would be `number`. The type annotation is `NodeJS.Timeout | null`. This is fine for Node.

- `ModelLoadBalancer.instance` is `private static instance: ModelLoadBalancer | null = null;` - fine.

- `selected = eligible[this.roundRobinIndex];` - `selected` is `ModelState | null`, `eligible[this.roundRobinIndex]` is `ModelState | undefined` (since array access is not bounds-checked by TS). Wait, `eligible` is `ModelState[]`. Accessing by index gives `ModelState | undefined` in `noUncheckedIndexedAccess

---

## TYP-024 — typesafe — `innomcp-node/src/services/motherExportService.ts` [zai-org/GLM-5.1]
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| High | `exportToCSV` -> `run.query.replace` | Missing null/undefined guard on `run.query` | `(run.query ?? "").replace(/"/g, '""')` |
| High | `exportToCSV` -> `p.preview.replace` | Missing null/undefined guard on `p.preview` | `(p.preview ?? "").replace(/"/g, '""')` |
| Medium | `exportToJSON` -> `JSON.stringify(history)` | Unhandled exception if `history` contains circular references | Wrap in try/catch, return fallback string or throw typed error |
| Medium | `exportToCSV` -> `run.timestamp` | Implicit type coercion if `timestamp` is a `Date` object | Use `run.timestamp instanceof Date ? run.timestamp.toISOString() : run.timestamp` |
| Low | `exportToJSON` -> `JSON.stringify(history)` | `JSON.stringify` returns `undefined` if input is `undefined`, violating `string` return type | Guard `history` for `undefined` before stringifying |

---

## TYP-025 — typesafe — `innomcp-node/src/services/motherHistory.ts` [deepseek/deepseek-v4-pro]
| severity | location | unsafe pattern | safer fix |
|----------|----------|----------------|-----------|

---

## TYP-026 — typesafe — `innomcp-node/src/services/motherProviderToggle.ts` [deepseek/deepseek-v4-flash]
| severity | location | unsafe pattern | safer fix |
|----------|----------|---------------|-----------|
| none | – | – | – |

---

## TYP-027 — typesafe — `innomcp-node/src/services/naturalnessGuard.ts` [Qwen/Qwen3.7-Max]
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| Medium | `checkNaturalness` (opts access) | Missing null/undefined guard for `opts` and `opts.userQuery` before property access and regex testing. | Add `if (!opts || typeof opts.userQuery !== 'string')` early return, or use optional chaining `opts?.userQuery ?? ''`. |

---

## TYP-028 — typesafe — `innomcp-node/src/services/notificationService.ts` [moonshotai/Kimi-K2.6]
The user wants a type-safety audit of the provided TypeScript code. I need to find:
1. `as any` - none visible
2. unsafe casts - none visible
3. non-null assertions (!) - found: `notification.sessionId!` in the `notify` method
4. implicit any - need to check `err` in catch block, and possibly other variables
5. missing null/undefined guards - `notification.sessionId` is used with non-null assertion but the parameter type `Omit<Notification, 'id' | 'timestamp'>` still allows `sessionId` to be optional (`sessionId?: string`). So if someone calls `notify` without `sessionId`, it will be undefined, but the code assumes it exists to look up the listener. Also `getRecentNotifications` filters by `sessionId` but `sessionId` in Notification is optional, so `n.sessionId === sessionId` could be comparing `undefined === string` which is fine but maybe missing guard for undefined sessionId in history.
6. unsafe JSON.parse - none visible
7. untyped catch - `catch (err)` - `err` is implicitly `any` in older TS or `unknown` in strict newer TS depending on tsconfig. Since they asked for untyped catch, this qualifies.

Let me analyze each issue carefully:

1. **Non-null assertion**: Line `const callback = this.listeners.get(notification.sessionId!);`
   - Severity: high/medium
   - Location: `notify` method
   - Pattern: `notification.sessionId!`
   - Fix: Guard against undefined sessionId or change type to require sessionId.

2. **Untyped catch**: Line `catch (err)`
   - Severity: medium/low
   - Location: `broadcast` method
   - Pattern: `catch (err)` with implicit any/unknown
   - Fix: `catch (err: unknown)` and type-narrow before logging.

3. **Missing null/undefined guard**: In `notify`, the parameter is `Omit<Notification, 'id' | 'timestamp'>`. Since `Notification` has `sessionId?: string`, the omit still leaves it optional. Calling `this.listeners.get(notification.sessionId!)` will pass `undefined` to `.get()` if sessionId is missing, which is valid for Map.get but the intent is wrong. Also the callback check `if (callback)` handles missing callback, but the real issue is that `notify` should probably require `sessionId` since it's notifying a specific session. The type signature allows omitting it.
   - Actually, looking at the convenience methods like `notifyTaskComplete`, they pass `sessionId`. But a direct call to `notify({type: 'error', title: 'x'})` would be type-valid but crash or silently fail because `sessionId` is undefined and `notification.sessionId!` hides this.
   - Fix: Change parameter type to require `sessionId`: `Omit<Notification, 'id' | 'timestamp'> & { sessionId: string }` or guard inside.

4. **Missing null/undefined guard in `getRecentNotifications`**: `n.sessionId === sessionId` where `n.sessionId` can be undefined. If `sessionId` parameter is passed as empty string or undefined? The parameter is `sessionId: string` so it's required. But history contains broadcast notifications where `sessionId` might be undefined. The filter will correctly exclude them (undefined === string is false). However, if the intent is to also get broadcast notifications, this is a bug. But based on the method name "for a session", excluding broadcasts is correct. Still, comparing optional to required without explicit handling could be noted, but it's not necessarily unsafe in TS terms. Actually, `Notification` interface has `sessionId?: string`, so `n.sessionId` can be undefined. The comparison is safe TS-wise. I'll skip this unless it's a clear issue.

5. **Implicit any**: The `err` in catch is the main one. Are there others? `crypto.randomUUID()` - assuming crypto is available. In Node.js, `crypto` might need import. Wait, the code doesn't show imports. If this is running in a modern Node environment with global crypto, it's fine. But if not imported, it might be an implicit any if there's a global declaration. However, the user is asking about type-safety specifically in the code shown. The `crypto` usage assumes a global or imported

---

## TYP-029 — typesafe — `innomcp-node/src/services/presenceService.ts` [deepseek/deepseek-v4-pro]
| severity | location | unsafe pattern | safer fix |
|----------|----------|----------------|------------|
| Low | `join()` – after `projectPresence.set(...)` | Non‑null assertion `!` on `projectPresence.get(projectId)` | Retrieve and guard: `let room = projectPresence.get(projectId); if (!room) { room = new Map(); projectPresence.set(projectId, room); }` – then use `room` without `!`. |
| Low | `join()` – inside `if (room.has(key))` block | Non‑null assertion `!` on `room.get(key)` after a `has` check | Remove the `has` check and directly get: `const existing = room.get(key); if (existing) { /* update */ } else { /* create */ }`. This avoids the assertion entirely and reduces lookups. |

---

## TYP-030 — typesafe — `innomcp-node/src/services/promptAdapter.ts` [MiniMaxAI/MiniMax-M3]
```typescript
/**
 * promptAdapter.ts — Phase 6A/6B
/* …truncated… */
```

The snippet is truncated, so I'll audit the visible portion and note where truncation limits analysis. I'll also check for the patterns the user asked about in the visible code.

Audit of visible code (`innomcp-node/src/services/promptAdapter.ts`):

| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| INFO | top-level `import` / function signatures | No explicit return-type annotations on exported functions; no defensive type for `unknown` boundary. | Add explicit return types (e.g. `Promise<AdaptedImagePromptResult>`) and use `unknown` for untrusted inputs at the boundary. |
| LOW | `normalizeThaiQuery` import | Imported value is treated as fully trusted; no compile-time proof of its signature. | Ensure `../utils/thaiQueryNormalizer` exports a `.d.ts` or wrap calls in a typed adapter: `const normalize: (s: string) => string = normalizeThaiQuery;` |
| LOW | `GLOSSARY: GlossaryEntry[]` | Array is typed, but entries are only validated at *definition* time, not at load time if ever deserialized. | If this data ever moves to JSON/external storage, validate with a Zod/io-ts schema. (For inline data: acceptable.) |
| INFO | `stripImageCommand(text: string)` | Pure function, no null/undefined guard on `text` (TS catches this at call sites, but untyped callers could pass `undefined` at runtime). | Add `if (typeof text !== "string" \|\| text.length === 0) return "";` at the top for runtime safety. |
| INFO | Regex declarations | Regexes are untyped at the literal level (TS infers `RegExp`); fine. | No change required. |
| MEDIUM | `normalizePlannerQuery` / `adaptImagePrompt` (truncated, typically contains `JSON.parse` + `await`) | The truncated region almost certainly contains `JSON.parse(<llm output>)` cast through `as any` or `as Record<string, unknown>` plus non-null assertions. **Cannot confirm from visible code.** | Please paste the rest of the file (especially any `JSON.parse(`, `as any`, `!`, and `try/catch (e)` blocks) so I can score severity. |
| MEDIUM | `catch (e)` (truncated) | Typical Phase-6B LLM fallback path uses `catch (e) { ... console.error(e) }` with `e: any` or untyped `e`. | Use `catch (e: unknown)` and narrow: `if (e instanceof Error) ...`; never access `.message` directly. |
| HIGH (suspected) | `JSON.parse(raw, ...) as AdaptedImagePromptResult` style cast (truncated) | Direct cast from `any`/`unknown` to a fully-typed result object is a classic source of runtime shape mismatch. | Parse to `unknown`, then validate with a runtime schema (Zod) and only then assign the result type. Avoid `as any` entirely. |
| HIGH (suspected) | `process.env.SOMETHING!` / `result.fields!.foo` (truncated) | Non-null assertion on env config or freshly-parsed LLM JSON. | Validate env at boot (return a typed `Config` object); replace `!` with explicit narrowing or a thrown `ConfigurationError`. |
| LOW (suspected) | Implicit `any` in `for (let i = 0; i < 2; i++)` loop body callbacks (truncated) | If any callback infers `any` from `replace(...)` chain, TS won't catch errors. | No evidence in visible code; loop is safe. Revisit if truncated region shows callbacks. |
| LOW | Public API: `adaptImagePrompt(rawPrompt)` | No runtime check that `rawPrompt` is a non-null `string`; callers can pass `null`/`undefined` from `JSON.parse` boundaries. | Guard: `if (typeof rawPrompt !== "string") throw new TypeError(...)`. |

**Net assessment of the visible portion:** the *shown* code is relatively clean — no `as any`, no `!`, no `JSON.parse`, no `catch (e)`, no implicit `any` are present in the lines I can see. The real risk surface lives in the truncated tail (the LLM-fallback branch), which is where Phase-6A/6B adapters historically accumulate these patterns. Paste the remainder (especially the `llm-fallback` block, the env-var reads, and any `JSON.parse` site) and I can produce a definitive scored table.

If you can share lines from the `llm-fallback` s

---

## TYP-031 — typesafe — `innomcp-node/src/services/providerAdapter.ts` [deepseek/deepseek-v4-flash]
| Severity | Location | Unsafe pattern | Safer fix |
|----------|----------|---------------|-----------|
| High | `callOpenAI` – after `resp.json()` | `as { choices: Array<{ message: { content: string } }> }` – unsafe cast without validation | Use a schema validator (e.g., zod) to parse and validate the response structure; e.g., `const parsed = responseSchema.parse(await resp.json())`. |
| High | `streamOpenAI` – after `JSON.parse(payload)` | `as { choices: Array<{ delta?: { content?: string } }> }` – unsafe cast without validation | Validate the parsed object with a runtime type guard or schema parser before accessing properties. |
| High | `callAnthropic` – after `resp.json()` | `as { content: Array<{ type: string; text?: string }> }` – unsafe cast without validation | Use a schema validator for the Anthropic response structure. |
| High | `streamAnthropic` – after `resp.json()` (assumed similar) | `as { content: Array<{ type: string; text?: string }> }` – unsafe cast without validation | Same as above – validate with a schema. |
| Medium | `streamOpenAI` – catch block in SSE parsing | `catch { }` – untyped catch clause (implicit `any`) | Add an error parameter: `catch (e) { /* log or handle */ }`. Alternatively, use `catch { /* skip */ }` is syntactically valid but leaves `e` as `any`; explicitly typing as `unknown` and logging helps debugging. |
| Medium | `callOpenAI` – `model` assignment | `const model = req.model ?? provider.model;` – no fallback if both are `undefined` | Provide a guaranteed fallback (e.g., a default model or throw). Example: `const model = req.model ?? provider.model ?? "gpt-4";` |
| Medium | `callOpenAI` – `max_tokens` assignment | `max_tokens: req.maxTokens ?? provider.maxTokens` – no fallback if both are `undefined` | Add a sensible default: `req.maxTokens ?? provider.maxTokens ?? 1024`. |
| Medium | `streamOpenAI` – `model` and `max_tokens` (same pattern) | Same as above – missing default when both are `undefined` | Add defaults as shown above. |
| Medium | `callAnthropic` – `model` assignment | `const model = req.model ?? provider.model;` – no fallback if both `undefined` | Provide a default model or throw. Anthropic model is required. |
| Medium | `streamAnthropic` – `model` assignment | Same as above | Add default model. |

---

## TYP-032 — typesafe — `innomcp-node/src/services/providerFailover.ts` [Qwen/Qwen3.7-Max]
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| High | `selectProvider` | Non-null assertion: `this.statuses.get(DEFAULT_PRIMARY_ID)!` | Add null guard: `const primaryStatus = this.statuses.get(DEFAULT_PRIMARY_ID); if (!primaryStatus) { /* handle missing */ }` |
| High | `getStats` | Non-null assertion: `this.statuses.get(DEFAULT_PRIMARY_ID)!` | Add null guard or fallback: `const primary = this.statuses.get(DEFAULT_PRIMARY_ID) ?? { id: DEFAULT_PRIMARY_ID, healthy: false, latencyMs: 0, failCount: 0, lastCheck: 0 };` |
| Medium | `checkProvider` (catch block) | Unsafe cast: `(error as Error).message` on `unknown` catch variable | Use type guard: `const msg = error instanceof Error ? error.message : String(error);` |
| Medium | `getStats` | Unsafe cast: `.filter(Boolean) as ProviderStatus[]` | Use type predicate: `.filter((s): s is ProviderStatus => s !== undefined)` |

---

## TYP-033 — typesafe — `innomcp-node/src/services/providerHealthProbe.ts` [deepseek/deepseek-v4-pro]
| severity | location | unsafe pattern | safer fix |
|----------|----------|----------------|-----------|
| None     | N/A      | N/A            | N/A       |

---

## TYP-034 — typesafe — `innomcp-node/src/services/providerManager.ts` [zai-org/GLM-5.1]
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| High | `checkHealth` catch block | `catch (err: any)` | `catch (err: unknown)` |
| Medium | `register` validation | `!config.id \|\| !config.baseUrl \|\| !config.model` (falsy check on required `string` properties implies they can be `undefined` at runtime, contradicting the type) | Make properties optional in `ProviderConfig` (`id?: string`) if they can be missing, or change to strict empty string check (`config.id === ''`) |
| Medium | `register` else block | `config.healthStatus ?? 'unknown'`, `config.capabilities ?? []`, `config.enabled ?? true`, `config.priority ?? 0` (nullish coalescing on required properties implies type definition is inaccurate) | Make these properties optional in `ProviderConfig` (e.g., `capabilities?: string[]`) to match runtime expectations, or remove `??` fallbacks if the type is strictly enforced |

---

## TYP-035 — typesafe — `innomcp-node/src/services/responseComposer.ts` [MiniMaxAI/MiniMax-M3]
| Severity | Location | Unsafe Pattern | Safer Fix |
|---|---|---|---|
| Low | `responseComposer.ts` (top of file) | Implicit `any` risk at module boundary — `input: ResponseComposerInput` is typed, but any untyped call sites in the wider codebase can propagate `any` into this strictly-typed surface and silently break contracts. | Enable `strict` + `noImplicitAny` in `tsconfig`; add a runtime guard (`zod`/`valibot` parse) at the entry of `composeThaiAnswer` to reject malformed input early. |
| Low | `composeThaiAnswer` — `input.facts` handling | Defensive coercion `Array.isArray(input.facts) ? input.facts : []` silently masks wrong-type input. | Narrow the type with a Zod schema (`z.array(ToolFactSchema).parse(input.facts)`) so invalid shapes fail loudly rather than degrading to an empty array. |
| Low | `composeThaiAnswer` — `trimFact(f.summary)` | `f.summary` is assumed string-typed after the trim helper’s `String(s || "")` coercion. If a `ToolFact` ever contains a non-string `summary` (loose upstream typing), the coercion hides a contract violation. | Tighten `ToolFact.summary: string` and add a `z.string().min(1)` schema check; drop the `String(... || "")` band-aid. |
| Low | `composeThaiAnswer` — `Number(f.confidence ?? 1)` | If `confidence` is a non-numeric value (e.g. `"0.5"`, `null`, object), `Number()` returns `NaN`, and `NaN >= 0.3` is `false` — silently drops valid-seeming facts. | Validate at the boundary: `typeof f.confidence === "number" && Number.isFinite(f.confidence)`; otherwise treat as `1` or reject the fact. |
| Low | `composeThaiAnswer` — `f.confidence * 100` (inside template) | Same NaN risk: a `NaN` confidence would render as `"_(ความมั่นใจ NaN%)_"`. | Guard with the finite-number check above before formatting. |
| Low | `composeThaiAnswer` — `f.source` truthiness check | `f.source` is typed `string` but used in a truthy test (`f.source ? ... : ""`). A non-empty whitespace string passes; empty string becomes `""` (potentially rendering `**: `). | Require non-empty trimmed string: `f.source?.trim() ? \`**${f.source.trim()}**: ` : ""`. |
| Low | `composeThaiAnswer` — `input.header` / `input.footer` | Assumed string with `.trim()`; an upstream `undefined` (despite type) would throw, and whitespace-only values are silently dropped without a `reason` entry — inconsistent with fact-drop logging. | Add a `typeof input.header === "string"` check and, if dropped, push `reasons.push("empty-header")` / `"empty-footer"` for traceability. |
| Low | `composeThaiAnswer` — `input.route || "unknown"` | Falsy-route fallback masks an unset route; no diagnostic in `reasons`. | Use `input.route?.trim() || "unknown"` and push `reasons.push("route-missing")` when empty. |
| Low | `composeThaiAnswer` — `lines.join("\n").trim()` | `.trim()` on the joined string can unintentionally strip leading/trailing Thai whitespace that callers may rely on. | Document the trim behavior, or trim each line individually before joining. |
| Low | `composeThaiAnswer` — return shape | `mode: "deterministic" | "llm-fallback" | "passthrough"` is a string-literal union, fine, but no exhaustiveness guard exists if a new mode is added to the type. | Add a `never`-based exhaustiveness check in any consumer switch; consider a branded type for `mode`. |
| Low | `composeThaiAnswer` — `latencyMs` | Uses `Date.now()` delta; susceptible to clock skew if the process clock changes mid-call (minor). | Prefer `performance.now()` for monotonic timing. |
| Info | `composeThaiAnswerWithLLM` | Stub silently delegates to deterministic composer with no signaling that LLM mode was requested. Callers opting in get a misleading `mode: "deterministic"` result. | Return `mode: "passthrough"` (or a new `"unavailable"`) with a `reasons.push("llm-not-implemented")` entry so opt-in callers can detect the gap. |
| Info | `composeThaiAnswerWithLLM` | No `try/catch` around the future LLM call — once implemented, an unhandled rejection will propagate as an untyped error to callers.