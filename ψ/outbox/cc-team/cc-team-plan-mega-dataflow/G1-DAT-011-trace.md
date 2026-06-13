<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-011 role=trace model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2723,"completion_tokens":2221,"total_tokens":4944,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":833,"image_tokens":0},"cache_creation_input_tokens":0} | 27s
 generated: 2026-06-13T12:00:43.745Z -->
## Trace: `handleFastPathMessage` Data Flow (Ordered Step List)

**Module:** `innomcp-node/src/services/fastPathHandler.ts`  
**Entry point:** `handleFastPathMessage(text, respond, opts, clientIp?, userId?)`  
**Purpose:** Short-circuit common queries (greeting, math, ping, etc.) with a fast (<1s) response, bypassing main AI pipeline.

---

### Step 1 – Input reception
| Field | Value |
|---|---|
| **Source** | Caller (HTTP handler, WebSocket listener) |
| **Shape** | `{ text: string, respond: Responder, opts: FastPathHandlerOptions, clientIp?: string, userId?: string }` |
| **Side effects** | None |

---

### Step 2 – Enable check
| Transformation | `isEnabled(opts)` → reads `opts.mode` (default `"on"`) |
|---|---|
| **Input** | `opts: FastPathHandlerOptions` |
| **Output** | `boolean: enabled` |
| **Side effects** | None |

If `false` → return `{ handled: false, reason: "disabled", latencyMs: 0 }` and stop.

---

### Step 3 – Intent gate bypass
| Transformation | `analyzeIntent(text)` – checks if text matches known bypass patterns (e.g. complex reasoning, code generation) |
|---|---|
| **Input** | `text: string` |
| **Output** | `{ shouldBypass: boolean, reason?: string }` |
| **Side effects** | None (pure-ish) |

If `shouldBypass` → log (`logger.debug`) and return `{ handled: false, reason: ..., latencyMs }`.

---

### Step 4 – Rate limiting
| Transformation | `checkRateLimit(key, 5, 8)` where key = `buildRateLimitKey(clientIp, userId, 'fastpath')` |
|---|---|
| **Input** | `clientIp?: string, userId?: string` (from caller) |
| **Output** | `{ allowed: boolean, remaining: number, reset: number }` |
| **Side effects** | **Database/State**: Increment usage counter, store timestamp (assumed Redis / in-memory store) |

If `!allowed` → respond with error (e.g. `{ error: "rate limit", retryAfter }`) and return `{ handled: true, reason: "rate_limit", ... }`.

---

### Step 5 – Math expression detection & evaluation (if present)
| Transformation | `trigToDeg(text)` → replace `sin(90)` → `sin(90 deg)`; then `evaluate(expr)` via `mathjs` |
|---|---|
| **Input** | `text: string` |
| **Output** | `{ isMath: boolean, result?: number }` |
| **Side effects** | None (pure) |

If `isMath`:
-   `cleanFloat(result)` → e.g. `0.9999999999999999` → `"1"`
-   Build response string `"Result: <cleaned>"`
-   Call `respond(payload)` – **side effect**: send HTTP/WS response immediately.
-   Return `{ handled: true, hit: "math", responseTextPreview: ..., latencyMs }`.

---

### Step 6 – Load extra phrases (cache + external sources)
| Transformation | `getExtraPhrases(opts)` |
|---|---|
| **Input** | `opts.FASTPATH_EXTRA_FILE / FASTPATH_EXTRA_URL` env vars or options |
| **Output** | `ExtraPhrases = { greeting[], identity[], thanks[], ok[], ping[], emoji[] }` |
| **Side effects** | - **File read** (if `extraPhrasesFile` set) – `fs.readFileSync`<br>- **Network fetch** (if `extraPhrasesUrl` set) – `fetch()` with abort timeout 1.5s<br>- **State mutation**: update module-level `extraCache` variable |

---

### Step 7 – Fast‑path dictionary matching
| Transformation | `maybeFastPath(text, extraPhrases)` + `getFastPathDictInfo()` |
|---|---|
| **Input** | `text: string`, merged extra phrases |
| **Output** | `{ hit: string | null, response: string, structuredContent?: any }` |
| **Side effects** | None (pure lookup) |

If `hit` is non‑null → build response payload and call `respond(payload)` – **side effect**: send response.
Return `{ handled: true, hit, responseTextPreview, structuredContent, latencyMs }`.

---

### Step 8 – Fallback (no fast path hit)
| Transformation | None (direct return) |
|---|---|
| **Input** | (same context) |
| **Output** | `{ handled: false, reason: "no_match", latencyMs }` |
| **Side effects** | None (main AI pipeline sees this) |

---

### Final output shape (any return)
```typescript
{
  handled: boolean;        // true if fast path responded
  reason?: string;         // "disabled"|"intent_bypass"|"rate_limit"|"math"|"greeting"|..."no_match"
  latencyMs: number;       // wall clock from start to decision
  hit?: string;            // "math", "greeting", "identity", "thanks", "ping", "emoji" etc.
  responseTextPreview?: string; // first N chars of actual response sent (for logging)
  structuredContent?: any; // e.g. JSON for identity, status info
}
```

---

### Summary of side‑effects outside the response

| Scope | Type | Details |
|---|---|---|
| **Logger** | log file / stdout | `logger.debug()` at intent bypass, extra refresh, or rate limit denial |
| **File system** | synchronous read | `fs.readFileSync` for extra phrases file (blocking, but guarded by watchdog) |
| **Network** | HTTP GET | `fetch()` for extra phrases from URL (with abort timeout) |
| **State** | module‑level variable | `extraCache` updated after every TTL expiry |
| **State** | external store (assumed Redis) | Rate limit counters incremented via `checkRateLimit` |
| **Response to client** | HTTP / WebSocket | `respond(payload)` executed for every fast‑path hit |
