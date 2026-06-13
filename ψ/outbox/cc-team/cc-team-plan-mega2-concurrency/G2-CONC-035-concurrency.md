<!-- cc-team deliverable
 group: G2 (concurrency division)
 member: CONC-035 role=concurrency model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1450,"completion_tokens":1704,"total_tokens":3154,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 44s
 generated: 2026-06-13T12:17:19.883Z -->
# Concurrency/Async-Safety Audit: `responseComposer.ts`

## Summary

This module is **stateless** and **pure**. All exports are functions over passed-in data; no module-level mutable state, no caches, no listeners, no timers, no I/O. The async function is a stub that simply delegates to the sync composer. Consequently, most concurrency categories do not apply. The only real-world risk surfaces if a future implementation of `composeThaiAnswerWithLLM` introduces shared state or fails to enforce the documented 1500ms timeout — call sites are then exposed to the typical LLM-call hazards.

| # | Severity | Location | Race / Issue | Why it (will) matter | Fix |
|---|----------|----------|--------------|----------------------|-----|
| 1 | **Info** | `composeThaiAnswerWithLLM` (entire body) | **Shared mutable state expected, none present** | The function is the documented opt-in for LLM-backed composition. If/when implemented naively, a module-level `let cache`, `inFlight` map, or rate-limit counter is the most likely concurrency bug (cache stampede, torn reads). Today the risk is latent. | When implementing, encapsulate any cache behind a single-flight `Map<string, Promise<T>>` keyed on a stable hash of `input`, or use `Map` with `set`/await inside an async function and rely on the event-loop's run-to-completion for the synchronous `set` step. Never mutate shared state outside a `Promise` chain boundary without awaiting. |
| 2 | **Info** | `composeThaiAnswerWithLLM` (stub) | **Unawaited promise risk at call sites** | The stub currently returns a synchronously-resolved promise, so `await` is not required for correctness — but the signature is `Promise<…>`. A caller that forgets `await` will silently receive a stale "deterministic" answer while the future LLM path executes. | In the implementation, require callers to `await` and document it. Optionally mark the return type non-`Promise` while still deterministic, or use a `Symbol`-tagged branded type so misuse is a type error. Add a lint rule (`@typescript-eslint/no-floating-promises`) at the call-site level. |
| 3 | **Info** | `composeThaiAnswerWithLLM` (planned) | **No timeout enforcement in stub** | The JSDoc mandates `≤ 1500ms`. A missing `AbortController` + `setTimeout` means a slow LLM can block the route, and concurrent slow calls compound (no concurrency cap) → event-loop starvation / connection pool exhaustion under load. | Wrap the LLM call in `Promise.race([call, timeout(1500)])` with an `AbortController` so the request is actually cancelled, not just abandoned. Reject with a typed `ComposerTimeoutError` and fall back to `composeThaiAnswer`. |
| 4 | **Info** | `composeThaiAnswerWithLLM` (planned) | **Promise.all error-swallowing** | If the LLM call fans out (e.g. parallel fact re-ranking) and someone wraps it in `Promise.all([...])` without a per-promise `catch`, one rejection rejects the whole call and the error path may not be distinguishable from a "no facts" `passthrough` result. | Use `Promise.allSettled` for best-effort parallel work, or per-task `.catch(err => ({ ok: false, err }))` and aggregate. Never `await Promise.all([…])` then `.catch(() => fallback)` without logging — it hides root causes. |
| 5 | **Low** | `composeThaiAnswer` line: `Date.now() - t0` | **Clock-jump / ordering assumption** | `Date.now()` is wall-clock; on a system where NTP steps the clock backwards, `latencyMs` can be negative. Harmless here, but the field is consumed by tracing — downstream "p99 latency" calculations become misleading. | Use `performance.now()` (monotonic) for elapsed-time measurement; keep `Date.now()` only for absolute timestamps. Also: `latencyMs` is computed twice (early-return and end) — fine, just be aware it's wall-clock. |
| 6 | **Low** | `composeThaiAnswer` line: `facts = Array.isArray(input.facts) ? input.facts : []` | **Check-then-act on caller-provided array** | If a caller mutates `input.facts` concurrently (e.g. a tool handler pushes facts into a shared array while `composeThaiAnswer` is iterating `rendered`), the length/contents read here may not match what gets iterated. Synchronous JS can't actually observe this mid-function, but a microtask boundary in a future async refactor would make it racy. | (a) Shallow-clone once on entry: `const facts = (Array.isArray(input.facts) ? input.facts : []).slice();`. (b) Document that `ResponseComposerInput` must be treated as immutable by callers. (c) If the function ever becomes `async`, snapshot `facts` before any `await`. |
| 7 | **Low** | `composeThaiAnswer` loop: `for (const f of rendered)` | **Ordering assumption on caller-provided order** | The composer preserves the caller-supplied fact order. If upstream tools resolve out of order (e.g. weather finishes after seismic), the rendered answer's order is non-deterministic per-request, which can look like flaky UX and confound golden-file tests. Not a thread-safety bug, but a "concurrency-adjacent" determinism bug. | (a) Document that callers must pre-sort by `source` priority, or (b) accept an `order?: 'source' \| 'confidence' \| 'arrival'` option and sort here. Either way, do not rely on whatever microtask order the caller happened to feed. |
| 8 | **Info** | Module top-level | **No event-listener / timer / cache leaks** | None registered. Confirmed clean. | — |
| 9 | **Info** | Module top-level | **No cache → no stampede** | None present. Confirmed clean. | — |
| 10 | **Info** | `composeThaiAnswer` early return | **TOCTOU on `usable.length === 0` is impossible** | Synchronous function; no time-of-check/time-of-use window in the current implementation. Flagged only because the question asked. | If the function becomes async, replace `if (usable.length === 0) { return … }` with a recomputed check after any `await`, or assert once after all data is gathered. |

## Net Assessment

- **No live concurrency defects.** The module is a pure function over its arguments and a future-LLM stub that currently just calls the sync version.
- **All risk is latent** and concentrated in `composeThaiAnswerWithLLM` (items 1–4). Address those before wiring the LLM hook, not after.
- **Two low-severity improvements worth making now** even without the LLM path: switch to `performance.now()` (#5) and clone the input array on entry (#6). Both are one-line changes that harden the sync path for free.

### Recommended Pre-Wire Checklist for `composeThaiAnswerWithLLM`

1. Add `AbortController` + 1500ms timeout.
2. Single-flight cache (Map of in-flight Promises) keyed on a stable hash of `input`.
3. Concurrency cap (e.g. a simple `p-limit(4)`) so parallel LLM calls can't exhaust the upstream.
4. `Promise.allSettled` (never raw `Promise.all`) for any fan-out.
5. Typed `ComposerTimeoutError` / `ComposerLLMError` so `passthrough` vs. errored fallback is distinguishable in `reasons[]` and tracing.
6. Require `await` at call sites via `@typescript-eslint/no-floating-promises` and a code-review checklist.
