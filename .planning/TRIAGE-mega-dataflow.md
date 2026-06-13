_25 findings consolidated, 0 missing._

# TRIAGE — mega-dataflow

> dataflow lens (provider=0): TRACE data flow through this module (a /trace pass): what enters (shape/source),

> Generated for mother-Sonnet review. provider=0 deliverables.


---

## DAT-001 — trace — `innomcp-node/src/agents/conductor.ts` [deepseek/deepseek-v4-pro]
```text
1.  **Function entry**  
    An external caller (e.g., an HTTP chat endpoint) invokes the orchestrator with a `ConductorOptions` object (shape: `{ message, history?, sessionId?, clientMessageId?, preferredMode?, preferredProviderId?, responseMode?, thinkingMode?, toolHint?, userTier?, capabilityLevel?, guestLimits? }`).

2.  **Normalise response mode**  
    `normalizeResponseMode(opts)`  
    - Input: `opts.thinkingMode`, `opts.responseMode`  
    - Transformation: returns `"thinking"` if either is truthy, else `"normal"`  
    - Output: `AgentRunMode` string (`"thinking"` | `"normal"`)  
    - Side-effects: none

3.  **Generate identifiers**  
    ```ts
    const runId = randomUUID();
    const messageId = opts.clientMessageId || randomUUID();
    ```  
    - Input: `opts.clientMessageId`  
    - Transformation: creates UUIDs using `crypto.randomUUID`  
    - Output: `runId: string`, `messageId: string`  
    - Side-effects: accesses system entropy (no external state changed)

4.  **Emit “agent_started” event**  
    `emitStarted(emit, runId, messageId, "conductor", "เริ่มต้นวิเคราะห์...", expectedToolUsage=false)`  
    - Internally calls `newEnvelope` →  `checkAgentEventSafe` → `emit`  
    - If safety check fails, emits a `"fallback"` event instead  
    - Side-effects: emits a public‑safe `AgentEvent` through the supplied `emit` callback (output stream)

5.  **Fetch runtime MCP client (state access)**  
    `getRuntimeMcpClient()`  
    - Read‑side‑effect: `require("../routes/api/chat")?.mcpClient`  
    - Output: a reference to the live MCP client object (or `null`)  
    - No write, no network call here

6.  **Classify intent**  
    `classifyIntent(opts.message, opts.history)`  
    - Input: `message: string`, optional `history` array  
    - Transformation: deterministic rule‑based classification (import from `../services/intentClassifier`)  
    - Output: `ChatIntent` enum value (e.g., `"planning-broad"`, `"weather"`, `"greeting"`, …)  
    - Side-effects: none expected

7.  **Naturalness guard**  
    `checkNaturalness(opts.message)`  
    - Input: user message string  
    - Output: a result indicating naturalness (boolean or score)  
    - Side-effects: none expected, deterministic guard

8.  **Session memory disambiguation (conditional)**  
    If `opts.sessionId` is provided:  
    `disambiguateWithSessionMemory(opts.message, opts.sessionId)`  
    - Side-effect: reads from `sessionMemory` service (in‑memory or database state)  
    - Output: possibly a disambiguated query or context  
    - Write is not performed here; only read

9.  **System‑inventory check**  
    If `intent === "system-inventory"` and `looksLikeSystemInventoryQuestion(opts.message)` returns true:  
    - Call `buildSystemInventoryAnswer(opts.message)` which may gather internal facts and produce a string  
    - Side-effects: none external; code is deterministic  
    - (The actual emit of the answer would happen later)

10. **Dispatcher selection (intent‑based)**  
    Based on `intent`, `toolHint`, and `responseMode`:
    - `planning-broad`, `weather`, `map`, `knowledge`, etc. → use `dispatchAgents(runId, messageId, ..., emit, mode)` to run parallel sub‑agents  
      - Each sub‑agent emits its own `agent_started`, `fact_found`, etc. through the same `emit` callback  
      - Returns aggregated facts / partial results  
    - Tool‑hinted intents → `dispatchTool(...)`  
    - Complex/fallback → `dispatchMother(...)`  
    - Greeting, datetime, calc, code (simple) → skip heavy dispatch  

    *Note: In the Phase C deterministic slice these dispatchers may be stubbed or short‑circuited to avoid LLM calls; the actual compute is replaced by template‑driven composition.*

11. **Synthesise answer draft**  
    - If `dispatchAgents` was used, its returned facts are passed to `synthesizeAnswer(facts, intent, ...)` which may aggregate them  
    - Otherwise facts are collected from simple lookups (e.g., datetime)  
    - The final textual an

---

## DAT-002 — trace — `innomcp-node/src/agents/eventGuard.ts` [Qwen/Qwen3.7-Max]
### Function: `checkAgentEventSafe`

**What Enters (Inputs)**
*   `ev`: `AgentEvent` object (Source: Orchestrator/Agent pipeline). Expected shape includes fields like `publicSummary`, `deltaText`, `finalText`, `fallbackReason`, `type`, `runId`, `messageId`, `isSafeForUser`, `timestamp`.
*   `opts`: `{ allowMapTerms?: boolean; expectedToolUsage?: boolean }` (Source: Caller configuration). Defaults to `{}`.

**Transformation Steps**
1.  **Shape Validation**: Passes `ev` to the imported `validateAgentEvent` function. 
    *   *Branch*: If a string error is returned, short-circuits and returns a failure `GuardResult`.
2.  **Serialization**: Converts the entire `ev` object into a JSON string using `JSON.stringify(ev)`.
3.  **Normalization**: Lowercases the serialized JSON string to prepare for case-insensitive key matching.
4.  **Forbidden Key Scan**: Iterates through the `FORBIDDEN_KEY_NAMES` array. Checks if the lowercased JSON contains the exact substring `"keyname":` for each forbidden key.
    *   *Branch*: If a match is found, short-circuits and returns a failure `GuardResult` identifying the `forbiddenKey`.
5.  **Visible Text Extraction**: Extracts the strings from `ev.publicSummary`, `ev.deltaText`, `ev.finalText`, and `ev.fallbackReason` (falling back to `""` if undefined). Joins them with newline characters (`\n`) into a single `visible` string.
6.  **Forbidden Literal Scan**: Iterates through the `FORBIDDEN_VISIBLE_LITERALS` array. Checks if any exact literal substring exists within the `visible` string.
    *   *Branch*: If a match is found, short-circuits and returns a failure `GuardResult` identifying the `forbiddenSubstring`.
7.  **Placeholder Word Scan**: Tests the `visible` string against the regex `/\bplaceholder\b/i`. 
    *   *Branch*: If it matches AND `opts.allowMapTerms` is falsy, short-circuits and returns a failure `GuardResult` with `forbiddenSubstring: "placeholder"`.
8.  **Tool Usage Scan**: Tests the `visible` string against the regex `/Used tools:\s*none/i`.
    *   *Branch*: If it matches AND `opts.expectedToolUsage` is truthy, short-circuits and returns a failure `GuardResult` with `forbiddenSubstring: "Used tools: none"`.
9.  **Success Resolution**: If all validation and scan steps pass without short-circuiting, constructs and returns a success `GuardResult`.

**What Exits (Outputs)**
*   `GuardResult` object (Destination: Caller/Orchestrator). 
    *   *Shape*: `{ ok: boolean, reason?: string, forbiddenKey?: string, forbiddenSubstring?: string, shapeError?: string }`.

**Side-Effects**
*   **None**. Pure function. No DB, network, event emission, or external state mutation.

---

### Function: `checkVisibleTextSafe`

**What Enters (Inputs)**
*   `text`: `string` (Source: Naturalness guard / draft answer generator).
*   `opts`: `{ allowMapTerms?: boolean; expectedToolUsage?: boolean }` (Source: Caller configuration). Defaults to `{}`.

**Transformation Steps**
1.  **Wrapper Construction**: Synthesizes a mock `AgentEvent` object (`wrapped`) to satisfy the type requirements of the main guard. 
    *   *Shape*: Hardcodes `type: "draft_delta"`, `runId: "scan"`, `messageId: "scan"`, `publicSummary: "scan"`, `isSafeForUser: true`. Sets `timestamp` to the current ISO string. Maps the input `text` to the `deltaText` field.
2.  **Delegation**: Passes the synthesized `wrapped` event and the original `opts` directly into `checkAgentEventSafe`.
3.  **Pass-through Return**: Returns the exact `GuardResult` yielded by `checkAgentEventSafe`.

**What Exits (Outputs)**
*   `GuardResult` object (Destination: Naturalness guard / Caller). 
    *   *Shape*: `{ ok: boolean, reason?: string, forbiddenKey?: string, forbiddenSubstring?: string, shapeError?: string }`.

**Side-Effects**
*   **System Clock Read**: Calls `new Date().toISOString()` to generate a timestamp for the mock event wrapper. No DB, network, event emission, or external state mutation.

---

## DAT-003 — trace — `innomcp-node/src/agents/events.ts` [moonshotai/Kimi-K2.6]
**Ordered trace of `innomcp-node/src/agents/events.ts`**

1. **ENTRY — Raw candidate event into `validateAgentEvent`**  
   - **Shape:** `unknown` (any runtime value; typically an object claiming to be an `AgentEvent`).  
   - **Source:** Upstream caller (e.g., `eventGuard.ts`, stream serializer, or agent runner before SSE emission).

2. **TRANSFORM — Base structural cast**  
   - Guard: `ev !== null && typeof ev === "object"`.  
   - Cast to `Record<string, unknown>` for key-level inspection.  
   - **Exit on failure:** returns `"event is not an object"`.

3. **TRANSFORM — Required string field scan**  
   - Iterate `["type", "runId", "messageId", "publicSummary", "timestamp"]`.  
   - Verify `typeof e[k] === "string"` and `length > 0`.  
   - **Exit on failure:** returns `"missing or empty required string field: ${k}"`.

4. **TRANSFORM — Safety literal check**  
   - Assert `e.isSafeForUser === true` (strict boolean equality, not truthiness).  
   - **Exit on failure:** returns `"isSafeForUser must be the literal true"`.

5. **TRANSFORM — Type enumeration check**  
   - Assert `e.type` is present in the 16-element `AgentEventType` allow-list (e.g., `"agent_delta"`, `"tool_call_started"`, `"final_answer"` …).  
   - **Exit on failure:** returns `"unknown event type: ${String(e.type)}"`.

6. **TRANSFORM — Content length & optional scalar checks**  
   - Assert `e.publicSummary.length <= 240` (`PUBLIC_SUMMARY_MAX`).  
   - If `confidence` defined: assert `typeof === "number"` and `0 <= c <= 1`.  
   - **Exit on failure:** returns length or confidence violation string.

7. **TRANSFORM — Optional array check**  
   - If `sourceIds` defined: assert `Array.isArray(e.sourceIds)` and every element `typeof === "string"`.  
   - **Exit on failure:** returns `"sourceIds must be string[]"`.

8. **TRANSFORM — Type-specific payload validation**  
   - Switch on `e.type`:  
     - `"draft_delta"` → `deltaText` must be `string`.  
     - `"final_answer"` → `finalText` must be `string`.  
     - `"tool_call_started"` | `"tool_call_finished"` → `toolName` must be non-empty `string`.  
     - `"fallback"` → `fallbackReason` must be `string`.  
   - **Exit on failure:** returns type-specific requirement string.

9. **EXIT — Validation verdict from `validateAgentEvent`**  
   - **Shape:** `null` (well-formed) or `string` (first violation message).  
   - **Destination:** Caller; a non-null result blocks the event from entering the SSE stream.

10. **ENTRY — Orchestrator metadata into `newEnvelope`**  
    - **Shape:** `{ runId: string; messageId: string; type: AgentEventType; publicSummary: string; agentId?: AgentId }`.  
    - **Source:** Conductor / agent runner creating a new outbound event.

11. **TRANSFORM — Role label lookup**  
    - Read `opts.agentId`; if defined, index into the constant `AGENT_ROLE_LABEL_TH` Record (e.g., `"thinker"` → `"นักคิดวิเคราะห์"`).  
    - If `agentId` absent, `role` is set to `undefined`.

12. **TRANSFORM — Envelope assembly**  
    - Construct `AgentEvent` object:  
      - Copy `type`, `runId`, `messageId`, `agentId`, `publicSummary`.  
      - Inject derived `role`.  
      - Inject hardcoded `isSafeForUser: true`.  
      - Inject `timestamp: new Date().toISOString()`.

13. **EXIT — Populated event envelope from `newEnvelope`**  
    - **Shape:** `AgentEvent` containing all base fields (`type`, `runId`, `messageId`, `agentId`, `role`, `publicSummary`, `isSafeForUser`, `timestamp`).  
    - **Missing:** Payload-specific fields (`deltaText`, `finalText`, `toolName`, `fallbackReason`, etc.) are absent; caller must add them before validation/emission.  
    - **Destination:** Agent runner → likely passed to `validateAgentEvent` → then serialized into the SSE stream bound for the frontend `ThinkingPanel`.

14. **SIDE-EFFECTS**  
    - **Clock read:** `newEnvelope` calls `new Date().toISOString()`, reading the system clock (non-deterministic side effect).  
    - **No DB I/O.**  
    - **No network calls.**  
  

---

## DAT-004 — trace — `innomcp-node/src/agents/motherDispatch.ts` [zai-org/GLM-5.1]
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
   - **Side-effect:** network call to oracle endpoint; possible `_oracleToken 

