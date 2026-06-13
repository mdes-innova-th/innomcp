<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-003 role=trace model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":1678,"completion_tokens":3796,"total_tokens":5474,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2688,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 47s
 generated: 2026-06-13T11:58:54.497Z -->
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
    - **No EventEmitter/SSE emissions** (this module only defines the schema and helpers; it does not write to the response stream).  
    - **No mutable module-level state:** `AGENT_ROLE_LABEL_TH`, `SCHEMA_VERSION`, and `PUBLIC_SUMMARY_MAX` are immutable constants; all operations are reads or pure object construction.
