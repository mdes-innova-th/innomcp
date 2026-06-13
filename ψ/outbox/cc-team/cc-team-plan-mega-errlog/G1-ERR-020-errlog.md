<!-- cc-team deliverable
 group: G1 (errlog division)
 member: ERR-020 role=errlog model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1839,"completion_tokens":1937,"total_tokens":3776,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 47s
 generated: 2026-06-13T12:03:19.168Z -->
# Error-Handling & Logging Audit: `mdesModelCache.ts`

| Severity | Location | Issue | Fix |
|----------|----------|-------|-----|
| **High** | `getModels` — `catch` block, line ~42 | **No request timeout** on `fetch(MDES_OLLAMA_URL/...)`. A hung TCP connection (e.g., MDES endpoint down) will block indefinitely, blocking callers in `warmUp` and any request that hits a stale/empty cache. | Wrap the fetch with `AbortController` + `setTimeout` (e.g., 5–10s). Reject with a descriptive `TimeoutError`. Pattern: `const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000); try { await fetch(url, { signal: ctl.signal }); } finally { clearTimeout(t); }` |
| **High** | `getModels` — `catch` block, line ~42 | **Swallowed error context** when stale cache is returned. `console.warn("Failed to refresh model cache, using stale cache:", error)` logs the raw `Error` object via Node's default util-inspect; stack/cause/response body are lost, making triage difficult. | Log structured fields: `console.warn({ event: "mdes_cache.refresh_failed", url: MDES_OLLAMA_URL, status: error.status, cause: error.message, cacheAgeMs: now - this.lastFetch }, "Falling back to stale cache")`. If using a logger, use a dedicated level (e.g., `logger.warn`) with a stable event code. |
| **High** | `getModels` — `throw` at end of `catch` | **No timeout / no `AbortError` differentiation**. A timeout and a 500 are conflated; the same generic "Failed to fetch" message hides root cause. | Differentiate: `if (error.name === "AbortError") throw new Error("MDES Ollama request timed out")`; otherwise preserve `response.status` from the thrown error and include it in the message. |
| **High** | `getModels` — rethrown error | **Error loses HTTP context.** The original `response.status` (e.g., 401/403/500/503) is dropped; callers cannot distinguish auth vs. outage vs. rate-limit. | Throw a custom error class carrying `status`, `url`, and the response snippet: `throw new MDESFetchError(message, { status: response.status, url })`. Catch this specific type upstream. |
| **High** | `response.json()` (line ~36) | **Unvalidated payload** — `OllamaTagsResponse` is trusted. Malformed JSON or missing `models` could throw a `TypeError` caught generically, masking payload issues. | Validate: `if (!data || !Array.isArray(data.models)) throw new Error("Unexpected MDES /api/tags schema")`. Optionally use a schema validator (zod/ajv). |
| **Medium** | `getModels` — `console.warn` | **Inconsistent log levels & unstructured logging.** Mixes `console.warn` with throwing errors; no level for success, no level for the no-cache-available throw path. | Introduce a module-level logger with explicit levels: `logger.debug("cache hit")`, `logger.warn({...}, "stale cache used")`, `logger.error({...}, "fetch failed and no cache")`. Be consistent across the file. |
| **Medium** | `getBestModelForTask` — `parseInt(m.details.quantization_level, 10)` | **Silent `NaN` swallowed by `\|\| 0`.** If `quantization_level` is e.g. `"Q4_0"`, `parseInt` returns `NaN`, coerced to `0`. The `fast` heuristic then produces a misleading score with no warning. | Use `Number.parseInt(..., 10)` and explicitly check `Number.isFinite(q)`; log a debug message when the value is non-numeric. Consider mapping known strings (`Q4_0`, `Q5_K_M`, …) to bits-per-weight directly. |
| **Medium** | `getBestModelForTask` — `reasoning` fallback at the bottom | **Untracked generic fallback.** When no model is ≥7B, the function silently falls through to "largest overall", which may be a small model if all are sub-7B. No log/visibility for the operator. | Log at `info` level when the fallback path is taken, e.g., `logger.info({ task, available: models.map(m => m.details?.parameter_size) }, "no 7B+ model; using largest overall")`. |
| **Medium** | `getBestModelForTask` — empty models | **Throws plain `Error("No models available")`.** No context about whether this came from a network failure or an empty remote list. | `throw new Error("No MDES models available from cache and upstream returned empty list")`; include `task` and `cacheAgeMs` for debugging. |
| **Low** | `getModel`, `isModelAvailable` | **No try/catch.** They propagate any error from `getModels` directly, which is fine, but the cache layer's stale-fallback means callers may receive a *stale* model list unexpectedly. There is no API for callers to know freshness. | Add a `getModelsWithMetadata(): Promise<{ models: MDESModel[]; stale: boolean; fetchedAt: Date }>` so callers can make informed decisions; or expose `getStats()` is enough for callers who want to inspect. |
| **Low** | `MDES_OLLAMA_URL` constant | **No validation at startup.** A typo or empty `MDES_OLLAMA_URL` env var (e.g., `""` set explicitly) bypasses the default only if `process.env.MDES_OLLAMA_URL` is *undefined*; the falsy check treats `""` as "use default", which can mask misconfiguration. | `const MDES_OLLAMA_URL = process.env.MDES_OLLAMA_URL?.trim() || "https://ollama.mdes-innova.online";` and validate with `new URL(...)` at module load; throw on invalid. |
| **Low** | `getModelFamilies`, `getStats` | **Logs nothing on misuse.** If called before any fetch, `lastFetch === 0` and `getStats().lastFetched === null` — fine — but `getModelFamilies()` returns `[]` silently. No indicator of cold cache. | Optionally return `{ families: string[]; cold: boolean }` or document explicitly. Low priority. |
| **Info** | `warmUp` | **Unhandled rejection on server start.** If `warmUp()` is called and `getModels` throws (no cache yet), the rejection is unhandled unless the caller awaits + catches. | Make the contract explicit: `warmUp()` should never throw during boot. Internally, catch and `logger.error({...}, "MDES warm-up failed; service will start with empty cache")`, leaving `this.cache = []`. Alternatively document that callers must await and handle. |
| **Info** | Whole module | **No PII/secrets concern identified** in the current code. The only external value is `MDES_OLLAMA_URL` (not a secret). Just ensure future logging does not include auth headers or full model `details` blobs if they ever carry user data. | Add a `redact()` helper or use a logger with field-redaction if request/response bodies are ever logged. |

---

### Recommended concrete changes (highest impact)

1. **Timeout + structured error**
   ```ts
   private static readonly FETCH_TIMEOUT_MS = 8_000;

   private async fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
     const ctl = new AbortController();
     const t = setTimeout(() => ctl.abort(), MDESModelCache.FETCH_TIMEOUT_MS);
     try {
       return await fetch(url, { ...init, signal: ctl.signal });
     } finally {
       clearTimeout(t);
     }
   }
   ```

2. **Typed error + context**
   ```ts
   class MDESFetchError extends Error {
     constructor(msg: string, public readonly status?: number, public readonly url: string) { super(msg); this.name = "MDESFetchError"; }
   }
   ```

3. **Structured logger (pino-style or console-based shim)** with stable `event` codes:
   - `mdes.cache.hit`
   - `mdes.cache.refresh_failed`
   - `mdes.cache.refreshed`
   - `mdes.cache.warmup_failed`
   - `mdes.model_selection.fallback`

4. **Validation** of `/api/tags` payload before assigning to `this.cache`.

5. **Reconsider the `stale cache` strategy**: it currently hides outages. Consider exposing a `stale: true` flag on the returned list (or a separate `getModelsSafe()`) so callers can opt in to freshness checks.
