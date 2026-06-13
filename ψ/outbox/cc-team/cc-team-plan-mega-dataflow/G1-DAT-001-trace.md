<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-001 role=trace model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2715,"completion_tokens":3865,"total_tokens":6580,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2485,"image_tokens":0},"cache_creation_input_tokens":0} | 50s
 generated: 2026-06-13T11:58:57.928Z -->
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
    - The final textual answer is produced by `composeAnswer({ intent, query: opts.message, facts })`  
      - Transformations: selects a template based on `intent`, interpolates query and facts  
      - Output: a plain string (Thai‑led plan, weather summary, greeting, etc.)  
    - No side-effects during composition; it’s a pure function

12. **Emit answer / final events**  
    The orchestrator likely emits an `"agent_completed"` or `"answer"` event with the composed text.  
    Example:  
    ```ts
    const ev = newEnvelope({ runId, messageId, type: "agent_completed", publicSummary: finalText, agentId: "conductor" });
    safeEmit(emit, ev, expectedToolUsage);
    ```  
    - Side-effect: emits public‑safe event to output stream

13. **Assemble run result**  
    ```
    const result: RunResult = {
      runId,
      messageId,
      finalText,           // from composeAnswer or buildSystemInventoryAnswer
      intent,              // classified ChatIntent
      providerId: null,    // LLM not used in slice
      model: null,
      events: countOfEmittedEvents,
    };
    ```  
    - Output: `RunResult` object returned to the caller  
    - Side-effect: none

14. **Return to caller**  
    The orchestrator exits, returning the `RunResult`. All agent communication happened via the `emit` callback; the final text is also available directly in the returned structure.
```
