<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-007 role=trace model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2359,"completion_tokens":3981,"total_tokens":6340,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2547,"image_tokens":0},"cache_creation_input_tokens":0} | 76s
 generated: 2026-06-13T12:00:32.237Z -->
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
    *   *Transformation:* Regex searches for fenced code blocks (` ```csv ... ``` `) or bare JSON arrays at the start of the string. Separates the raw data payload from the actual question text.

#### **Phase 3: Plan Assembly**
11. **Construct `ToolPlan`:** The selected `toolName`, transformed `args`, a human-readable `reason`, and `authoritative: true` are packaged into the `ToolPlan` interface.
12. **Return Plan:** `planToolCall` returns the `ToolPlan` (or `null` if no intent matched) to the caller.

#### **Phase 4: Execution & Dispatch (Truncated / Inferred from Docstring & Imports)**
13. **Access Control:** `checkToolAccess` evaluates the `ToolPlan` against `GuestLimits` to ensure the user has permission/quota to execute this specific tool.
14. **Event Emission (Start):** `emit` pushes a `tool_call_start` event (via `newEnvelope`) to the SSE stream, guarded by `checkAgentEventSafe` to prevent UI crashes.
15. **Network Request:** An HTTP POST is sent to `MCP_URL` (`/mcp` JSON-RPC endpoint) containing the `toolName` and `args`. The request is bound by a 20,000ms timeout (`TOOL_TIMEOUT_MS`).
16. **Event Emission (End/Error):** Upon resolution or timeout, `emit` pushes a `tool_call_end` (with the result) or `tool_call_error` event to the SSE stream.
17. **Return Result:** The parsed JSON-RPC result is returned to the conductor/MDES agents to be injected into the final LLM synthesis context.
