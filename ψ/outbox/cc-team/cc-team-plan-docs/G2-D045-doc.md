<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D045 role=doc model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":893,"completion_tokens":258,"total_tokens":1151,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 6s
 generated: 2026-06-13T11:26:51.958Z -->
### Exported Members

- **`default` (Express `Router`)**
  - Express router exposing `POST /stream` for SSE-based agent execution.
  - Mount under any prefix (e.g. `app.use('/api/agent', router)`).
  - @param body `StreamRequestBody` — `{ task: string, projectId?: string }`. Returns 400 if `task` is missing/non-string.
  - On success, writes each `AgentEvent` as `data: <json>\n\n` and terminates with `event: done\ndata: {}\n\n`.
  - On failure, emits `event: error` with `{ error: message }` before closing the response.
  - Aborts the agent loop via `AbortController` when the client disconnects (`req.on('close')`); the loop's `signal` is also aborted in `finally` for cleanup.
  - Caveats: `llm` is currently a stub returning `{ content: 'LLM not implemented' }`; uses `createRegistry()` per request (not request-scoped per `projectId`); `projectId` is parsed but not used; `X-Accel-Buffering: no` is set to bypass nginx buffering.
