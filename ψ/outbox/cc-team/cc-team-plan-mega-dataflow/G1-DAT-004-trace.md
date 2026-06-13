<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-004 role=trace model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":2378,"completion_tokens":2597,"total_tokens":4975,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":631,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 22s
 generated: 2026-06-13T11:59:16.078Z -->
# Trace Pass: `motherDispatch.ts`

---

## Step 1 — Function Entry

**Enters:**
- `prompt: string` — user/AI prompt text (e.g. `"อุณหภูมิกรุงเทพวันนี้"`)
- `options: AgentDispatchOptions` — dispatch opts (mode, signal, etc.)
- `emit: EmitFn` — conductor event emitter callback

**Side-effect:** `motherIteration++` (module-level mutable counter, persists across calls)

---

## Step 2 — Build Provider Configs

**Transform:** `buildProviderConfigs()` calls `listProviders()` → maps each `ProviderDescriptor` through `resolveApiKey(p.id)` → produces `ProviderConfig[]`

**Shape out:**
```ts
ProviderConfig[] // e.g. 6-10 items
  { id: "mdes-cloud", name: "MDES Cloud Gemma4", kind: "ollama",
    baseUrl: "https://ollama.mdes.in.th", model: "gemma4:26b",
    apiKey: "sk-...", isMdes: true }
```

**Side-effect:** none (pure read from registry + env)

---

## Step 3 — Filter Eligible Providers

**Transform:** `configs.filter(isProviderConfigEligible)` — three gates per config:

| Gate | Check | Effect |
|------|-------|--------|
| Toggle | `isProviderEnabled(id)` | reads runtime toggle state |
| API key | `cfg.kind !== "ollama" \|\| !KEY_FREE_PROVIDER_IDS.has(id)` → key must be non-empty | providers with no key are **silently skipped** (no network call) |
| MDES_ONLY | `process.env.MDES_ONLY === "1"` → `MDES_PROVIDER_IDS.has(id)` | restricts to `mdes-cloud`, `thai-llm`, `seed-mdes-ollama`, `seed-thai-llm-specialist` |

**Shape out:** `ProviderConfig[]` (subset, typically 3–7 items)

**Side-effect:** reads `isProviderEnabled` toggle state (in-memory map)

---

## Step 4 — Intent Detection

**Transform:** Scans `prompt` against `INTENT_KEYWORDS` keys (`weather`, `geo`, `knowledge`, `code`, `planning-broad`, `greeting`, `general`). Matches Thai + English keywords.

**Shape out:** `intent: string` (e.g. `"weather"` or `"general"` as fallback)

**Side-effect:** none

---

## Step 5 — Critic Provider Selection

**Transform:** `selectCriticConfig(eligible, intent)` → calls `selectProvider()` from router with:
- `mode`: `"remote"` if MDES_ONLY else `"hybrid"`
- `capabilities`: `["code","grounding-critic"]` if intent=code, else `["grounding-critic","hard-reasoning"]`
- `privacyLevel: "public"`

Falls back: `selection.provider` → `selection.alternates[0]` → `eligible[0]` → `null`

**Shape out:** `ProviderConfig | null` — the designated critic

**Side-effect:** none (router is read-only selection)

---

## Step 6 — Fan-Out: Parallel Provider Calls

**Transform:** For each eligible config, `Promise.allSettled` (or equivalent) with `AbortSignal` timeout at `MOTHER_TIMEOUT_MS = 20_000`. Each call:

### 6a — Standard providers (ollama / openai / anthropic)

- Builds request body from `cfg.kind`:
  - **ollama**: `POST {model, prompt, stream: false}` to `${cfg.baseUrl}/api/generate`
  - **openai**: `POST /v1/chat/completions` with `Authorization: Bearer ${cfg.apiKey}`
  - **anthropic**: `POST /v1/messages` with `x-api-key` header
- Measures `latencyMs = Date.now() - startMs`
- Strips `AI_ISMS` phrases from response text
- Computes `estimatedCostUsd` via `PROVIDER_COST_PER_1K[cfg.id] * (inputTokenEstimate / 1000)`

**Side-effect:** **network** — HTTP calls to each provider endpoint

### 6b — Innova Oracle (special path)

If provider id is `"innova-oracle"`:

