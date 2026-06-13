<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D034 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":2198,"completion_tokens":1078,"total_tokens":3276,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":913,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 16s
 generated: 2026-06-13T11:24:58.698Z -->
- **`ToolPlan`**: Defines the structure for a planned MCP tool invocation, specifying the target tool, its arguments, the reason for the call, and whether the tool's result is considered authoritative.
- **`planToolCall`**: Resolves a given chat intent and user query into a specific MCP tool call plan.
  - `@param intent` - The classified `ChatIntent` determining the broad tool category.
  - `@param query` - The raw user query string, used to extract specific tool arguments (e.g., math expressions, provinces, evidence actions).
  - `@returns` A `ToolPlan` object if a matching tool is found, otherwise `null`.
  - *Caveat*: Defaults the weather province to `"กรุงเทพมหานคร"` if province extraction fails; evidence routing relies on keyword signals as a fallback even if the primary intent isn't strictly evidence.
