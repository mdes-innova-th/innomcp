<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-001 role=learn model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2715,"completion_tokens":1024,"total_tokens":3739,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":776,"image_tokens":0},"cache_creation_input_tokens":0} | 16s
 generated: 2026-06-13T11:58:22.772Z -->
**Single responsibility:** Orchestrates a deterministic, LLM‑free agent run (Phase C) – classifies intent, dispatches sub‑agents, gathers facts, composes a safe, Thai‑templated answer, and emits every event through a public‑safety gate.

**Exported API:**  
`run(options: ConductorOptions, emit: EmitFn): Promise<RunResult>` – the main entrypoint that produces agent events and the final text.

**Upstream callers:** The chat API route (e.g., `routes/api/chat`).

**Downstream deps:** Intent classifier, parallel/tool/mother dispatchers, provider adapter, session memory, system inventory, event guard, and naturalness guard.

**Role in chat/agent pipeline:** The central conductor; it turns a user message into an event‑gated plan, runs parallel agent steps, and returns a templated final answer without calling an LLM (placeholder for future Ollama streaming).

**Surprising coupling:** A direct `require("../routes/api/chat")` to grab a runtime `mcpClient` from the Express route, tightly binding the orchestrator to server‑side state and the HTTP layer.
