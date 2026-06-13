<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-001 role=fuzz model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2724,"completion_tokens":4140,"total_tokens":6864,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2282,"image_tokens":0},"cache_creation_input_tokens":0} | 70s
 generated: 2026-06-13T11:59:06.326Z -->
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
  **Expected Invariant:** The returned string exactly matches `"สวัสดีครับ มีอะไรให้ช่วยไหม?"`, `"สวัสดีครับ วันนี้ต้องการทราบอะไรเป็นพิเศษ?"`, or `"ยินดีช่วยเสมอครับ บอกได้เลย"`. No concatenated external data appears.

- **Property:** `composeDateTimeAnswer` always produces a string with the Thai weekday, date, month, Buddhist year, and time in UTC+7, regardless of system clock mockery.  
  **Fuzz Input:** Call the function at different real times; mock `Date` to extreme values like `new Date(0)`, `new Date(32503680000000)` (year 2999), or with negative timestamps.  
  **Expected Invariant:** The output matches the regex `^ขณะนี้ที่ประเทศไทยคือ (วัน[ก-ฮ]+)ที่ \d{1,2} (มกราคม|...|ธันวาคม) พ\.ศ\. \d{4} เวลา \d{2}:\d{2} น\. \(UTC\+7\)$`. The Buddhist year is correctly calculated as UTC year + 543 (modulo day/month consistency at boundaries). No `RangeError` from `padStart` or `getUTC*` methods.

- **Property:** `composePlanningBroadAnswer` includes the query trimmed to 120 characters and every fact prefixed with `• `; it never exceeds expected size limits.  
  **Fuzz Input:** `query` containing `"a".repeat(5000)` plus special characters `\n\r\t\u0000`; `facts` as a massive array of 10 000 strings each of length 1000, and an empty facts array.  
  **Expected Invariant:** The result contains `โจทย์: "…"` with at most the first 120 characters of `query.trim()`. The facts section displays either bullet-pointed facts or the placeholder `• กำลังดึงข้อมูล...`. The total string length is bounded (no memory explosion), and there are no raw newline injections that break message formatting.

- **Property:** Intent classification remains deterministic for a given fixed input when no LLM is involved (the deterministic path).  
  **Fuzz Input:** A message that explicitly matches a recognised intent trigger, e.g., `"what is the weather"` and `"weather report"` with identical history.  
  **Expected Invariant:** For two calls with identical `message`, `history`, and other options, the returned `intent` field is identical. (Exclude time‑dependent intents like `datetime` if the classifier uses wall‑clock time; adjust to clear‑cut factual queries.)

- **Property:** `userTier` is either `"guest"`, `"user"`, `"admin"`, or `undefined`; any other value is treated as `"guest"` or falls back to a safe default without breaking.  
  **Fuzz Input:** `userTier = "hacker"`, `userTier = 123`, `userTier = ""`, `userTier = null`.  
  **Expected Invariant:** The orchestrator continues to operate without crashing. If a tier-dependent feature exists, it either defaults to `"guest"` constraints or ignores the invalid value, rather than throwing `TypeError` on unknown tier.

- **Property:** `safeEmit` respects the `expectedToolUsage` flag when validating events.  
  **Fuzz Input:** Simulate an internal event with `type: "tool_result"` containing raw file paths, private keys, or system commands in `publicSummary`. Call with `expectedToolUsage=true`.  
  **Expected Invariant:** The event is either rejected and a `fallback` emitted, or if accepted it has been sanitized by the guard such that the summary no longer contains dangerous strings. No raw `mcpClient` data or system paths survive unchecked.
