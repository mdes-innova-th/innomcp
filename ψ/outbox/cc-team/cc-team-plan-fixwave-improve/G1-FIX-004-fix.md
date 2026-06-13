<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-004 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2830,"completion_tokens":3500,"total_tokens":6330,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2504,"image_tokens":0},"cache_creation_input_tokens":0} | 38s
 generated: 2026-06-13T11:24:46.036Z -->
### 1. Race condition in `getOracleToken` (MEDIUM)
**Summary:** Concurrent calls may both see `_oracleToken` as null/expired and issue duplicate token requests. Introduce a promise-based dedup lock to ensure only one in‑flight request.

```typescript
// --- add a new module-level variable near _oracleToken ---
let _oracleTokenPromise: Promise<string | null> | null = null;

// --- replace the entire getOracleToken function ---
async function getOracleToken(baseUrl: string, signal: AbortSignal): Promise<string | null> {
  const now = Date.now();
  // Return cached token if still valid (60 s buffer)
  if (_oracleToken && _oracleToken.expiresAt > now + 60_000) return _oracleToken.token;

  // If another caller is already fetching, reuse its promise
  if (!_oracleTokenPromise) {
    _oracleTokenPromise = (async () => {
      try {
        const res = await fetch(`${baseUrl}/api/auth/token?client_id=innomcp&role=user`, {
          method: "POST", signal,
        });
        if (!res.ok) return null;
        const data = await res.json() as { access_token?: string };
        const token = data.access_token ?? "";
        if (!token) return null;
        _oracleToken = { token, expiresAt: Date.now() + 23 * 3600 * 1000 };
        return token;
      } catch {
        return null;
      } finally {
        _oracleTokenPromise = null;          // clear lock on completion/error
      }
    })();
  }
  return _oracleTokenPromise;
}
```

### 2. Stale token not cleared on 401/403 inside `callInnovaOracle` (MEDIUM)
**Summary:** When the Oracle responds with 401/403 the cached token is kept, forcing all subsequent calls to fail until the 23‑h expiry. Clear the cache on auth failures.

```typescript
// ---- inside callInnovaOracle, replace the !res.ok check ----
if (!res.ok) {
  if (res.status === 401 || res.status === 403) {
    _oracleToken = null;   // force re-authentication next time
  }
  throw new Error(`innova-oracle: HTTP ${res.status}`);
}
```

### 3. `.json()` throws raw `SyntaxError` on malformed body (LOW)
**Summary:** A non‑JSON response from the Oracle causes an untyped `SyntaxError` that callers might not handle gracefully. Wrap `.json()` and fall back to a safe placeholder string.

```typescript
// ---- inside callInnovaOracle, after the fetch() and ok check, replace the next lines ----
let data: Record<string, unknown>;
try {
  data = await res.json() as Record<string, unknown>;
} catch {
  // Response body is not parseable JSON – use text fragment
  const text = await res.text().catch(() => "");
  return `[Oracle] Invalid response: ${text.slice(0, 200)}`;
}

const text = (data.context ?? data.result ?? data.text ?? "") as string;
if (!text || typeof text !== "string") return JSON.stringify(data).slice(0, 800);
return `[Oracle]\n${text.trim()}`;
```

### 4. Fallback `kind` classification defaults to "openai" (LOW)
**Summary:** `buildProviderConfigs` treats any unrecognised `p.type` as `"openai"`, which could silently misclassify new provider types. Make the default explicit `"unknown"` and log a warning.

```typescript
// ---- extend the ProviderConfig interface to accept "unknown" ----
interface ProviderConfig {
  id: string;
  name: string;
  kind: "ollama" | "openai" | "anthropic" | "unknown";   // <-- add "unknown"
  baseUrl: string;
  model: string;
  apiKey: string;
  isMdes: boolean;
}

// ---- replace the kind line in buildProviderConfigs ----
kind: p.type === "ollama-local" || p.type === "ollama-remote" ? "ollama" :
      p.type === "anthropic-compatible" ? "anthropic" :
      p.type === "openai-compatible"   ? "openai"          // explicit mapping for openai
        : (console.warn(`[motherDispatch] Unknown provider type: ${p.type}, treating as "unknown"`),
           "unknown" as ProviderConfig["kind"]),
```
