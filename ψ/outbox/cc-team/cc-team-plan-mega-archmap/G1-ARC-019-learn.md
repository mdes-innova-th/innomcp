<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-019 role=learn model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1734,"completion_tokens":1062,"total_tokens":2796,"prompt_tokens_details":{"cached_tokens":32,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":895,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-13T11:59:50.324Z -->
**Single Responsibility:** Manages and trims conversation history per session to fit LLM token limits.

**Key Exported API:** Singleton `contextManager` exposing `addMessage()`, `getContext()`, `trim()`, `summarize()`, `clear()`, and `stats()`.

**Upstream/Downstream:** Called by chat/agent controllers upstream. Zero downstream dependencies (pure in-memory logic).

**Pipeline Role:** Pre-processing step before LLM API calls. It accumulates conversational turns and prunes older messages (always preserving the initial system prompt) to prevent context window overflow.

**Surprising Coupling:** 
1. `summarize()` is a dead method—it exists but isn't invoked by `trim()`, which simply drops old messages instead of summarizing them. 
2. The in-memory `Map` implicitly couples this service to a single-process lifecycle; it won't persist or scale across instances. 
3. Token counting uses a naive `length/4` heuristic rather than an actual tokenizer, risking inaccurate context truncation.
