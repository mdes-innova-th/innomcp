<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-002 role=trace model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1393,"completion_tokens":2505,"total_tokens":3898,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1488,"image_tokens":0},"cache_creation_input_tokens":0} | 48s
 generated: 2026-06-13T11:58:56.060Z -->
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
