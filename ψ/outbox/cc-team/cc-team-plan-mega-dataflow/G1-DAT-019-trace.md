<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-019 role=trace model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":2262,"completion_tokens":4555,"total_tokens":6817,"prompt_tokens_details":{"cached_tokens":32,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":886,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 39s
 generated: 2026-06-13T12:02:20.423Z -->
# Data Flow Trace: `providerHealthProbe.ts`

---

## STEP 1 — Module Load: Initialize In-Memory State

- **Enters:** `import` of this module by any consumer
- **Transformation:** `new Map<string, ProviderProbeResult>()` is created as module-level singleton
- **Exits:** `probeStatus` exported Map (empty, shape: `Map<string, {providerId, status, latencyMs, checkedAt}>`)
- **Side-effects:** None yet — Map is empty until `runAllProbes()` (or equivalent entry function) is called

---

## STEP 2 — `buildProbeTargets()`: Environment Variables → ProbeTarget[]

- **Enters:** ~35 environment variables read via `process.env.*` with fallback chains:

| Env var chain | Resolves to field | Default |
|---|---|---|
| `REMOTE_OLLAMA_BASE_URL` → `OLLAMA_REMOTE_BASE_URL` → `OLLAMA_REMOTE_URL` | `mdesUrl` | `https://ollama.mdes-innova.online` |
| `REMOTE_OLLAMA_TOKEN` → `OLLAMA_REMOTE_API_KEY` → … | `mdesKey` | `""` |
| `COMMANDCODE_API_KEY` → `CODEX_API_KEY` | `commandCodeApiKey` | `""` |
| `COMMANDCODE_BASE_URL` | `commandCodeBaseUrl` (trailing `/` stripped) | `https://api.commandcode.ai/provider/v1` |
| `LOCAL_OLLAMA_BASE_URL` → `OLLAMA_LOCAL_BASE_URL` → `OLLAMA_BASE_URL` | `baseUrl` for `ollama-local` | `http://localhost:11434` |
| `OPENAI_BASE_URL` | `baseUrl` for `openai-gpt` | `https://api.openai.com/v1` |
| `OPENAI_FALLBACK_MODELS` (comma-split, `[0]`) | `model` for `openai-gpt` | `"gpt-4o-mini"` |
| `ANTHROPIC_API_KEY` | `apiKey` for `claude-haiku`, `claude-sonnet` | `""` |
| `GITHUB_COPILOT_TOKEN` → `GH_COPILOT_TOKEN` | `apiKey` for `copilot` | `""` |
| `GEMINI_API_KEY` → `GOOGLE_AI_API_KEY` | `apiKey` for `gemini-pro` | `""` |
| `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY`, `GROQ_API_KEY`, `TOGETHER_API_KEY` | respective `apiKey` fields | `""` |
| `INNOVA_GATEWAY_URL` → `http://localhost:{GATEWAY_PORT\|8000}` | `baseUrl` for `innova-oracle` | `http://localhost:8000` |

- **Transformation logic for CommandCode providers:**
  - Regex `/(^|\/)v1$/` or localhost:4322 → `commandCodeUsesOpenAiProxyShape = true`
  - If `true`: `kind = "openai"`, models prefixed with `cc/` (e.g. `"cc/claude-sonnet-4-6"`)
  - If `false`: `kind = "anthropic"`, models unprefixed (e.g. `"claude-sonnet-4-6"`)

- **Exits:** `ProbeTarget[]` — **19 items** (comment says 14 but array has 19):