---

## DAT-005 — trace — `innomcp-node/src/agents/orchestrator.ts` [deepseek/deepseek-v4-pro]
Here is the data flow trace for `MultiAgentOrchestrator`:

---

### 0. Constructor
**Input:** partial `OrchestratorConfig` (optional object with fields like `coordinatorModel`, `brain1Model`, `sharedMemoryPath`, etc.)  
**Transformation:** Merges provided config with `DEFAULT_CONFIG`.  
**Side-effects:** Creates empty `activeTasks` Map (in‑memory state).  
**Output:** Configured `MultiAgentOrchestrator` instance (held in variable, no return value).

---

### 1. `createTask()`
**Input:** `description: string`, `priority: "low" | "medium" | "high" | "urgent"` (default `"medium"`)  
**Transformation:** Constructs an `AgentTask` object with a generated `id` (`task-{timestamp}-{random6}`), `status: "pending"`, empty `cycle` array.  
**Side-effects:** Sets `this.activeTasks[task.id] = task`.  
**Output (return):** The newly created `AgentTask` (shape: `{ id, description, priority, status: "pending", cycle: [] }`).

---

### 2. `executeCycle(taskId)`
**Input:** `taskId: string`  
**Side-effects:** Multiple network calls, file‑system write, modifications to the in‑memory `AgentTask`.

**Flow step‑by‑step:**

#### 2a. Lookup task  
- Reads `this.activeTasks.get(taskId)`. If missing → throws `Error`.

#### 2b. Brain‑1 Analysis (Phase "analyze")  
- Sets `task.status = "analyzing"`.  
- Calls `this.callBrain("brain-1", task.description)`.  
  - Input: `role = "brain-1"`, `input = task.description` (original user string).  
  - Transformation inside `callBrain`:  
    - Selects provider via `selectProvider({ mode:"hybrid", capabilities:["long-context"], privacyLevel:"internal" })`.  
    - Constructs HTTP POST to `{provider.baseUrl}/api/generate` with JSON body: `{ model: provider.model, prompt: input, stream: false, options: { temperature: 0.3, num_predict: 2048 } }`.  
    - Fetches response, extracts `result.response` string.  
  - **Side-effect:** Network call (POST to Ollama‑like endpoint).  
  - Output: Brain‑1 result string (`brain1Result`).  
- Mutates task:  
  - `task.brain1Result = brain1Result`  
  - Pushes cycle entry:  
    ```ts
    { timestamp: nowISO, phase: "analyze", actor: "brain-1", result: brain1Result.substring(0, 500) }
    ```

#### 2c. Brain‑2 Summarization (Phase "summarize")  
- Sets `task.status = "summarizing"`.  
- Calls `this.callBrain("brain-2", brain1Result)`.  
  - Provider selection with capability `"fast-cheap"`.  
  - HTTP POST with same endpoint, `prompt = brain1Result`, `temperature: 0.7`, `num_predict: 512`.  
- **Network side-effect** (second API call).  
- Output: `brain2Result` string.  
- Mutates task:  
  - `task.brain2Result = brain2Result`  
  - Cycle entry:  
    ```ts
    { timestamp: nowISO, phase: "summarize", actor: "brain-2", result: brain2Result.substring(0, 500) }
    ```

#### 2d. Coordinator Decision (Phase "coordinate")  
- Sets `task.status = "coordinating"`.  
- Calls `this.coordinate(task.description, brain1Result, brain2Result)`.  
  - Selects provider with capability `"tool-use"`.  
  - If no provider → returns `"SKIP: No coordinator provider available - task logged but not committed"` (no network call).  
  - Otherwise: builds a prompt containing `task.description`, `brain1Result` (first 1000 chars), `brain2Result`, and the action options.  
  - HTTP POST to `{coordinatorProvider.baseUrl}/api/generate` with `prompt`, `temperature: 0.2`, `num_predict: 32`.  
  - **Network side-effect** (third API call, if provider exists).  
  - Extracts `result.response`, trims it → `coordinatorAction`.  
- Mutates task:  
  - `task.coordinatorAction = coordinatorAction`  
  - Cycle entry:  
    ```ts
    { timestamp: nowISO, phase: "coordinate", actor: "coordinator", result: coordinatorAction } // full value, no truncation
    ```

