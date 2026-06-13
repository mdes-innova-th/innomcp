<!-- cc-team deliverable
 group: G4 (Doc generation)
 member: D077 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":682,"completion_tokens":1297,"total_tokens":1979,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1082,"image_tokens":0},"cache_creation_input_tokens":0} | 26s
 generated: 2026-06-13T11:31:01.122Z -->
- **`default`** (`Router`)
  - **Purpose:** Express router for the `/api/stats` endpoint that serves live aggregate statistics (task counts, feedback averages, and recent agent activity) for the AgentLeaderboard.
  - **@returns** A JSON object containing `tasks` (status counts), `feedback` (average rating and total), `agents` (status counts), and `agentActivity` (top 20 agents by recent step activations).
  - **Caveats:** 
    - Designed to be mounted without authentication for guest access.
    - The `agents` property in the response currently returns hardcoded placeholder values (`active: 12`, `standby: 4`, `total: 16`) rather than live database counts.
    - Degrades gracefully: if the database connection fails or if the `task_steps` table lacks the `agent_id` column, it silently catches the error and returns safe default/empty fallbacks so the frontend leaderboard still renders.