| # | id | kind | baseUrl (default) | model (default) |
|---|---|---|---|---|
| 1 | `mdes-cloud` | `ollama` | `https://ollama.mdes-innova.online` | `gemma4:26b` |
| 2 | `thai-llm` | `ollama` | `https://ollama.mdes-innova.online` | `qwen3.5:9b` |
| 3 | `ollama-local` | `ollama` | `http://localhost:11434` | `llama3.2` |
| 4 | `openai-gpt` | `openai` | `https://api.openai.com/v1` | `gpt-4o-mini` |
| 5 | `claude-haiku` | `anthropic` | `https://api.anthropic.com/v1` | `claude-haiku-4-5-20251001` |
| 6 | `copilot` | `openai` | `https://api.githubcopilot.com` | `gpt-4o` |
| 7 | `gemini-pro` | `openai` | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-1.5-flash` |
| 8 | `mistral-large` | `openai` | `https://api.mistral.ai/v1` | `mistral-large-latest` |
| 9 | `deepseek-r1` | `openai` | `https://api.deepseek.com/v1` | `deepseek-reasoner` |
| 10 | `groq-llama` | `openai` | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| 11 | `together-llama` | `openai` | `https://api.together.xyz/v1` | `meta-llama/Llama-3-70b-chat-hf` |
| 12 | `claude-sonnet` | `anthropic` | `https://api.anthropic.com/v1` | `claude-sonnet-4-6` |
| 13 | `innova-bot` | `ollama` | `http://localhost:11434` | `qwen2.5:0.5b` |
| 14 | `innova-oracle` | `openai` | `http://localhost:8000` | `oracle-rag` |
| 15 | `seed-cc-claude-sonnet` | `openai` or `anthropic` | commandCodeBaseUrl | `cc/claude-sonnet-4-6` or `claude-sonnet-4-6` |
| 16 | `seed-cc-claude-opus` | `openai` or `anthropic` | commandCodeBaseUrl | `cc/claude-opus-4-8` or `claude-opus-4-8` |
| 17 | `seed-cc-gpt-5.4` | `openai` | commandCodeBaseUrl | `cc/gpt-5.4` or `gpt-5.4` |
| 18 | `seed-cc-deepseek-v4` | `openai` | commandCodeBaseUrl | `cc/deepseek/deepseek-v4-pro` or `deepseek/deepseek-v4-pro` |
| 19 | `seed-cc-qwen-3.7` | `openai` | commandCodeBaseUrl | `cc/qwen/qwen3.7-max` or `Qwen/Qwen3.7-Max` |

- **Side-effects:** None (pure function of env vars)

---

## STEP 3 — Entry Function Call (e.g. `runAllProbes()`)

- **Enters:** No arguments — reads `buildProbeTargets()` internally
- **Transformation:** Creates an `AbortController` with **5,000ms timeout**
- **Exits:** N/A (sets up step 4)
- **Side-effects:** None yet

---

## STEP 4 — Per-Target: Dispatch HTTP Probe (concurrent, `Promise.allSettled`)

For each of the 19 `ProbeTarget` objects, one of three probe paths runs:

### 4A — Ollama Probe (targets: `mdes-cloud`, `thai-llm`, `ollama-local`, `innova-bot`)

| Field | Value |
|---|---|
| **Method** | `GET` |
| **URL** | `{baseUrl}/api/tags` |
| **Headers** | `Authorization: Bearer {apiKey}` (only if `apiKey !== ""`) |
| **Timeout** | AbortController signal, 5s |

- **Response handling:**
  - `status === 200` → `"online"`
  - Any other status / network error / abort → `"offline"`

### 4B — OpenAI Probe (targets: `openai-gpt`, `copilot`, `gemini-pro`, `mistral-large`, `deepseek-r1`, `groq-llama`, `together-llama`, `innova-oracle`, `seed-cc-gpt-5.4`, `seed-cc-deepseek-v4`, `seed-cc-qwen-3.7`, and conditionally `seed-cc-claude-sonnet`, `seed-cc-claude-opus`)

| Field | Value |
|---|---|
| **Pre-check** | If `apiKey === ""` → short-circuit to `"configured"`, **no HTTP request** |
| **Method** | `POST` |
| **URL** | `{baseUrl}/chat/completions` |
| **Headers** | `Authorization: Bearer {apiKey}`, `Content-Type: application/json` |
| **Body** | `{"model":"{model}","messages":[{"role":"user","content":"hi"}],"max_tokens":1}` |
| **Timeout** | AbortController signal, 5s |

- **Response handling:**
  - `status === 200` or `status === 401` → `"online"` (401 = key is valid format, endpoint reachable)
  - Any other status / network error / abort → `"offline"`

### 4C — Anthropic Probe (targets: `claude-haiku`, `claude-sonnet`, and conditionally `seed-cc-claude-sonnet`, `seed-cc-claude-opus`)

| Field | Value |
|---|---|
| **Pre-check** | If `apiKey === ""` → short-circuit to `"configured"`, **no HTTP request** |
| **Method** | `POST` |
| **URL** | `{baseUrl}/messages` |
| **Headers** | `x-api-key: {apiKey}`, `anthropic-version: 2023-06-01`, `Content-Type: application/json` |
| **Body** | `{"model":"{model}","messages":[{"role":"user","content":"hi"}],"max_tokens":1}` |
| **Timeout** | AbortController signal, 5s |

- **Response handling:**
  - `status === 200` or `status === 400` or `status === 401` → `"online"` (400 = valid key, bad params; 401 = key recognized)
  - Any other status / network error / abort → `"offline"`

- **Side-effects (network):** Up to 19 outbound HTTP requests to external APIs (or 0 for empty-key providers short-circuited to `"configured"`)

---

## STEP 5 — Per-Target: Measure Latency & Build Result

