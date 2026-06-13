<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-006 role=trace model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2703,"completion_tokens":3018,"total_tokens":5721,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1674,"image_tokens":0},"cache_creation_input_tokens":0} | 32s
 generated: 2026-06-13T11:59:29.654Z -->
Based on the code and comments in `parallelDispatch.ts`, the following trace outlines the **data flow** for a typical parallel dispatch of MDES child agents. The entry point is assumed to be an exported `parallelDispatch` or `buildPlan` function (not fully shown, but logically present).

---

## Ordered Step List

### Step 0 – Entry (Input)
- **Input shape**: `AgentDispatchOptions`  
  ```ts
  {
    query: string;               // e.g. "Weather in Bangkok"
    intent?: string;             // e.g. "weather" (optional, may be inferred upstream)
    history?: Array<{sender: string; text: string}>;
    runMode?: "normal" | "thinking";
    responseMode?: "normal" | "thinking";
    remoteAvailable?: boolean;
  }
  ```
- **Source**: Mother orchestrator (caller)  
- **Side effects**: None  
- **Destination** (internal): main dispatch function

---

### Step 1 – Guard check
- **Check**: `process.env.PARALLEL_AGENTS === "0"`  
- **Transformation**: If true → return early (empty/fallback response).  
- **Side effects**: Possibly log “skip”  
- **Destination**: Early exit or continue to Step 2

---

### Step 2 – Resolve agent pool for intent
- **Input**: `intent` string (or fallback to `"general"`)  
- **Transformation**: Look up `INTENT_AGENTS_POOL[intent]` → array of `AgentId` (e.g. `["weather-analyst", "geo-planner", "critic"]`)  
- **Side effects**: None  
- **Destination**: list of AgentId strings

---

### Step 3 – Score complexity (dynamic agent count)
- **Input**: `query` token count / length  
- **Transformation**: Apply internal `scoreComplexity()` to **subset** the agent list  
  - **Example**: if query ≤25 tokens → keep 2 agents (thinker +responder); 25‑50 → 3; >50 → 4; special intents like `planning-broad` always keep all 6.  
- **Side effects**: None  
- **Destination**: reduced array of `AgentId`

---

### Step 4 – Resolve endpoints per agent
- **Input**: each `AgentId` + `runMode` + `remoteAvailable` flag  
- **Transformation**: Call `resolveEndpoint(kind, agentId, runMode)`  
  - `kind` chosen from `hasRemoteEndpoint()` and `remoteAvailable`  
  - Builds `AgentPlanItem`:
    ```ts
    {
      agentId: string;
      kind: "local" | "remote";
      url: string;           // e.g. "http://localhost:11434"
      key: string;           // API key (optional)
      model: string;         // e.g. "qwen3.6:27b"
      timeoutMs: number;     // model‑specific * (thinking? 2 : 1)
    }
    ```
- **Side effects**: None (pure mapping)  
- **Destination**: array of `AgentPlanItem`

---

### Step 5 – Create envelopes for each agent
- **Input**: each `AgentPlanItem` + original `query`, `history`, `runMode`  
- **Transformation**: Call `newEnvelope(agentId, { ...payload })`  
  - Payload typically includes `query`, `history`, `runMode`, `responseMode`  
  - Result is an `Envelope` object (type from `./events`)  
- **Side effects**: None  
- **Destination**: array of `Envelope`

---

### Step 6 – Parallel network dispatch
- **Input**: array of `Envelope` objects  
- **Transformation** (per envelope):
  - HTTP POST to `{url}/api/generate` (Ollama) with JSON body `{ model, prompt, ... }`  
  - Authorization header includes `key` if present  
  - Await all requests concurrently (Promise.all) with individual timeouts  
- **Side effects** (per request):
  - **Network**: outbound HTTP to local or remote Ollama instance  
  - **Events** (via `EmitFn`): `"agent:start"`, `"agent:complete"`, `"agent:error"`  
  - **State**: no persistent DB writes  
- **Destination**: array of raw response strings (or parsed text)

---

### Step 7 – Merge agent responses
- **Input**: array of response strings (one per agent)  
- **Transformation**:  
  - if `responseMode === "normal"` → pick longest string (max character length)  
  - if `responseMode === "thinking"` → feed all responses into a **merger LLM call** (likely local Ollama again) to generate a synthesised answer  
- **Side effects** (only for thinking mode):  
  - Additional HTTP call to Ollama (merger model)  
  - Emit `"merger:start"`, `"merger:complete"` events  
- **Destination**: single final answer string

---

### Step 8 – Final output
- **Output shape**: `string` (the final merged response)  
- **Destination**: caller (Mother orchestrator)  
- **Side effects**: Emit final event `"parallelDispatch:complete"` (or similar)

---

## Summary of side‑effects (non‑exhaustive)

| Step | Side‑effects |
|------|--------------|
| 1    | (optionally log skip) |
| 6    | **HTTP calls** to Ollama instances (local/remote) – 1 per agent |
| 6    | **Events** `agent:start`, `agent:complete`, `agent:error` |
| 7    | **HTTP call** to merger LLM (only when `responseMode="thinking"`) |
| 7    | **Events** `merger:start`, `merger:complete` |
| 8    | **Events** final completion event |

No database writes, no persistent state changes. All data is ephemeral and held in memory for the duration of the dispatch.
