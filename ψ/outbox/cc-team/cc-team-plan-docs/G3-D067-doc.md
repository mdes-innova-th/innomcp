<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D067 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":855,"completion_tokens":2119,"total_tokens":2974,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1791,"image_tokens":0},"cache_creation_input_tokens":0} | 41s
 generated: 2026-06-13T11:30:14.688Z -->
- **`orchestratorRouter`** (default export)
  - **Purpose:** Express router exposing the Multi-Agent Orchestrator (Brain-1, Brain-2, Coordinator) as RESTful endpoints to create, poll, and list orchestration tasks.
  - **Endpoints (`@param` / `@returns`):**
    - `POST /tasks`: Creates a task and begins execution. **@param** (body) `description` (string, required), `priority` ("low"|"medium"|"high"|"urgent", defaults to "medium"). **@returns** `202 Accepted` with `{ taskId, status }`.
    - `GET /tasks/:taskId`: Polls the status of a specific task. **@param** (path) `taskId` (string). **@returns** `200 OK` with the task object, or `404 Not Found`.
    - `GET /tasks`: Lists all tracked tasks (active and completed). **@returns** `200 OK` with `{ tasks: Task[] }`.
  - **Caveats:** 
    - Instantiates a process-wide singleton `MultiAgentOrchestrator` configured via `ORCHESTRATOR_MEMORY_PATH`, `ORCHESTRATOR_TMUX_SYNC`, and `ORCHESTRATOR_REMOTE_SYNC` environment variables.
    - `POST /tasks` triggers the agent execution cycle asynchronously and returns the HTTP response immediately; it does not block for cycle completion, and async cycle errors are only logged to `console.error`.