1. `getOracleToken(cfg.baseUrl, signal)`:
   - Checks `_oracleToken` cache (module-level mutable)
   - If expired/missing: `POST ${baseUrl}/api/auth/token?client_id=innomcp&role=user`
   - Caches `{ token, expiresAt }` for 23 hours
   - **Side-effect:** network call to auth endpoint; mutates `_oracleToken`

2. `callInnovaOracle(cfg, prompt, signal)`:
   - `POST ${baseUrl}/api/oracle/consult` with `Authorization: Bearer ${token}`
   - Body: `{ query: prompt.slice(0, 500), max_chars: 1500 }`
   - Extracts `data.context ?? data.result ?? data.text`
   - Prefixes with `"[Oracle]\n"`
   - On 401/403: nullifies `_oracleToken` cache
   - **Side-effect:** network call to oracle endpoint; possible `_oracleToken = null`

---

## Step 7 — Collect Results

**Transform:** Each settled promise → `MotherResult`:

```ts
MotherResult {
  providerId: "mdes-cloud",       // from cfg.id
  providerName: "MDES Cloud",     // from cfg.name
  text: "...",                    // stripped of AI_ISMS
  latencyMs: 1842,
  success: true,
  errorMsg?: undefined,
  estimatedCostUsd?: 0.0          // self-hosted = 0
}
```

Failed calls get `success: false`, `errorMsg: e.message`, `text: ""`.

**Shape out:** `MotherResult[]`

---

## Step 8 — Synthesis

**Transform:** From `results` array:
- Filter `success === true && text.length > 0`
- Pick **longest** successful response text as `synthesis`
- If none, fallback to first non-empty `text` (even from failed)
- If all empty, `synthesis = ""`

**Shape out:** `synthesis: string`

---

## Step 9 — Leaderboard Metrics (side-effects)

For each result:
- `recordProviderCall(providerId)` — increments call count
- If this provider produced the `synthesis` winner: `recordProviderWin(providerId)` — increments win count
- `recordProviderQuality(providerId, text.length, success)` — records quality sample
- `recordStreaks()` — recalculates streak windows

**Side-effect:** writes to in-memory leaderboard metrics store (not DB, not network)

---

## Step 10 — Mother History (side-effect)

`pushRun()` called with:

```ts
MotherRunProvider {
  providerId, providerName, text, latencyMs, success, errorMsg
}[]
```

Plus metadata: iteration number, intent, timestamp.

**Side-effect:** appends to in-memory `motherHistory` ring buffer (capped size)

---

## Step 11 — Event Emission (side-effect)

Via `emit()` callback:
- `newEnvelope("mother-dispatch-start", { iteration, providerCount, intent })` — at dispatch start
- `newEnvelope("mother-dispatch-result", { providerId, success, latencyMs })` — per-provider
- `newEnvelope("mother-dispatch-complete", { synthesis, totalAgents, successCount })` — at end

Each envelope passes through `checkAgentEventSafe()` for sanitization.

**Side-effect:** events flow into conductor's event bus (in-process)

---

## Step 12 — Return

**Exits as `MotherDispatchResult`:**

```ts
{
  results: MotherResult[],           // all provider results
  synthesis: " longest successful text… ",
  totalAgents: 5,                    // eligible count
  successCount: 4,                   // success=true count
  totalEstimatedCostUsd: 0.00175     // sum of per-provider costs
}
```

**Destination:** caller (conductor in thinking mode) — used to feed the next reasoning step or return to user.

---

## Summary Side-Effect Table

| Type | Target | When |
|------|--------|------|
| **Network** | Ollama endpoints (mdes-cloud, thai-llm, local) | Step 6a |
| **Network** | OpenAI `/v1/chat/completions` | Step 6a |
| **Network** | Anthropic `/v1/messages` | Step 6a |
| **Network** | GitHub Copilot (OpenAI-compat) | Step 6a |
| **Network** | Innova Oracle auth + consult | Step 6b |
| **State** | `_oracleToken` module-level cache | Step 6b |
| **State** | `motherIteration` counter | Step 1 |
| **State** | `leaderboardMetrics` in-memory store | Step 9 |
| **State** | `motherHistory` ring buffer | Step 10 |
| **Events** | Conductor event bus via `emit()` | Step 11 |
| **DB** | None | — |
| **Filesystem** | None | — |
