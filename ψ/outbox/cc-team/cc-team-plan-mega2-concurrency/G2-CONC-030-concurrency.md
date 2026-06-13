<!-- cc-team deliverable
 group: G2 (concurrency division)
 member: CONC-030 role=concurrency model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":3471,"completion_tokens":4053,"total_tokens":7524,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 83s
 generated: 2026-06-13T12:16:00.204Z -->
```typescript
  { th: "ยืนกลาง", en: "standing in the middle of", tag: "modifier" },
  { th: "นั่งบน", en: "sitting on", tag: "modifier" },
  { th: "ยืนบน", en: "standing on", tag: "modifier" },
  { th: "บินอยู่", en: "flying", tag: "modifier" },
  { th: "วิ่งอยู่", en: "running", tag: "modifier" },
  { th: "นอนอยู่", en: "lying down", tag: "modifier" },
];

// ── LLM fallback (opt-in, env-gated) ──────────────────────────────────────

interface LlmConfig {
  enabled: boolean;
  model: string;
  timeoutMs: number;
  maxTokens: number;
}

function readLlmConfig(): LlmConfig {
  return {
    enabled: process.env.PROMPT_ADAPTER_LLM === "1",
    model: process.env.PROMPT_ADAPTER_LLM_MODEL ?? "gpt-4o-mini",
    timeoutMs: Number(process.env.PROMPT_ADAPTER_LLM_TIMEOUT_MS ?? 4000),
    maxTokens: Number(process.env.PROMPT_ADAPTER_LLM_MAX_TOKENS ?? 200),
  };
}

let cachedConfig: LlmConfig | null = null;

function getLlmConfig(): LlmConfig {
  if (cachedConfig === null) {
    cachedConfig = readLlmConfig();
  }
  return cachedConfig;
}

// ── In-flight de-duplication (cache-stampede guard) ───────────────────────

const inflight = new Map<string, Promise<AdaptedImagePromptResult | PlannerQueryResult>>();

function dedup<T extends AdaptedImagePromptResult | PlannerQueryResult>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// ── Public API ────────────────────────────────────────────────────────────

export async function adaptImagePrompt(rawPrompt: string): Promise<AdaptedImagePromptResult> {
  const start = Date.now();
  const reasons: string[] = [];
  const normalized = normalizeThaiQuery(rawPrompt);
  const stripped = stripImageCommand(normalized);

  // try deterministic first
  const deterministic = tryDeterministicImage(stripped, reasons);
  if (deterministic) {
    return {
      originalPrompt: rawPrompt,
      normalizedPromptTh: stripped,
      adaptedPromptEn: deterministic,
      mode: "deterministic",
      confidence: 0.9,
      reasons,
      latencyMs: Date.now() - start,
    };
  }

  // opt-in LLM fallback with de-dup
  const cfg = getLlmConfig();
  if (!cfg.enabled) {
    return {
      originalPrompt: rawPrompt,
      normalizedPromptTh: stripped,
      adaptedPromptEn: stripped, // passthrough
      mode: "passthrough",
      confidence: 0.3,
      reasons: [...reasons, "llm-disabled-passthrough"],
      latencyMs: Date.now() - start,
    };
  }

  const key = `img:${stripped}`;
  return dedup(key, async () => {
    try {
      const en = await callLlmForImage(stripped, cfg);
      return {
        originalPrompt: rawPrompt,
        normalizedPromptTh: stripped,
        adaptedPromptEn: en,
        mode: "llm-fallback",
        confidence: 0.7,
        reasons: [...reasons, "llm-fallback"],
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        originalPrompt: rawPrompt,
        normalizedPromptTh: stripped,
        adaptedPromptEn: stripped,
        mode: "passthrough",
        confidence: 0.3,
        reasons: [...reasons, `llm-error:${(err as Error).message}`],
        latencyMs: Date.now() - start,
      };
    }
  });
}

// …similar for normalizePlannerQuery…

// …truncated: callLlmForImage, callLlmForPlanner, tryDeterministicImage, tryDeterministicPlanner…
```

---

# Concurrency / Async-Safety Audit