- **Enters:** HTTP response (or short-circuit) + `Date.now()` delta from request start
- **Transformation:** Compute `latencyMs = endTime - startTime`. Assemble:

```typescript
{
  providerId: target.id,        // e.g. "mdes-cloud"
  status: resolvedStatus,       // "online" | "offline" | "configured"
  latencyMs: number,            // 0 for "configured" short-circuit
  checkedAt: new Date().toISOString()  // e.g. "2025-07-11T08:30:00.000Z"
}
```

- **Exits:** `ProviderProbeResult` object per target
- **Side-effects:** None yet (result not yet stored)

---

## STEP 6 — `Promise.allSettled` Resolution: Collect All 19 Results

- **Enters:** 19 settled promises (each `PromiseFulfilledResult<ProviderProbeResult>` or `PromiseRejectedResult`)
- **Transformation:** 
  - Fulfilled → extract `.value` as `ProviderProbeResult`
  - Rejected → construct fallback `ProviderProbeResult` with `status: "offline"`, `latencyMs: 0` (per comment: "No exception ever escapes — all errors are caught per provider")
- **Exits:** `ProviderProbeResult[]` (length: 19)
- **Side-effects:** None

---

## STEP 7 — Write to In-Memory State: `probeStatus` Map

- **Enters:** `ProviderProbeResult[]` from Step 6
- **Transformation:** For each result, `probeStatus.set(result.providerId, result)`
- **Exits:** Updated `probeStatus` Map, shape:

```
Map<string, ProviderProbeResult> {
  "mdes-cloud"           → { providerId: "mdes-cloud",           status: "online"|"offline"|"configured", latencyMs: <int>, checkedAt: "<ISO>" },
  "thai-llm"             → { ... },
  "ollama-local"         → { ... },
  "openai-gpt"           → { ... },
  "claude-haiku"         → { ... },
  "copilot"              → { ... },
  "gemini-pro"           → { ... },
  "mistral-large"        → { ... },
  "deepseek-r1"          → { ... },
  "groq-llama"           → { ... },
  "together-llama"       → { ... },
  "claude-sonnet"        → { ... },
  "innova-bot"           → { ... },
  "innova-oracle"        → { ... },
  "seed-cc-claude-sonnet"→ { ... },
  "seed-cc-claude-opus"  → { ... },
  "seed-cc-gpt-5.4"      → { ... },
  "seed-cc-deepseek-v4"  → { ... },
  "seed-cc-qwen-3.7"     → { ... },
}
```

- **Side-effects (state):** `probeStatus` Map mutated — overwrites any previous entries for same keys. This is the **single source of truth** consumed by `agentLeaderboard`.

---

## STEP 8 — Consumer Read: `agentLeaderboard`

- **Enters:** `probeStatus.get(providerId)` called by downstream consumer
- **Transformation:** Reads `ProviderProbeResult.status` → maps to UI label `"online"` / `"offline"` / `"configured"` (replaces static `"configured"` display)
- **Exits:** UI rendering in leaderboard
- **Side-effects:** None (read-only)

---

## Summary Side-Effect Table

| Type | Detail |
|---|---|
| **Network (outbound)** | Up to 19 concurrent HTTP requests (GET/POST) to external LLM provider APIs; 5s timeout each |
| **Network (inbound)** | None — this module is a client, not a server |
| **State (in-memory)** | `probeStatus` Map written — 19 entries keyed by provider ID |
| **State (persistent)** | None — no DB writes, no file I/O |
| **Events** | None emitted |
| **External side-effects** | Each OpenAI/Anthropic probe POST creates a **1-token completion** on the remote API (consumes minimal quota); Ollama GET is read-only; empty-key providers generate **zero** network traffic |

---

## Data Flow Diagram (Linear)

```
process.env (35+ vars)
       │
       ▼
 buildProbeTargets() ──→ ProbeTarget[19]
       │
       ▼
 ┌─────────────────────────────────────────────┐
 │ Promise.allSettled (concurrent, 5s timeout) │
 │                                              │
 │  ┌─ ollama ── GET /api/tags ──────────────┐  │
 │  ├─ openai ── POST /chat/completions ─────┤  │
 │  └─ anthropic ─ POST /messages ───────────┘  │
 │         │  (or short-circuit → "configured")  │
 │         ▼                                    │
 │  HTTP response → status + latencyMs         │
 └─────────────────────────────────────────────┘
       │
       ▼
 ProviderProbeResult[19]
       │
       ▼
 probeStatus.set(id, result) × 19
       │
       ▼
 probeStatus: Map<string, ProviderProbeResult>  ←── agentLeaderboard reads here
```
