# Phase 7.4: General Intelligence Hardening - Acceptance Criteria

## 1. Minimal CI & Verifier

- Running `scripts/run_minimal_ci.ps1` MUST result in a `PASS` exit code (0).
- Building the backend and MCP server MUST succeed without compilation errors.
- A dedicated verifier script (`verify_phase74_general.ts` or similar) MUST pass all defined test cases, particularly ensuring the budget timeouts and fallback logic work correctly.

## 2. PII & Log Leakage Prevention

- **Trace Logging:** `ChatTraceOut` logs MUST ONLY be written when `CHAT_TRACE_QA=1` is true.
- **No Raw Payloads in Output:** The LLM's raw generation metrics, database rows, or internal stack traces MUST NOT leak into the `structuredContent` or standard stdout logs visible to normal users.
- **Error Sanitization:** If the fast LLM fails or times out, the backend MUST NOT leak the internal error message (e.g., "Error: GENERAL_FAST_TIMEOUT"). It MUST cleanly use the predefined Thai fallback copy.

## 3. Strict Routing (Negative Intent Check)

- Real tools (Evidence DB, Weather APIs, Geo Logic, Calculators, URL fetchers) MUST NEVER be blocked by `GeneralGate`. The regex checks for tools MUST accurately bypass the `GeneralGate`.
- If a user sends a mixed query (e.g., "AI คืออะไร แล้วตอนนี้กรุงเทพฝนตกไหม"), it SHOULD ideally bypass `GeneralGate` and hit the MCP God-Tier so that the Weather tool can be used.

## 4. Response Time (Budget Enforcement)

- The execution time of `GeneralGate` MUST NOT exceed `GENERAL_LLM_BUDGET_MS` + a small structural overhead (~500ms max).
- If the LLM is slow, it MUST cleanly abort and return the localized fallback string.
