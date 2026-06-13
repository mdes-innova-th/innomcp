<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-012 role=learn model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1556,"completion_tokens":2171,"total_tokens":3727,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1938,"image_tokens":0},"cache_creation_input_tokens":0} | 41s
 generated: 2026-06-13T11:59:47.125Z -->
**Single Responsibility:** In-memory telemetry aggregation for LLM messages, tool executions, errors, and session lifecycles.

**Key Exported API:** Singleton `analyticsService` exposing `track()`, `getStats()`, session management, and JSON `save/loadSnapshot()`.

**Upstream Callers & Downstream Deps:** 
*Upstream:* Chat orchestrators, LLM clients, and tool runners. 
*Downstream:* Node `fs` and `path`.

**Role in Chat/Agent Pipeline:** Cross-cutting observability. It passively records execution metadata (latency, tokens, success rates) parallel to the main agent loop without blocking inference.

**Surprising Coupling:**
1. *Direct File I/O:* Embedding `fs` read/write logic for snapshots inside a core domain service violates separation of concerns; persistence should delegate to a dedicated repository or external telemetry sink.
2. *Global Singleton:* Exporting a pre-instantiated singleton (`export const analyticsService`) hardwires consumers to this specific instance, bypassing dependency injection and complicating unit test isolation.
