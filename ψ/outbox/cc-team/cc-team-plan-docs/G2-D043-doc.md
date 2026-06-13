<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D043 role=doc model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":1198,"completion_tokens":1192,"total_tokens":2390,"prompt_tokens_details":{"cached_tokens":81,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1159,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 15s
 generated: 2026-06-13T11:26:34.366Z -->
- **`sessionsRouter`** (default export): Express `Router` that exposes admin session management endpoints under `/api/admin/sessions`. Relies on the parent admin router for `authenticateToken` and `requireRole(0)` guards.  
  **Caveats:**  
  - `DELETE /user/:userId` is registered before `DELETE /:jti` to prevent Express from interpreting the literal path segment `"user"` as a JTI parameter.  
  - Both `DELETE` endpoints reject attempts to revoke the requesting admin’s own sessions; self-logout must be performed via `/api/auth/logout`.
