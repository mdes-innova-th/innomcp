<!-- cc-team deliverable
 group: G2 (archmap division)
 member: ARC-030 role=learn model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1839,"completion_tokens":341,"total_tokens":2180,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 13s
 generated: 2026-06-13T12:01:04.547Z -->
**MDESModelCache** — single responsibility: cache and query the list of available models from a remote MDES Ollama endpoint, and select suitable ones per task.

**Exported API:** `MDESModel` interface, `MDESModelCache` class (`getModels`, `getModel`, `getModelFamilies`, `isModelAvailable`, `getBestModelForTask("thai"|"code"|"reasoning"|"fast")`, `warmUp`, `getStats`), and a shared `mdesModelCache` singleton.

**Upstream callers:** MCP server bootstrap (calls `warmUp` at startup); chat/agent pipeline that must pick a model — e.g., Thai NLU node uses `getBestModelForTask("thai")`, code-assist node uses `"code"`, planning node uses `"reasoning"`, lightweight classification uses `"fast"`. Health/diagnostic endpoints expose `getStats`.

**Downstream deps:** `fetch` against `MDES_OLLAMA_URL/api/tags` (Ollama tags schema), `process.env.MDES_OLLAMA_URL`. No DB, no other services.

**Pipeline role:** gatekeeper for model selection — sits before any LLM call, decoupling task-routing logic from the live Ollama registry and absorbing outages via stale-cache fallback.

**Surprising coupling:** task heuristics encode domain policy (Thai, code, ≥7B reasoning) directly inside the cache; `sizeValue` only recognizes the `…B` suffix, silently returning `Infinity` for missing/unknown sizes, which biases sorting. The exported `MDESModel` shape is Ollama-specific, leaking into all callers.
