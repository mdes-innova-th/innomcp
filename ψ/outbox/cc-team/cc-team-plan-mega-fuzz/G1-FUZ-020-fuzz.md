<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-020 role=fuzz model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1998,"completion_tokens":3694,"total_tokens":5692,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 77s
 generated: 2026-06-13T12:04:59.361Z -->
```markdown
# Property-Based / Fuzz Test Cases: `providerManager.ts`

## 1. Constructor & Default State

- **P1.1** → Fuzz: Construct `ProviderManager` repeatedly; mutate `process.env.MDES_OLLAMA_URL` to arbitrary strings (including empty, whitespace, unicode, 10KB strings, `null` bytes) and `MDES_OLLAMA_MODEL` similarly. → **Invariant**: Constructor never throws; `getMDESPrimary()` always returns a provider with `id === 'mdes-primary-ollama'`, `type === 'mdes-ollama'`, `enabled === true`, `healthStatus === 'unknown'`, and `capabilities` containing all 5 default capabilities.
- **P1.2** → Fuzz: Call `getMDESPrimary()` then unregister `'mdes-primary-ollama'` → re-call `getMDESPrimary()`. → **Invariant**: Throws `Error` whose message contains `'MDES primary provider not found'`. No silent fallback.
- **P1.3** → Fuzz: Instantiate 100× in parallel, mutate shared `process.env` between calls. → **Invariant**: Singleton (`providerManager`) identity is stable across imports; no cross-instance leakage of `providers` map.

## 2. `register()` — Required Field Validation

- **P2.1** → Fuzz: Pass config with `id` ∈ {`''`, `null`, `undefined`, `0`, `false`, `NaN`, whitespace-only, 100KB string}. → **Invariant**: Throws `Error` with message containing `'id, baseUrl, and model are required'`.
- **P2.2** → Fuzz: Valid `id` but `baseUrl` ∈ {`''`, `null`, `undefined`, `'   '`}. → **Invariant**: Throws same validation error.
- **P2.3** → Fuzz: Valid `id`+`baseUrl` but `model` ∈ {`''`, `null`, `undefined`, `'   '`}. → **Invariant**: Throws same validation error.
- **P2.4** → Fuzz: All three required fields valid; `type` set to a string NOT in the union (`'foo'`, `123`, `null`, object). → **Invariant**: Module accepts (it's a structural interface, not runtime-validated) — document this as **weakness**: no runtime `type` validation. Property: `getAll()` returns the config as-stored.

## 3. `register()` — Default Field Application (new provider)

- **P3.1** → Fuzz: Register fresh provider omitting `healthStatus`, `capabilities`, `enabled`, `priority`. → **Invariant**: Stored entry has `healthStatus === 'unknown'`, `capabilities.deepEqual([])`, `enabled === true`, `priority === 0`.
- **P3.2** → Fuzz: Register fresh provider with `enabled: false`, `priority: -Infinity`, `priority: Number.MAX_SAFE_INTEGER`, `capabilities: <10000 random strings>`. → **Invariant**: All fields stored verbatim; `getBest()` never returns disabled ones; priority sort remains stable for equal priorities.
- **P3.3** → Fuzz: Register with `latencyMs: undefined`, `lastChecked: undefined`. → **Invariant**: Stored as `undefined`; `getBest()` sorts undefined latency as `Infinity` (always last among equal priority+health).

## 4. `register()` — Merge Semantics on Existing Id

- **P4.1** → Fuzz: Register provider A, then register A again with new `name`/`baseUrl`/`model` but omit `healthStatus`/`latencyMs`/`lastChecked`. → **Invariant**: New fields overwrite; health data **preserved** from existing entry.
- **P4.2** → Fuzz: Register A (`healthStatus='healthy'`, `latencyMs=50`, `lastChecked=12345`), re-register A with `healthStatus='degraded'`, `latencyMs=200`, `lastChecked=99999`. → **Invariant**: New health data fully overwrites — no hidden carry-over.
- **P4.3** → Fuzz: Register A with `enabled: true`; re-register A with `enabled: false`. → **Invariant**: Final state has `enabled: false`; `getBest()` excludes it.
- **P4.4** → Fuzz: Register A with `capabilities: ['thai-language']`; re-register A with `capabilities: ['code-generation']` (no merge). → **Invariant**: Capabilities are **replaced**, not merged. Document as **weakness** — no array union.

## 5. `unregister()` Idempotence

- **P5.1** → Fuzz: Call `unregister(<random-uuid>)` on non-existent id 1000×. → **Invariant**: Never throws; map size unchanged for missing ids; size decrements by 1 for present ids.
- **P5.2** → Fuzz: Register N providers, unregister them in random order, calling `getAll()` between each. → **Invariant**: `getAll().length` monotonically decreases; never negative; `getMDESPrimary()` invariant still holds unless `'mdes-primary-ollama'` was the one removed.

## 6. `getAll()` Immutability

- **P6.1** → Fuzz: Get all, mutate every returned object's fields (`enabled`, `priority`, `capabilities.push(...)`, `capabilities[0] = 'evil'`). → **Invariant**: Internal `providers` map values are **not** mutated; subsequent `getAll()` returns original values.
- **P6.2** → Fuzz: Get all, then re-register one of the returned providers with different config. → **Invariant**: Previously returned objects are stale copies (not live references); new `getAll()` reflects update.

## 7. `getBest()` — Selection Properties

- **P7.1** → Fuzz: Register N providers with `enabled` randomly set, all distinct `id`. → **Invariant**: `getBest()` returns `undefined` iff no provider has `enabled === true`; otherwise returns an enabled one.
- **P7.2** → Fuzz: Register providers with priorities `[-2^53, -1, 0, 1, 2^53, NaN, +Infinity, -Infinity]`. → **Invariant**: Sorting is stable: `NaN`-priority provider never selected (NaN comparison breaks sort); document as **weakness** — no NaN guard. Highest finite priority wins.
- **P7.3** → Fuzz: All enabled providers share identical `priority` and `healthStatus='healthy'`; vary `latencyMs` over `[-1, 0, undefined, 1, Number.MAX_SAFE_INTEGER, Infinity, NaN]`. → **Invariant**: Selected provider is the one with smallest finite non-negative `latencyMs`; `undefined` → `Infinity` (last); `NaN` behavior is implementation-defined (likely sorted last or skipped).
- **P7.4** → Fuzz: Register providers with `healthStatus` cycling through all 3 values + invalid strings (`'foo'`, `''`, `null`). → **Invariant**: Selection order is `healthy > degraded > unknown`; invalid `healthStatus` values cause `healthOrder[undefined] === undefined` → `NaN` sort comparison → **weakness** (no enum validation).
- **P7.5** → Fuzz: `getBest('capability-X')` where no provider has `'capability-X'` in `capabilities`. → **Invariant**: Returns `undefined`.
- **P7.6** → Fuzz: `getBest(<empty-string>)`, `getBest(<1000-char random string>)`, `getBest(<string with null bytes>)`. → **Invariant**: Behaves like normal string filter; no regex/special-char injection (uses `.includes`).
- **P7.7** → Fuzz: Capability arrays with 10,000 strings; one matching. → **Invariant**: Filter completes; correct provider selected; no DoS.

## 8. `selectForTask()` — Task Mapping

- **P8.1** → Fuzz: For each task in the union, register a provider with the mapped capability and verify selection. → **Invariant**: `selectForTask('thai')` selects provider with `'thai-language'`; `'code'` → `'code-generation'`; `'reasoning'` → `'reasoning'`; `'fast'` → `'low-latency'`; `'general'` → `'general-purpose'`.
- **P8.2** → Fuzz: Call `selectForTask(<value not in union>)` (e.g., `'unknown'`, `''`, `null` via `as any`). → **Invariant**: `Record<K, V>[K]` access returns `undefined`; `getBest(undefined)` then falls back to unfiltered `getBest()`; if any enabled provider exists, returns it; else throws `No available provider for task "<task>"`.
- **P8.3** → Fuzz: All providers disabled; call `selectForTask('thai')`. → **Invariant**: Throws `Error` with message `No available provider for task "thai"`.
- **P8.4** → Fuzz: Providers exist but none match capability; others exist. → **Invariant**: Falls back to unfiltered `getBest()` — **weakness**: silently ignores requested capability, may return wrong-type provider.

## 9. `checkHealth()` — Network Behavior

- **P9.1** → Fuzz: `baseUrl` = `''`, `'   '`, `'not-a-url'`, `'http://'`, `'ftp://x'`, `'://missing-scheme'`. → **Invariant**: `new URL('/health', '')` throws → `checkHealth` should throw or be caught. Verify the catch block sets `healthStatus='degraded'` and returns `{healthy:false, latencyMs:>=0}`.
- **P9.2** → Fuzz: `baseUrl` points to unreachable host (`'http://10.255.255.1:1'`, `'http://localhost:1'`, `'http://0.0.0.0:0'`). → **Invariant**: Returns `{healthy:false, latencyMs:<10000}`; provider mutated to `healthStatus='degraded'`, `lastChecked` updated.
- **P9.3** → Fuzz: Mock `fetch` to hang forever (never resolves). → **Invariant**: AbortController fires at 10s; returns `{healthy:false, latencyMs: ~10000}`; `setTimeout` is cleared (no leaked timers — verify by mocking `setTimeout`).
- **P9.4** → Fuzz: Mock `fetch` to throw synchronously, throw asynchronously, reject with `TypeError` (network error), reject with `AbortError`. → **Invariant**: All paths caught; `healthStatus='degraded'`; `healthy:false`.
- **P9.5** → Fuzz: `response.ok = false` for status codes `[400, 401, 403, 404, 429, 500, 503, 599, 999]`. → **Invariant**: `throw new Error('Non-OK status: ...')` → caught → `healthStatus='degraded'`.
- **P9.6** → Fuzz: `apiKey` ∈ {`undefined`, `''`, 10KB string, `'\n\r\t'`, string with `";\n--header-injection"`}. → **Invariant**: Header value used verbatim; **weakness** — no sanitization; CRLF injection possible. Response still processed.
- **P9.7** → Fuzz: `checkHealth(<non-existent-id>)`. → **Invariant**: Throws `Error` with message `'Provider <id> not found'`. No state mutation.
- **P9.8** → Fuzz: System clock jumps backward during call (mock `Date.now` to return decreasing values). → **Invariant**: `latencyMs = Date.now() - start` may be negative — **weakness** (no clock-skew guard). Document; subsequent `getBest()` sorts negatives first.
- **P9.9** → Fuzz: Concurrent `checkHealth` on same id (Promise.all of 50). → **Invariant**: All return; final state consistent (last-write-wins on `lastChecked`); no corruption.

## 10. `checkAllHealth()` — Concurrency

- **P10.1** → Fuzz: Register 0 providers, call `checkAllHealth`. → **Invariant**: Returns `[]`; never throws.
- **P10.2** → Fuzz: Register N=1000 providers, half with bad URLs. → **Invariant**: `Promise.allSettled` never rejects the outer promise; returns array of length N with all `healthStatus` ∈ `{healthy, degraded}` (no `'unknown'` after check).
- **P10.3** → Fuzz: Mock `fetch` to throw on every call. → **Invariant**: All providers marked `degraded`; all `lastChecked` updated; no unhandled rejections.

## 11. Singleton & Cross-Instance Isolation

- **P11.1** → Fuzz: Import module in two "contexts" (simulate via module-cache reset); mutate via instance A. → **Invariant**: Singleton `providerManager` is shared (same map). Re-instantiating `new ProviderManager()` creates an **isolated** map (separate default MDES). Document divergence.
- **P11.2** → Fuzz: 100 parallel `new ProviderManager()` instances. → **Invariant**: Each starts with exactly 1 provider (`mdes-primary-ollama`); no shared mutable state across instances.

## 12. Boundary / Malformed Inputs (Adversarial)

- **P12.1** → Fuzz: `id` containing path-traversal (`'../etc/passwd'`), SQL chars, prototype-pollution keys (`'__proto__'`, `'constructor'`, `'toString'`). → **Invariant**: `Map.get`/`Map.set` use these as keys safely; `getMDESPrimary()` only matches exact `'mdes-primary-ollama'`.
- **P12.2** → Fuzz: `baseUrl` = `'javascript:alert(1)'`, `'data:text/html,<script>'`, `'file:///etc/passwd'`. → **Invariant**: `fetch` called with constructed URL; no validation — **weakness** (SSRF risk).
- **P12.3** → Fuzz: `capabilities` as non-array (`'string'`, `123`, `null`, `{length:5}`). → **Invariant**: `p.capabilities.includes(...)` may throw on null/non-string-coercible — **weakness** (no type guard). Document expected throw or graceful handling.
- **P12.4** → Fuzz: Register 100,000 providers with unique ids. → **Invariant**: `getAll()` returns 100,001 (incl. default); `getBest()` completes in <1s; memory bounded by entries.
- **P12.5** → Fuzz: `register` called with circular-reference config object. → **Invariant**: `{...config}` spread handles cycles (depends on engine; may stack-overflow on JSON-style spread of cyclic structures — **weakness** in deep-clone).

## 13. Returned-Value Identity

- **P13.1** → Fuzz: Call `getBest()` 1000×. → **Invariant**: Returns a fresh shallow copy each time (mutating result does not affect next call's result).
- **P13.2** → Fuzz: Call `getMDESPrimary()` twice in a row, mutate first result's `enabled=false`. → **Invariant**: Second call still returns `enabled: true` (defensive copy held).

## 14. Documented Weaknesses (No Fix — Only Fuzz-Asserts Behavior)

- **W1**: No runtime validation of `type`, `healthStatus`, `enabled` — strings/numbers outside allowed values are stored.
- **W2**: `capabilities` not array-merged on re-register.
- **W3**: `checkHealth` does not sanitize `apiKey` (CRLF injection in header).
- **W4**: `checkHealth` susceptible to SSRF — no URL scheme/host allowlist.
- **W5**: Negative or `NaN` `latencyMs` accepted; sorts produce surprising order.
- **W6**: `selectForTask` silently falls back to wrong-type provider when capability unavailable.
- **W7**: `healthStatus` can be set to any string; breaks `healthOrder` lookup → `NaN` sort.
- **W8**: `latencyMs: undefined` sorted as `Infinity`, but if explicitly set to `NaN` → undefined sort behavior.
- **W9**: `baseUrl` validation only inside `new URL`; no protocol/host checks.
- **W10**: `Promise.allSettled` swallows individual errors silently — caller cannot tell which providers failed.
```
