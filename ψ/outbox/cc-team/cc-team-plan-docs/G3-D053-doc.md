<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D053 role=doc model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":1100,"completion_tokens":2451,"total_tokens":3551,"prompt_tokens_details":{"cached_tokens":84,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2521,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 26s
 generated: 2026-06-13T11:28:01.653Z -->
- **`router`** (default export)
  - Express `Router` mounted at `/api/dashboard`. Returns a consolidated JSON summary of task statistics, recent non-archived tasks, average feedback rating, and shell executions in the last 24 hours. Requires JWT authentication.
  - `@param req.query.projectId | req.query.project_id` — Optional project filter. When provided, lazily ensures the `tasks` table has a `project_id` column and composite index on first use (idempotent, swallows errors).
  - `@returns` `{ stats: {...}, recentTasks: [...], generatedAt: string }`. On any database error, returns zeroed stats and an empty `recentTasks` array instead of an HTTP error.
  - `@remarks` Results are scoped to the authenticated `userId` when present in the JWT payload; if `userId` is missing, no ownership filter is applied.
