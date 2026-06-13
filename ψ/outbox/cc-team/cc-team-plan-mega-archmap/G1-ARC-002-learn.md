<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-002 role=learn model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1397,"completion_tokens":1479,"total_tokens":2876,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1284,"image_tokens":0},"cache_creation_input_tokens":0} | 29s
 generated: 2026-06-13T11:58:36.088Z -->
**Single Responsibility:** Outbound sanitization gate blocking `AgentEvent`s containing internal reasoning, secrets, or debug placeholders from the public SSE stream.

**Key API:** `checkAgentEventSafe(event, opts)` and `checkVisibleTextSafe(text, opts)` returning a `GuardResult`.

**Upstream/Downstream:** Called by the SSE orchestrator and naturalness guard. Depends on `./events` for `AgentEvent` shape validation.

**Pipeline Role:** Final pre-write filter in the agent pipeline, preventing prompt-leakage and UI noise before network emission.

**Surprising Coupling:** Despite acting as a generic security boundary, it hardcodes domain-specific map literals (e.g., Thai map errors, "Weather Map Placeholder") and map-specific flags (`allowMapTerms`). Furthermore, it deliberately bypasses TypeScript type-safety, relying on naive `JSON.stringify` substring scanning to catch untyped runtime object merges.
