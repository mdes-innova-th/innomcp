<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-016 role=learn model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1438,"completion_tokens":518,"total_tokens":1956,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":278,"image_tokens":0},"cache_creation_input_tokens":0} | 8s
 generated: 2026-06-13T11:59:32.245Z -->
**Single responsibility:** Concurrency throttling & priority queueing for async tasks, capping parallel execution and queue depth to prevent resource exhaustion.

**Key exported API:** Singleton `backpressureHandler` exposing `enqueue(task)`, `getStats()`, `drain()`, `clear()`, `setMaxConcurrent(n)`. `enqueue` returns a promise resolved when the task runs and completes.

**Upstream callers:** Any module performing LLM calls, tool executions, or agent steps that need backpressure (e.g., `TaskRunner`, `Orchestrator`).

**Downstream deps:** None—it wraps arbitrary `() => Promise<unknown>` functions; only depends on native `Promise`.

**Role in chat/agent pipeline:** Acts as a throttle in the execution layer, managing concurrency for expensive operations (e.g., model inference, external APIs). It prioritises tasks by priority, ensuring critical agent steps aren’t starved.

**Surprising coupling:** The singleton design means all callers share the same queue and limits, coupling unrelated flows. Priority sorting via binary search may be over-engineering for typical sub‑100 item queues.
