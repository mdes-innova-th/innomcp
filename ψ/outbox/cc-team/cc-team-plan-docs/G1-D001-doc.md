<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D001 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1639,"completion_tokens":1098,"total_tokens":2737,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":571,"image_tokens":0},"cache_creation_input_tokens":0} | 19s
 generated: 2026-06-13T11:19:28.463Z -->
- **`AgentEvent`**  
  Union type of events emitted by the agent loop. Each variant describes a step: planning, tool calls, results, assistant messages, artefacts, completion, or errors.  
  No `@param`/`@returns` (type-only).  
  *Caveat*: The `tool_call` and `tool_result` events include a unique `id` that links the call to its result; consumers should track this correspondence for UI rendering.

- **`runAgentLoop`**  
  Standalone async generator implementing a plan‑act‑observe loop. It repeatedly calls the supplied LLM with conversation history and tool specs, executes any tool calls sequentially, and yields events for real‑time ingestion. The loop stops on a content‑only response, an error, abort, or reaching `maxSteps`.  
  **`@param opts.task`** – The user’s task description (initial prompt).  
  **`@param opts.tools`** – Tool registry providing `getToolSpecs()` and `execute(name, input, opts)`.  
  **`@param opts.llm`** – Function that receives messages and tool specs, returns `{content?, toolCalls?}`.  
  **`@param opts.maxSteps`** – Maximum LLM iteration rounds (default `8`).  
  **`@param opts.signal`** – Optional `AbortSignal` to cancel the loop at any safe point.  
  **`@yields`** `AgentEvent` items describing progress, tool calls, results, assistant messages, artefacts, errors, or completion.  
  *Caveats*:  
  - Tool calls are executed **sequentially**, one per LLM response; parallel execution is not supported.  
  - Tool arguments are parsed with `JSON.parse` before execution; parse errors become tool‑result events with an error message.  
  - Tool execution errors are caught and yielded as `tool_result` events (with `output` as the error string), and the error message is stored in the conversation history.  
  - An `AbortSignal` check is performed before each LLM call, after parsing arguments, and before tool execution; abort yields an `error` event and returns.  
  - If the LLM returns an empty response (neither content nor tool calls), an `error` event is yielded and the loop terminates.  
  - The loop yields an `error` event if `maxSteps` is reached without a final answer.
