<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-009 role=learn model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1899,"completion_tokens":581,"total_tokens":2480,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":297,"image_tokens":0},"cache_creation_input_tokens":0} | 9s
 generated: 2026-06-13T11:58:51.495Z -->
**Single responsibility:** Provider broker – selects the “best” LLM provider from the registry based on request mode, required capabilities, privacy, and health; it does not invoke the model.

**Key exported API:**  
- `selectProvider(opts)` → `SelectionResult` (chosen provider, fallback alternates, Thai reason).  
- `getAvailableProviders()` → `string[]` of env‑gated IDs.  
- `resolveProviderEndpoint(id)` → `{url, key, model}`.  
- `previewSelection(opts)` → UI‑friendly selection preview.

**Upstream callers:** Chat/agent dispatch layer that needs to route a prompt to a concrete provider. Typically invoked before building the LLM client.

**Downstream deps:** `./registry` (listProviders, getProvider, resolveApiKey) and environment variables (process.env). Types from `./types`.

**Role in chat/agent pipeline:** Acts as a decision point that maps a high‑level request specification (mode “local/remote/hybrid”, capability list, privacy) into a concrete provider record, enabling fallback chains and manual overrides.

**Surprising coupling:** `getAvailableProviders` reads `process.env` directly, bypassing the registry abstraction and coupling routing logic to environment variable names. This makes testing harder and ties provider discovery to the Node runtime.
