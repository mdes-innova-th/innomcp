<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-024 role=learn model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":2031,"completion_tokens":1214,"total_tokens":3245,"prompt_tokens_details":{"cached_tokens":32,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1065,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 9s
 generated: 2026-06-13T12:00:18.838Z -->
**Single Responsibility:** Aggregates system and custom service health checks into a single, 10-second cached status response.

**Key Exported API:** `HealthAggregator` singleton (`getInstance`, `registerChecker`, `check`) and types (`AggregatedHealth`, `HealthChecker`).

**Upstream Callers:** HTTP routers (`/health` endpoints) or container orchestrators (Kubernetes liveness/readiness probes).

**Downstream Deps:** Node.js `process` APIs, `setImmediate`/`setTimeout`, and external services (DBs, caches) that register custom checkers via `registerChecker`.

**Pipeline Role:** Out-of-band observability; ensures the node is alive and resourced enough to handle chat/agent traffic, but doesn't process pipeline data directly.

**Surprising Coupling:** Hardcoded Thai language strings in timeout/error handlers (e.g., `หมดเวลา`), tightly coupling infrastructure-level observability to a specific locale.
