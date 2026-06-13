<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D051 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2214,"completion_tokens":1030,"total_tokens":3244,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":500,"image_tokens":0},"cache_creation_input_tokens":0} | 13s
 generated: 2026-06-13T11:27:35.153Z -->
- **`router`** (default export)  
  Express router that exposes a single `POST /api/chat/stream` endpoint for streaming agent chat responses via Server-Sent Events.

  **Parameters** (from request body):
  - `message` (string, required) – The user’s chat message.
  - `messages` (Array<{sender: "user"|"ai", text: string}>, optional) – Message history; only the last 20 entries are used.
  - `sessionId` (string, optional) – Session identifier for state continuity.
  - `preferredMode` (`"local"|"remote"|"hybrid"`, optional) – Override the chat mode.
  - `preferredProviderId` (string, optional) – Force a specific provider.
  - `responseMode` / `reasoningMode` (`"normal"|"thinking"`, optional) – Controls the agent’s run mode.
  - `thinkingMode` (boolean, optional) – Enables extended thinking.
  - `toolHint` (string, optional) – Suggests a tool for the agent.
  - `clientMessageId` (string, optional) – Client-side deduplication key.
  - `projectId` (string, optional) – Associates the request with a project.

  **Returns**: `text/event-stream` – Each line contains an `event:` and `data:` field according to the SSE spec. Events are of type `AgentEvent` (e.g., `draft_delta`, `agent_delta`, `final_answer`, `error`). The stream ends after a `final_answer` or `error` event, or on client disconnect.

  **Non‑obvious behavior / caveats**:
  - A heartbeat comment (`: heartbeat`) is sent every 15 seconds to prevent proxies from closing idle connections.
  - Client disconnect is detected via `res.on("close")` instead of `req.on("close")` to avoid premature cleanup when the request body finishes reading.
  - Guest users have response‑length limits enforced per-stream: `draft_delta` text is clamped, and `final_answer` text is truncated via `limitResponseLength`; other event fields (`publicSummary`, `fallbackReason`) are capped at 180 characters.
  - The endpoint automatically flushes the response after every write to ensure immediate delivery even when compression middleware is active.
  - The stream is also persisted as a task record in the database (Phase 5 integration).
