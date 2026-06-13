<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-007 role=learn model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2363,"completion_tokens":2033,"total_tokens":4396,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1831,"image_tokens":0},"cache_creation_input_tokens":0} | 40s
 generated: 2026-06-13T11:59:15.594Z -->
**Single Responsibility:** Translates classified chat intents and raw queries into structured MCP tool execution plans and dispatches them.

**Key API:** `ToolPlan` (interface), `planToolCall(intent, query)` (maps intent to tool/args).

**Upstream/Downstream:** Upstream: `conductor` (SSE orchestrator), `intentClassifier`. Downstream: External MCP JSON-RPC server, `guestLimiter`.

**Pipeline Role:** Bridges intent classification and tool execution. Emits `tool_call_*` SSE events for the `MultiAgentPanel` UI, then returns results to MDES agents for synthesis.

**Surprising Coupling:** Embeds heavy, hardcoded regex heuristics for entity extraction (Thai/English math, weather, ISP, evidence signals) directly in the dispatcher rather than using an LLM or dedicated NER service. Also tightly couples to `guestLimiter` middleware for access checks inside the dispatch flow.
