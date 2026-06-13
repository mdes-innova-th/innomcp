_27 findings consolidated, 2 missing._

# TRIAGE — mega-fuzz

> fuzz lens (provider=0): Design PROPERTY-BASED / FUZZ test cases for this module: enumerate input invaria

> Generated for mother-Sonnet review. provider=0 deliverables.


---

## FUZ-001 — fuzz — `innomcp-node/src/agents/conductor.ts` [deepseek/deepseek-v4-pro]
- **Property:** `run()` never throws an unhandled exception and always returns a `RunResult` or emits at least one fallback event.  
  **Fuzz Input:** `ConductorOptions` with `message` as a 10 MB string, `history` containing `null` entries, `userTier` set to an unexpected value (e.g., `"superadmin"`), `capabilityLevel` as `-999`, and `thinkingMode` an array.  
  **Expected Invariant:** The call completes without propagating an exception. Either a `RunResult` is returned (even if `finalText` is empty) or the `emit` callback receives a `fallback` event. No uncaught `TypeError`, `ReferenceError`, or assertion failures occur.

- **Property:** Returned `RunResult.runId` and `RunResult.messageId` are always valid UUIDs.  
  **Fuzz Input:** All options fields set to empty strings (`""`), `null`, or omitted; sessionId=`""`, clientMessageId=`""`.  
  **Expected Invariant:** `result.runId` and `result.messageId` are non‑empty strings matching the UUID v4 pattern (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`), regardless of the supplied (or missing) IDs.

- **Property:** Every event emitted by the orchestrator has the same `runId` and `messageId` as the final `RunResult`.  
  **Fuzz Input:** A normal query `"plan my trip"` with `preferredMode="fast"`. All emitted events are captured in an array.  
  **Expected Invariant:** For every captured `AgentEvent`, `ev.runId === result.runId` and `ev.messageId === result.messageId`. No orphan or mismatched IDs exist.

- **Property:** All events emitted pass the public-safety gate or a clean `fallback` event is emitted instead; no event leaks raw private tokens or internal reasoning.  
  **Fuzz Input:**
  ```json
  {
    "message": "secret: token=sk-12345678",
    "history": [{ "sender": "ai", "text": "internal reasoning: user is suspicious" }],
    "toolHint": "internal deployment password: xyz"
  }
  ```
  **Expected Invariant:** For each `emit` call, either the event passes `checkAgentEventSafe` (with appropriate `expectedToolUsage`) or a `fallback` event with `fallbackReason` is emitted. No event contains the strings `"secret"`, `"internal"`, `"token=sk-..."`, or `"password"` in its `publicSummary`.

- **Property:** `finalText` is always a string (possibly empty) and never `undefined` or `null`.  
  **Fuzz Input:** `message = ""` (empty), `message = "   "` (whitespace only), `message = null` (if type-cast at runtime), and `message` containing only emoji `"🙂"`.  
  **Expected Invariant:** `typeof result.finalText === "string"`. Even intents that return an empty `""` string (e.g., `system-inventory`, `code`) still produce a string.

- **Property:** The orchestrator emits at least one event for a well-formed request and never silently swallows the entire run.  
  **Fuzz Input:** `message = "hello"`, all other options default.  
  **Expected Invariant:** The `emit` callback is invoked at least once (e.g., with an `agent_started` or `fact_found` event). The `events` count in the `RunResult` is ≥ 1.

- **Property:** `normalizeResponseMode` always returns `"thinking"` or `"normal"`.  
  **Fuzz Input:** All combinations: `thinkingMode = true` + `responseMode = undefined`; `thinkingMode = false` + `responseMode = "thinking"`; `thinkingMode = true` + `responseMode = "normal"`; `thinkingMode = undefined` + `responseMode = undefined`; `thinkingMode = null` + `responseMode = "normal"`; `thinkingMode = "yes"` + `responseMode = 123`.  
  **Expected Invariant:** The returned value is strictly `"thinking"` when `thinkingMode === true` or `responseMode === "thinking"`, otherwise `"normal"`. Any truthy/falsy coercion does not change the binary outcome.

- **Property:** `composeGreetingAnswer` returns only one of the three predefined Thai greetings and never includes any injected content.  
  **Fuzz Input:** Call the function directly (no user input reaches its template).  
  **Expected Invariant:** The returned string exactly matches `"สวัสดีครับ มีอะไรให้ช่วยไหม?"`, `"สวัสดีครับ วันนี้ต้องการทราบอะไรเป็นพิเศษ?"`, or 

---

## FUZ-002 — fuzz — `innomcp-node/src/agents/eventGuard.ts` [Qwen/Qwen3.7-Max]
- **Property**: Shape validation short-circuits string scanning
  - **Fuzz Input**: `AgentEvent` missing required fields (e.g., `type`, `runId`) to fail `validateAgentEvent`, but containing `privateThought: "secret"` and `publicSummary: "Weather Map Placeholder"`.
  - **Expected Invariant**: Returns `ok: false` with `shapeError` populated. `forbiddenKey` and `forbiddenSubstring` must be strictly `undefined` (no further scanning occurs).

- **Property**: Forbidden key detection is case-insensitive and nesting-agnostic
  - **Fuzz Input**: Valid `AgentEvent` with deeply nested objects/arrays containing keys like `"PrIvAtEtHoUgHt"`, `"SECRET"`, and `"apikey"`.
  - **Expected Invariant**: Returns `ok: false`. `forbiddenKey` matches the canonical casing from `FORBIDDEN_KEY_NAMES` (e.g., `privateThought`, `secret`, `apiKey`).

- **Property**: Forbidden key scanner ignores values and unquoted substrings
  - **Fuzz Input**: Valid `AgentEvent` where `publicSummary` is `"My password is a secret chainOfThought"` and `deltaText` is `"The apiKey is hidden"`.
  - **Expected Invariant**: Returns `ok: true`. Forbidden words appearing strictly as string values, not as serialized JSON keys (`"key":`), must not trigger the key guard.

- **Property**: JSON `undefined` stripping bypasses key detection; `null` does not
  - **Fuzz Input**: Valid `AgentEvent` with `privateThought: undefined` vs `privateThought: null`.
  - **Expected Invariant**: `undefined` yields `ok: true` (key stripped by `JSON.stringify`). `null` yields `ok: false, forbiddenKey: 'privateThought'` (serializes to `"privatethought":null`).

- **Property**: Exact visible literal matching is strict and case-sensitive
  - **Fuzz Input**: `finalText` containing `"weather map placeholder"` (lowercase) vs `"Weather Map Placeholder"` (exact). Also test Thai string `"ข้อมูลไม่ครบสำหรับการแสดงแผนที่"` vs `"ข้อมูลไม่ครบ"`.
  - **Expected Invariant**: Lowercase English and partial Thai yield `ok: true`. Exact English and exact Thai yield `ok: false`, with `forbiddenSubstring` equaling the exact literal.

- **Property**: "Placeholder" word boundary regex prevents false positives
  - **Fuzz Input**: `deltaText` containing `"placeholders"`, `"ngoutplaceholder"`, and `"place-holder"` vs `"placeholder"` and `"placeholder."`.
  - **Expected Invariant**: `"placeholders"`, `"ngoutplaceholder"`, and `"place-holder"` yield `ok: true`. `"placeholder"` and `"placeholder."` yield `ok: false, forbiddenSubstring: 'placeholder'`.

- **Property**: `allowMapTerms` overrides "placeholder" word check but NOT exact literals
  - **Fuzz Input**: `deltaText` = `"This is a placeholder. Weather Map Placeholder"`, with `opts.allowMapTerms = true`.
  - **Expected Invariant**: Returns `ok: false, forbiddenSubstring: 'Weather Map Placeholder'`. The standalone word "placeholder" is ignored, but the exact literal still blocks.

- **Property**: "Used tools: none" regex handles flexible whitespace and respects `expectedToolUsage`
  - **Fuzz Input**: `publicSummary` = `"Used tools: \n none"` (with newline/spaces). Tested with `opts.expectedToolUsage = false` and `opts.expectedToolUsage = true`.
  - **Expected Invariant**: `expectedToolUsage: false` yields `ok: true`. `expectedToolUsage: true` yields `ok: false, forbiddenSubstring: 'Used tools: none'`.

- **Property**: Visible text scanning strictly isolates target fields
  - **Fuzz Input**: Valid `AgentEvent` where `publicSummary`, `deltaText`, `finalText`, and `fallbackReason` are clean, but a non-standard/custom field (e.g., `internalDebug: "Weather Map Placeholder"`) contains forbidden text.
  - **Expected Invariant**: Returns `ok: true`. The visible substring scanner must only evaluate the four explicitly defined visible fields.

- **Property**: `checkVisibleTextSafe` is strictly equivalent to `checkAgentEventSafe` for text violations
  - **Fuzz Input**: Randomly generated strings containing mixed forbidden literals, "placeholder", and "Used tools: none", passed to both func

---

## FUZ-003 — fuzz — `innomcp-node/src/agents/events.ts` [moonshotai/Kimi-K2.6]
The user wants property-based / fuzz test cases for the provided TypeScript module (`agents/events.ts`). I need to:

1. Enumerate input invariants and properties that must always hold.
2. Identify adversarial/malformed/boundary inputs that could break them.
3. Output a markdown list in the format: property → fuzz input → expected invariant.
4. Keep it concrete, no filler.

The module contains:
- Types: `AgentEventType`, `AgentId`, `AgentEvent`
- Constants: `AGENT_ROLE_LABEL_TH`, `SCHEMA_VERSION`, `PUBLIC_SUMMARY_MAX`
- Functions: `validateAgentEvent(ev: unknown)`, `newEnvelope(opts)`

Key areas to test:
1. `validateAgentEvent` function - this is the main validation logic.
2. `newEnvelope` function - envelope construction.
3. Type constraints (AgentEventType, AgentId).
4. Boundary conditions (PUBLIC_SUMMARY_MAX, confidence 0..1, required fields).
5. Type-specific required fields (draft_delta needs deltaText, final_answer needs finalText, etc.).
6. `isSafeForUser` must be literal `true`.
7. `AGENT_ROLE_LABEL_TH` mapping completeness.

Let me think about invariants and fuzz inputs:

**Invariants for validateAgentEvent:**
- Must reject non-objects (null, undefined, primitives, arrays).
- Must reject missing/empty required string fields: type, runId, messageId, publicSummary, timestamp.
- Must reject unknown event types.
- Must reject `isSafeForUser` !== true (including `false`, `"true"`, `1`, etc.).
- Must reject `publicSummary` > 240 chars.
- Must reject `confidence` outside [0,1] or non-number.
- Must reject `sourceIds` if not string array (including mixed arrays, non-arrays).
- Type-specific:
  - `draft_delta`: requires `deltaText` string. Missing or wrong type should fail.
  - `final_answer`: requires `finalText` string.
  - `tool_call_started`/`tool_call_finished`: requires non-empty `toolName` string.
  - `fallback`: requires `fallbackReason` string.
- Must accept valid minimal events.
- Must accept valid events with optional fields.
- Must accept boundary values: confidence=0, confidence=1, publicSummary=240 chars, empty sourceIds array.

**Invariants for newEnvelope:**
- Must return object with all required base fields.
- `isSafeForUser` must be literal `true`.
- `timestamp` must be valid ISO string (or at least present).
- `role` must match `AGENT_ROLE_LABEL_TH` when `agentId` provided.
- `role` must be undefined when `agentId` omitted.
- Must not include extra undefined fields cluttering? Actually TypeScript will include undefined for optional fields if set. But the function only sets specific fields.
- Must handle all valid `AgentId` values.
- Must reject invalid `AgentId` at compile time (but runtime fuzzing with ts-ignore or cast could test behavior - it would produce `undefined` role if agentId not in map).

**Invariants for AGENT_ROLE_LABEL_TH:**
- Every `AgentId` enum value has a key in the record.
- Values are non-empty strings.

**Schema/Type invariants:**
- `AgentEventType` union and `allowedTypes` array in validator must stay in sync.
- `AgentId` union and `AGENT_ROLE_LABEL_TH` keys must stay in sync.

Let me structure the markdown list. The user wants: property → fuzz input → expected invariant.

I should organize by the property/invariant being tested, then the fuzz input, then the expected result.

Let me draft concrete entries:

1. **validateAgentEvent rejects non-objects**
   - Fuzz: `null`, `undefined`, `42`, `"string"`, `true`, `Symbol('x')`, `[]` (array), `() => {}`
   - Invariant: returns `"event is not an object"` for all non-object inputs.

2. **validateAgentEvent rejects missing or empty required string fields**
   - Fuzz: `{}`, `{type:''}`, `{type:'agent_delta', runId:'', messageId:'m', publicSummary:'s', timestamp:'t'}`, `{type:'agent_delta', runId:'r', messageId:'', publicSummary:'s', timestamp:'t'}`, etc. Also missing keys entirely.
   - Invariant: returns string starting with `"missing or empty required string field: ..."`

3. **validateAgentEvent rejects unknown event types**
   - Fuzz: `{type

---

## FUZ-004 — fuzz — `innomcp-node/src/agents/motherDispatch.ts` [zai-org/GLM-5.1]
- Provider Eligibility Filtering → `MDES_ONLY=1` env var set, registry contains `openai-gpt` and `mdes-cloud` → Invariant: `results` array contains zero entries for `openai-gpt`; `totalAgents` equals count of eligible MDES providers only.
- Key-Free Provider Bypass → Provider config with `id="ollama-local"`, `kind="ollama"`, and `apiKey=""` → Invariant: Provider passes `isProviderConfigEligible` and is dispatched (empty key allowed for `KEY_FREE_PROVIDER_IDS`).
- Whitespace API Key Rejection → Provider config with `id="openai-gpt"`, `kind="openai"`, and `apiKey="   \t "` → Invariant: Provider fails `isProviderConfigEligible` (trim check) and is skipped without a network call.
- Synthesis Longest Success Selection → Provider A returns `text="short"`, Provider B returns `text="a much longer response text"`, Provider C returns `success=false` → Invariant: `synthesis` equals `"a much longer response text"`.
- Synthesis Fallback on Empty → Provider A returns `text=""`, Provider B returns `text="valid"`, Provider C returns `text=null` → Invariant: `synthesis` equals `"valid"` (first non-empty successful response).
- Cost Summation Integrity → 3 providers return `estimatedCostUsd` of `0.0015`, `0.00025`, and `0.000` → Invariant: `totalEstimatedCostUsd` strictly equals `0.00175` (sum of all non-skipped provider costs).
- Cost Non-Negativity → Provider returns malformed negative token count causing negative cost calculation → Invariant: `totalEstimatedCostUsd` >= 0 and individual `estimatedCostUsd` >= 0.
- Oracle Auth Token Invalidation → Oracle endpoint returns HTTP 401/403 → Invariant: `_oracleToken` is set to `null`; `callInnovaOracle` throws Error; subsequent call attempts fresh re-authentication.
- Oracle Token Caching → Valid token fetched with `expiresAt` 23 hours in the future, second call issued immediately → Invariant: Exactly 1 HTTP POST to `/api/auth/token`; second call uses cached token without network request.
- Malformed Oracle JSON Response → Oracle `/api/oracle/consult` returns `{ "context": null, "result": undefined, "text": 123 }` → Invariant: Returns stringified JSON fallback `JSON.stringify(data).slice(0, 800)`.
- Timeout Enforcement → Provider endpoint delayed by 30,000ms → Invariant: Provider result has `success: false`, `latencyMs` <= 20,500ms (respects `MOTHER_TIMEOUT_MS`), `errorMsg` indicates abort/timeout.
- Intent-Based Critic Selection → Intent string `"code"` vs `"weather"` → Invariant: `selectCriticConfig` for "code" requests `["code", "grounding-critic"]` capabilities; "weather" requests `["grounding-critic", "hard-reasoning"]`.
- Iteration Monotonicity → 10 concurrent `dispatchMother` invocations → Invariant: `motherIteration` increments exactly 10 times; no duplicate iteration values.
- Oracle Query Truncation → Prompt string of length 10,000 characters → Invariant: `callInnovaOracle` sends `query: prompt.slice(0, 500)` to the API; payload never exceeds 500 chars.
- Disabled Provider Skipping → `isProviderEnabled(cfg.id)` returns `false` for `mdes-cloud` → Invariant: Provider is excluded from `results` and `totalAgents` count regardless of valid API key.
- Empty Registry Fan-Out → `listProviders()` returns `[]` → Invariant: `MotherDispatchResult` returns `{ results: [], synthesis: "", totalAgents: 0, successCount: 0, totalEstimatedCostUsd: 0 }`.

---

## FUZ-005 — fuzz — `innomcp-node/src/agents/orchestrator.ts` [deepseek/deepseek-v4-pro]
- **Property: Task creation always yields a valid AgentTask object with default fields**  
  - Fuzz Input: `createTask(description=fuzz.string(), priority=fuzz.string())` where `priority` can be any string (including invalid enum values)  
  - Expected Invariant: Returned object contains `id` matching regex `^task-\d+-[a-z0-9]{6}$`, `description` equals input description, `priority` equals input priority (verbatim), `status === "pending"`, `cycle` is `[]`, `brain1Result`/`brain2Result`/`coordinatorAction` are `undefined`, and `activeTasks` map includes the task by its id.

- **Property: Task id is unique per creation**  
  - Fuzz Input: Create 1000 tasks in rapid succession with random descriptions and priorities  
  - Expected Invariant: All generated task IDs are distinct; no duplicates.

- **Property: executeCycle processes a pending task successfully through all phases when all providers succeed**  
  - Fuzz Input: Mocked `selectProvider` and `fetch` return valid, non-empty JSON responses with `response: fuzz.string()`; call `executeCycle(taskId)` on a task with `status: "pending"` and arbitrary description.  
  - Expected Invariant: Task `status` becomes `"completed"`, `cycle` has length 4, phases are `"analyze"`, `"summarize"`, `"coordinate"`, `"memory"` in sequence, `cycle[0..2].result` lengths ≤ 500, `task.brain1Result`/`task.brain2Result`/`task.coordinatorAction` are set to the full mock responses (except coordinator which may be trimmed).

- **Property: executeCycle sets failed status if brain-1 call fails**  
  - Fuzz Input: Mock `callBrain` throws an `Error` for `brain-1` (e.g., no provider, network error). Call `executeCycle` on a valid task.  
  - Expected Invariant: Task `status === "failed"`, `cycle` contains exactly one error entry with `actor: "coordinator"`, `phase: "coordinate"`, and `result` includes the error message. `brain1Result`/`brain2Result` unchanged (or `brain1Result` not set because it failed before assignment). No memory phase added.

- **Property: executeCycle sets failed status if brain-2 call fails**  
  - Fuzz Input: Brain-1 succeeds, but brain-2 call throws.  
  - Expected Invariant: Task `status === "failed"`, task has `brain1Result` set from the successful Brain-1, `brain2Result` remains `undefined` (or previous value), `cycle` shows analyze phase succeeded, then an error phase with `actor: "coordinator"`. No summarize phase recorded. Coordinator phase result contains error message.

- **Property: executeCycle sets failed status if memory save throws**  
  - Fuzz Input: Mock `saveToMemory` to throw (e.g., disk full, permission), all brain calls succeed.  
  - Expected Invariant: Task `status === "failed"`, `cycle` includes analyze, summarize, coordinate phases (success), then the catch block adds a coordinate error entry (with the memory error). Even though coordinator action succeeded, the cycle may have a duplicate coordinate phase? Code: after `saveToMemory` throws, catch adds a push to `cycle` with `phase: "coordinate"` and the error message. So total cycles = 4 (analyze, summarize, original coordinate, then error coordinate). Expect invariant: last cycle entry is the error entry with phase "coordinate" and actor "coordinator", task status "failed".

- **Property: executeCycle throws if task ID does not exist**  
  - Fuzz Input: Call `executeCycle(taskId="nonexistent")` with any non-existent id (empty string, special characters, very long id).  
  - Expected Invariant: Throws `Error` with message containing the task id. No modification to `activeTasks`.

- **Property: callBrain returns empty string when Ollama response has no "response" field**  
  - Fuzz Input: Mock fetch to return `{ }` (no response key) with HTTP 200; call `callBrain("brain-1", fuzz.string())`.  
  - Expected Invariant: Returns `""` without throwing. Works for both brain roles.

- **Property: coordinate returns fallback SKIP string if provider is null**  
  - Fuzz Input: Mock `selectProvider` to return `{ provider:

---

## FUZ-006 — fuzz — `innomcp-node/src/agents/parallelDispatch.ts` [deepseek/deepseek-v4-flash]
```markdown
- **Property:** `agentPlan` always returns at least 2 agents for any known intent.
  - **Fuzz input:** `agentPlan({ intent: "weather", query: "" })` (0 tokens)
  - **Expected invariant:** `returnedArray.length >= 2`

- **Property:** For greeting/datetime/weather/general/knowledge/geo/calc with query ≤ 25 tokens, exactly 2 agents are returned.
  - **Fuzz input:** `agentPlan({ intent: "greeting", query: "Hi" })` (1 token)
  - **Expected invariant:** `returnedArray.length === 2`

- **Property:** For greeting/datetime/weather/general/knowledge/geo/calc with query between 26 and 50 tokens, exactly 3 agents are returned.
  - **Fuzz input:** `agentPlan({ intent: "knowledge", query: "Explain the difference between quantum mechanics and classical physics in three paragraphs." })` (estimated 45 tokens)
  - **Expected invariant:** `returnedArray.length === 3`

- **Property:** For general/knowledge with query > 50 tokens, exactly 4 agents are returned.
  - **Fuzz input:** `agentPlan({ intent: "general", query: "A ".repeat(100) })` (200 tokens)
  - **Expected invariant:** `returnedArray.length === 4`

- **Property:** For `planning-broad` intent, exactly 6 agents are always returned regardless of query length.
  - **Fuzz input:** `agentPlan({ intent: "planning-broad", query: "Short" })`
  - **Expected invariant:** `returnedArray.length === 6`

- **Property:** For `code` intent, exactly 8 agents are always returned.
  - **Fuzz input:** `agentPlan({ intent: "code", query: "Write a sorting function in Rust" })`
  - **Expected invariant:** `returnedArray.length === 8`

- **Property:** For unknown intent string, `agentPlan` returns at least 2 agents (likely defaults to "general").
  - **Fuzz input:** `agentPlan({ intent: "nonexistent-intent-12345", query: "Hello" })`
  - **Expected invariant:** `returnedArray.length >= 2 && returnedArray.every(item => item.agentId !== "")`

- **Property:** All returned agents have distinct `agentId`s.
  - **Fuzz input:** `agentPlan({ intent: "evidence", query: "Check this claim." })`
  - **Expected invariant:** `new Set(returnedArray.map(a => a.agentId)).size === returnedArray.length`

- **Property:** Every `AgentPlanItem` has positive `timeoutMs` and non-empty `url`, `key`, `model`.
  - **Fuzz input:** `agentPlan({ intent: "calc", query: "2+2"})`
  - **Expected invariant:** `returnedArray.every(item => item.timeoutMs > 0 && item.url !== "" && item.model !== "")`

- **Property:** When `runMode` is "thinking", timeouts are double the normal value for the model.
  - **Fuzz input:** `agentPlan({ intent: "geo", query: "Map of Bangkok", runMode: "thinking" })`
  - **Expected invariant:** `returnedArray.every(item => item.timeoutMs >= (MODEL_TIMEOUT_MS[item.model] || DEFAULT_TIMEOUT_MS) * 2)`

- **Property:** When `remoteAvailable` is false, all endpoints have kind `local`.
  - **Fuzz input:** `agentPlan({ intent: "knowledge", query: "What is AI?", remoteAvailable: false })`
  - **Expected invariant:** `returnedArray.every(item => item.kind === "local")`

- **Property:** Thai language query with `THAI_LLM_MODEL` set overrides model for `rag-agent` and `linguist`.
  - **Fuzz input:** `process.env.THAI_LLM_MODEL = "openthaigpt:7b"; agentPlan({ intent: "knowledge", query: "สวัสดีครับ" })`
  - **Expected invariant:** `returnedArray.find(a => a.agentId === "rag-agent")?.model === "openthaigpt:7b"`

- **Property:** When `PARALLEL_AGENTS` env is `"0"`, the dispatch returns empty array (skip mode).
  - **Fuzz input:** `process.env.PARALLEL_AGENTS = "0"; agentPlan({ intent: "weather", query: "Rain?" })`
  - **Expected invariant:** `returnedArray.length === 0`

- **Property:** `history` array with missing `text` field is handled gracefully (does not throw).
  - **Fuzz input:** `agentPlan({ intent: "general", query: "Hello", history: [{ sender: "user", text: undefined }] })`
  - **Expected invariant:** Does not throw TypeError; returns valid array.

- **Property:** `preferredMode` is non‑mandatory and any string valu

---

## FUZ-007 — fuzz — `innomcp-node/src/agents/toolDispatch.ts` [Qwen/Qwen3.7-Max]
- **Math Expression Safety** → `"คำนวณ บวก ลบ คูณ หาร ยกกำลัง เปอร์เซ็นต์"` (no digits) → Output contains no Thai math keywords; returns empty string or original stripped text; never throws.
- **Math Expression Average Fallback** → `"ค่าเฉลี่ย ของ a b c"` (no digits with 'average') �� Output does not contain `mean([])`; returns original stripped text.
- **Math Expression Thousand Separators** → `"1,000,000 + 2,000"` → Commas acting as thousand separators are removed; output is strictly `"1000000 + 2000"`.
- **Regex Catastrophic Backtracking (ReDoS)** → `"(" * 5000 + ")" * 5000` or `"a" + " ".repeat(10000) + "b"` → Execution completes in < 50ms; no ReDoS exception thrown.
- **Hourly Weather Fallback** → `"อากาศตอนนี้ดีไหม"` (current weather without 'hour' keyword) → `needsHourlyWeather` returns `false`; `planToolCall` routes to `nwp_daily_by_place`.
- **Hourly Weather Trigger** → `"อากาศรายชั่วโมงวันนี้"` → `needsHourlyWeather` returns `true`; `planToolCall` routes to `nwp_hourly_by_place` with `duration: 24`.
- **Evidence Action Default** → `"สวัสดีครับ"` (no evidence keywords) → `inferEvidenceAction` strictly returns `"officer_summary"`.
- **Evidence Action Priority** → `"machine offline yesterday"` (conflicting keywords) → `inferEvidenceAction` returns `"active_machines_offline_count"` (first regex match wins).
- **ISP Filter Case & Boundary** → `"AIS DtAc TRUE tot 3bb NT"` → `extractIspFilter` returns the first matched ISP strictly in lowercase (e.g., `"ais"`).
- **ISP Filter Invalid** → `"cat dog mouse"` → `extractIspFilter` strictly returns `undefined`.
- **Data Payload Fenced CSV** → ```` ```csv\na,b\n1,2\n``` ```` → `dataFormat` is `"csv"`, `dataPayload` is `"a,b\n1,2"`, `questionText` is empty.
- **Data Payload Fenced JSON Hint (Malformed)** → ```` ```json\nnot valid json\n``` ```` → `dataFormat` is `"json"`, `dataPayload` is `"not valid json"` (does not throw on invalid JSON inside fences).
- **Data Payload Bare JSON Invalid** → `"[{a:1}] what is this"` (invalid JSON syntax) → Falls back to empty `dataPayload`, `dataFormat` is `"csv"`, `questionText` is the full original string.
- **Data Payload Bare JSON Valid** → `'[{"a":1}] calculate sum'` → `dataFormat` is `"json"`, `dataPayload` is `'[{"a":1}]'`, `questionText` is `"calculate sum"`.
- **Data Payload Unclosed Fence** → ```` ```csv\ndata ```` (no closing backticks) → `dataPayload` is empty, treats entire string as `questionText`.
- **Evidence Signal Machine Alone** → `"machine"` or `"url"` (isolated keywords) → `hasEvidenceSignal` strictly returns `false`.
- **Evidence Signal Machine Context** → `"machine offline"` or `"url detect"` → `hasEvidenceSignal` strictly returns `true`.
- **Plan Tool Call Null Intent** → `intent: "chitchat"`, `query: "hello"` → `planToolCall` strictly returns `null`.
- **Plan Tool Call Weather Default Province** → `intent: "weather"`, `query: "อากาศเป็นอย่างไร"` (no province mentioned) → `args.province` strictly defaults to `"กรุงเทพมหานคร"`.
- **Plan Tool Call Map Fallback** → `intent: "map"`, `query: "where is this"` (no province extracted) → `args.query` strictly falls back to the full trimmed query string.
- **Plan Tool Call Structural Invariant** → Any valid `intent` and arbitrary `query` string (including empty/null chars) → If return is not `null`, object strictly contains `toolName` (non-empty string), `args` (non-null object), `reason` (string), `authoritative` (boolean).

---

## FUZ-008 — fuzz — `innomcp-node/src/services/coldRetriever.ts` [moonshotai/Kimi-K2.6]
The user wants property-based / fuzz test cases for the `ColdRetriever` module. I need to enumerate input invariants and properties that must always hold, then adversarial/malformed/boundary inputs that could break them. Output format: markdown list with property → fuzz input → expected invariant. Concrete, no filler.

Let me analyze the code carefully to identify invariants, properties, and potential failure modes.

Key components:
1. `chunkText(text, docId)` - chunks text into ColdChunk[]
2. `extractTitle(content, filePath)` - extracts title from markdown or filename
3. `extractTags(content, filePath)` - extracts tags from YAML frontmatter and path regexes
4. `inferDomain(tags, filePath)` - infers domain from tags
5. `tokenize(text)` - tokenizes text
6. `computeTFIDF(query, chunk, idfMap)` - computes TF-IDF score
7. `ColdRetriever.loadCorpus(corpusDir)` - loads corpus directory
8. `ColdRetriever.search(query, options)` - searches corpus

Let me identify invariants and properties:

**chunkText invariants:**
- Output chunks should cover all non-empty lines from input (no data loss for non-empty content)
- Each chunk's content should be a substring of the original text (trimmed)
- chunk.id should be `${docId}:chunk:${index}`
- chunk.documentId should equal docId
- chunk.index should be sequential starting from 0
- startLine <= endLine for all chunks
- Adjacent chunks should have overlapping content if buffer exceeded CHUNK_SIZE and overlap was applied
- If text is empty or only whitespace, returns empty array
- Total number of chunks >= 0
- For single line text shorter than CHUNK_SIZE, should produce exactly 1 chunk (if non-empty)

**extractTitle invariants:**
- Return value is always a non-empty string
- If content has `# Heading`, returns that heading text
- Otherwise returns basename without extension
- Should handle filePath being empty or having no extension

**extractTags invariants:**
- Always returns an array (possibly empty)
- Tags from frontmatter should be deduplicated with path-derived tags
- No duplicate tags in output (Set used)
- Should not crash on malformed frontmatter

**inferDomain invariants:**
- Returns one of specific strings: "weather", "evidence", "geo", "law", "process", "general"
- If tags contain a domain tag, returns that domain (priority order? weather first in code)
- If multiple domain tags exist, first checked in code wins (weather > evidence > geo > law > process)

**tokenize invariants:**
- Returns array of strings
- All tokens length > 1
- All tokens lowercase
- No tokens contain non-word/non-Thai characters (replaced with space)
- Empty string returns empty array
- String with only punctuation returns empty array

**computeTFIDF invariants:**
- Returns a finite number >= 0
- If query or chunk has no tokens, returns 0
- Score should be 0 if no query tokens appear in chunk
- Score increases with more matching tokens (monotonicity)
- Score is deterministic given same inputs

**loadCorpus invariants:**
- Returns docCount and chunkCount >= 0
- If corpusDir doesn't exist, returns {0,0} without throwing
- Only .md and .txt files are indexed
- Files with empty content are skipped
- node_modules and .git paths are skipped
- All document ids start with "cold:"
- All documents have chunks array (possibly empty? but empty content is skipped)
- fileSize matches actual file size
- updatedAt is valid ISO string
- initialized set to true after success
- Does not throw on unreadable files (catches error)

**search invariants:**
- Returns array of ColdRetrievalResult
- If not initialized or no docs, returns empty array
- maxResults limits output length (<= maxResults)
- Results sorted by score descending
- domainFilter filters to exact domain match
- score >= 0 in results
- confidence = min(0.95, score * 2)
- freshness computed from updatedAt
- source.type is always "document"
- source.id equals chunk.id
- source.name equals doc.title
- source.path equals doc.path
- source.timestamp equals doc.metadata.updated

---

## FUZ-009 — fuzz — `innomcp-node/src/services/contextManager.ts` [deepseek/deepseek-v4-pro]
```markdown
- **Property:** `countTokens` returns `Math.ceil(text.length / 4)` for any non‑negative length.  
  **Fuzz input:** `text = ''`, `text = 'a'`, `text = 'abcd'`, `text = 'abcde'`, `text` containing multi‑byte emojis (`'😀'`, length = 2).  
  **Expected invariant:** Output equals `Math.ceil(text.length / 4)`; e.g., `'' → 0`, `'a' → 1`, `'abcd' → 1`, `'abcde' → 2`, `'😀' → 1` (length 2 → ceil(2/4)=1).

- **Property:** `addMessage` creates session if it does not exist and appends the message.  
  **Fuzz input:** `sessionId = undefined`, `null`, `123` (number), empty string `""`; message with `role = 'user'`, `content = 'hello'`.  
  **Expected invariant:** After call, `contextManager.getContext(sessionId)` returns an array ending with the message (after trim). No exception thrown; session exists in internal map under coerced key.

- **Property:** `addMessage` does *not* enforce `maxMessagesPerSession` or `maxContentLength` (they are ignored).  
  **Fuzz input:** Repeatedly add messages with identical content until length > 100, then add a single message whose `content.length > 10000`.  
  **Expected invariant:** Session holds all messages regardless of limits; stats show `messageCount > 100` and `estimatedTokens` may exceed any cap.

- **Property:** `getContext` return value has total estimated tokens ≤ `maxTokens` **unless** the preserved first system message alone exceeds the limit.  
  **Fuzz input:** A session with first message `role: 'system'`, `content` of length `4 * (maxTokens + 1)` (so tokens > maxTokens), and `maxTokens = 100`.  
  **Expected invariant:** Returned array length = 1 (only system message) and `countTokens(content) > maxTokens`.  
  **Fuzz input:** Same but no system message, many messages total tokens > maxTokens.  
  **Expected invariant:** Returned array total tokens ≤ maxTokens; oldest non‑system messages are removed first.

- **Property:** `getContext` always preserves the very first message if its `role` is `'system'`.  
  **Fuzz input:** Session messages = `[system, user1, assistant1, user2, …]`, `maxTokens` small so many messages dropped.  
  **Expected invariant:** Returned array[0] is the original system message; its `content` unchanged.

- **Property:** `getContext` does not modify the original array stored in the session.  
  **Fuzz input:** Add several messages, call `getContext`, then call `getContext` again with same parameters.  
  **Expected invariant:** The internal session array length remains unchanged after `getContext`; subsequent `stats` show same `messageCount`.

- **Property:** `trim` returns empty array when input array is empty, regardless of `maxTokens`.  
  **Fuzz input:** `messages = []`, `maxTokens = 0`, `-1`, `NaN`, huge positive.  
  **Expected invariant:** Output is `[]`.

- **Property:** `trim` removes messages from the head of the non‑system portion while total tokens > maxTokens.  
  **Fuzz input:** `messages = [user1, user2, user3]`, each `content` of exact token count such that total=10, `maxTokens=6`.  
  **Expected invariant:** Returned array contains `user2, user3` (first removed). Order preserved.

- **Property:** `trim` never removes a message with `tokens` field pre‑computed; it relies solely on `countTokens(content)`.  
  **Fuzz input:** Provide a message with `tokens: 999999` but short `content`.  
  **Expected invariant:** The `tokens` field is ignored; removal decision based on `Math.ceil(content.length/4)`.

- **Property:** `summarize` returns a `system` message whose `content` starts with `'สรุปเนื้อหาการสนทนาก่อนหน้า:'` if any `user`/`assistant` messages exist.  
  **Fuzz input:** non‑empty array containing only system messages.  
  **Expected invariant:** Output content equals `'สรุป: ไม่มีเนื้อหาการสนทนา'`.  
  **Fuzz input:** array with user messages where `content.length > 80`.  
  **Expected invariant:** Each such message contributes its first 80 characters to the summary; the final string contains `\n` separated lines.

- **Property:** `cl

---

## FUZ-010 — fuzz — `innomcp-node/src/services/dataAnalysisTool.ts` [MiniMaxAI/MiniMax-M3]
```markdown
# Property-Based / Fuzz Test Cases — `dataAnalysisTool.ts`

## Parser Invariants

- **P1: Empty/whitespace-only input returns empty result** → fuzz: `""`, `"   "`, `"\n\n\n"`, `"\t\r\n"` → expected: `rowCount=0, colCount=0, columns=[], summary` non-throwing, no chart.
- **P2: Header count matches parsed column count** → fuzz: random N∈[1,30] headers + N-aligned then misaligned rows → expected: `colCount === columns.length === headers.length`; row cells may be short but never extend `columns`.
- **P3: `nullCount` = rows where that column index is missing/empty after trim** → fuzz: rows with `undefined`, `""`, `"   "`, short rows → expected: `nullCount === limitedRows.length - cellVals.length` per column.
- **P4: Type detection threshold (70% numeric)** → fuzz: column with ratios 0%, 69%, 70%, 71%, 100% numeric strings ("1","2","3",…,"x") → expected: type flips exactly at >70%; numeric column returns `min/max/mean/median/stdDev`; string column returns `topValues`.
- **P5: Numeric coercion rejects NaN but accepts sci notation/exponents/negatives** → fuzz: `"1e308"`, `"-0"`, `"NaN"`, `"Infinity"`, `"-Infinity"`, `"1e-500"` (→0), `"0.0"`, `"0001"` → expected: `NaN/Infinity` excluded from `numVals`; `count` reflects filtered; no NaN in returned stats.
- **P6: Median correctness for odd/even lengths** → fuzz: random integer arrays length 1,2,3,7,100,1000, identical-value arrays → expected: `min ≤ median ≤ max`; `min === max === mean === median === stdDev` for single-unique arrays; even-length median is average of two middles.
- **P7: `mean` and `stdDev` rounded to 3 decimals** → fuzz: values producing repeating decimals (`1/3`, `2/7`) → expected: `mean`, `stdDev` are integers with ≤3 decimal places (no `1.3333334`).
- **P8: `unique` matches `Set` cardinality** → fuzz: strings with unicode duplicates (`"café"` vs `"cafe\u0301"`), whitespace variants, case variants → expected: `unique` ≤ `count`; case-sensitive (no normalization).
- **P9: `topValues` length ≤ 5, sorted by count desc** → fuzz: columns with 0,1,2,10,1000 distinct strings → expected: `topValues.length = min(unique,5)`; counts monotonically non-increasing; tie-break stable.
- **P10: `rowCount` ≤ `maxRows` and ≤ input row count** → fuzz: `maxRows=0,1,5,100,10000`; CSV with 50k rows → expected: `rowCount === min(parsedRows, maxRows)`.

## CSV Parser Robustness

- **P11: Quoted commas preserved, unquoted commas split** → fuzz: `'a,b\n"x,y",2\n3,4'` → expected: 2 columns, row1=`["x,y","2"]`.
- **P12: Unbalanced quotes toggle inQ forever** → fuzz: `'"a,b,c\n2,3,4'` (odd quote count) → expected: must not throw; subsequent text treated as one cell — invariant: result is well-formed (arrays of strings).
- **P13: Embedded newlines inside quotes break row split** (known limitation) → fuzz: `'a,b\n"x\ny",2'` → expected: doesn't crash; downstream stats still defined, even if row count wrong.
- **P14: Trailing comma / empty trailing cell** → fuzz: `'a,b,c\n1,2,'`, `'a,b\n1,2,3,4'` → expected: no crash; `colCount` taken from header; missing trailing cell counts toward `nullCount`.
- **P15: CRLF / LF / CR line endings** → fuzz: mixed `\r\n`, `\n`, lone `\r` in same input → expected: identical row count vs LF-only equivalent.
- **P16: BOM at file start** → fuzz: `'\uFEFFa,b\n1,2'` → expected: must not include BOM in first header name (current impl likely fails — flag if header starts with `\uFEFF`).
- **P17: Header row with empty/duplicate header names** → fuzz: `",b,b\n1,2,3"` → expected: `columns[0].name === ""`; downstream `headers.indexOf(name)` returns first match (duplicate `b` → always first index).
- **P18: Non-string characters / control bytes** → fuzz: `'\x00a,b\n\x001,2'`, embedded `\x01-\x1f` → expected: does not throw `TypeError`; control bytes survive as cell content.
- **P19: Very long rows / cells** → fuzz: 1MB single cell, 100k column row → expected: completes; `topValues` values may be truncated only by `.slice(0,8)` in **chart label**, not in `topValues[].va

---

## FUZ-011 — fuzz — `innomcp-node/src/services/fastPathHandler.ts` [deepseek/deepseek-v4-flash]
- **Property**: trigToDeg appends " deg" after numeric argument inside trig functions → **Fuzz input**: `"sin(45)"` → **Expected invariant**: returns `"sin(45 deg)"`
- **Property**: trigToDeg handles negative decimal numbers → **Fuzz input**: `"cos(-3.14)"` → **Expected invariant**: returns `"cos(-3.14 deg)"`
- **Property**: trigToDeg does not modify arguments containing "deg", "rad", or "pi" → **Fuzz input**: `"tan(pi/4)"` → **Expected invariant**: returns `"tan(pi/4)"`
- **Property**: trigToDeg does not modify arguments with "deg" keyword → **Fuzz input**: `"sin(45 deg)"` → **Expected invariant**: returns `"sin(45 deg)"`
- **Property**: trigToDeg does not modify non-numeric arguments → **Fuzz input**: `"asin(x)"` → **Expected invariant**: returns `"asin(x)"`
- **Property**: trigToDeg handles multiple trig calls in one expression → **Fuzz input**: `"sin(30)+cos(60)"` → **Expected invariant**: returns `"sin(30 deg)+cos(60 deg)"`
- **Property**: trigToDeg does not throw for empty string → **Fuzz input**: `""` → **Expected invariant**: returns `""`
- **Property**: trigToDeg does not throw for string without trig functions → **Fuzz input**: `"hello world"` → **Expected invariant**: returns `"hello world"`
- **Property**: trigToDeg does not throw on nested parentheses (incorrect match) → **Fuzz input**: `"sin((1))"` → **Expected invariant**: returns a string (no exception)
- **Property**: cleanFloat returns integer string for integer input → **Fuzz input**: `5` → **Expected invariant**: returns `"5"`
- **Property**: cleanFloat rounds near-integer to integer → **Fuzz input**: `0.9999999999999999` → **Expected invariant**: returns `"1"`
- **Property**: cleanFloat returns up to 10 decimal places → **Fuzz input**: `0.123456789123456` → **Expected invariant**: returns `"0.1234567891"` (rounded)
- **Property**: cleanFloat returns "NaN" for NaN → **Fuzz input**: `NaN` → **Expected invariant**: returns `"NaN"`
- **Property**: cleanFloat returns "Infinity" for Infinity → **Fuzz input**: `Infinity` → **Expected invariant**: returns `"Infinity"`
- **Property**: cleanFloat returns "0" for negative zero → **Fuzz input**: `-0` → **Expected invariant**: returns `"0"`
- **Property**: handleFastPathMessage returns `handled: false` and `latencyMs: 0` when mode is "off" → **Fuzz input**: `opts: { mode: "off" }`, text: `"hello"` → **Expected invariant

---

## FUZ-012 — fuzz — `innomcp-node/src/services/generalGate.ts` [Qwen/Qwen3.7-Max]
### `renderThaiNumberText(value: number)`
- **Non-finite passthrough** → `NaN`, `Infinity`, `-Infinity` → Returns exact string representation (`"NaN"`, `"Infinity"`, `"-Infinity"`) without throwing.
- **Zero normalization** → `0`, `-0` → Returns exactly `"ศูนย์"`.
- **Negative prefix invariant** → `-1`, `-999999`, `-1000001` → Output strictly starts with `"ลบ"` and contains no `-` or numeric digits.
- **Decimal truncation** → `1.5`, `1.9`, `999999.9`, `-1.5` → Output strictly equals `renderThaiNumberText(Math.floor(input))` (or equivalent for negatives via `Math.abs`).
- **Million boundary threshold** → `999999`, `1000000`, `1000001` → Output for `>= 1000000` contains `"ล้าน"`, output for `< 1000000` does not.
- **Digitless output** → Random integers/floats in `[-1e9, 1e9]` → Output contains absolutely no characters in `[0-9]`.
- **Large number resilience** → `Number.MAX_SAFE_INTEGER`, `1e20`, `1e100` → Returns a string without throwing or entering infinite loops (JS precision loss is acceptable, crash is not).

### `countDaysUntilEndOfYear(baseDate: Date)`
- **Non-negative floor** → `new Date("invalid")`, `new Date(NaN)` → Returns `0` (since `Math.max(0, NaN)` evaluates to `0`).
- **Upper bound limit** → `new Date(2023, 0, 1)`, `new Date(2024, 0, 1)` → Returns `<= 365` (364 for non-leap year, 365 for leap year).
- **End-of-year zero** → `new Date(2023, 11, 31)`, `new Date(2024, 11, 31, 23, 59, 59)` → Returns exactly `0`.
- **Timezone/Time agnostic** → `new Date(2023, 11, 31, 23, 59, 59)`, `new Date(2023, 11, 31, 0, 0, 0)` → Both return `0` (time component is stripped via `getFullYear/getMonth/getDate`).
- **Type coercion safety** → `null`, `undefined`, `"2023-01-01"`, `{}` → Throws `TypeError` predictably (due to `.getFullYear()` on non-Date objects) rather than returning silent garbage.

### `renderGeneralSmokeAnswer(userText: string)`
- **Null/Undefined coercion** → `null`, `undefined`, `NaN`, `[]`, `{}` → Returns `LOW_CONFIDENCE_FALLBACK_TEXT` (coerced to `""` or `"null"`, failing Thai/regex checks).
- **Non-Thai fallback** → `"abcdef"`, `"12345"`, `""`, `"   "` → Returns exactly `LOW_CONFIDENCE_FALLBACK_TEXT`.
- **Regex DoS resistance** → `"a".repeat(100000)`, `"ระบบ" + "a".repeat(100000) + "พร้อม"` → Completes in `< 50ms`, no catastrophic backtracking or event loop blocking.
- **Precedence determinism** → `"ping ชื่ออะไร"`, `"ภาคกลาง RAG"` → Returns the first matched regex's response (e.g., ping status, not name/region), strictly deterministic.
- **Unicode/Whitespace resilience** → `"\u200b".repeat(100) + "ping"`, `"p\u0069ng"`, `"👍"` → Handles gracefully without throwing; falls back to low confidence if regex fails to match normalized text.
- **Extreme length handling** → `"ก".repeat(10_000_000)` → Returns fallback or matches without OOM (Out of Memory) or V8 string length limit crashes.

### `renderGeneralFallbackMessage()`
- **Static immutability** → `()` (no args) → Always returns the exact hardcoded string, length `> 0`, no side effects or state mutations.

---

## FUZ-013 — fuzz — `innomcp-node/src/services/hotRetriever.ts` [deepseek/deepseek-v4-pro]
- **Property:** normalizeWeatherFacts returns empty array for falsy toolResult  
  **Input:** `toolResult = null`, `query = "any"`  
  **Expected invariant:** `normalizeWeatherFacts(null, "any")` → `[]`

- **Property:** normalizeWeatherFacts returns empty array for truthy primitive string result  
  **Input:** `toolResult = "live data"`, `query = ""`  
  **Expected invariant:** result `[]` because no object/array unwrapping yields a fact

- **Property:** normalizeWeatherFacts returns empty array for numeric toolResult (0)  
  **Input:** `toolResult = 0`, `query = ""`  
  **Expected invariant:** `[]`

- **Property:** normalizeWeatherFacts creates one fact per array item from toolResult.result  
  **Input:** `toolResult = { result: [{ province: "เชียงใหม่" }, { location: "ภูเก็ต" }] }`, `query = ""`  
  **Expected invariant:** length 2; each fact has `domain: "weather"`, entity equals province or location; source.id includes the province

- **Property:** normalizeWeatherFacts handles array item with missing province/location by using "unknown"  
  **Input:** `toolResult = { result: [{ temp: 30 }] }`, any query  
  **Expected invariant:** fact has entity `["unknown"]` and does not throw

- **Property:** normalizeWeatherFacts gracefully handles null items inside the result array  
  **Input:** `toolResult = { result: [null, null] }`, `query = ""`  
  **Expected invariant:** No TypeError; each null item yields a fact with province `"unknown"` and content `"null"` (JSON.stringify of null)

- **Property:** normalizeWeatherFacts with a non-array object result creates exactly one fact using query-based entities  
  **Input:** `toolResult = { temp: 35 }`, `query = "กรุงเทพอากาศวันนี้"`  
  **Expected invariant:** single fact; `entities` contains `["กรุงเทพ"]`; `source.id` is `"tool:weatherPipeline"` (no province suffix)

- **Property:** normalizeWeatherFacts does not crash when query is null/undefined  
  **Input:** `toolResult = { result: { temp: 35 } }`, `query = null`  
  **Expected invariant:** No TypeError from `extractWeatherEntities`; returns a fact with `entities = []` (or safely handles null)

- **Property:** normalizeEvidenceFacts returns empty array for null/undefined toolResult  
  **Input:** `toolResult = null`  
  **Expected invariant:** `[]`

- **Property:** normalizeEvidenceFacts creates a fact with ISP "all" when query contains no ISP keyword  
  **Input:** `toolResult = { data: "evidence text" }`, `query = "no isp"`  
  **Expected invariant:** fact.entities is `["all"]`, confidence 0.95

- **Property:** normalizeEvidenceFacts extracts ISP from query case-insensitively and uppercases  
  **Input:** `toolResult = { data: "..." }`, `query = "ais fiber outage"`  
  **Expected invariant:** fact.source.id ends with `:AIS`, entities `["AIS"]`

- **Property:** normalizeEvidenceFacts does not crash when query is null  
  **Input:** `toolResult = { data: "..." }`, `query = null`  
  **Expected invariant:** No TypeError from `extractISP`; fact.entities is `["all"]`

- **Property:** normalizeDeterministicFact stringifies non-string results via String()  
  **Input:** `domain = "calc"`, `toolName = "calculator"`, `result = 42`, `query = ""`  
  **Expected invariant:** fact.content is `"42"`, confidence 1.0, entities `[]`

- **Property:** normalizeDeterministicFact does not throw for Symbol result  
  **Input:** `result = Symbol("test")`  
  **Expected invariant:** No TypeError from `String(result)`; content should be `"Symbol(test)"` (or handled gracefully, as String(symbol) throws in current code)

- **Property:** mergeRetrievalFacts deduplicates by fact.id, preserving first occurrence  
  **Input:** `factSets = [[{id:"1"}, {id:"2"}], [{id:"2"}, {id:"3"}]]` (minimal shapes)  
  **Expected invariant:** output IDs are `["1","2","3"]`, length 3, order follows first-seen

- **Property:** mergeRetrievalFacts handles empty sub-arrays and all-empty input  
  **Input:** `factSets = [[], []]` → `[]`  
  **Expected invariant:** `[]`

- **Pr

---

## FUZ-014 — fuzz — `innomcp-node/src/services/intentClassifier.ts` [zai-org/GLM-5.1]
# Property-Based & Fuzz Test Cases for `intentClassifier.ts`

## 1. Determinism

- **Property: Same input always yields same output** → fuzz: random strings of 0–500 chars, run `classifyIntent(x)` twice → invariant: result deep-equals itself
- **Property: Order of calls doesn't affect result** → fuzz: generate two messages `a`, `b`; classify `a` then `b` then `a` again → invariant: `classifyIntent(a)` result is identical both times

## 2. Output Shape / Type Invariants

- **Property: `intent` is always a valid ChatIntent** → fuzz: random strings (Thai, English, mixed, unicode, empty, symbols) → invariant: result.intent ∈ ChatIntent union
- **Property: `expectedToolUsage` is always boolean** → fuzz: any string input → invariant: `typeof result.expectedToolUsage === "boolean"`
- **Property: `reasons` is always a non-empty string array** → fuzz: any string input including `""` → invariant: `Array.isArray(result.reasons) && result.reasons.length > 0 && result.reasons.every(r => typeof r === "string")`

## 3. Empty / Invalid Input Handling

- **Property: Empty string → general intent** → fuzz: `""` → invariant: `intent === "general" && expectedToolUsage === false`
- **Property: Whitespace-only string → general intent** → fuzz: `"   "`, `"\t\n"`, `"\u00A0\u2000"` → invariant: `intent === "general"`
- **Property: Non-string input → general intent** → fuzz: `undefined`, `null`, `123`, `{}`, `[]`, `NaN` (cast to `any`) → invariant: `intent === "general" && expectedToolUsage === false && reasons === ["empty"]`
- **Property: String with only zero-width characters** → fuzz: `"\u200B\u200C\u200D\uFEFF"` → invariant: `intent === "general"`

## 4. Case Insensitivity

- **Property: Keyword matching is case-insensitive** → fuzz: `"WEATHER"`, `"Weather"`, `"wEaThEr"`, `"FORENSIC"`, `"NIP"`, `"ISP"` → invariant: same intent as lowercase equivalent
- **Property: Thai keywords are not case-folded incorrectly** → fuzz: Thai text with mixed Latin/Thai → invariant: Thai keyword matches still work (Thai has no case, so no false negatives)

## 5. Keyword Presence Triggers Correct Intent

- **Property: Each keyword in PLANNING_KEYWORDS triggers planning-broad** → fuzz: `"วางแผน"`, `"plan"`, `"shortlist"`, `"rank"` → invariant: `intent === "planning-broad"`
- **Property: Each keyword in WEATHER_KEYWORDS triggers weather** → fuzz: `"อากาศ"`, `"forecast"`, `"rain"`, `"temperature"` → invariant: `intent === "weather"`
- **Property: Each keyword in DATETIME_KEYWORDS triggers datetime** → fuzz: `"กี่โมง"`, `"what time"`, `"clock"`, `"วันนี้วัน"` → invariant: `intent === "datetime"`
- **Property: Each keyword in CALC_KEYWORDS triggers calc** → fuzz: `"คำนวณ"`, `"calculate"`, `"%"`, `"mean"` → invariant: `intent === "calc"`
- **Property: Each keyword in CODE_KEYWORDS triggers code** → fuzz: `"function"`, `"regex"`, `"python"`, `"type error"` → invariant: `intent === "code"`
- **Property: Each keyword in MAP_KEYWORDS triggers map** → fuzz: `"แผนที่"`, `"coordinates"`, `"map"` → invariant: `intent === "map"`
- **Property: Each keyword in SHELL_KEYWORDS triggers shell** → fuzz: `"npm"`, `"bash"`, `"mkdir"`, `"deploy"` → invariant: `intent === "shell"`
- **Property: Each keyword in WRITE_KEYWORDS triggers write** → fuzz: `"เขียน"`, `"draft"`, `"summarize"`, `"email"` → invariant: `intent === "write"`
- **Property: Each keyword in DATA_KEYWORDS triggers data** → fuzz: `"csv"`, `"excel"`, `"กราฟ"`, `"statistic"` → invariant: `intent === "data"`
- **Property: Each keyword in RESEARCH_KEYWORDS triggers research** → fuzz: `"search"`, `"find"`, `"ค้นหา"`, `"about"` → invariant: `intent === "research"`
- **Property: Each keyword in GREETING_KEYWORDS triggers greeting** → fuzz: `"สวัสดี"`, `"hello"`, `"yo"`, `"ฮัลโหล"` → invariant: `intent === "greeting"`

## 6. Evidence Intent — Special Guard Logic

- **Property: Unambiguous evidence keywords always trigger evidence** → fuzz: `"หลักฐาน"`, `"คดี"`, `"forensic"`, `"evidence"` → invariant: `intent === "evidence"`
- **Propert

---

## FUZ-015 — fuzz — `innomcp-node/src/services/motherProviderToggle.ts` [MiniMaxAI/MiniMax-M3]
```markdown
# Property-Based / Fuzz Tests: motherProviderToggle.ts

## Core Invariants

- **`isProviderEnabled(P)` after `disableProvider(P)`** → always `false`
  - Fuzz: any ASCII / Unicode / control-char / empty / 1MB string as `providerId`
  - Expected: `isProviderEnabled(P) === false` regardless of charset

- **`isProviderEnabled(P)` after `enableProvider(P)`** → always `true`
  - Fuzz: `providerId` = emoji-only, null-byte embedded, surrogate pairs, leading/trailing whitespace
  - Expected: `true` (Set membership is exact-string)

- **`isProviderEnabled(P)` after `toggleProvider(P)`** → returns the **negation** of prior state, and reported return value matches new state
  - Fuzz: call `toggle` 2× with same arbitrary string; return values must be `[false, true]` or `[true, false]`
  - Expected: `toggle(P) === !isProviderEnabled(P)` pre-call

- **`getDisabledProviders()` length** ≡ `|disabledProviders|` set membership
  - Fuzz: 10k random string `providerId`s, mix of `disable/enable/toggle`, then snapshot
  - Expected: every returned ID `id` satisfies `isProviderEnabled(id) === false`; every `id` with `isProviderEnabled(id) === false` appears in the snapshot (bijection)

- **No duplicate IDs in snapshot**
  - Fuzz: call `disableProvider(P)` 1000× with same `P`
  - Expected: snapshot contains `P` at most once

- **Set operations are idempotent for `disableProvider`**
  - Fuzz: `disableProvider(P); disableProvider(P); disableProvider(P)` then `getDisabledProviders()`
  - Expected: same state as single call

- **Set operations are idempotent for `enableProvider` on already-enabled**
  - Fuzz: `enableProvider(P)` when `P` never disabled
  - Expected: no throw, no state change, `isProviderEnabled(P) === true`

- **`resetAllProviders()` returns state to all-enabled**
  - Fuzz: random sequence of `disable/toggle` on 100 strings, then `resetAllProviders()`, then `isProviderEnabled` for each
  - Expected: all return `true`; `getDisabledProviders().length === 0`

- **Default state is all-enabled for any of the 14 known providers**
  - Fuzz: at fresh import, `isProviderEnabled(id)` for all 14 canonical IDs (e.g. `"openai"`, `"anthropic"`, …)
  - Expected: all `true`

## Cross-Operation Invariants

- **`isProviderEnabled(P)` ⇔ `!getDisabledProviders().includes(P)`**
  - Fuzz: arbitrary interleaving of `disable/enable/toggle/reset` on arbitrary strings, then assert equivalence for all probed IDs
  - Expected: equivalence holds after every operation

- **Toggle is involution on boolean state: `toggle(toggle(P))` ≡ no-op for `isProviderEnabled`**
  - Fuzz: arbitrary `P`, random leading state
  - Expected: `isProviderEnabled` unchanged; but Set may have transient entry — verify by capturing snapshot before/after

- **`enableProvider(P)` then `disableProvider(P)`** ≡ state where `P` is disabled, snapshot contains `P`
  - Fuzz: P = any string including empty
  - Expected: holds

- **`disableProvider(P)` then `enableProvider(P)`** ≡ state where `P` is enabled, snapshot does **not** contain `P`
  - Fuzz: P = 1000 random strings
  - Expected: holds

- **`getDisabledProviders()` returns a fresh array (no aliasing of internal state)**
  - Fuzz: snapshot, mutate returned array (`push`, `splice`, `sort`), then call `isProviderEnabled` for pushed IDs
  - Expected: pushed IDs report `true` (internal Set untouched); also snapshot length unchanged on next call

## Adversarial / Malformed Inputs

- **Empty string `""` as `providerId`**
  - Fuzz: full lifecycle `disable("")` → `isProviderEnabled("")` → `enable("")` → `toggle("")`
  - Expected: module treats it as a valid distinct key; no throw

- **Whitespace-only / control-character IDs** (`" "`, `"\t"`, `"\n"`, `"\0"`, `"\r"`)
  - Fuzz: each as `providerId`
  - Expected: no throw; treated as distinct keys; no normalization

- **Case sensitivity**
  - Fuzz: `disableProvider("OpenAI")` then `isProviderEnabled("openai")` and vice versa
  - Expected: treated as different IDs (case-sensitive Set)

- **Leadin

---

## FUZ-016 — fuzz — `innomcp-node/src/services/naturalnessGuard.ts` [deepseek/deepseek-v4-flash]
## Property-Based / Fuzz Test Cases for `naturalnessGuard.ts`

| Property | Fuzz Input | Expected Invariant |
|---|---|---|
| Non‑string candidate returns error | `null` / `undefined` / `42` / `[]` | `result.ok === false` and `result.ruleFired === "empty-answer"` |
| Empty string answer | `""` | `result.ok === false` and `result.ruleFired === "empty-answer"` |
| Whitespace‑only answer leaks past empty‑answer rule | `"   "` (spaces, tabs, newlines) with `intent: "planning-broad"` | `result.ok === false` and `result.ruleFired === "planning-broad-too-shallow"` (empty trimmed string fails follow‑up/plan‑frame check) |
| Exact province‑request match for `planning‑broad` | `"กรุณาระบุจังหวัดเชียงใหม่"` (intent = `planning-broad`) | `result.ruleFired === "planning-broad-province-only"` |
| Province‑request with trailing newline bypass (trim removes) | `"กรุณาระบุจังหวัด\n"` (intent = `planning-broad`) | `result.ruleFired === "planning-broad-province-only"` (newline is trimmed) |
| Province‑request with newline in middle bypasses regex | `"กรุณาระบุจังหวัด\nข้อมูลเพิ่มเติม"` (intent = `planning-broad`) | `result.ruleFired` is **not** `"planning-broad-province-only"` (regex `$` fails) |
| Thai query / English‑first answer (first 50 chars no Thai) | `userQuery: "สวัสดี"`, `candidate: "Hello, this is English without Thai in first 50 chars..."` | `result.ruleFired === "english-first-leak"` |
| Thai query / English‑first answer with Thai character in first 50 (bypass) | `userQuery: "สวัสดี"`, `candidate: "Hello สวัสดีแล้ว..."` (Thai at position 7) | `result.ok === true` (rule condition `!hasThaiCharacter(trimmed.slice(0,50))` is false) |
| Non‑Thai user query / English‑first answer (rule not applicable) | `userQuery: "hello"`, `candidate: "Hello world"` | `result.ok === true` (userIsThai is false) |
| Raw JSON leak (object) | `'{"key":"value"}'` (any intent) | `result.ruleFired === "raw-json-leak"` |
| Raw JSON leak (array) | `'["item1","item2"]'` | `result.ruleFired === "raw-json-leak"` |
| JSON‑like with single quotes bypasses regex | `"{ 'key': 'value' }"` | `result.ok === true` (after `{` regex expects `"` not `'`) |
| JSON with leading character bypasses regex | `"a{\"key\":1}"` | `result.ok === true` (first non‑whitespace char is `a`) |
| Guard violation: `"Used tools: none"` in answer | `"Here: Used tools: none"` (expectedToolUsage = true, intent ≠ map) | `result.ruleFired === "forbidden-substring:Used tools: none"` |
| Guard violation: map placeholder when intent ≠ map | `"ดูบนแผนที่ [{lat,lng}]"` (intent = `planning-broad`) | `result.ruleFired` starts with `"forbidden-substring:"` |
| Map placeholder allowed when intent = map | `"ดูบนแผนที่ [{lat,lng}]"` (intent = `map`) | `result.ok === true` (guard allows map terms) |
| `planning-broad` answer with only `?` (bypasses shallow check) | `"?"` (intent = `planning-broad`) | `result.ok === true` (hasFollowup true via `\?`) |
| `planning-broad` answer with only `มีคำถาม` (bypasses) | `"มีคำถามไหม?"` | `result.ok === true` (hasFollowup true) |
| `planning-broad` answer with plan frame present | `"แนวทางคือ...` | `result.ok === true` (hasPlanFrame true) |
| `planning-broad` answer missing both follow‑up and plan frame | `"แค่นี้"` (intent = `planning-broad`) | `result.ruleFired === "planning-broad-too-shallow"` |
| Province‑request answer with **non**‑`planning-broad` intent | `"กรุณาระบุจังหวัด"` (intent = `general`) | `result.ruleFired` is **not** `"planning-broad-province-only"` (rule only applies to `planning-broad`) |
| Extremely long answer (buffer overflow? no, but performance) | `"a".repeat(100000)` (any intent) | `result.ok === true` (no error, passes all checks) |
| Unicode control characters / invisible characters | `"\u200B\u200C\u200D"` (zero‑width spaces) with intent `planning-broad` | `result.ruleFired === "planning-broad-too-shallow"` (trim removes nothing, no Thai, no follow‑up) |
| Answer with emoji causing regex quirks | `"😀สวัสดี"` (userQuery Thai, answer starts with

---

## FUZ-017 — fuzz — `innomcp-node/src/services/providerAdapter.ts` [deepseek/deepseek-v4-pro]
### 1. API key never appears in error output
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
No thrown error message or error chunk contains the API key string. | Call `callOpenAI` with a provider that returns a 401 response body `{"error":"Invalid API key: sk-123"}` (simulate). | The thrown `Error` message must **not** include the literal value of the key; it may contain status 401 and body but the actual key must be absent from the message.
Streaming error chunk must also exclude the key. | `streamOpenAI` with same provider; on 401, `onChunk({ type: "error" })` must be emitted. | The chunk's `.error` string must not contain the key.

### 2. Missing / empty API key aborts with safe error
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
`requireApiKey` throws without exposing the (missing) key. | `provider.id = "gpt-4"` but `resolveApiKey(provider.id)` returns `""`. | `callOpenAI` throws an `Error` whose message is `"API key not configured for provider: <displayName>"`. Message must **not** contain the empty string or `undefined`.

### 3. Malformed `messages` array does not cause uncaught exception
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
All adapter functions handle `messages` edge cases without crashing. | `messages: []` (empty array). | `callOpenAI` sends `messages: []`; returns empty string or throws a controlled error (no property access crash).
A message with `role` missing or `null`. | `messages: [{ content: "hi" }]` (role undefined). | Fetch is made with JSON containing `role: undefined`; adapter must not crash before fetch; network error will surface cleanly.
`content` is `null` or omitted. | `[{ role: "user" }]`. | Response handling must not break when `content` is `null`; returns `""` or safe fallback.

### 4. Adapter never hangs – timeout enforced
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
All calls abort after `provider.timeoutMs` regardless of slow response. | `provider.timeoutMs = 1` (1 ms), `fetch` mocked to never resolve. | `callOpenAI` rejects with an `AbortError` (or wrapped error) within a short grace period; no indefinite hang.
Timer cleanup always runs (no dangling `setTimeout`). | Same as above; observe after call settles. | `clearTimeout` is invoked exactly once in the `finally` block; no timer leak.

### 5. Streaming: malformed SSE lines are silently skipped
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
`streamOpenAI` ignores lines that are not valid JSON without crashing. | SSE data lines containing `data: {broken` and `data: "hello"`. | `onChunk` receives only deltas from correctly parsed chunks; no error chunk emitted for parse failures; stream eventually ends with `done`.
Empty `data:` lines (`data: ` with no payload) are skipped. | Line `data:`. | No chunk emitted for that line; processing continues.

### 6. Streaming: response without body yields an error chunk
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
If `resp.body` is null, an error is emitted and reading is not attempted. | Simulated fetch that returns `ok: true` but `body: null`. | `onChunk` receives exactly one chunk: `{ type: "error", error: "No response body from OpenAI stream" }`. No `done` follows.

### 7. Anthropic system message extraction doesn’t drop messages
**Property** | **Fuzz Input** | **Expected Invariant**
---|---|---
`callAnthropic` strips system messages and combines them, but all non‑system messages remain in the `messages` array. | `messages: [ {role:"system", content:"A"}, {role:"user", content:"B"}, {role:"system", content:"C"} ]`. | Sent `body.messages` equals `[{role:"user", content:"B"}]`; `body.system` equals `"A\n\nC"`.
If only system messages exist, `messages` is empty array. | `messages: [ {role:"system", content:"S"} ]`. | `body.messages: []`, `body.system: "S"`. The adapter must not crash; API may return error but adapter should handle the response normally.

### 8. Provider defaul

---

## FUZ-018 — fuzz — `innomcp-node/src/services/providerFailover.ts` [moonshotai/Kimi-K2.6]
The user wants property-based / fuzz test cases for the provided TypeScript module `providerFailover.ts`.

 I need to:
 1. Enumerate input invariants and properties that must always hold.
 2. Identify adversarial/malformed/boundary inputs that could break them.
 3. Output a markdown list in the format: property → fuzz input → expected invariant.
 4. Be concrete, no filler.

 Let's analyze the code carefully.

 **Module Analysis:**

 `ProviderFailover` class:
 - Constructor: takes `primaryId`, `backupIds`, `failThreshold`, `cooldownMs`.
   - Defaults: `DEFAULT_PRIMARY_ID = 'mdes-ollama'`, `DEFAULT_BACKUP_IDS = ['ollama-local', 'openai-compatible']`, `DEFAULT_FAIL_THRESHOLD = 3`, `DEFAULT_COOLDOWN_MS = 60000`.
   - Initializes `statuses` Map with all providers (primary + backups).
   - Sets `activeProviderId` to `primaryId`.
   - **BUG/INVARIANT**: `selectProvider` always uses `DEFAULT_PRIMARY_ID` and `DEFAULT_BACKUP_IDS`, ignoring constructor arguments `primaryId` and `backupIds`. This is a critical bug. The constructor stores them in the map keys, but `selectProvider`, `getStats`, `resetAll` use the constants. Wait, `resetAll` iterates over `this.statuses.values()`, so it resets whatever is in the map. But `selectProvider` and `getStats` hardcode `DEFAULT_PRIMARY_ID` and `DEFAULT_BACKUP_IDS`.
   - **INVARIANT**: If user passes custom `primaryId`/`backupIds`, `selectProvider` should respect them. But it doesn't. This is a property to test.

 - `setHealthChecker(fn)`: sets `this.healthChecker`.
   - Fuzz input: `null`, `undefined`, function throwing, function returning non-Promise, function returning malformed objects.

 - `selectProvider(_task?: string)`: async, returns string.
   - Hardcodes `DEFAULT_PRIMARY_ID` and `DEFAULT_BACKUP_IDS`.
   - Checks `primaryStatus.healthy`. If true, returns primary.
   - Else iterates `DEFAULT_BACKUP_IDS`. Returns first healthy.
   - Else returns primary and logs warning.
   - **INVARIANT**: Return value must always be a provider ID present in `this.statuses`.
   - **INVARIANT**: If primary is healthy, must return primary (if we ignore the constructor bug, but with the bug it returns DEFAULT_PRIMARY_ID even if a different primary was passed).
   - **INVARIANT**: `this.activeProviderId` must equal returned ID.
   - **INVARIANT**: If no providers healthy, still returns a string (primary ID).
   - Fuzz input: `_task` can be any string, empty, undefined, null (though TS might prevent null at compile time, runtime fuzz can pass it). Since it's unused, shouldn't matter, but we should test it doesn't crash.

 - `markFailed(providerId: string)`: async, void.
   - Looks up provider. If unknown, logs and returns.
   - Increments `failCount`, updates `lastCheck`.
   - If `failCount >= failThreshold`, sets `healthy = false`.
   - **INVARIANT**: `failCount` only increments for known providers.
   - **INVARIANT**: `healthy` must be false if `failCount >= failThreshold`.
   - **INVARIANT**: `healthy` must remain true if `failCount < failThreshold`.
   - **INVARIANT**: `lastCheck` must be updated to a timestamp >= previous `lastCheck`.
   - Fuzz input: unknown providerId, empty string, null, undefined, special chars, very long string. `failThreshold` boundary: exactly at threshold, one below, one above. `failThreshold` could be 0, 1, negative? Constructor accepts any number. If `failThreshold` is 0, first failure makes it unhealthy immediately because `0 >= 0`. If negative, `failCount` (starts at 0) will never be >= negative? Actually 0 >= -1 is true, so it would immediately mark unhealthy on first call? Wait, `failCount` starts at 0. If `failThreshold` is -1, then `0 >= -1` is true, so it becomes unhealthy immediately on first `markFailed` (which makes `failCount` 1). But what if `failThreshold` is 0? `1 >= 0` true. So yes, first failure marks unhealthy. What if `failThreshold` is `NaN`? `1 >= NaN` is false, so never unhealthy. `Infinity`? Never unhealthy unless failCount reaches Infinity.

 - `markHealthy(p

---

## FUZ-019 — fuzz — `innomcp-node/src/services/providerHealthProbe.ts` [zai-org/GLM-5.1]
# Property-Based & Fuzz Test Cases: `providerHealthProbe.ts`

## 1. Status Validity

- **Property**: Every `ProviderProbeResult.status` is always one of `"online"|"offline"|"configured"|"checking"` — never `undefined`, `null`, empty string, or any other value.
  - **Fuzz input**: All 19 providers with `baseUrl` pointing at servers returning random status codes (0, 1, 302, 403, 404, 418, 429, 500, 502, 503, 999, NaN-coded status).
  - **Expected invariant**: `result.status ∈ {"online","offline","configured","checking"}` for every provider.

- **Property**: Empty `apiKey` on an `openai`-kind provider always yields `"configured"`, never `"online"` or `"offline"`.
  - **Fuzz input**: `apiKey: ""` with a live `baseUrl` returning 200.
  - **Expected invariant**: `result.status === "configured"`.

- **Property**: Empty `apiKey` on an `anthropic`-kind provider always yields `"configured"`.
  - **Fuzz input**: `apiKey: ""` with a live `baseUrl` returning 200.
  - **Expected invariant**: `result.status === "configured"`.

- **Property**: Empty `apiKey` on an `ollama`-kind provider does **not** yield `"configured"` — ollama ignores apiKey; status depends on HTTP response.
  - **Fuzz input**: `apiKey: ""`, ollama server returning 200.
  - **Expected invariant**: `result.status === "online"` (not `"configured"`).

## 2. No Unhandled Exceptions

- **Property**: `probeAll()` (or equivalent entry point) never throws, regardless of input.
  - **Fuzz input**: All env vars set to `undefined`; `baseUrl` values of `""`, `"not a url"`, `"http://[::1]"`, `"ftp://evil.com"`, `"javascript:alert(1)"`, `null`, `"http://0.0.0.0:0"`, `"http://\x00host"`, extremely long string (65KB).
  - **Expected invariant**: Function returns/resolves without throwing; `probeStatus` map populated for every provider.

- **Property**: Individual probe functions never throw — all errors caught internally.
  - **Fuzz input**: `baseUrl` pointing at a TCP server that immediately RSTs; a server that sends garbage binary; a server that sends an infinite response body with no end; DNS that never resolves.
  - **Expected invariant**: No exception propagates; result is `"offline"`.

## 3. Timeout Enforcement

- **Property**: Every probe completes within ≤5 seconds (plus minor overhead).
  - **Fuzz input**: `baseUrl` pointing at a server that hangs for 30s before responding.
  - **Expected invariant**: `result.status === "offline"` and `result.latencyMs < 6000`.

- **Property**: Timeout fires even when DNS resolution is slow.
  - **Fuzz input**: `baseUrl` with a hostname that has 4.9s DNS TTL then hangs on connect.
  - **Expected invariant**: `result.status === "offline"`.

## 4. Latency Non-Negativity

- **Property**: `latencyMs` is always ≥ 0 and finite.
  - **Fuzz input**: System clock set to past (simulated), `Date.now()` mocked to return `0`, `Infinity`, or negative values.
  - **Expected invariant**: `result.latencyMs >= 0 && Number.isFinite(result.latencyMs)`.

## 5. ISO-8601 Timestamp

- **Property**: `checkedAt` is always a valid ISO-8601 string parseable by `Date.parse()`.
  - **Fuzz input**: Run probe with system clock mocked to `new Date(0)`, `new Date(8640000000000001)` (out of range), `new Date(NaN)`.
  - **Expected invariant**: `!isNaN(Date.parse(result.checkedAt))` — always a valid date string.

## 6. Provider ID Consistency

- **Property**: Each `ProviderProbeResult.providerId` exactly matches the corresponding `ProbeTarget.id`.
  - **Fuzz input**: Targets with `id` containing unicode (`"日本語"`), special chars (`"a/b?c=d&e"`), empty string `""`, very long string (10KB), duplicate ids.
  - **Expected invariant**: `result.providerId === target.id` for every entry.

## 7. Map Completeness

- **Property**: After probing, `probeStatus.size` equals the number of targets returned by `buildProbeTargets()`.
  - **Fuzz input**: All env vars set to valid-but-diverse values; all env vars set to `undefined`.
  - **Expected invariant**: `probeStatus.size === buildProbeTargets().l

---

## FUZ-020 — fuzz — `innomcp-node/src/services/providerManager.ts` [MiniMaxAI/MiniMax-M3]
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
- **P5.2** → Fuzz: Register N providers, unregister them in random order, calling `getAll()` between each. → **Invariant**

---

## FUZ-021 — fuzz — `innomcp-node/src/services/responseComposer.ts` [deepseek/deepseek-v4-pro]
- **Property**: Empty facts returns preset Thai apology with `mode: "passthrough"`, `factCount: 0`, and reason `"no-facts"`  
  - **Fuzz input**: `{ route: "test", userQuery: "อะไรก็ได้", facts: [] }`  
  - **Expected invariant**: output.text === `"ขออภัย ไม่พบข้อมูลที่เกี่ยวข้องในขณะนี���"`, output.mode === `"passthrough"`, output.reasons includes `"no-facts"`, output.factCount === 0, output.latencyMs is a non‑negative number.

- **Property**: All facts have empty/whitespace-only summary → treated as empty  
  - **Fuzz input**: `{ route: "x", userQuery: "", facts: [{ source: "src", summary: "   " }, { source: "s2", summary: "\n\t" }] }`  
  - **Expected invariant**: same as empty‑facts output; no facts rendered.

- **Property**: Single fact with `confidence` ≥ 0.6 renders without confidence suffix  
  - **Fuzz input**: `{ route: "w", userQuery: "ฝน", facts: [{ source: "tmd", summary: "ฝนตก", confidence: 0.88 }] }`  
  - **Expected invariant**: output.text === `"• **tmd**: ฝนตก"`, output.mode === `"deterministic"`, output.factCount === 1, reasons include `"composed:1"`.

- **Property**: Fact with `confidence` between 0.3 and 0.6 shows Thai confidence note  
  - **Fuzz input**: `{ facts: [{ source: "api", summary: "ข้อมูล", confidence: 0.45 }] }`  
  - **Expected invariant**: output.text includes `" _(ความมั่นใจ 45%)_"` after the summary.

- **Property**: Low‑confidence facts (<0.3) are dropped when any fact ≥ 0.3 exists  
  - **Fuzz input**: `{ facts: [{ source: "a", summary: "สูง", confidence: 0.9 }, { source: "b", summary: "ต่ำ", confidence: 0.2 }] }`  
  - **Expected invariant**: output.factCount === 1, output.text contains only "สูง", reasons includes `"dropped-low-conf:1"`.

- **Property**: All facts have confidence < 0.3 → none dropped, all rendered  
  - **Fuzz input**: `{ facts: [{ summary: "ต่ำ1", confidence: 0.1 }, { summary: "ต่ำ2", confidence: 0.29 }] }`  
  - **Expected invariant**: output.factCount === 2, reasons does **not** contain any `"dropped-low-conf"`, both summaries appear as separate bullets.

- **Property**: Confidence exactly 0.3 is kept (threshold inclusive)  
  - **Fuzz input**: `{ facts: [{ summary: "edge", confidence: 0.3 }] }`  
  - **Expected invariant**: output.factCount === 1, fact rendered.

- **Property**: Fact with `confidence === 0` treated as low but kept if only fact  
  - **Fuzz input**: `{ facts: [{ summary: "ศูนย์", confidence: 0 }] }`  
  - **Expected invariant**: output.factCount === 1, fact appears (since all facts are low, no drop).

- **Property**: Missing or empty `source` produces no source label  
  - **Fuzz input**: `{ facts: [{ summary: "ไม่มีแหล่ง", source: "" }, { summary: "ไม่มี source field" }] }`  
  - **Expected invariant**: both lines start with `"• "` directly followed by Thai summary, no bold label.

- **Property**: Optional `header` and `footer` are rendered exactly once in correct positions  
  - **Fuzz input**: `{ header: "หัวข้อ", footer: "เชิงอรรถ", facts: [{ summary: "ข้อมูล" }] }`  
  - **Expected invariant**: output.text === `"หัวข้อ\n\n• ข้อมูล\n\nเชิงอรรถ"` (exact string after trimming trailing newline).

- **Property**: Fact summary whitespace normalisation (multiple spaces, newlines → single space)  
  - **Fuzz input**: `{ facts: [{ summary: "   หลาย   \nบรรทัด   " }] }`  
  - **Expected invariant**: rendered summary in output is `"หลาย บรรทัด"` (space‑separated).

- **Property**: `route` is recorded in reasons even when empty  
  - **Fuzz input**: `{ route: "", facts: [{ summary: "test" }] }`  
  - **Expected invariant**: output.reasons includes `"route:"`.

- **Property**: Non‑array `facts` (e.g., `null`, `undefined`, string) treated as empty  
  - **Fuzz input**: `{ facts: null }` (or `undefined`, or `"not array"`)  
  - **Expected invariant**: output.factCount === 0, mode `"passthrough"`, no error thrown.

- **Property**: `confidence` is `NaN` – dropped only if other high‑confidence fact exists, kept otherwise  
  - **Fuzz input (with high fact)**: `{

---

## FUZ-022 — fuzz — `innomcp-node/src/services/responseFormatter.ts` [Qwen/Qwen3.7-Max]
- **Property: Truncation Length Limit**
  - **Fuzz Input**: `raw` = random string (length 0–10,000), `maxLength` = random integer (3–1000), `ellipsis` = random string (length 1–5).
  - **Expected Invariant**: `result.text.length <= maxLength`. If `raw.length > maxLength`, `result.text` strictly ends with the `ellipsis` string.

- **Property: Truncation Word Boundary Preservation**
  - **Fuzz Input**: `raw` = string with multiple spaces, `maxLength` < `raw.length`, `maxLength` > `ellipsis.length`.
  - **Expected Invariant**: If a space exists in `raw` after the 60% mark of the truncation boundary, the character immediately preceding the `ellipsis` in `result.text` is not a space (no trailing whitespace before ellipsis).

- **Property: XSS Sanitization Coverage**
  - **Fuzz Input**: `raw` = string heavily injected with `<script>`, `onclick="..."`, `onclick='...'`, `javascript:`, mixed casing, and nested tags. `options.renderMarkdown = true`, `options.sanitizeHtml = true`.
  - **Expected Invariant**: `result.html` (lowercased) contains zero instances of `<script`, `javascript:`, or the regex pattern `\son\w+=["']`.

- **Property: Stream Buffer Backtick Parity & State**
  - **Fuzz Input**: Sequence of random string chunks containing random counts of ` ``` ` (0–5 per chunk).
  - **Expected Invariant**: `formatStream(chunk)` returns an empty string `''` IF AND ONLY IF the internal unflushed buffer contains an odd number of ` ``` ` substrings. When it returns a non-empty string, the internal buffer is reset to `''`.

- **Property: Code Block Line Count Accuracy**
  - **Fuzz Input**: `raw` = string containing valid ````lang\n[code]```` blocks, where `[code]` contains random combinations of `\n`, `\r\n`, and empty lines.
  - **Expected Invariant**: For every block in `result.codeBlocks`, `block.lineCount === block.code.split(/\r?\n/).length` (if code is not empty), or `0` if the code string is empty.

- **Property: Reading Time Lower Bound & Type**
  - **Fuzz Input**: `raw` = empty string, single space, or very short string (1–5 chars). `locale` = randomly `'th'` or `'en'`.
  - **Expected Invariant**: `result.estimatedReadTimeSeconds >= 1` and `Number.isInteger(result.estimatedReadTimeSeconds)` is strictly true.

- **Property: Table Separator Row Exclusion**
  - **Fuzz Input**: `raw` = markdown tables with varying separator rows (e.g., `|---|---|`, `|:---|---:|`, `| --- | --- |`, `|---|`).
  - **Expected Invariant**: No row array in `result.tables` contains a cell string that matches the regex `/^:?-{3,}:?$/` (separator rows are strictly filtered out).

- **Property: Markdown HTML Escaping (Input Isolation)**
  - **Fuzz Input**: `raw` = string containing raw HTML tags (`<div>`, `<img src=x>`, `<`), `options.renderMarkdown = true`.
  - **Expected Invariant**: `result.html` does not contain raw `<` or `>` characters that originated from the `raw` input text; all input angle brackets must be escaped to `&lt;` and `&gt;` prior to markdown tag generation.

- **Property: Singleton Reference Stability**
  - **Fuzz Input**: Call `ResponseFormatter.getInstance()` multiple times, interspersed with random method calls (`format`, `formatStream`, `sanitize`).
  - **Expected Invariant**: `Object.is(instanceA, instanceB)` is always true; the exact same memory reference is returned every time.

- **Property: Code Block Language Fallback**
  - **Fuzz Input**: `raw` = string containing ````\n[code]```` blocks (no language specified), where `[code]` is randomized to match or not match the regex patterns in `detectLanguage`.
  - **Expected Invariant**: If the markdown fence lacks a language identifier, `block.language` strictly equals the output of `detectLanguage(block.code)`, defaulting to `'text'` if no regex matches.

- **Property: Format Stream Cumulative Output**
  - **Fuzz Input**: Array of chunks that collectively contain an even number of ` ``` ` (or zero).
  - **Expected Invariant**: The concatenation of all returned strings from sequential `for

---

## FUZ-023 — fuzz — `innomcp-node/src/services/retrievalOrchestrator.ts` [moonshotai/Kimi-K2.6]
The user wants property-based / fuzz test cases for the provided TypeScript module `retrievalOrchestrator.ts`.

 I need to:
 1. Enumerate input invariants and properties that must always hold.
 2. Identify adversarial/malformed/boundary inputs that could break them.
 3. Output a markdown list: property → fuzz input → expected invariant.
 4. Be concrete, no filler.

 Let's analyze the module carefully.

 Key functions:
 - `planRetrieval(query, route?, memory?)`: RetrievalPlan
 - `executeColdRetrieval(plan)`: ColdRetrievalResult[]
 - `buildRetrievalResult(plan, hotFacts, coldResults, meta)`: RetrievalResult
 - Helpers: `inferHotDomains`, `extractColdQuery`

 Invariants to consider:

 **planRetrieval:**
 1. Output `decision` must always be one of the four valid strings: "hot", "cold", "hot+cold", "none".
 2. `hotDomains` must be a non-null array (even if empty).
 3. If `route` is "calculator" or "datetime", decision MUST be "none" regardless of query/memory.
 4. If `route` is "weather", "evidence", "geo", "seismic", and not calculator/datetime, decision should be "hot" (unless overridden by mixed patterns? Wait, looking at code: step 2 checks mixed patterns first. Step 4 checks hot route. So if route is "weather" but query matches MIXED_PATTERNS, it returns "hot+cold" in step 2. So route=weather doesn't guarantee "hot" if mixed pattern matches. But if no mixed pattern, then yes, step 4 catches it.)
 5. `coldQuery` must be defined when decision is "cold" or "hot+cold", and undefined when decision is "hot" or "none".
 6. `coldQuery` length should be <= 500? Actually `q` is sliced to 500, but `coldQuery` comes from `extractColdQuery(q)` which might be shorter. But if decision is cold, `coldQuery` is `q` (which is already sliced). So `coldQuery` should be <= 500.
 7. `reason` must always be a non-empty string.
 8. If `query` is empty string or whitespace, `q` becomes empty. Then no patterns match. No route. No memory. Returns "none". But `q.trim().slice(0,500)` - if query is empty, q is "". No patterns match. Returns default "none".
 9. If `query` is very long (>500), it is sliced. Should not crash.
 10. If `query` contains regex special characters that might break the regex patterns? The patterns are hardcoded regexes. `pattern.test(q)` where q is user input. If q contains unescaped regex syntax, it shouldn't matter because `test` just matches against the string. The string is treated as literal by the regex engine (the pattern is the regex, q is the subject string). Wait, actually no - `pattern.test(q)` is safe. The regex is the pattern, q is the string being tested. Regex injection isn't possible here in JS the way it is if you construct regex from string. So no crash from regex special chars in query.
 11. `memory.activeDomain` continuation: if memory.activeDomain is "weather", "evidence", "geo", it returns "hot". But what if activeDomain is something else? It falls through to default.
 12. `hasColdPattern && hasHotPattern` returns "hot+cold". This is checked before `hasColdPattern && !hasHotPattern`.
 13. `coldRetriever.isReady()` side effect: If decision is "cold" but coldRetriever is not ready, it falls through to step 4? Wait, looking at code:
     ```typescript
     if (hasColdPattern && !hasHotPattern) {
       if (coldRetriever.isReady()) {
         return { decision: "cold", ... }
       }
       // Fall through to none if cold retriever not ready
     }
     ```
     Actually the comment says "Fall through to none" but the code doesn't explicitly return "none" there. It falls through to the next checks (step 4, 5, 6). So if coldRetriever is not ready, it might still become "hot" in step 4 if hasHotPattern is true? But wait, this branch is `hasColdPattern && !hasHotPattern`. So hasHotPattern is false. So step 4 won't trigger. Step 5 might trigger if memory. Step 6 returns "none". So effectively it becomes "none" or memory-based. But the comment is slightly misleading. Actually if memory has activeDomain, it could return "

---

## FUZ-024 — fuzz — `innomcp-node/src/services/riskDetector.ts` [zai-org/GLM-5.1]
*   **Approval Consistency** → `assessRisk("npm install foo")` → `requiresApproval === true` if and only if `riskLevel !== "low"`
*   **Risk Level Priority (Critical > High)** → `"sudo rm -rf /"` → `riskLevel === "critical"` (must not be "high")
*   **Risk Level Priority (High > Medium)** → `"sudo npm install"` → `riskLevel === "high"` (must not be "medium")
*   **Risk Level Priority (Command > Context)** → `assessRisk("rm -rf /", "file-delete")` → `riskLevel === "critical"` (command pattern overrides context)
*   **Context Fallback** → `assessRisk("ls -la", "file-delete")` → `riskLevel === "medium"` AND `requiresApproval === true`
*   **Context Ignored on Low** → `assessRisk("git status", undefined)` → `riskLevel === "low"` AND `requiresApproval === false`
*   **Case Insensitivity** → `"RM -RF /"`, `"SUDO ls"`, `"NPM INSTALL"` → `riskLevel` matches the lowercase equivalent ("critical", "high", "medium")
*   **Empty/Whitespace Strings** → `""`, `"   "`, `"\t\n"` → `riskLevel === "low"` AND `requiresApproval === false`
*   **Substring Matching (Adversarial)** → `"echo 'rm -rf /'"`, `"cat file | sh"` → `riskLevel === "critical"` / `riskLevel === "high"` (regexes match substrings without word boundaries)
*   **Whitespace Variations (Regex \s+)** → `"rm  -rf  /"`, `"sudo    ls"` → `riskLevel === "critical"` / `riskLevel === "high"` (multiple spaces still match)
*   **Whitespace Obfuscation (Broken Patterns)** → `"r m -rf /"`, `"s u d o ls"` → `riskLevel === "low"` (spaces within keywords break regex matches)
*   **High Pattern Boundary (`| sh`)** → `"echo hi | sh"`, `"echo hi |sh"` → `riskLevel === "high"` (regex `/\|\s*sh\b/` matches)
*   **Medium Pattern Boundary (`rm`)** → `"rm file"`, `"rm -z file"` → `riskLevel === "medium"` (matches `/rm\s+\S+/`)
*   **High Pattern Boundary (`rm -rf`)** → `"rm -rf file"`, `"rm -fr file"` → `riskLevel === "high"` (matches `/rm\s+(-r|-f|-rf|-fr)/`)
*   **Critical Pattern Boundary (`rm -rf /`)** → `"rm -rf /"`, `"rm -rf ~"` → `riskLevel === "critical"` (matches `/rm\s+-rf?\s+[\/~]/i`)
*   **Return Type Structure** → Any string input → Output is strictly of type `{ riskLevel: "low"|"medium"|"high"|"critical", reason: string, requiresApproval: boolean }`
*   **Reason Populated** → `"mkfs"`, `"sudo"`, `"npm install"`, `"ls"` → `reason !== ""` for non-low levels; `reason === ""` for low level

---

## FUZ-026 — fuzz — `innomcp-node/src/services/thaiGovtTools.ts` [deepseek/deepseek-v4-flash]
### Property-based / Fuzz Test Cases for `ThaiGovtTools`

| Property | Fuzz Input | Expected Invariant |
|---|---|---|
| **getWeatherReport** returns an object with all required `WeatherReport` fields present and of correct primitive type | `undefined` (default used) | `result.province` is string, `result.temperature` is number, `result.humidity` is number, `result.condition` is string, `result.timestamp` is string matching ISO 8601 regex |
| | `''` (empty string) | Same as above (MCP may return fallback or error; service must not throw its own exception) |
| | `null` | Service passes `'null'` as province; result fields still conform to `WeatherReport` (or promise rejects from MCP) |
| | `123` (number) | same |
| | `'ก'.repeat(10000)` (very long Thai string) | same |
| | `'<script>alert(1)</script>'` (injection) | same |
| **getDisasterAlerts** always returns an array of `DisasterAlert` | `no input` | `Array.isArray(result)` is true; every element has `id`, `type`, `severity`, `description`, `province`, `issuedAt` as strings (except `severity` is one of the enum values) |
| | – | – |
| **getWeatherForecast** validates `days` argument | `days = 0` | Throws `Error('Forecast days must be between 1 and 14')` |
| | `days = 15` | same |
| | `days = -1` | same |
| | `days = 1.5` | Passes; should not throw (but MCP may truncate or accept fractional days – service does not validate integer) |
| | `days = NaN` | `NaN < 1` is false, `NaN > 14` is false → no validation throw; passes `NaN` to MCP, likely MCP error; invariant: service does not add its own exception |
| | `days = '7'` (string) | `days < 1` coerces to `'7' < 1` → false; passes string to MCP; outcome depends on MCP |
| | `days = undefined` (default 7) | Service defaults to 7; result must be array of `ForecastDay` |
| **getWeatherForecast** returns array of `ForecastDay` with required fields | `province = ''`, `days = 7` | `Array.isArray(result)` true; each element has `date` (YYYY-MM-DD), `maxTemp`/`minTemp`/`precipitation`/`humidity` as numbers, `condition` as string |
| | `province = null` | Service passes `'null'` (string); result may be empty array or error; invariant: no service-side crash |
| | `province = undefined` | undefined is coerced to string? Actually function expects string, so `undefined` becomes `'undefined'`; no crash |
| **getProvinceInfo** returns `ProvinceInfo` with all required fields | `name = ''` | result has `name`, `nameTh`, `region`, `areaKm2`, `population`, `capital`, `postalCodes`, `borderingProvinces` as per interface |
| | `name = null` | passes `'null'`; same invariant |
| | `name = 0` | passes `'0'`; same |
| | `name = '\0'` (null byte) | MCP may reject; service must not throw its own error |
| **findNearest** returns array of `GeoPoint` | `lat = 0, lon = 0, type = undefined` | `Array.isArray(result)` true; each element has `name`, `latitude`, `longitude`, `type`, `address`, `province` |
| | `lat = 1000, lon = 200` | (out‑of‑range coordinates) – service does not validate; must still return array (possibly empty) |
| | `lat = NaN, lon = Infinity` | passes `NaN`/`Infinity` to MCP; service does not throw |
| | `lat = 'abc', lon = 0` | passes `'abc'`; no service crash (MCP may error) |
| | `type = ''` | passes empty string; result array may be empty |
| | `type = 'invalid_type'` | MCP may return empty; service does not throw |
| **searchLocation** returns array of `GeoPoint` | `query = ''` | returns array (may be empty) |
| | `query = null` | passes `'null'`; same invariant |
| | `query = ' OR 1=1;--'` (SQL‑like) | result is array (no crash) |
| | `query = '\n\t\u0000'` (control chars) | same |
| **searchEvidence** validates `limit` | `limit = 0` | Throws `Error('Limit must be between 1 and 100')` |
| | `limit = 101` | same |
| | `limit = -5` | same |
| | `limit = 100.5` | Does **not** throw (service checks `<1` and `>100`; 100.5 passes); MCP may truncate or error |
| | `limit = '10'` (string) | `'10' < 1` is false, `'10' > 100` is false → no valid

---

## FUZ-027 — fuzz — `innomcp-node/src/services/thaiIntentRouter.ts` [Qwen/Qwen3.7-Max]
- **Empty Model Array Handling** → **Fuzz Input:** `text`: `"สวัสดี"`, `availableModels`: `[]` → **Expected Invariant:** Returns `model: ''`, `confidence: 0`, and `reason` contains `"ไม่มีโมเดลที่พร้อมใช้งาน"`. Does not throw.
- **Model Selection Containment (No Hallucinations)** → **Fuzz Input:** `text`: `"สวัสดี"`, `availableModels`: `['custom-model-A', 'custom-model-B']` (models not in `DOMAIN_MODEL_MAP` or `MDES_OLLAMA_MODELS`) → **Expected Invariant:** Returned `model` must be strictly equal to `'custom-model-A'` (first fallback) or `''`. Must never return a model string absent from the `availableModels` input array.
- **Prototype Pollution in Domain Lookup** → **Fuzz Input:** Mock `detectIntent` to return `domain`: `'__proto__'`, `'constructor'`, or `'toString'`. `availableModels`: `['gemma4:26b']` → **Expected Invariant:** Must not throw `TypeError: preferredModels.find is not a function`. Must safely fallback to `general` domain or return `''`. Must not return object prototype properties.
- **Null/Undefined Domain Fallback** → **Fuzz Input:** Mock `detectIntent` to return `domain`: `null`, `undefined`, or `''` → **Expected Invariant:** `domain` resolves to `'general'`. Selected model must be the first available model from `DOMAIN_MODEL_MAP['general']` or the fallback list.
- **Deterministic Fallback Ordering** → **Fuzz Input:** Mock `detectIntent` to return `domain`: `'weather'`. `availableModels`: `['llama3.2:3b', 'qwen2.5:7b', 'deepseek-r1:32b']` (shuffled, none are preferred for weather except `qwen2.5:7b` which is preferred, wait, let's use a domain where none are preferred, e.g., mock domain `'unknown'`) → **Expected Invariant:** If no preferred models match, the selected model must be the one that appears *first* in the hardcoded `MDES_OLLAMA_MODELS` array that is also present in `availableModels`, ignoring the order of the `availableModels` array.
- **Confidence Mathematical Bounds** → **Fuzz Input:** `text`: randomized strings, `availableModels`: randomized valid/invalid model arrays → **Expected Invariant:** `confidence` must strictly be one of `{0, 0.56, 0.7}`. Must never be `NaN`, `> 1.0`, or `< 0.0`. `reason` string must correctly format the percentage without `"NaN%"`.
- **Fallback Flag Consistency** → **Fuzz Input:** `text`: `"สวัสดี"`, `availableModels`: `['gemma4:26b']` (preferred) vs `['llama3.2:3b']` (fallback) → **Expected Invariant:** If the chosen model is in the domain's preferred list, `fallback` must be `undefined`. If the chosen model is a fallback, `fallback` must strictly equal the `model` string.
- **Malformed Text Input Robustness** → **Fuzz Input:** `text`: `null`, `undefined`, `''`, `' '.repeat(100000)`, `'\0\0\0'`, `'🇹🇭'.repeat(10000)`, `Symbol()` (bypassing TS). `availableModels`: `['gemma4:26b']` → **Expected Invariant:** `route` must never throw `TypeError`, `RangeError`, or OOM exceptions. Must gracefully return a valid `RoutingDecision` object (relying on `ThaiNLPService` to handle or safely bubble up errors).
- **Reason String Interpolation Safety** → **Fuzz Input:** Mock `detectIntent` to return `domain`: `'%s %d ${alert(1)}'`. `availableModels`: `['gemma4:26b']` → **Expected Invariant:** `reason` is a safely interpolated string. No template injection, no unescaped format specifiers breaking the string, and `toFixed(0)` executes without throwing.
- **Empty String Model in Available List** → **Fuzz Input:** `text`: `"สวัสดี"`, `availableModels`: `['', 'gemma4:26b']` or `['']` → **Expected Invariant:** If `['']` is passed, it should not select `''` as a valid preferred model unless it's the absolute last fallback. If `''` is selected, `confidence` must be `0` and `reason` must indicate failure. (Currently, the code will select `''` if it's the first in the fallback order, which is a bug; the invariant is that `''` should be treated as an invalid model and skipped).
- **Duplicate Models in Available List** → **Fuzz Input:** `text`: `"สวัสดี"`, `availableModels`: `['gemma4:26b', 'ge

---

## FUZ-028 — fuzz — `innomcp-node/src/services/toolExecutor.ts` [moonshotai/Kimi-K2.6]
The user wants property-based / fuzz test cases for the provided TypeScript module `ToolExecutor`. I need to:

1. Enumerate input invariants and properties that must always hold.
2. Identify adversarial/malformed/boundary inputs that could break them.
3. Output a markdown list in the format: property → fuzz input → expected invariant.
4. Be concrete, no filler.

Let me analyze the module carefully.

**Module Analysis:**

- `ToolExecutor` is a singleton extending `EventEmitter`.
- It maintains a private Map `tools` of `ToolDefinition`.
- Methods: `register`, `unregister`, `hasTool`, `listTools`, `execute`.
- `execute` takes `name`, `params`, `options`.
- Key behaviors:
  - If tool not found: return `{success: false, error: NOT_FOUND_MESSAGE, durationMs: 0, retries: 0}`.
  - `effectiveTimeout`: `options.timeoutMs ?? tool.timeout ?? DEFAULT_TIMEOUT_MS` (30_000).
  - `maxRetries`: `Math.min(Math.max(options.retries ?? 0, 0), MAX_RETRIES)` (3). So clamped to [0, 3].
  - Loop: `for (let attempt = 0; attempt <= maxRetries; attempt++)` → total attempts = maxRetries + 1.
  - Emits `tool:start`, `tool:end`, `tool:error`.
  - `raceWithTimeout`: rejects with `ToolTimeoutError` if timeout.
  - `toErrorMessage`: if `ToolTimeoutError` or `ToolParamError`, returns `error.message`; else returns `EXEC_ERROR_MESSAGE`.
  - Delay between retries: `RETRY_BASE_DELAY_MS * Math.pow(2, attempt)` (1000 * 2^attempt).
  - If final attempt fails, returns `{success: false, error: errorMessage, durationMs: Date.now() - startTime, retries: attempt}`.
  - The final return after loop (should be unreachable if logic is correct, but exists): `{success: false, error: EXEC_ERROR_MESSAGE, durationMs: Date.now() - startTime, retries: maxRetries}`.

**Invariants to test:**

1. **Singleton**: `getInstance()` always returns the same instance.
2. **Register/Unregister/Has/List**: 
   - After register, `hasTool` is true.
   - After unregister, `hasTool` is false.
   - `listTools` doesn't expose `handler`.
   - Registering same name overwrites.
   - Register with empty string name? Should work based on code, but might be edge case.
3. **Execute - Not Found**:
   - Any name not in map → `success: false`, `error: NOT_FOUND_MESSAGE`, `durationMs: 0`, `retries: 0`.
   - `tool:start`/`tool:end`/`tool:error` should NOT be emitted for not found? Looking at code: it returns early before the loop, so no emits. Invariant: no events emitted for missing tools.
4. **Execute - Timeout**:
   - `effectiveTimeout` boundary: negative, 0, Infinity, NaN, very large.
   - `raceWithTimeout` behavior: if timeoutMs is 0 or negative, the timeout fires immediately? `setTimeout` with negative/0 fires ASAP (next tick), but promise might resolve first if already resolved. Actually if timeoutMs=0, setTimeout 0 means next event loop tick. If promise is already resolved (synchronous), it might win? No, `new Promise` executor runs synchronously, so `setTimeout` is scheduled. If `promise` is already resolved (e.g., `Promise.resolve(5)`), the `.then` microtask is queued before the timer macrotask? Actually in JS, microtasks (promise callbacks) run before macrotasks (setTimeout). So if promise is already resolved, `clearTimeout` and `resolve` happen in microtask, which runs before the timer macrotask. So it should succeed even with timeout 0. But if promise is pending, timeout 0 will reject next tick.
   - If timeoutMs is `NaN`, `setTimeout` treats it as 0 or minimum? In Node/JS, `setTimeout(fn, NaN)` is treated as 0 (or 1ms). Actually per spec, it's converted to 0. But `Infinity` might be treated as 0 too? No, `setTimeout` with Infinity might be treated as 0 in some environments? Actually `setTimeout` converts to signed long, Infinity becomes 0? Need to check. In Node.js, `setTimeout(..., Infinity)` results in a very long wait? No, the delay is converted to an integer. `Infinity` becomes 0? Actually `setTimeout` calls `ToNumber`, then `ToInt32` or similar. `Infinity` might become 0 or 1. This is a fuzz targ