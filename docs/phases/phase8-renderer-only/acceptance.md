# Phase 8: LLM as Renderer Only - Acceptance Criteria

## 1. Deterministic Routing

- Tools/Gates must correctly classify the 25 test cases without overlap.
- `GeneralGate` MUST intercept pure knowledge queries and MUST NOT intercept tool-dependent queries (GEO/WX/EVI).

## 2. Quality Markers (Renderer Standards)

- **Formatting:** Tool outputs must be formatted in clean Markdown (bullet points, bold text) by the God-Tier MCP / Renderer.
- **Accuracy:** The Renderer must not invent data not present in the tool's JSON output. If the JSON says 20% rain, the text must say 20% rain.
- **No Raw Data:** Raw JSON buffers or database rows must never reach the final user chat bubble.

## 3. Trace v3 Hygiene

- `CHAT_TRACE_QA=1` must produce structured trace logs.
- Trace logs must only contain expected metadata (`route`, `durMs`, `tool`, `code`) and the final `q` / `ans`.
- Secrets (`DETECT_DB_PASSWORD`) and raw prompt weights must **not** be written to the Trace v3 log.

## 4. Execution Budget Limits

- `GeneralGate` fast-LLM operations MUST adhere strictly to `GENERAL_LLM_BUDGET_MS` (default 5000ms).
- Weather Pipeline MUST enforce its internal `budgetMs` (default 30000ms max).
- Timeouts must be evaluated gracefully with standard `ERR:CODE` mappings rendered into polite Thai.
