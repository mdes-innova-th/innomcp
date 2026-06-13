<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D033 role=doc model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":1826,"completion_tokens":2917,"total_tokens":4743,"prompt_tokens_details":{"cached_tokens":81,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2646,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 27s
 generated: 2026-06-13T11:24:42.425Z -->
- **`BrainRole`**  
  Discriminated union identifying the three agent roles: `"coordinator"`, `"brain-1"`, or `"brain-2"`.

- **`OrchestratorConfig`**  
  Configuration shape for `MultiAgentOrchestrator`. All model fields are optional; the constructor applies hardcoded defaults when omitted.

- **`AgentTask`**  
  Represents a task traversing the full multi-agent lifecycle. The `cycle` array is append-only and stores every phase transition.

- **`TaskCycle`**  
  Audit log entry for a single execution phase. `tokensUsed` is optional and may be undefined if the provider does not report consumption.

- **`MultiAgentOrchestrator`**  
  Neural coordinator that runs the three-brain pipeline: deep analysis, fast summarization, and coordinator commit/push/review with memory persistence. Maintains internal state in an `activeTasks` map.

- **`MultiAgentOrchestrator.constructor(config?)`**  
  Merges user-provided partial config with `DEFAULT_CONFIG`.  
  @param `config` — Partial `OrchestratorConfig` overrides.

- **`MultiAgentOrchestrator.createTask(description, priority?)`**  
  Registers a new pending task without executing it.  
  @param `description` — Task prompt/body.  
  @param `priority` — Defaults to `"medium"`.  
  @returns The initialized `AgentTask` with a generated `id`.  
  Caveat: Only creates the record; invoke `executeCycle` to run the pipeline.

- **`MultiAgentOrchestrator.executeCycle(taskId)`**  
  Runs the full Brain-1 → Brain-2 → Coordinator → memory pipeline for the given task.  
  @param `taskId` — Identifier returned by `createTask`.  
  @returns The mutated `AgentTask` with populated results and cycle history.  
  Caveat: Throws if `taskId` is unknown. Runtime errors during the cycle are caught, recorded in the task’s `cycle` log, and surfaced via `status = "failed"` instead of throwing. Cycle entries for analyze/summarize phases are truncated to 500 characters. If no coordinator provider is available, `coordinatorAction` is set to a `SKIP` message rather than throwing.
