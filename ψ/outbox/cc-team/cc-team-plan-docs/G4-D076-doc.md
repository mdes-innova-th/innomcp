<!-- cc-team deliverable
 group: G4 (Doc generation)
 member: D076 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2277,"completion_tokens":820,"total_tokens":3097,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":518,"image_tokens":0},"cache_creation_input_tokens":0} | 12s
 generated: 2026-06-13T11:30:45.846Z -->
- **router** (`Router`)  
  **Purpose:** Express router providing three shell execution endpoints (`POST /api/shell/exec`, `POST /api/shell/stream`, `GET /api/shell/history`). All commands are risk-assessed before execution; medium/high/critical commands require explicit approval (recorded via a pending-approval map with a TTL of 60 seconds). Unauthenticated callers get an empty history result, not a 401.  
  **@returns** – An Express `Router` instance, intended to be mounted at `/api/shell`.  
  **Caveats / Non-obvious behavior:**  
  - The `pendingApprovals` map is pruned every 5 minutes; expired approvals are silently deleted.  
  - The history endpoint enforces an ownership gate: authenticated users see only their own rows plus rows with `user_id IS NULL`; unauthenticated callers always receive an empty array (no data leak).  
  - The streaming endpoint (`POST /stream`) uses Server-Sent Events (SSE) with named event types.  
  - The `WORKSPACE_ROOT` defaults to `../workspace` relative to `process.cwd()` unless `WORKSPACE_ROOT` env var is set.  
  - All endpoints require `AuthRequest` – the user ID is extracted from `req.user.userId`; if missing, `userId` is set to `null`.
