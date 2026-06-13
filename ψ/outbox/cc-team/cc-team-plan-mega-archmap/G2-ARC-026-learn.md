<!-- cc-team deliverable
 group: G2 (archmap division)
 member: ARC-026 role=learn model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2573,"completion_tokens":497,"total_tokens":3070,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":291,"image_tokens":0},"cache_creation_input_tokens":0} | 18s
 generated: 2026-06-13T12:00:36.832Z -->
**Single responsibility:** Image generation with provider failover (MDES Gateway → Pollinations.ai).  
**Key exported API:** `callImageGen(prompt, opts?) → ImageGenResponse` (async); `buildImageGenText(result) → string`; interfaces (`ImageGenResult`, `ImageGenError`).  
**Upstream callers:** Agent/chat MCP tool handlers invoking image generation.  
**Downstream deps:** External HTTP APIs (gateway, Pollinations), `mcpLogger`, env vars (`IMAGE_GEN_GATEWAY_URL`, `TOKEN`, `TIMEOUT_MS`).  
**Role in pipeline:** Converts user prompt → provider request → structured result with metadata (provider, model, timing). Supports prompt adaptation (English/Thai) via `opts.adaptedPromptEn`.  
**Surprising coupling:** Inline prompt cleaning logic (`cleanPrompt`) rather than delegated to a separate adapter; tight coupling to `mcpLogger` for structured logging.
