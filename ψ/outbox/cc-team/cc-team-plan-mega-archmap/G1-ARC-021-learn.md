<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-021 role=learn model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":731,"completion_tokens":802,"total_tokens":1533,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":598,"image_tokens":0},"cache_creation_input_tokens":0} | 12s
 generated: 2026-06-13T12:00:02.731Z -->
Single responsibility: Typed pub/sub bus for decoupled, event-driven communication across the system.  
Key export: Singleton `eventBus` with `on`, `emit`, `off`, `once`, `removeAll`.  
Upstream emitters: Agent orchestrator (`agent:started`, `agent:done`), message handler (`message:sent`), tool executors (`tool:called`), health monitor (`mdes:healthy`, `mdes:down`), error reporters.  
Downstream subscribers: Loggers, telemetry, UI state, monitoring dashboards.  
Role in chat/agent pipeline: Orchestration backbone – signals message arrival, agent lifecycle, tool invocations, and errors, allowing tracing and reactive flows without direct coupling.  
Surprising coupling: Global singleton forcing all consumers to share the same bus; runtime error handlers are caught and logged to console, silently discarding failures; generic `Set<Function>` storage sacrifices type safety at runtime despite compile-time typed API.
