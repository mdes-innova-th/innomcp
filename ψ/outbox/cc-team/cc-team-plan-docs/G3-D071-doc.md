<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D071 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1775,"completion_tokens":774,"total_tokens":2549,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":616,"image_tokens":0},"cache_creation_input_tokens":0} | 9s
 generated: 2026-06-13T11:30:05.373Z -->
- **router** (default export) – Express Router for `/api/projects` endpoints. Provides authenticated CRUD operations for user projects (tasks/memories grouping). All routes require a valid JWT (via `authenticateToken` middleware). Projects are scoped to the authenticated user. Non-obvious: The `projects` table is lazily created on first access if missing. `GET /` returns an empty array if table not found after attempting to create it. `POST /` retries insertion once if table is missing, and clears the `/api/dashboard` cache on success. `GET /:id` and `PATCH /:id` return 404 if not found or not owned. `PATCH` requires at least one field to update.
