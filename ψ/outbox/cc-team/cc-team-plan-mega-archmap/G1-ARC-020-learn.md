<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-020 role=learn model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":2284,"completion_tokens":291,"total_tokens":2575,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 22s
 generated: 2026-06-13T12:00:09.552Z -->
**dataAnalysisTool** — single-purpose CSV introspection.

**Responsibility:** Parse CSV (string or workspace file), compute per-column stats, optionally render a bar-chart SVG and persist it.

**Exported API:** `analyzeData(input, opts)` → `Promise<AnalysisResult>`; types `ColumnStats`, `AnalysisResult`.

**Pipeline role:** Downstream of the agent's tool dispatcher. The LLM emits a tool call (file path or inline CSV) → MCP tool wrapper invokes `analyzeData` → `summary`/`chartSvg`/`artifactPath` flow back into the chat as a tool result for the model to narrate.

**Upstream callers:** MCP tool server / agent executor registering it as a tool (likely peers with `sqlTool`, `chartTool`).

**Downstream deps:** `node:fs/promises`, `node:path` only — no DB, no charting lib.

**Surprising coupling:**
- Dual input mode couples the *pure parser* to filesystem I/O.
- Side effect: auto-writes `artifacts/charts/chart-<ts>.svg` whenever a chart is produced — the "analysis" module silently mutates the workspace.
- Naive CSV parser (no RFC 4180 escaped-quote handling, no `Date` type branch despite the union declaring it).
- Heuristic numeric detection (>70% parseable) silently misclassifies ID columns.
