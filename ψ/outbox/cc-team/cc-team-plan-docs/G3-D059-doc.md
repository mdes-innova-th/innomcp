<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D059 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1305,"completion_tokens":2379,"total_tokens":3684,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2064,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 24s
 generated: 2026-06-13T11:28:31.360Z -->
- **`default` (router)**: Express router that mounts all metrics API endpoints for querying, clearing, and summarizing system latency and performance metrics.
  - `GET /`: Returns all current metrics grouped by type (`endpoints`, `tools`, `websockets`, `other`). `@returns` JSON object of grouped metrics.
  - `GET /performance`: Returns in-memory per-route call counts, latency stats, error rates, and slow routes (avg > 500ms). `@returns` JSON with `routes`, `slowRoutes`, and `generatedAt`.
  - `GET /:name`: Retrieves a specific metric by name. `@param name` (path) - metric name. `@returns` JSON with metric `name`, `timestamp`, and `stats`; returns 404 if not found.
  - `DELETE /:name`: Clears a specific metric by name (primarily for testing). `@param name` (path) - metric name. `@returns` JSON confirmation message.
  - `GET /advanced`: Generates an advanced metrics report from Redis. `@param days` (query) - number of days to include (defaults to 1). `@returns` JSON report.
  - `GET /summary/overview`: Returns a high-level overview of system performance, including a `healthScore` (starts at 100, subtracts 10 for each endpoint/tool with p95 > 2s). `@returns` JSON overview object.
  - **Caveat**: The `GET /:name` route is registered before `GET /advanced` and `GET /summary/overview`. Due to Express route matching order, requests to `/advanced` and `/summary/overview` will be intercepted by `/:name` and fail to reach their intended handlers, making those two endpoints unreachable.
