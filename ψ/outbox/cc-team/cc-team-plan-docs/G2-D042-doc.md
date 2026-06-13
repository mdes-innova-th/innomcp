<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D042 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1818,"completion_tokens":2262,"total_tokens":4080,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1909,"image_tokens":0},"cache_creation_input_tokens":0} | 43s
 generated: 2026-06-13T11:26:59.775Z -->
- **`router`** (Default Export)
  - **Purpose:** Express router for the `/api/activity` endpoint that aggregates recent system events (task creation/completion, agent actions, project creation) into a unified, chronologically sorted live feed.
  - **`@param` (Query):** 
    - `limit` (number): Max items to return. Defaults to 20, clamped between 1 and 100.
    - `projectId` / `project_id` (string): Filters events to a specific project.
    - `userId` / `user_id` (string): Filters events to a specific user.
  - **`@returns`:** `ActivityItem[]` — Array of recent activity events.
  - **Caveats/Behavior:** 
    - Uses `optionalAuth`; if an unauthenticated guest requests a `userId` filter, it scopes to their own guest ID (best-effort, no strict auth guard).
    - Fetches `limit * 3` items per individual source query before merging to ensure sufficient results remain after the final sort.
    - Lazily ensures the `projects` table and `tasks.project_id` column/index exist on the first request (cached via module-level flags to avoid repeated DDL queries).

- **`ActivityItem`** (Interface)
  - **Purpose:** Defines the response shape for a single event within the activity feed.
  - **Caveats/Behavior:** `userId` and `projectId` can be `null`. The `agentId` property is optional and is only populated for `agent_action` event types (sourced from `task_steps`).