## Scope Note

The provided snippet is **truncated** (`/* …truncated… */` markers for `callLlmForImage`, `callLlmForPlanner`, `tryDeterministicImage`, `tryDeterministicPlanner`, and `normalizePlannerQuery`). Findings marked **(needs verification)** apply to the omitted tail; core findings below are sourced from the visible code.

---

## Summary Table

| # | Severity | Location | Race / Issue | Fix |
|---|----------|----------|--------------|-----|
| 1 | **HIGH** | `cachedConfig: LlmConfig \| null` + `getLlmConfig()` (module scope) | **Check-then-act race on config cache** — `if (cachedConfig === null) { cachedConfig = readLlmConfig(); }` is not atomic. Two concurrent first-callers can both observe `null`, both read `process.env`, and both assign. In Node's single-threaded event loop this *usually* benignly yields the last write, but the contract is non-deterministic if `readLlmConfig()` ever becomes async (e.g. reads from a file, secrets vault, or remote config). Even today, callers that depend on the config being stable across an operation may see a partially-initialized value. | Make init idempotent and atomic: `cachedConfig ??= readLlmConfig();` and `const cachedConfig: LlmConfig = readLlmConfig();` at module load (preferred — env vars are stable for process lifetime). If dynamic reload is required, guard with a `Promise`-based memoizer (`let init: Promise<LlmConfig> \| null`). |
| 2 | **HIGH** | `inflight: Map<string, Promise<…>>` + `dedup()` (module scope) | **Shared mutable state + cache-stampede window, but the stampede-guard itself is racy** — (a) The `Map` is a mutable singleton with no synchronization. (b) `inflight.get(key)` → `inflight.set(key, p)` is a non-atomic check-then-act: two concurrent `adaptImagePrompt` calls for the same `stripped` input can both miss the cache and both insert, defeating de-duplication and causing **two LLM calls** for the same query. (c) The `.finally(() => inflight.delete(key))` runs after `fn()` settles; if `fn()` throws synchronously before returning a promise, the entry is never cleaned (see #3). | Synchronize the get-or-create window in a single synchronous tick. Options: (i) perform the `set` immediately with a placeholder, then `await` outside the lock: `const cached = inflight.get(key); if (cached) return cached; const p = (async () => fn())(); inflight.set(key, p); p.finally(() => inflight.delete(key)); return p;` — note the IIFE so synchronous throws inside `fn` are still captured. (ii) Better: use `Promise.resolve().then(() => inflight.get(key))` to defer the lookup and serialize via a single microtask. (iii) Use an external `p-queue`/mutex. Also wrap `fn` in `Promise.resolve().try(fn)` to guarantee a Promise. |
| 3 | **HIGH** | `dedup()` `.finally(() => inflight.delete(key))` | **Unawaited promise / cleanup-not-on-throw** — `fn()` is typed `() => Promise<T>`, but the TypeScript signature is unenforced at runtime. If `fn` throws synchronously (e.g. an LLM client constructed lazily throws on first call), the `Promise` returned by `fn()` is never produced, the `.finally` is never registered, and the entry leaks in `inflight` forever. Subsequent calls for that key will see a stale `undefined`/leaked entry. | Wrap invocation: `const p = Promise.resolve().then(() => fn()).finally(() => inflight.delete(key)); inflight.set(key, p); return p;` — this guarantees cleanup regardless of sync/async failure. |
| 4 | **MEDIUM** | `dedup()` return value typing | **Type-unsafe cast hides errors** — `return existing as Promise<T>;` discards the result-type guarantee. A caller asking for an `AdaptedImagePromptResult` could receive a `PlannerQueryResult` if keys collide. Keys are namespaced (`img:` / presumably `planner:`), so this is *latent* rather than active, but the type system is lying. | Type the inflight map per namespace: `const inflightImg = new Map<string, Promise<AdaptedImagePromptResult>>(); const inflightPlanner = new Map<…>();` and key on `(namespace, input)` tuples. Remove the `as Promise<T>` cast. |
| 5 | **MEDIUM** | `dedup()` key derivation in `adaptImagePrompt` | **Key collision via raw prompt** — `const key = `img:${stripped}`;`. `stripped` is the *normalized* form, which is good. However, callers that vary only by whitespace/case after `stripImageCommand` (e.g. trailing spaces) get distinct keys, defeating the stampede guard. More importantly, if `stripped` contains user-controlled characters, the map grows unboundedly → **memory leak / DoS** (no LRU, no TTL, no max size). | (a) Normalize the key further (`.trim().toLowerCase()`). (b) Cap the map: `if (inflight.size > MAX) { /* evict or reject */ }`. (c) Add a TTL-based sweeper or use an LRU (`lru-cache`). (d) Reject empty/suspiciously-long keys. |
| 6 | **MEDIUM** | `reasons: string[]` arrays in result objects | **Shared-array references across inflight callers** — when `dedup` returns a single in-flight promise, all concurrent callers receive the *same* result object. The `reasons` array is mutated only inside the producing call (before return), so this is currently safe. **However**, if a future change appends to `reasons` after returning the object (e.g. post-processing), all cached-result holders will see each other's mutations. | Treat result objects as immutable post-construction. Document the invariant. If post-hoc enrichment is needed, return a fresh shallow copy per caller (or stop using `dedup` for the final delivery — use it only for the LLM call primitive). |
| 7 | **MEDIUM** | `tryDeterministicImage()` (truncated, **needs verification**) | **Ordering assumption in glossary scan** — comment says "longer phrases first" and the array is ordered accordingly, but the iteration is `for (const entry of GLOSSARY)` (assumed — verify). If any tag category is scanned independently, the `subject` *after* `modifier` (e.g. "แมว" matched before "นั่งบน") could be detected and then partially over-consumed, producing a different result depending on the order regexes are tried. In async contexts where multiple `adaptImagePrompt` calls run interleaved, this doesn't introduce *new* races (JS is single-threaded), but it does mean **non-determinism is possible if the array is ever mutated at runtime** (e.g. hot-reload of glossary). | Freeze the glossary: `const GLOSSARY: readonly GlossaryEntry[] = Object.freeze([…])`; or, better, precompute a `Map` of `string → {en, tag}[]` keyed by length-descending at module load. Reject runtime mutation. |
| 8 | **MEDIUM** | `process.env.PROMPT_ADAPTER_LLM` reads | **Env read race during tests / config reload** — `readLlmConfig()` reads four env vars non-atomically. If a test or runtime config-loader mutates `process.env` concurrently (e.g. `jest --watch`, or a SIGHUP handler that toggles `PROMPT_ADAPTER_LLM`), a `getLlmConfig()` call may observe an inconsistent snapshot (e.g. `enabled=1` but `model=undefined` → falls through to default). | Read all four env vars into a local object in a single synchronous block (already done — good). Add a `refreshLlmConfig()` invalidator that resets `cachedConfig` and is called from a single known place. Never mutate `process.env` from request handlers. |
| 9 | **LOW** | `Date.now() - start` latency measurement | **Clock skew / monotonicity assumption** — `Date.now()` is wall-clock and can jump backward (NTP, manual set). Latency could go negative. Not concurrency-related per se, but `start` is captured before any await, so the value is reliable *for a single call*; however, the inflight de-dup shares one `start` across all coalesced callers, which is arguably wrong (each caller wants its own observed latency). | Use `performance.now()` (monotonic). Either: (a) do not de-dup the latency measurement — capture `start` outside `dedup`, or (b) document that all coalesced callers observe the originator's latency. |
| 10 | **LOW** | `callLlmForImage` / `callLlmForPlanner` (truncated, **needs verification**) | **Timeout + uncaught rejection** — the snippet mentions "strict timeout" but the implementation is cut off. Common bug: `Promise.race([call, timeout])` where the loser is never `.catch()`-ed, producing `UnhandledPromiseRejection` warnings (and in Node 15+, process termination by default). | Ensure the losing promise has its rejection swallowed explicitly: `const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), cfg.timeoutMs));` and the underlying call has `.catch(() => {})` attached, or use `AbortController` to actually cancel. |
| 11 | **LOW** | Module-level `GLOSSARY`, `inflight`, `cachedConfig` | **Event-listener / global state leak across hot-reloads** — in dev mode (ts-node-dev, vite-node, esbuild --watch), module re-evaluation creates *new* instances of these, while the old ones may still be referenced by in-flight promises. Not a production issue, but a source of "ghost" de-duplication in development. | Guard: `globalThis.__promptAdapter ??= { inflight: new Map(), glossary: GLOSSARY };` for dev hot-reload safety. |
| 12 | **LOW** | `dedup` return type | **Promise.all error-swallowing potential** — if a caller does `Promise.all([adaptImagePrompt(a), adaptImagePrompt(b)])` and one of them ends up sharing the *same* inflight promise (e.g. by passing the same `rawPrompt` from two different call sites with different `originalPrompt` values), the `originalPrompt` field baked into the shared result will be the *originator's* raw prompt, not the caller's. This is an **information leak / cross-tenant data exposure** if `originalPrompt` is sensitive and the dedup key (`stripped`) is coarser than the input. | Either (a) include the full input hash in the key, or (b) return only the *translation* from `dedup` and let each caller compose its own wrapper with its own `originalPrompt`. |
| 13 | **LOW** | `tryDeterministicImage()` regex application (assumed) | **Regex state / lastIndex concerns** — none of the visible regexes use `g` or `y` flags, so `lastIndex` is not a footgun here. **Verifying** with the truncated source is recommended. | (No action if confirmed; otherwise use stateless `String.prototype.matchAll` with the `g` flag and reset `lastIndex` between calls.) |
| 14 | **INFO** | Top-level `await` not used | N/A — module uses only `import`, no top-level await. Safe. | — |

---

## Recommended Minimal Patch for the Top Three Issues

```typescript
// 1) LlmConfig: initialize at module load (env is stable)
const LLM_CONFIG: LlmConfig = {
  enabled: process.env.PROMPT_ADAPTER_LLM === "1",
  model: process.env.PROMPT_ADAPTER_LLM_MODEL ?? "gpt-4o-mini",
  timeoutMs: Number(process.env.PROMPT_ADAPTER_LLM_TIMEOUT_MS ?? 4000),
  maxTokens: Number(process.env.PROMPT_ADAPTER_LLM_MAX_TOKENS ?? 200),
};
// Optional: getLlmConfig() returns a frozen copy if you need reloadability

// 2) dedup: atomic get-or-create, cleanup-safe, type-safe per namespace
const inflightImg = new Map<string, Promise<AdaptedImagePromptResult>>();
const inflightPlanner = new Map<string, Promise<PlannerQueryResult>>();

function dedupImg(
  key: string,
  fn: () => Promise<AdaptedImagePromptResult>
): Promise<AdaptedImagePromptResult> {
  const hit = inflightImg.get(key);
  if (hit) return hit;

  // Promise.resolve().then() guarantees a Promise even if fn() throws sync,
  // and the .finally() always runs (so the entry is never leaked).
  const p = Promise.resolve()
    .then(fn)
    .finally(() => inflightImg.delete(key));

  inflightImg.set(key, p);
  return p;
}

// 3) Bounded cache: optional LRU wrapper
// import { LRUCache } from "lru-cache";
// const inflight = new LRUCache<string, Promise<…>>({ max: 500, ttl: 30_000 });
```

---

## Items Requiring the Truncated Source

To complete the audit, please provide the bodies of:

- `tryDeterministicImage(stripped, reasons)`
- `tryDeterministicPlanner(...)`
- `callLlmForImage(prompt, cfg)` — especially the timeout implementation
- `callLlmForPlanner(...)`
- `normalizePlannerQuery(rawQuery)` (the full function)
- Any `addListener` / `EventEmitter` / `setInterval` usage inside this file (none visible so far)

Once those are visible, the `Promise.race` timeout pattern, the `tryDeterministic*` array-iteration order, and any `process.on('SIGTERM')` cleanup hooks can be graded definitively.
