<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D050 role=doc model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":2147,"completion_tokens":1095,"total_tokens":3242,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 25s
 generated: 2026-06-13T11:27:35.847Z -->
```typescript
/**
 * Express router exposing chat endpoints: a non-streaming HTTP `POST /`
 * handler and a WebSocket upgrade handler at the same path.
 *
 * Responsibilities include:
 *  - Resolving the active AI mode (local/remote/hybrid) and Ollama clients
 *  - Per-session MCP client initialization and lifecycle management
 *  - Rate limiting, guest/user permission checks, and JWT auth
 *  - Routing each turn through the fast path, semantic router, or
 *    god-tier router depending on mode and confidence
 *  - Optional A/B testing between remote and hybrid modes
 *  - Thai-language validation/segmentation and system inventory awareness
 *  - Streaming or non-streaming LLM responses (with retry/abort on timeouts)
 *  - Optional image generation passthrough
 *  - WebSocket session lifecycle (init → loop → close) with per-connection
 *    correlation IDs and request-queue accounting
 *
 * Mounted under `/api/chat` (see parent router). The sub-router
 * `reportRouter` is mounted at `/report`.
 *
 * Caveats:
 *  - `AI_MODE` is captured once at module load via `getCurrentAIMode()`
 *    and is not re-read until the process restarts.
 *  - Many `process.env` lookups (model names, hosts, secrets) happen
 *    eagerly; changing them at runtime has no effect.
 *  - Host strings are normalized to include an `http://` scheme and to
 *    strip trailing slashes before constructing `URL`/`Ollama` clients.
 *  - When `AI_MODE` is `remote` or `hybrid` but no `REMOTE_OLLAMA_BASE_URL`
 *    (or its aliases) is configured, the module logs a warning and silently
 *    falls back to the local Ollama client.
 */

/**
 * Synchronous Express middleware that, on `POST /`, processes one chat
 * turn: validates payload, resolves session (with guest auth/limits),
 * performs intent classification, runs the fast path or MCP tool
 * pipeline, and returns the assistant reply as JSON.
 *
 * Catches and routes thrown errors to the next error handler instead of
 * crashing the worker. The real streaming/turn logic is implemented in
 * the `processChatTurn` helper (see source); this handler wires it into
 * the HTTP request/response lifecycle.
 *
 * @param req   Express request; body is a {@link ChatRequest} (message,
 *              optional sessionId/image/model/locale, etc.).
 * @param res   Express response; resolves with a JSON `ChatResponse`
 *              (typically `{ reply, sessionId, model, ...meta }`).
 * @param next  Error-forwarding callback used for unhandled failures.
 */

/**
 * Express middleware bound to the same router path that handles
 * `Connection: upgrade` requests and turns the HTTP connection into a
 * bidirectional WebSocket.
 *
 * Behavior:
 *  - Auths the upgrade via `optionalAuth`/`verifyToken` (token may come
 *    from query or headers), extracting `userId` for the session.
 *  - Enforces guest limits for unauthenticated upgrades.
 *  - Pulls a correlation ID from headers/upgrade (see
 *    `extractCorrelationIdFromUpgrade`) and registers the socket with
 *    the shared `requestQueue` so concurrent connection caps are honored.
 *  - On `open`, kicks off `initWebSocketSession(ws, req)`; on `close`,
 *    unregisters and tears down per-session MCP clients.
 *  - Delegates message handling to the `handleWebSocketMessage` helper
 *    (defined in this module).
 *
 * Rejects upgrades that fail auth, rate limiting, or the global queue.
 *
 * @param req   Incoming HTTP upgrade request.
 * @param res   Used to send 4xx/5xx if the upgrade is refused.
 * @param next  Forwarded to the next handler when this is not an upgrade.
 */

/**
 * Sub-router that exposes the chat reporting endpoints (e.g. analytics,
 * turn logs, feedback). Mounted at `/report` relative to the parent
 * chat router; see `./chat/report` for the actual routes.
 */
```

Note: a handful of `logBoth` calls in the snippet contain garbled `?` characters (likely an encoding issue in the source) — they look like standard info/warn log messages for "Remote AI …" and a missing-config warning, but the exact text can't be read from the truncated input. I documented the observable behavior instead of guessing the strings.

Only three exported symbols are present in the file (`router` default, the sub-router default `reportRouter`, and the implicit named exports for `processChatTurn`/`initWebSocketSession`/`handleWebSocketMessage` are *not* `export`ed in the shown code) — I documented the three that match the explicit `export` keywords and described the helpers as internal. If you'd like doc-comments for the internal helpers (`processChatTurn`, `initWebSocketSession`, `handleWebSocketMessage`, `processWebSocketTurn`, etc.), point me at the rest of the file and I'll add them.
