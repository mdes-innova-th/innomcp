<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-006 role=learn model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2703,"completion_tokens":686,"total_tokens":3389,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":420,"image_tokens":0},"cache_creation_input_tokens":0} | 9s
 generated: 2026-06-13T11:58:40.295Z -->
**Single Responsibility:** Orchestrates MDES multi-agent dispatch based on intent and query complexity; uses ≥2 child agents (thinker + responder) per query, escalating to GPT only after two MDES failures.

**Key Exported API:** `AgentPlanItem`, `AgentDispatchOptions`, `AgentPlanOptions`, `INTENT_AGENTS` (legacy), `INTENT_AGENTS_POOL`, and likely a dispatch function (not fully shown).

**Upstream Callers:** Mother/conductor module. **Downstream Dependencies:** `./events` (AgentId, envelope), `./eventGuard`, `./conductor` (EmitFn), `../providers/router` (ChatMode), plus numerous environment variables for Ollama endpoints.

**Role in Pipeline:** Phase 10.16 – mother-orchestrated MDES dispatch; selects agents per intent (e.g., `"knowledge": [thinker, rag-agent, …]`) and scales count by query token length.

**Surprising Coupling:** Hardcoded intent→agent pools and role→model mappings (e.g., `critic: gemma4:e4b`). Coexistence of legacy `INTENT_AGENTS` and new `INTENT_AGENTS_POOL` for backward compatibility.