#### 2e. Memory Persistence (Phase "memory")  
- Calls `this.saveToMemory(task)`.  
  - **Side-effect:** Writes a file to disk, presumably at `{this.config.sharedMemoryPath}/` (folder `.claude/memory`) using the task’s details. (The code is truncated; it likely c

---

## DAT-006 — trace — `innomcp-node/src/agents/parallelDispatch.ts` [deepseek/deepseek-v4-flash]
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
  - Additional HTTP call to Ollama (merger mod

---

## DAT-007 — trace — `innomcp-node/src/agents/toolDispatch.ts` [Qwen/Qwen3.7-Max]
### **Inputs (Shape / Source)**
*   **`intent`** (`ChatIntent` enum/string): Source: `intentClassifier` service. Represents the classified user intent (e.g., `"datetime"`, `"calc"`, `"weather"`, `"evidence"`, `"map"`, `"knowledge"`).
*   **`query`** (`string`): Source: User input / Conductor pipeline. The raw text of the user's prompt.
*   **`emit`** (`EmitFn`, inferred): Source: Conductor. Function to push SSE events to the client.
*   **`guestLimits`** (`GuestLimits`, inferred): Source: `guestLimiter` middleware. Rate limit/role context for the current user.

### **Outputs (Shape / Destination)**
*   **`ToolPlan`** (`{ toolName: string, args: Record<string, unknown>, reason: string, authoritative: boolean }`): Destination: MCP JSON-RPC executor / MDES synthesis agents. The structured blueprint for the tool call.
*   **Tool Result** (`unknown`, inferred from docstring): Destination: MDES agents. The parsed JSON-RPC response from the MCP server.
*   **SSE Events** (`tool_call_*` envelopes, inferred): Destination: `MultiAgentPanel` UI via SSE stream.

### **Side-Effects**
*   **Visible Code:** **None.** All visible functions (`planToolCall` and its helpers) are pure functions.
*   **Truncated/Inferred Code (based on docstring & imports):**
    *   **Network:** HTTP POST to `MCP_URL` (JSON-RPC protocol) with a 20-second timeout (`TOOL_TIMEOUT_MS`).
    *   **Events:** Emits `tool_call_start`, `tool_call_end`, and `tool_call_error` events via `EmitFn`, wrapped in `newEnvelope` and validated by `checkAgentEventSafe`.
    *   **State/Security:** Reads/validates guest limits via `checkToolAccess` to block unauthorized tool usage.

---

### **Ordered Step List: Data Flow Trace**

#### **Phase 1: Input Normalization & Routing**
1.  **Receive Inputs:** `planToolCall` ingests `intent` and `query`.
2.  **Normalize:** `query` is trimmed and lowercased (`trimmed`, `lower`).
3.  **Route:** A conditional cascade evaluates `intent` and keyword signals to determine the target MCP tool.

#### **Phase 2: Argument Extraction & Transformation (Per Intent Branch)**
*Depending on the route, the `query` string is piped through specific pure helper functions to build the `args` object:*

4.  **Branch: `datetime`**
    *   *Transformation:* None. Hardcodes `{ format: "thai" }`.
5.  **Branch: `calc`**
    *   *Transformation (`extractMathExpression`):* Replaces Thai words (บวก, ลบ, คูณ, หาร) with math symbols (`+`, `-`, `*`, `/`). Detects "average/mean" and extracts numbers into `mean([...])`. Strips thousands-separator commas and sanitizes against injection (allows only `0-9 + - * / % ^ ( ) . \s [ ]`).
6.  **Branch: `weather`**
    *   *Transformation (`needsHourlyWeather`):* Regex checks for hourly keywords (e.g., "รายชั่วโมง").
    *   *Transformation (`extractThaiProvince` - external):* Extracts Thai province name.
    *   *Routing:* Selects `nwp_hourly_by_place` (24h duration, specific fields) OR `nwp_daily_by_place` (2d duration, max/min fields).
7.  **Branch: `evidence` (Intent or Keyword Signal)**
    *   *Signal Check (`hasEvidenceSignal`):* Regex checks for forensic/ISP/machine keywords.
    *   *Transformation (`inferEvidenceAction`):* Maps keyword combinations to specific backend action strings (e.g., "offline" → `active_machines_offline_count`, "7 day" → `evidence_records_last_7_days_trend`).
    *   *Transformation (`extractIspFilter`):* Regex extracts ISP names (ais, dtac, true, etc.) to apply as a filter.
8.  **Branch: `map`**
    *   *Transformation (`extractThaiProvince`):* Extracts province. Falls back to raw query if no province found.
9.  **Branch: `knowledge`**
    *   *Transformation (`inferKnowledgeDomain`):* Regex maps keywords to specific knowledge domains (`law`, `history`, `religion`, `geo`). Sets `confidence_required: 0.45`.
10. **Branch: `data` / CSV/JSON (Inferred from `extractDataPayload`)**
    *   *Transformation:* Regex searches for fenced code blocks (` ```csv ... ``` `) or bare JSON arrays at the start of the string.

---

## DAT-008 — trace — `innomcp-node/src/services/coldRetriever.ts` [moonshotai/Kimi-K2.6]
The user wants a TRACE pass through the `coldRetriever.ts` module. This means I need to trace the data flow: what enters, each transformation step, what exits, and side-effects (db/network/events/state). Output should be an ordered step list, concrete.

Let me analyze the code carefully.

First, let's identify the entry points and data flows:

1. **Entry: `loadCorpus(corpusDir: string)`**
   - Input: `corpusDir` (string - filesystem path)
   - Source: Caller (likely initialization code or another service)

2. **Inside `loadCorpus`:**
   - Calls `this.listFiles(corpusDir)` - though `listFiles` isn't shown in the snippet, it presumably returns `string[]` of file paths. It likely uses `fs.readdirSync` or similar recursively.
   - Filters by extension `.md`, `.txt`
   - Skips `node_modules`, `.git`
   - Reads file: `fs.readFileSync(file, "utf-8")` → `content` (string)
   - Gets `relativePath` via `path.relative`
   - Computes `docId` = `cold:${relativePath}`
   - Extracts `tags` via `extractTags(content, relativePath)`
   - Gets file stats via `fs.statSync(file)` → `stat`
   - Extracts title via `extractTitle(content, file)`
   - Chunks text via `chunkText(content, docId)` → `ColdChunk[]`
   - Constructs `ColdDocument` object
   - Pushes to `this.documents` (state mutation)
   - After loop: calls `this.buildIDF()` (not shown in snippet but referenced - it presumably builds `this.idfMap`)
   - Sets `this.initialized = true`
   - Returns `{ docCount, chunkCount }`

3. **Inside `chunkText`:**
   - Input: `text` (string), `docId` (string)
   - Splits text by newlines → `lines`
   - Iterates, accumulates buffer
   - When buffer >= 500 chars or last line, creates chunk with trimmed content
   - Overlap logic: keeps last 100 chars
   - Returns `ColdChunk[]`

4. **Inside `extractTitle`:**
   - Input: `content` (string), `filePath` (string)
   - Regex match for markdown heading `/^#\s+(.+)$/m`
   - Fallback to basename without ext
   - Returns string

5. **Inside `extractTags`:**
   - Input: `content` (string), `filePath` (string)
   - Matches YAML frontmatter `---\n...\n---`
   - Extracts tags array from frontmatter
   - Adds domain tags based on regex tests on `filePath`
   - Returns deduplicated string array

6. **Inside `inferDomain`:**
   - Input: `tags` (string[]), `filePath` (string) - though filePath unused in the shown code? Wait, looking at the code: `function inferDomain(tags: string[], filePath: string)` but `filePath` is not used in the body. The body only checks tags. But it's called with `inferDomain(tags, relativePath)`.
   - Returns domain string

7. **Inside `buildIDF`:** Not shown in snippet, but it's called. It presumably iterates over all documents/chunks, tokenizes, computes document frequency, and populates `this.idfMap`. I need to mention it as a transformation step even if not fully shown, but I should note it's referenced. Actually, looking at the code, `buildIDF` is not defined in the shown snippet. But it's clearly called. I should trace it as a "black box" step or infer from context. Since the user asked to trace the module, and it's part of the module's flow, I should include it but note it's internal. Wait, the user said "TRACE data flow through this module". Since `buildIDF` isn't shown, I should probably mention it as a step that transforms `this.documents` into `this.idfMap`. But I can't see its implementation. I'll describe it based on standard TF-IDF and the fact that `computeTFIDF` uses `idfMap`.

8. **Entry: `search(query: string, options?)`**
   - Input: `query` (string), `options` (optional object with `maxResults`, `domain`)
   - Source: Caller (likely query processor or orchestrator)

9. **Inside `search`:**
   - Checks `this.initialized` and `this.documents.length`
   - Sets defaults
   - Iterates `this.documents`
   - Filters by `domainFilter` if provided
   - Iterates `doc.chunks`
   - Calls `computeTFIDF(query, chunk.content, this.idfMap)` → `score` (number)
   - Calls `this.keywordBoost(query,

---

## DAT-009 — trace — `innomcp-node/src/services/contextManager.ts` [deepseek/deepseek-v4-pro]
**Trace: `addMessage` → `getContext` (Typical Client Usage)**  

1. **Client calls `addMessage(sessionId, message)`**  
   - **Input shape**  
     `sessionId`: `string`  
     `message`: `{ role: 'user'|'assistant'|'system', content: string, tokens?: number }`  
   - **Source** – external actor (e.g., MCP tool handler, conversation manager)

2. **`addMessage` transforms state**  
   - Retrieves `current = this.sessions.get(sessionId)` (initially `undefined`).  
   - **Branch**  
     - If `current` is `undefined`: sets `this.sessions.set(sessionId, [message])`.  
     - Else: `current.push(message)` (mutates existing array in-place).  
   - **Side‑effect** – mutates the in‑memory `sessions` Map (the primary state of the module). No database, network, or event emissions.  
   - **Exit** – returns `void`.

3. **Client calls `getContext(sessionId)`**  
   - **Input shape** – same `sessionId: string`.  
   - **Source** – typically right before sending a request to an LLM API.

4. **`getContext` reads state**  
   - `messages = this.sessions.get(sessionId) || []` (read‑only access).  
   - No side‑effect.

5. **`getContext` calls `this.trim(messages, this.maxTokens)`**  
   - `this.maxTokens = 8000` (can be changed externally, but is a number).  
   - Enters the `trim` method with the raw message array and a token budget.

6. **Inside `trim(messages, maxTokens)`**  
   - **Early exit** – if `messages` is empty → return `[]`.  
   - **Separate system message**  
     - `hasSystem = messages[0].role === 'system'`  
     - `systemMessages = hasSystem ? [messages[0]] : []`  
     - `otherMessages = hasSystem ? messages.slice(1) : [...messages]`  
   - **Compute initial total tokens**  
     - `totalTokens = messages.reduce((sum, msg) => sum + this.countTokens(msg.content), 0)`  
     - Uses helper `countTokens(text)`: `Math.ceil(text.length / 4)` (character‑based approximation).  
   - **Trim oldest non‑system messages**  
     - While `otherMessages.length > 0` **and** `totalTokens > maxTokens`:  
       - `removed = otherMessages.shift()` (removes the oldest non‑system message).  
       - `totalTokens -= this.countTokens(removed.content)`  
   - **Combine and return** – `return [...systemMessages, ...otherMessages]`  
   - **No side‑effects** – `trim` only mutates its local `otherMessages` array (via `shift`); external state (`sessions`) is untouched.

7. **`getContext` returns the trimmed array**  
   - **Output shape**: `Message[]` (same interface as input, but possibly shorter).  
   - **Destination** – caller (e.g., used as the `messages` parameter for an OpenAI/Anthropic chat completion request).

---

### Other Methods (invoked separately)

8. **`summarize(messages)`**  
   - **Input**: `Message[]` (e.g., the full untrimmed history).  
   - **Transformations**  
     - Iterate messages, for role `user`/`assistant` take `msg.content.slice(0, 80)`.  
     - Join with `\n`, prefix `"สรุปเนื้อหาการสนทนาก่อนหน้า:\n"`.  
   - **Output**: single `Message` of role `'system'` with the summary string.  
   - **Side‑effects**: none (pure computation).

9. **`clear(sessionId)`**  
   - **Input**: `sessionId: string`.  
   - **Side‑effect** – deletes the entry from `sessions` Map.  
   - **Output**: `void`.

10. **`stats(sessionId)`**  
    - **Input**: `sessionId: string`.  
    - **Reads** messages array from `sessions`.  
    - **Computes** `messageCount = messages.length` and `estimatedTokens` via same `countTokens` reduction.  
    - **Output**: `{ messageCount: number, estimatedTokens: number }`.  
    - **Side‑effects**: none.

---

**Summary of data flow**  
- **Enters** – sessionId + message objects (from client).  
- **Transformations** – encoding into the `sessions` map, token counting, oldest‑first truncation while preserving a leading system message, optional summarisation.  
- **Exits** – trimmed `Message[]` (to caller), void, or statistics object.  
- **Side‑effects** – only the in‑memory `sessions` Map. No network, databas

---

## DAT-010 — trace — `innomcp-node/src/services/dataAnalysisTool.ts` [MiniMaxAI/MiniMax-M3]
# Data Flow Trace: `dataAnalysisTool.ts::analyzeData`

## Entry (Step 0)

- **Input `input`**: `string` (raw CSV text) **OR** `{ path: string; workspaceRoot: string }` (file reference)
- **Input `opts`**: `{ workspaceRoot: string; maxRows?: number }`, default `maxRows = 10_000`
- **Source**: caller in MCP tool layer
- **Exit contract**: `Promise<AnalysisResult>`

---

## Step 1 — Input Materialization

- **Enters**: `input` (union) + `opts.workspaceRoot`
- **Transformation**:
  - Branch on `typeof input === "string"`:
    - `string` branch: `text = input` (no I/O)
    - `object` branch:
      - `safePath = path.resolve(input.workspaceRoot, input.path.lstrip("/"))` (file system path)
      - **Security check**: throws `Error("Path outside workspace")` if `safePath` does not start with `input.workspaceRoot` (path-traversal guard)
      - **Side effect (network/disk)**: `await fs.readFile(safePath, "utf-8")` → filesystem read
- **Exits**: `text: string` (full CSV)
- **Side effects**: FS read (object branch only) or error throw

## Step 2 — CSV Parsing

- **Enters**: `text: string`
- **Transformation in `parseCSV`**:
  - `lines = text.split(/\r?\n/).filter(l => l.trim())` → `string[]`
  - `headers = lines[0].split(",").map(stripQuotes).map(trim)` → `string[]`
  - For each subsequent line: hand-rolled character loop tracks `inQ` (quote flag), splits on unquoted commas → `string[][]`
- **Exits**: `{ headers: string[]; rows: string[][] }`
- **Shape**: `rows` is `N × C` (C = headers.length, but ragged if rows have fewer cells)
- **Side effects**: none

## Step 3 — Row Limiting

- **Enters**: `rows: string[][]`, `maxRows = opts.maxRows ?? 10_000`
- **Transformation**: `limitedRows = rows.slice(0, maxRows)`
- **Exits**: `limitedRows: string[][]` (≤ 10,000 rows)
- **Side effects**: none

## Step 4 — Per-Column Statistical Reduction (the main loop)

For each column index `ci` ∈ `[0, headers.length)`:

### 4a — Cell extraction
- `cellVals = limitedRows.map(r => r[ci]?.trim() ?? "").filter(v => v !== "")` → `string[]`
- `nullCount = limitedRows.length - cellVals.length` → `number`

### 4b — Type inference
- `numVals = cellVals.map(Number).filter(!isNaN)` → `number[]`
- `isNumeric = numVals.length > cellVals.length * 0.7` → `boolean` (numeric iff >70% parse)

### 4c — Numeric branch
- `numStats(numVals)` computes (when `numVals.length > 0`):
  - `sorted` copy (ascending)
  - `mean = sum / n`
  - `median` (midpoint or midpoint pair)
  - `variance = Σ(v − mean)² / n`, then `stdDev = √variance`
  - All rounded to 3 decimals via `toFixed(3)` + unary `+`
- **Exits** `ColumnStats`: `{ name, type:"number", count: numVals.length, nullCount, unique: Set(numVals).size, min, max, mean, median, stdDev }`

### 4d — String branch (else)
- Build `freq: Map<string, number>` over `cellVals`
- `topValues = freq.entries().sortDesc().take(5).map({value, count})` → `Array<{value, count}>` (≤5)
- **Exits** `ColumnStats`: `{ name, type:"string", count: cellVals.length, nullCount, unique: freq.size, topValues }`
- No `date` branch is ever taken despite the type union declaring it.
- **Side effects**: none

## Step 5 — Column Partitioning

- `numCols = columns.filter(c => c.type === "number")` → `ColumnStats[]`
- `catCols = columns.filter(c => c.type === "string" && (c.unique ?? 0) <= 20)` → `ColumnStats[]` (categorical = low-cardinality string)
- **Side effects**: none

## Step 6 — Chart Generation (conditional)

- **Guard**: `if (catCols.length > 0 && numCols.length > 0)`
- Pick `cat = catCols[0]`, `num = numCols[0]` (first of each — **deterministic, not "best"**)
- Resolve column indices: `catIdx`, `numIdx`
- **Aggregation** (second pass over `limitedRows`):
  - `aggr: Map<string, number[]>` keyed by categorical value, accumulating numeric values
  - Skip rows where key empty or value NaN
  - `topEntries = [...aggr.entries()].slice(0, 10)` → keeps insertion order, **not** sorted by frequency
- **Guard**: only if `topEntries.length >= 2`
- Compute bar values: `val

---

## DAT-011 — trace — `innomcp-node/src/services/fastPathHandler.ts` [deepseek/deepseek-v4-flash]
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
  reason?: string;         // "disabled"|"intent_bypass"|"rate_limit"|"math"|"greeting"

---

## DAT-012 — trace — `innomcp-node/src/services/generalGate.ts` [Qwen/Qwen3.7-Max]
### Module Trace: `generalGate.ts`

**1. Module Initialization & Constants**
*   **Enters:** N/A (Module load time).
*   **Transformation:** Binds `LOW_CONFIDENCE_FALLBACK_TEXT` to a static Thai fallback string.
*   **Exits:** Exports 1 constant and 4 pure functions.
*   **Side-effects:** None.

**2. Execution: `renderGeneralFallbackMessage()`**
*   **Enters:** None.
*   **Transformation:** Returns a hardcoded Thai string explaining system latency and prompting the user for more specific context.
*   **Exits:** `string` (Destination: UI/Chat fallback message).
*   **Side-effects:** None.

**3. Execution: `renderThaiNumberText(value: number)`**
*   **Enters:** `value` (`number`, Source: Calculator tools or data formatting pipelines).
*   **Transformation Steps:** 
    1. **Validation:** Checks for `!Number.isFinite`, handles `0`, and recursively prefixes "ลบ" for negative numbers.
    2. **Chunking:** Splits number into `millions` and `remainder` (modulo 1,000,000).
    3. **Digit Mapping (`renderChunk`):** Maps individual digits to Thai words using positional arrays (`units`, `positions`). Applies Thai linguistic rules (e.g., "เอ็ด" for 1 in units place, "ยี่สิบ" for 20, "สิบ" for 10).
*   **Exits:** `string` (Thai text representation, e.g., "หนึ่งล้านสองแสน").
*   **Side-effects:** None.

**4. Execution: `countDaysUntilEndOfYear(baseDate: Date)`**
*   **Enters:** `baseDate` (`Date`, Source: System clock or injected date).
*   **Transformation Steps:** 
    1. **Normalization:** Strips time from `baseDate` to midnight (00:00:00).
    2. **Targeting:** Constructs `end` date as Dec 31 of the exact same year.
    3. **Calculation:** Computes delta in milliseconds, divides by 86400000 (ms in a day), rounds, and applies `Math.max(0, ...)` to prevent negative days.
*   **Exits:** `number` (Integer days remaining).
*   **Side-effects:** None.

**5. Execution: `renderGeneralSmokeAnswer(userText: string)` (Primary Router)**
*   **Enters:** `userText` (`string`, Source: `routes/api/chat.ts` / LLM Router intercept).
*   **Transformation Steps:**
    1. **Sanitization:** `t = String(userText || "").trim()`.
    2. **Status/Ping Check:** Regex tests for "พร้อมใช้งาน", "ping", "alive". If match → returns status string.
    3. **Identity Check:** Regex tests for "ชื่ออะไร", "who are you". If match → returns "Innova-bot" identity string.
    4. **Capability Check:** Regex tests for "ทำอะไรได้", "help". If match → returns feature list string.
    5. **Language Guard:** Regex tests for Thai characters (`/[ก-ฮ]/`). If *no* Thai chars found → immediately returns `LOW_CONFIDENCE_FALLBACK_TEXT`.
    6. **Geography Routing:** Regex tests for Thai regions (ภาคกลาง, เหนือ, อีสาน, ใต้, ตะวันออก) combined with "จังหวัด". If match → returns hardcoded province lists.
    7. **Domain Knowledge Routing:** Regex tests for specific tech/data topics (NASA, WorldBank, RAG, AI, KPI, Docker, ML, Solar). If match → returns canned definitions.
    8. **Date Math Routing:** Regex tests for "สิ้นปีนี้เหลือ" (days until end of year). If match → invokes `countDaysUntilEndOfYear(new Date())` and interpolates the result into a Thai string.
*   **Exits:** `string` (Destination: Direct API response to user, bypassing LLM inference).
*   **Side-effects:** 
    *   **DB/Network/Events/State:** None. (Strictly pure/stateless module).
    *   **System:** Reads system clock (`new Date()`) *only* if the Date Math regex branch (Step 5.8) is triggered.

---

## DAT-013 — trace — `innomcp-node/src/services/hotRetriever.ts` [deepseek/deepseek-v4-pro]
```step
1. **Entry: Function call**  
   External caller (e.g., Hot RAG orchestrator) invokes a normalization function with a raw tool result and the user query.  
   - `normalizeWeatherFacts(toolResult, query)`  
   - `normalizeEvidenceFacts(toolResult, query)`  
   - `normalizeDeterministicFact(domain, toolName, result, query)`

2. **Input shapes**  
   - `toolResult` → `any` (API/DB response – could be an object with `.result`/`.data`, or a plain value)  
   - `query` → `string` (the original user query, used for extracting entities)  
   - `domain`/`toolName`/`result` → specific scalar/string values for deterministic tools  
   Example (`normalizeWeatherFacts`):  
   `toolResult = { result: [{ province: "กรุงเทพ", temp: 35 }] }`  
   `query = "สภาพอากาศวันนี้ที่กรุงเทพ"`

3. **Guard: Falsy input**  
   If `toolResult` is falsy, return an empty `RetrievalFact[]` – immediate exit, no side-effects.

4. **Extract raw data**  
   Determine the core data payload: `toolResult.result` → `toolResult.data` → `toolResult` itself.

5. **Extract structured information** (weather/evidence)  
   - Weather (array branch): iterate items, extract location from `item.province`/`item.location` (default `"unknown"`).  
   - Weather (object branch): use `extractWeatherEntities(query)` (regex over Thai province/region names) to build an entity list.  
   - Evidence: use `extractISP(query)` (regex over ISP names) to extract an ISP string, default `"all"`.

6. **ID generation (side-effect)**  
   For each new fact, `nextFactId(domain)` reads and increments the module-level `factCounter` variable (mutable state).  
   Produces a string like `"hot:weather:3"`.  
   *Side-effect:* global `factCounter` increases by 1 per call.

7. **Construct `RetrievalFact` object**  
   For each data item:  
   - `id` ← generated ID  
   - `source` ← object with `type` ("api"|"database"|"tool"), `name`, `freshness: "live"`, `timestamp: now`, `confidence` (0.9/0.95/1.0)  
   - `domain` ← `"weather"` / `"evidence"` / `domain` argument  
   - `content` ← stringified representation (truncated later in summary)  
   - `entities` ← array (locations, ISP, or empty)  
   - `timestamp` ← current ISO string  
   - `confidence` ← fixed value  
   - `raw` ← original data item  

   Result: an array (`RetrievalFact[]`) for weather/evidence; a single fact for deterministic.

8. **Exit: Return array**  
   `normalizeWeatherFacts` / `normalizeEvidenceFacts` return the fact array to caller.  
   `normalizeDeterministicFact` returns a single `RetrievalFact`.

9. **Optional: Merge multiple fact sets**  
   Caller invokes `mergeRetrievalFacts(factSets: RetrievalFact[][])`  
   - Iterates all inner facts, deduplicates by `fact.id` using a `Set<string>`.  
   - Returns a flat, deduplicated `RetrievalFact[]`.  
   No side-effects.

10. **Optional: Compose a fact summary**  
    Caller invokes `composeFactSummary(facts: RetrievalFact[])`  
    - Iterates over facts.  
    - For each fact, builds a line `"[source.name] content"`, truncating content > 500 chars.  
    - Joins lines with double newline.  
    - Returns a human-readable `string`.  
    Destination: used by downstream answer-composition logic.  
    No side-effects.

11. **Overall module behaviour**  
    - Inputs: raw tool results + user query →  
    - Transformations: entity extraction, ID generation, object mapping →  
    - Outputs: `RetrievalFact[]` or a single `RetrievalFact` → optional merge → optional summary `string`.  
    - Side-effects: module-level `factCounter` mutation (global state); no database, network, or event emissions inside this module.
```

---

## DAT-014 — trace — `innomcp-node/src/services/intentClassifier.ts` [zai-org/GLM-5.1]
Here is the concrete, ordered data flow trace for the `intentClassifier.ts` module, based on the provided code and inferred logic for the truncated portion.

### 1. Entry: Input Data
*   **Enters:** `message` (`string` - the raw user chat input) and `toolHint` (`string | undefined` - likely a routing hint from the caller).
*   **Source:** The Conductor service (or chat handler) invoking `classifyIntent`.

### 2. Step: Input Validation
*   **Transformation:** Checks if `message` is falsy or not a string.
*   **Logic:** `if (!message || typeof message !== "string")`
*   **Result:** If invalid, short-circuits and returns a default fallback object `{ intent: "general", expectedToolUsage: false, reasons: ["empty"] }`.

### 3. Step: Keyword Extraction & Matching (Parallel Evaluations)
*   **Transformation:** The `message` string is lowercased and scanned against an array of predefined Thai/English keyword dictionaries using `containsAny` and `evidenceMatch`.
*   **Sub-steps:**
    *   **Greeting/Factual/Planning/Weather/Datetime/Travel/Map/Calc/Code/Data/Research/Shell/Write:** Direct `containsAny` checks. Returns the matched keyword string or `null`.
    *   **Evidence:** Evaluated via `evidenceMatch()`. 
        *   *Special Logic:* If the matched word is "machine", "url", or "traffic", it checks for an "officer signal" (regex `OFFICER_SIGNAL_RE`). If no signal exists, it returns `null`.
        *   *Exclusion Logic:* Explicitly returns `null` for false positives like "machine learning" or "url encoding".
    *   **System Inventory (Inferred):** Calls the imported `looksLikeSystemInventoryQuestion(message)` (which was imported but truncated from the snippet).
*   **Result:** A set of local variables holding matched keywords (e.g., `const weather = "rain"`, `const evidence = null`).

### 4. Step: Intent Resolution & Prioritization (Inferred from truncation)
*   **Transformation:** An `if/else if` priority chain evaluates the matched keyword variables from Step 3. Because keywords can overlap (e.g., "trip" is in both `PLANNING_KEYWORDS` and `TRAVEL_KEYWORDS`), this step applies deterministic precedence (e.g., Evidence > Calc > Weather > Knowledge > General).
*   **Result:** Selection of exactly one primary `ChatIntent` string.

### 5. Step: Tool Usage & Reasoning Assignment (Inferred from truncation)
*   **Transformation:** Based on the resolved `ChatIntent`, sets the `expectedToolUsage` boolean to `true` if the intent typically requires tool invocation (e.g., Weather, Map, Calc, Shell, Evidence), or `false` if not (e.g., Greeting, Knowledge). Populates the `reasons` array with the specific keywords that triggered the intent.
*   **Result:** Finalizes the `ClassifyResult` object structure.

### 6. Exit: Output Data
*   **Exits:** `ClassifyResult` object: `{ intent: ChatIntent, expectedToolUsage: boolean, reasons: string[] }`
*   **Destination:** Returned to the Conductor service. The Conductor uses `intent` to route the workflow, and the naturalness guard uses `expectedToolUsage` to detect "Used tools: none" leaks.

---

### Side-Effects (DB / Network / Events / State)
*   **None.** As explicitly stated in the module docstring, this is a *"Pure-function, deterministic, keyword-based — no LLM call."* It performs no I/O, makes no database queries, triggers no network requests, and mutates no external state. It relies solely on in-memory string matching.

---

## DAT-015 — trace — `innomcp-node/src/services/motherProviderToggle.ts` [MiniMaxAI/MiniMax-M3]
# Trace: `motherProviderToggle.ts`

## Module-Level State
```
disabledProviders: Set<string>  // module-scope, empty at process start
```
A single in-memory `Set` shared across all four exported functions. No initialization of seed data — the set starts empty, and "all 14 providers enabled" is emergent from absence, not stored affirmatively.

---

## Step-by-Step Data Flow

### 1. `isProviderEnabled(providerId: string): boolean`
- **Enters:** `providerId: string` (caller-supplied, e.g. dispatch logic asking "can I route to provider X?")
- **Transform 1:** `Set.prototype.has(providerId)` — O(1) membership probe against the module-scope set.
- **Transform 2:** Logical NOT (`!`) inverts the boolean: presence in set = disabled, absence = enabled.
- **Exits:** `boolean` returned to caller. No mutation.
- **Side-effects:** None. Read-only.
- **Source of `providerId`:** External (downstream consumers, likely the mother-dispatch layer mentioned in comments).
- **Destination of result:** Caller — used as a gate to skip/allow dispatch.

---

### 2. `disableProvider(providerId: string): void`
- **Enters:** `providerId: string` (typically from an admin/UI toggle event).
- **Transform 1:** `Set.prototype.add(providerId)` — idempotent insertion; re-adding an already-present ID is a no-op (no duplicate, no error).
- **Exits:** `void`.
- **Side-effects:**
  - **State mutation:** `disabledProviders` gains the ID. Persists for the process lifetime.
  - **Implicit downstream effect:** Any subsequent `isProviderEnabled(id)` calls now return `false`. Not a callback/event — purely pull-based, lazy.
  - **DB:** None. **Network:** None. **Events:** None emitted.
- **No return channel** — caller cannot tell whether the ID was newly added or already present (no boolean return).

---

### 3. `enableProvider(providerId: string): void`
- **Enters:** `providerId: string`.
- **Transform 1:** `Set.prototype.delete(providerId)` — returns `true` if removed, `false` if not present, but the return is **discarded**.
- **Exits:** `void`.
- **Side-effects:**
  - **State mutation:** ID removed from `disabledProviders` if present. Otherwise no-op.
  - **Downstream effect:** Future `isProviderEnabled(id)` returns `true`.
- **No signal of "was-it-already-enabled"** — silent no-op if the ID was never disabled.

---

### 4. `toggleProvider(providerId: string): boolean`
- **Enters:** `providerId: string`.
- **Transform 1:** `disabledProviders.has(providerId)` — branch decision.
- **Transform 2 (branch A — currently disabled):** `delete(providerId)` → state mutates to enabled.
- **Transform 3 (branch B — currently enabled):** `add(providerId)` → state mutates to disabled.
- **Exits:** `boolean` — `true` if now enabled, `false` if now disabled. The return reflects the **post-mutation** state.
- **Side-effects:** Exactly one state mutation per call (guaranteed by the if/else exclusivity). No double-mutation risk.
- **Distinguishing feature vs. 2/3:** This is the only mutator that returns feedback on the resulting state.

---

### 5. `getDisabledProviders(): string[]`
- **Enters:** Nothing (no parameters).
- **Transform 1:** `Array.from(disabledProviders)` — copies the iterable into a new `string[]`. The result is a **fresh array** each call, not a live view.
- **Exits:** `string[]` — shallow copy, safe to mutate by the caller without corrupting internal state.
- **Side-effects:** None. No iteration order guarantee beyond `Set`'s insertion order (V8: insertion order for string keys).
- **Consumer use:** Likely admin/UI rendering of the current disabled list.

---

### 6. `resetAllProviders(): void`
- **Enters:** Nothing.
- **Transform 1:** `Set.prototype.clear()` — empties the set in place.
- **Exits:** `void`.
- **Side-effects:** **Total state wipe.** Every previously disabled provider is now considered enabled again. **No event, no log, no notification** to any in-flight dispatch logic that may have already read the prior state.
- **Documented intent:** Testing only — the c

---

## DAT-016 — trace — `innomcp-node/src/services/naturalnessGuard.ts` [deepseek/deepseek-v4-flash]
## Trace Data Flow: `checkNaturalness` in `naturalnessGuard.ts` (Phase C Guard)

### Inputs
| Name | Type | Source |
|------|------|--------|
| `candidate` | `string` | Caller (e.g., Conductor after composition) |
| `opts` | `NaturalnessCheckOptions` | Caller (derived from conversation context) |
| `opts.intent` | `ChatIntent` (enum) | Intent classifier |
| `opts.expectedToolUsage` | `boolean` | Intent classifier / tool planner |
| `opts.userQuery` | `string` | Original user message (Thai query) |

---

### Step-by-Step Transformation & Checks

**Step 1 – Input validation**  
- Check: `!candidate || typeof candidate !== "string"`  
- If true → **return** `{ ok: false, ruleFired: "empty-answer", hint: "คำตอบว่าง..." }`  
- **Side‑effects**: None  

**Step 2 – Trim**  
- `const trimmed = candidate.trim()`  
- No mutation, new local string  

**Step 3 – Rule 1: Province request as whole answer for `planning-broad`**  
- Condition: `opts.intent === "planning-broad"` AND `PROVINCE_REQUEST_RE.test(trimmed)`  
- If true → **return** `{ ok: false, ruleFired: "planning-broad-province-only", hint: "อย่าตอบแค่..." }`  
- **Side‑effects**: None  

**Step 4 – Rule 2: Thai query but answer starts with English**  
- `const userIsThai = hasThaiCharacter(opts.userQuery)`  
- Condition: `userIsThai` AND `startsWithEnglish(trimmed)` AND `!hasThaiCharacter(trimmed.slice(0, 50))`  
- If true → **return** `{ ok: false, ruleFired: "english-first-leak", hint: "คำถามเป็นภาษาไทย..." }`  
- **Side‑effects**: None  

**Step 5 – Rule 3: Raw JSON at top level**  
- `RAW_JSON_RE.test(trimmed)`  
- If true → **return** `{ ok: false, ruleFired: "raw-json-leak", hint: "อย่าตอบเป็น JSON ดิบ..." }`  
- **Side‑effects**: None  

**Step 6 – Rules 4 & 5: Forbidden substrings via `checkVisibleTextSafe`**  
- **External call**: `checkVisibleTextSafe(trimmed, { allowMapTerms: opts.intent === "map", expectedToolUsage: opts.expectedToolUsage })`  
- This is a pure function from `../agents/eventGuard` (no I/O)  
- Returns `{ ok: boolean, forbiddenSubstring?: string }`  
- If `!guard.ok` → **return** `{ ok: false, ruleFired: guard.forbiddenSubstring ? "forbidden-substring:"+... : "guard-violation", hint: "พบข้อความที่ไม่เหมาะ..." }`  
- **Side‑effects**: None  

**Step 7 – Rule 6: `planning-broad` must include follow-up or plan frame**  
- Condition: `opts.intent === "planning-broad"`  
- Check: `!hasFollowup && !hasPlanFrame` (using regex on `trimmed`)  
- If true → **return** `{ ok: false, ruleFired: "planning-broad-too-shallow", hint: "คำตอบสำหรับคำถามวางแผน..." }`  
- **Side‑effects**: None  

**Step 8 – All checks passed**  
- **return** `{ ok: true }`  

---

### Outputs
| Name | Type | Destination |
|------|------|-------------|
| `NaturalnessResult` | `{ ok: boolean, ruleFired?: string, hint?: string }` | Caller (Stylist or Conductor) |

### Side‑Effects (at runtime)
- **None** – The function is pure, no database/network/event/state mutations.  
- The only imported helper (`checkVisibleTextSafe`) is also pure.  

### Flow Diagram (summary)
```
[candidate: string, opts: object] 
  │
  ├── Step1: validate candidate (non‑empty string) ──fail──→ return error
  │
  ├── Step2: trimmed = candidate.trim()
  │
  ├── Step3: Rule 1 (planning‑broad province‑only) ──fail──→ return error
  │
  ├── Step4: Rule 2 (Thai query / English first) ──fail──→ return error
  │
  ├── Step5: Rule 3 (raw JSON leak) ──fail──→ return error
  │
  ├── Step6: checkVisibleTextSafe() ──fail──→ return error
  │
  ├── Step7: Rule 6 (planning‑broad too shallow) ──fail──→ return error
  │
  └── Step8: return { ok: true }
```

---

## DAT-017 — trace — `innomcp-node/src/services/providerAdapter.ts` [deepseek/deepseek-v4-pro]
**ProviderAdapter Module Trace** — ordered data flow from entry call to exit/effects.

---

### 1. Entry (Function Call)
- **What enters**:  
  - `provider` – `ProviderRecord` (shape: `{ id, displayName, baseUrl, model, maxTokens?, temperature?, timeoutMs, type? ... }`)  
  - `req` – `AdapterRequest` (shape: `{ messages: ChatMessage[], model?, maxTokens?, temperature?, stream? }`)  
    - `ChatMessage` = `{ role: "system" | "user" | "assistant", content: string }`  
  - (streaming only) `onChunk` – callback `(chunk: AdapterChunk) => void` with `AdapterChunk = { type: "delta"|"done"|"error", delta?: string, error?: string }`  
- **Source**: External caller (e.g., `/execute` route in main server)

---

### 2. Route to Provider Implementation (assumed dispatcher)
- The module internally dispatches based on `provider.type` (e.g., `"openai"`, `"anthropic"`).  
- The implementation functions shown are `callOpenAI`, `streamOpenAI`, `callAnthropic`, `streamAnthropic`.

---

### 3. Common Pre‑processing (per call)
- **`requireApiKey(provider)`**  
  - *Input*: `provider.id`  
  - *Calls*: `resolveApiKey(provider.id)` from `../providers/registry`  
  - *Returns*: string API key, or throws `Error` if missing/empty.  
  - *Side‑effect*: key is read from registry (potentially in‑memory / environment‑based store), never logged.  
- **Model resolution**  
  - `model = req.model ?? provider.model` (fallback to provider default).  
- **Timeout setup**  
  - `buildAbortController(provider.timeoutMs)`  
    - Creates `AbortController`, sets a `setTimeout` timer that calls `controller.abort()`.  
    - *Output*: `{ controller, clearTimer }` (cleanup function that clears the timer).  
    - *Side‑effect*: an OS timer is registered; will abort fetch after `timeoutMs` ms if not cleared.

---

### 4. Per‑Provider Transformation (non‑streaming example: `callOpenAI`)
1. **Build request URL**  
   - `provider.baseUrl + "/chat/completions"`  
2. **Assemble HTTP headers**  
   - `"Content-Type": "application/json"`  
   - `"Authorization": "Bearer ${apiKey}"` (key never stringified – safe)  
3. **Create body**  
   - `JSON.stringify({ model, messages: req.messages, max_tokens: req.maxTokens ?? provider.maxTokens, temperature: req.temperature ?? provider.temperature, stream: false })`  
4. **Dispatch fetch**  
   - `fetch(url, { method: "POST", signal: controller.signal, headers, body })`  
   - *Side‑effect*: network call to external provider API.  
5. **Handle HTTP response**  
   - *If `!resp.ok`*: read error body with `resp.text()`, throw new `Error("OpenAI API error <status>: <body>")`.  
   - *Else*: parse JSON → `data.choices[0].message.content` (default `""`). Return string.  
6. **Clean up**  
   - In `finally` block: `clearTimer()` (clears the abort timeout).  

   *Exit*: `Promise<string>` resolved with the assistant’s text content.

---

### 5. Streaming Variant (`streamOpenAI`)
- Steps 1–3 identical to non‑stream except `stream: true`.  
- **Read response stream**  
  - If `!resp.body`, fire error chunk (`{ type: "error", error: "No response body..." }`) and return.  
  - Obtain `reader = resp.body.getReader()`, use `TextDecoder`.  
  - Accumulate buffer, split by `"\n"`, process each line.  
- **SSE parsing loop**  
  - For each line starting with `"data:"`, extract payload.  
  - If payload `"[DONE]"` → stop.  
  - Else JSON‑parse as `{ choices: [{ delta?: { content?: string } }] }`.  
  - Extract `delta` string; if present, invoke `onChunk({ type: "delta", delta })`.  
- **End of stream**  
  - After reader completes, call `onChunk({ type: "done" })`.  
- **Error handling**  
  - HTTP failure → `onChunk({ type: "error", error: "..." })`.  
  - Malformed SSE lines are silently skipped.  
- **Cleanup**: `clearTimer()` in `finally`.  

  *Exit*: `Promise<void>`; side‑effect: multiple calls to `onChunk` with `AdapterChunk` objects.

---

### 6. Anthropic‑compatible transformations (`callAnthropic`, `streamAnthropic`)
- **System‑message separati

---

## DAT-018 — trace — `innomcp-node/src/services/providerFailover.ts` [moonshotai/Kimi-K2.6]
**Trace pass through `innomcp-node/src/services/providerFailover.ts`**  
*Ordered by typical lifecycle. All state is in-memory only; no DB, no filesystem, no event bus.*

---

### Step 1 – Module load / singleton instantiation
- **Enters:** Nothing (default arguments applied).
  - `primaryId` defaults to `'mdes-ollama'`
  - `backupIds` defaults to `['ollama-local', 'openai-compatible']`
  - `failThreshold` = `3`
  - `cooldownMs` = `60000`
- **Transform:** Constructor allocates `this.statuses = new Map<string, ProviderStatus>()` and inserts 3 objects:
  ```ts
  {
    id: <providerId>,
    healthy: true,
    latencyMs: 0,
    failCount: 0,
    lastCheck: Date

---

## DAT-019 — trace — `innomcp-node/src/services/providerHealthProbe.ts` [zai-org/GLM-5.1]
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
| 18 | `seed-cc-deepseek-v4` | `openai` | commandCodeBaseUrl | `cc/d

---

## DAT-020 — trace — `innomcp-node/src/services/providerManager.ts` [MiniMaxAI/MiniMax-M3]
# Trace: `providerManager.ts` Data Flow

## Module Inputs
- **Constructor entry:** `process.env.MDES_OLLAMA_URL` (string, env), `process.env.MDES_OLLAMA_MODEL` (string, env)
- **Public method inputs:** `ProviderConfig` (object), `id: string`, `capability?: string`, `task: 'thai'|'code'|'reasoning'|'fast'|'general'`
- **Network input:** HTTP GET response from `<baseUrl>/health` (network)

## Module Outputs
- `Promise<void>` (register/unregister)
- `Promise<ProviderConfig[]>` (getAll/checkAllHealth)
- `Promise<ProviderConfig | undefined>` (getBest)
- `Promise<{ healthy: boolean; latencyMs: number }>` (checkHealth)
- `ProviderConfig` (getMDESPrimary — sync)
- `Promise<ProviderConfig>` (selectForTask)
- **Exported singleton:** `providerManager` (instance)

## Side Effects
- **In-memory state:** `this.providers: Map<string, ProviderConfig>` (mutation throughout)
- **Network:** outbound HTTP GET requests (checkHealth, checkAllHealth)
- **Timers:** `setTimeout`/`clearTimeout` for 10s abort
- **No DB, no filesystem, no event emission, no logging**

---

## Step List

### Step 1 — Module Load
- **Enters:** ESM import side-effect
- **Transform:** None (type/interface declarations)
- **Exits:** Exports `ProviderConfig`, `ProviderManager`, `providerManager`
- **Side effects:** None

### Step 2 — Singleton Instantiation (`new ProviderManager()`)
- **Enters:** No runtime args
- **Transform:** `this.providers = new Map()` (empty)
- **Transform:** Calls `registerDefaultMDESPrimary()`
- **Exits:** Singleton `providerManager` ready
- **Side effects:** Heap-allocated singleton

### Step 3 — `registerDefaultMDESPrimary()` (private, called at Step 2)
- **Enters:** `process.env.MDES_OLLAMA_URL ?? 'http://localhost:11434'`, `process.env.MDES_OLLAMA_MODEL ?? 'mdes-llm-v1'`
- **Transform:** Builds `ProviderConfig` literal with fixed `id='mdes-primary-ollama'`, `priority=100`, `enabled=true`, `healthStatus='unknown'`, capabilities array of 5 strings
- **Exits:** Config object → `this.providers.set('mdes-primary-ollama', config)`
- **Side effects:** Map mutation (1 entry)
- **Destination:** `this.providers` map, key `mdes-primary-ollama`

### Step 4 — `register(config)` (caller-driven)
- **Enters:** `ProviderConfig` (caller-supplied)
- **Transform:** Validate `id`, `baseUrl`, `model` present → throw `Error` if not
- **Transform:** `this.providers.get(id)` → `existing` (or undefined)
- **Branch A (no existing):** Spread `config`, default `healthStatus='unknown'`, `capabilities=[]`, `enabled=true`, `priority=0` → set
- **Branch B (existing):** Merge `{...existing, ...config}`, preserve `healthStatus`/`latencyMs`/`lastChecked` from `existing` when new omits them → set
- **Exits:** `Promise<void>`
- **Side effects:** Map mutation
- **Throw destination:** Caller's rejected promise

### Step 5 — `unregister(id)`
- **Enters:** `id: string`
- **Transform:** `this.providers.delete(id)` (no-op if absent)
- **Exits:** `Promise<void>`
- **Side effects:** Map mutation (potential removal)

### Step 6 — `getAll()`
- **Enters:** Nothing
- **Transform:** `Array.from(this.providers.values())` → spread-copy each entry
- **Exits:** `Promise<ProviderConfig[]>` (shallow clones — note: nested arrays like `capabilities` are shared references)
- **Side effects:** None

### Step 7 — `getBest(capability?)`
- **Enters:** `capability?: string`
- **Transform 1:** Filter `p.enabled === true`
- **Transform 2 (optional):** Filter `p.capabilities.includes(capability)`; return `undefined` if empty
- **Transform 3:** Sort comparator — (a) `priority` desc, (b) `healthStatus` order `{healthy:0, degraded:1, unknown:2}` asc, (c) `latencyMs ?? Infinity` asc
- **Transform 4:** Spread-copy `candidates[0]`
- **Exits:** `Promise<ProviderConfig | undefined>`
- **Side effects:** None

### Step 8 — `checkHealth(id)`
- **Enters:** `id: string`
- **Transform 1:** `this.providers.get(id)`; throw if absent
- **Transform 2:** Construct `AbortController` + `setTimeout(abort, 10_000)`; record `start = Date.

---

## DAT-021 — trace — `innomcp-node/src/services/responseComposer.ts` [deepseek/deepseek-v4-pro]
**Data-flow trace for `responseComposer.ts` / `composeThaiAnswer`**

1. **Entry point**: Caller (e.g., a route handler) invokes `composeThaiAnswer(input)` with a `ResponseComposerInput` object.
   - **Shape**: `{ route: string, userQuery: string, facts: ToolFact[], header?: string, footer?: string }`
   - `facts` is an array of `ToolFact`: `{ source: string, summary: string, confidence?: number, metadata?: Record<string,unknown> }`

2. **Start timer**: `const t0 = Date.now()` to measure latency.

3. **Initialize reasons array**: empty `string[]`.

4. **Normalize facts array**: If `input.facts` is falsy or not an array, set `facts` to `[]`; else use `input.facts`.

5. **Trim and filter empty summaries**:
   - Map each fact: replace all whitespace sequences with a single space and trim.
   - Filter out facts whose trimmed summary is empty (`length === 0`).
   - Result: `usable` array of `ToolFact` with cleaned summaries.

6. **Empty-facts early exit**:
   - If `usable.length === 0`:
     - Add reason `"no-facts"`.
     - Return `ResponseComposerOutput`:
       ```json
       {
         "text": "ขออภัย ไม่พบข้อมูลที่เกี่ยวข้องในขณะนี้",
         "mode": "passthrough",
         "reasons": ["no-facts"],
         "latencyMs": Date.now() - t0,
         "factCount": 0
       }
       ```
     - **(Skip remaining steps)**

7. **Confidence filtering**:
   - `highConf` = `usable` filtered where `Number(f.confidence ?? 1) >= 0.3`.
   - `rendered` = `highConf` if it’s non-empty, else `usable`.
   - If `rendered.length < usable.length`, push reason `"dropped-low-conf:<N>"` where N = number dropped.

8. **Build output lines array**:
   - If `input.header` is truthy and its trimmed form is non-empty:
     - Push `input.header.trim()`.
     - Push an empty string `""` (blank line).
   - For each fact `f` in `rendered`:
     - Compute confidence suffix: if `f.confidence` is a number and `< 0.6`, use `" _(ความมั่นใจ " + (f.confidence*100).toFixed(0) + "%)_"`; else `""`.
     - Compute source prefix: if `f.source` is truthy, use `"**" + f.source + "**: "`; else `""`.
     - Build line: `"• " + source_prefix + f.summary + confidence_suffix`.
     - Push line.
   - If `input.footer` is truthy and trimmed non-empty:
     - Push an empty line `""`.
     - Push `input.footer.trim()`.

9. **Append diagnostic reasons**:
   - `"composed:<rendered.length>"`.
   - `"route:<input.route || 'unknown'>"`.

10. **Form final text**: Join all lines with `"\n"` and trim the result.

11. **Compute latency**: `Date.now() - t0`.

12. **Construct and return `ResponseComposerOutput`**:
    ```json
    {
      "text": "<composed string>",
      "mode": "deterministic",
      "reasons": [...],
      "latencyMs": <number>,
      "factCount": <rendered.length>
    }
    ```
    Destination: the caller (route handler / MCP tool response).

**Side effects**: None. The module is a pure function – no database writes, no network calls, no event emissions, no mutable external state modified.

**Additional export `composeThaiAnswerWithLLM`**:
- Receives the same input shape.
- Delegates entirely to `composeThaiAnswer` (identical data flow).
- Returns the same output shape; currently no external LLM call or other side effects.

---

## DAT-022 — trace — `innomcp-node/src/services/responseFormatter.ts` [Qwen/Qwen3.7-Max]
Here is the concrete data flow trace for the `ResponseFormatter` module, broken down by its public entry points.

### Flow 1: `format(raw, options)` — Primary Synchronous Formatting
1. **Enters**:
   * `raw` (`string`, source: raw LLM/text output).
   * `options` (`FormatOptions`, source: client configuration). Shape: `{ renderMarkdown?: boolean, highlightCode?: boolean, sanitizeHtml?: boolean, maxLength?: number, locale?: 'th' | 'en' }`.
2. **Transformation Steps**:
   * **Step 1 (Locale)**: Resolves `locale` from `options` (defaults to `'en'`).
   * **Step 2 (Truncation)**: If `options.maxLength` is set, calls `truncate(raw, maxLength)`. Slices text at word boundaries and appends `...`. Result: `text` (`string`).
   * **Step 3 (Code Extraction)**: Calls `extractCodeBlocks(text)`. Uses regex to find ```` ``` ```` fences. For each, determines language (via `detectLanguage()` if missing), extracts code, and counts lines. Result: `codeBlocks` (`CodeBlock[]`).
   * **Step 4 (Table Extraction)**: Calls `extractTables(text)`. Splits by newline, filters out markdown separator rows (`---|---`), splits cells by `|`. Result: `tables` (`string[][]`).
   * **Step 5 (Markdown Detection)**: Calls `hasMarkdown(text)`. Tests regex for headers, bold, code, lists, tables. Result: `hasMarkdown` (`boolean`).
   * **Step 6 (Reading Time)**: Calls `estimateReadingTime(text, locale)`. Calculates word count (Thai: chars/6, EN: space-split) and divides by WPM (150/200). Result: `estimatedReadTimeSeconds` (`number`).
   * **Step 7 (Assembly)**: Assembles base `FormattedResponse` object with the above results.
   * **Step 8 (HTML Rendering)**: If `options.renderMarkdown` is true, calls `renderMarkdown(text)`. Escapes HTML entities and replaces markdown syntax with HTML tags (`<h1>`, `<pre>`, `<strong>`, etc.). Result: `html` (`string`).
   * **Step 9 (Sanitization)**: If `options.sanitizeHtml !== false`, calls `sanitize(html)` to strip `<script>` tags, `on*` event attributes, and `javascript:` URIs. Updates `result.html`.
3. **Exits**:
   * `result` (`FormattedResponse`, destination: client UI/API response). Shape: `{ text: string, html?: string, codeBlocks: CodeBlock[], tables: string[][], hasMarkdown: boolean, estimatedReadTimeSeconds: number }`.
4. **Side-effects**:
   * **None**. (Pure computation, no state mutation, no I/O).

### Flow 2: `formatStream(chunk)` — Stateful Stream Buffering
1. **Enters**:
   * `chunk` (`string`, source: SSE/WebSocket streaming text chunk).
2. **Transformation Steps**:
   * **Step 1 (Buffer Append)**: Appends `chunk` to the instance state `this.streamBuffer`.
   * **Step 2 (Fence Check)**: Checks if `streamBuffer` contains code fences (```` ``` ````).
   * **Step 3 (Incomplete Block Halt)**: If fences exist, counts them. If the count is odd (indicating an unclosed code block), halts processing and returns an empty string `''` to buffer the incomplete block.
   * **Step 4 (Flush)**: If fence count is even or zero, assigns the current `streamBuffer` to a local `output` variable.
   * **Step 5 (Reset)**: Resets `this.streamBuffer` to an empty string `''`.
3. **Exits**:
   * `output` (`string`, destination: client stream consumer). Contains the fully buffered text or `''` if waiting for a closing fence.
4. **Side-effects**:
   * **State**: Mutates instance property `this.streamBuffer` (appends incoming chunk, then clears it upon flush).

### Flow 3: `detectLanguage(code)` — Code Language Inference
1. **Enters**:
   * `code` (`string`, source: extracted code block content).
2. **Transformation Steps**:
   * **Step 1**: Trims whitespace from `code`.
   * **Step 2**: Tests regex for TS/JS keywords (`import`, `const`, `async function`, etc.). If match, returns `'ts'`.
   * **Step 3**: Tests regex for Python keywords (`def`, `import`). If match, returns `'py'`.
   * **Step 4**: Tests regex for JSON start characters (`{`, `[`). If match, returns `'json'`.
   * **Step 5**: Tests regex for SQL keywords (`SELECT`, `INSERT`, etc.). 

---

## DAT-023 — trace — `innomcp-node/src/services/retrievalOrchestrator.ts` [moonshotai/Kimi-K2.6]
**Trace through `retrievalOrchestrator.ts`**  
*Ordered by the typical caller pipeline: `planRetrieval` → `executeColdRetrieval` → `buildRetrievalResult`*

---

**1. Entry into `planRetrieval`**  
- **What enters:**  
  - `query: string` (raw user text, e.g., `"อากาศวันนี้และอธิบายว่าฝนตกหมายถึงอะไร"`)  
  - `route?: string` (e.g., `"weather"`, `"calculator"`, `undefined`)  
  - `memory?: SessionMemorySnapshot | null` (e.g., `{ activeDomain: "weather", ... }`)  
- **Source:** Upstream intent router / session manager.

**2. Query normalization**  
- `query` is trimmed and sliced to the first 500 chars → local `q`.  
- **Shape:** `string` (bounded).  
- **Side-effects:** None.

**3. Deterministic route short-circuit**  
- If `route` is `"calculator"` or `"datetime"`, function returns immediately.  
- **What exits:** `RetrievalPlan`  
  ```ts
  { decision: "none", hotDomains: [], reason: "deterministic_route" }
  ```

**4. Mixed-pattern detection**  
- `q` is tested against 4 `MIXED_PATTERNS` regexes (e.g., `/.*และ.*อธิบาย/...`).  
- **If match:** calls pure helpers `inferHotDomains(q, route)` → `string[]`, and `extractColdQuery(q)` → `string`.  
- **What exits:**  
  ```ts
  { decision: "hot+cold", hotDomains: ["weather"], coldQuery: "อธิบายว่าฝนตกหมายถึงอะไร", reason: "mixed_hot_cold_query" }
  ```

**5. Cold-only / Hot-only flag extraction**  
- `q` tested against 6 `COLD_ONLY_PATTERNS` (e.g., `/คืออะไร/`, `/นโยบาย/`) → `hasColdPattern: boolean`.  
- `q` tested against 6 `HOT_ONLY_PATTERNS` (e.g., `/อากาศ.*วันนี้/`, `/ตอนนี้/`) → `hasHotPattern: boolean`.

**6. Branch: Both patterns detected**  
- If `hasColdPattern && hasHotPattern`: same helper calls as step 4.  
- **What exits:** `RetrievalPlan` with `decision: "hot+cold"`, `reason: "both_patterns_detected"`.

**7. Branch: Cold-only with readiness check**  
- If `hasColdPattern && !hasHotPattern`:  
  - **Side-effect (state read):** `coldRetriever.isReady()` is queried.  
  - If `true`: exits with `decision: "cold"`, `coldQuery: q`, `reason: "documentation_policy_query"`.  
  - If `false`: **falls through** to step 8 (does not return here).

**8. Branch: Operational / live query or routed hot domain**  
- If `hasHotPattern` OR `route` ∈ `["weather", "evidence", "geo", "seismic"]`:  
  - Calls `inferHotDomains(q, route)` → domains list.  
- **What exits:** `RetrievalPlan` with `decision: "hot"`, `reason: "operational_live_query"`.

**9. Branch: Memory domain continuation**  
- If `memory?.activeDomain` exists and is `"weather" | "evidence" | "geo"`:  
- **What exits:** `RetrievalPlan` with `decision: "hot"`, `hotDomains: [domain]`, `reason: "memory_domain_continuation"`.

**10. Default: No retrieval**  
- If none of the above branches trigger.  
- **What exits:**  
  ```ts
  { decision: "none", hotDomains: [], reason: "no_retrieval_pattern" }
  ```

---

**11. Entry into `executeColdRetrieval`**  
- **What enters:** `RetrievalPlan` object produced in steps 3–10.  
- **Source:** Caller (orchestrator / dispatcher).

**12. Guard: Decision & query presence**  
- Checks `plan.coldQuery` is truthy AND `plan.decision` is `"cold"` or `"hot+cold"`.  
- **If false:** exits with `[]` (empty `ColdRetrievalResult[]`).

**13. Guard: Cold retriever readiness**  
- **Side-effect (state read):** `coldRetriever.isReady()` queried again.  
- **If false:** exits with `[]`.

**14. External search execution**  
- Calls `coldRetriever.search(plan.coldQuery, { maxResults: 3 })`.  
- **Side-effect (network / disk / vector DB I/O):** Performs the actual cold retrieval against the document index.  
- **What exits:** `ColdRetrievalResult[]` (0–3 items).  
- **Destination:** Returned to caller; typically fed into `buildRetrievalResult` next.

---

**15. Entry into `buildRetrievalResult`**  
- **What enters:**  
  - `plan: RetrievalPlan` (from step 10)  
  - `hotFacts: RetrievalFact[]` (from upstream hot retriever, not from this module)  
  - `coldResults: ColdRetrievalResult[]` (from step 14)  
  - `met

---

## DAT-024 — trace — `innomcp-node/src/services/riskDetector.ts` [zai-org/GLM-5.1]
### Data Flow Trace: `innomcp-node/src/services/riskDetector.ts`

**Side-Effects:** None. This is a pure function. No DB calls, network requests, event emissions, or external state mutations.

---

#### 1. ENTER: Function Invocation
*   **Data:** `command` (Type: `string`, e.g., `"sudo rm -rf /"`) and `context` (Type: `string | undefined`, e.g., `"file-delete"`).
*   **Source:** External caller (likely an MCP tool handler or API route evaluating a user's command before execution).

#### 2. TRANSFORMATION: Critical Pattern Evaluation
*   **Action:** The `command` string is tested against the 5 regex patterns in the `CRITICAL_PATTERNS` array (e.g., `/rm\s+-rf?\s+[\/~]/i`, `/dd\s+if=/i`).
*   **Logic:** `CRITICAL_PATTERNS.some(p => p.test(command))`
*   **Branch:** If a match is found, flow jumps to **Exit A**. Otherwise, continues to Step 3.

#### 3. TRANSFORMATION: High Pattern Evaluation
*   **Action:** The `command` string is tested against the 7 regex patterns in the `HIGH_PATTERNS` array (e.g., `/sudo\s+/i`, `/chmod\s+777/i`).
*   **Logic:** `HIGH_PATTERNS.some(p => p.test(command))`
*   **Branch:** If a match is found, flow jumps to **Exit B**. Otherwise, continues to Step 4.

#### 4. TRANSFORMATION: Medium Pattern Evaluation
*   **Action:** The `command` string is tested against the 7 regex patterns in the `MEDIUM_PATTERNS` array (e.g., `/npm\s+install/i`, `/rm\s+\S+/i`).
*   **Logic:** `MEDIUM_PATTERNS.some(p => p.test(command))`
*   **Branch:** If a match is found, flow jumps to **Exit C**. Otherwise, continues to Step 5.

#### 5. TRANSFORMATION: Context String Evaluation
*   **Action:** Evaluates if the optional `context` parameter strictly equals `"file-delete"`.
*   **Logic:** `context === "file-delete"`
*   **Branch:** If true, flow jumps to **Exit D**. Otherwise, continues to Step 6.

#### 6. TRANSFORMATION: Default Low Risk Assignment
*   **Action:** If the command matched no patterns and the context is not "file-delete", the default state is generated.
*   **Branch:** Proceeds to **Exit E**.

---

#### EXITS (Shape: `RiskAssessment` object -> Destination: Caller)

*   **Exit A (from Step 2):** Returns `{ riskLevel: "critical", reason: "คำสั่งนี้อาจทำลายข้อมูลสำคัญหรือระบบไฟล์", requiresApproval: true }`
*   **Exit B (from Step 3):** Returns `{ riskLevel: "high", reason: "คำสั่งนี้มีความเสี่ยงสูง — อาจลบหรือแก้ไขข้อมูลสำคัญ", requiresApproval: true }`
*   **Exit C (from Step 4):** Returns `{ riskLevel: "medium", reason: "คำสั่งนี้แก้ไขไฟล์หรือ install package", requiresApproval: true }`
*   **Exit D (from Step 5):** Returns `{ riskLevel: "medium", reason: "การลบไฟล์ไม่สามารถย้อนกลับได้", requiresApproval: true }`
*   **Exit E (from Step 6):** Returns `{ riskLevel: "low", reason: "", requiresApproval: false }`

---

## DAT-025 — trace — `innomcp-node/src/services/shellTool.ts` [deepseek/deepseek-v4-pro]
Here is a concrete, ordered trace of the data flow through the `shellTool.ts` module, focusing on its main entry points (`executeShell` and `streamShell`). Each step is described with its input shape, transformation, output shape, and any side effects.

---

### **Module Overview**
The module exposes two async functions that receive a shell command and configuration, apply safety gates, execute the command, and return a result. The primary side effect is an audit log entry in the database (via `withDbConnection`); both functions can create a working directory if missing.

---

## **Trace for `executeShell(command, opts)`**

### **Inputs (enter the function)**
| Name | Type / Shape | Source |
|------|--------------|--------|
| `command` | `string` (e.g., `"ls -la"`) | Caller (MCP tool, API, etc.) |
| `opts` | `ShellExecOptions` object | Caller |

**`ShellExecOptions` shape (all optional except `workspaceRoot`):**
```ts
{
  workspaceRoot: string;          // required
  workingDir?: string; 
  timeoutMs?: number;             // default 10k, capped at 30k
  taskId?: string;
  sessionId?: string;
  userId?: number | null;
  strictMode?: boolean;           // default true
  skipAudit?: boolean;            // default false
}
```

---

### **Step‑by‑step data flow**

1. **Record start time**  
   `start = Date.now()` → used for duration calculation.

2. **Clamp timeout**  
   `timeoutMs = Math.min(opts.timeoutMs ?? 10_000, 30_000)`  
   *Transforms* raw timeout into a safe, bounded value.

3. **Extract bare command name**  
   `cmdName = extractCommandName(command)`  
   - Input: raw `command` string  
   - Transformation: trim → split on whitespace → take first token → lowercase → strip leading path (e.g., `/usr/bin/git` → `git`)  
   - Output: `cmdName` (e.g., `"git"`)

4. **Blocklist check**  
   If `COMMAND_BLOCKLIST.has(cmdName)` → call `mkBlocked(...)`  
   - `mkBlocked` builds a `ShellResult` with `exitCode: -1`, `blocked: true`, `blockReason`, `riskLevel: "critical"`, `durationMs` computed from `start`  
   - **Side effect:** None.  
   - **Exit:** Function returns this blocked result immediately (steps 5‑15 skipped).

5. **Risk assessment**  
   `risk = assessRisk(command)`  
   - Input: raw `command` string  
   - External call to `riskDetector` module  
   - Returns `{ riskLevel, reason, requiresApproval }`  
   - `riskLevel`: `"low" | "medium" | "high" | "critical"`  
   - `requiresApproval`: boolean (true for high/critical when approval gate is configured)

6. **Determine strict mode**  
   `strict = opts.strictMode !== false` → boolean. Default is `true`.

7. **Strict + allowlist + risk gate**  
   `if (strict && !COMMAND_ALLOWLIST.has(cmdName))` and `risk.riskLevel` is `"high"` or `"critical"` → block via `mkBlocked`, using the `risk.reason`.  
   - **Exit:** Returns blocked result if conditions met.

8. **Approval gate**  
   `if (risk.requiresApproval && (risk.riskLevel === "high" || risk.riskLevel === "critical"))` → block via `mkBlocked`.  
   - **Exit:** Returns blocked result if conditions met.

9. **Workspace containment check**  
   - Normalise workspace root: `normRoot = normalisePath(opts.workspaceRoot)` → absolute, lowercased.  
   - Resolve working directory:  
     - If `opts.workingDir` absolute → use it  
     - If relative → `path.resolve(opts.workspaceRoot, opts.workingDir)`  
     - Else → `opts.workspaceRoot`  
   - Normalise working directory: `normWd = normalisePath(rawWd)`  
   - Verify prefix: `if (!normWd.startsWith(normRoot))` → block with reason `"Working directory outside workspace"`, riskLevel `"high"`.  
   - **Exit:** Returns blocked result if containment fails.

10. **Execute the command**  
    `result = await runCommand(command, normWd, timeoutMs, risk.riskLevel, start)`  
    Inside `runCommand`:  
    - **Ensure working directory exists** (side effect on filesystem):  
      `try { if (!fs.existsSync(cwd)) fs.mkdirSync(cwd, { recursive: true }); } catch {}`  
      This may create the 