<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-004 role=learn model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":2380,"completion_tokens":1119,"total_tokens":3499,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1018,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 9s
 generated: 2026-06-13T11:58:31.715Z -->
**Single Responsibility**: Orchestrates concurrent fan-out to multiple AI providers, tracking latency/cost, and returning the best synthesis.

**Key Exported API**: `MotherDispatchResult`, `INTENT_KEYWORDS`, `AI_ISMS`, `dispatchMother`.

**Upstream Callers**: Conductor (specifically in "thinking mode").

**Downstream Deps**: `providers/registry`, `providers/router`, `leaderboardMetrics`, `motherHistory`, `errorRecovery`, `motherProviderToggle`, and external AI APIs (OpenAI, Anthropic, Ollama, Innova Oracle).

**Role in Pipeline**: Acts as the "Mother" aggregator during deep thinking; queries diverse models simultaneously to select the highest-quality synthesis.

**Surprising Coupling**: Caches Innova Oracle auth tokens in module-level state (`_oracleToken`), and directly reads the `MDES_ONLY` env var to restrict routing, tightly coupling infrastructure policy to dispatch logic.
