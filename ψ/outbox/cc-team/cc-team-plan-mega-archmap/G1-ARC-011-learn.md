<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-011 role=learn model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1612,"completion_tokens":365,"total_tokens":1977,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":121,"image_tokens":0},"cache_creation_input_tokens":0} | 6s
 generated: 2026-06-13T11:59:07.365Z -->
**Single responsibility:** Implements a plan‑act‑observe agent loop that drives an LLM to autonomously complete a task using tools.

**Key exported API:**  
- `runAgentLoop(...)` – an async generator yielding `AgentEvent` (plan, tool_call, tool_result, message, artifact, done, error).  
- `AgentEvent` type – consumed by UI or downstream processors.

**Upstream callers:** Workspace UI, agent runner, or any orchestrator that wants real‑time progress of an autonomous agent.

**Downstream deps:**  
- `ToolRegistry` (provides `getToolSpecs()` and `execute()`).  
- `llm` function (takes messages + tool specs, returns content or tool calls).  
- Optional `AbortSignal`.

**Role in pipeline:** Central orchestration: yields events for each step, manages conversation history, enforces max steps, handles aborts, and sanitizes errors.

**Surprising coupling:** None; it’s cleanly decoupled via dependency injection. The only implicit coupling is the expectation that `ToolRegistry` and `llm` follow the exact interfaces defined in the signature.
