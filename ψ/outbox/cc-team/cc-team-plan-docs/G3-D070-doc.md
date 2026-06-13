<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D070 role=doc model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1272,"completion_tokens":457,"total_tokens":1729,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 9s
 generated: 2026-06-13T11:29:55.968Z -->
- **default export `router`** — Express `Router` for the multi-user presence REST API mounted at `/api/presence`. Exposes `GET /:projectId` (public), `POST /:projectId/ping` (auth), and `POST /:projectId/leave` (auth). Note: `GET` is intentionally unauthenticated so dashboards/guests can view occupancy.

- **Helper `parseProjectId(raw: string): number | null`** — Parses a route param into a positive integer project ID. Returns `null` for non-numeric, non-finite, or `<= 0` values; callers translate that to HTTP 400.

- **GET `/:projectId` handler** — Lists active users for a project. @returns 200 `{ projectId, count, users: PresenceEntry[] }` where each entry is `{ userId, displayName, connectedAt, lastPingAt }`; @returns 400 if `projectId` is invalid. No auth required.

- **POST `/:projectId/ping` handler** — Heartbeat that refreshes the caller's presence entry. @returns 200 `{ projectId, ...PresenceEntry }` (caller's refreshed entry, looked up by `userId` from the verified JWT); @returns 400 on invalid `projectId`; @returns 401 if token missing/invalid. Identity comes from the JWT (not the body) so it cannot be spoofed; `displayName` falls back to `userEmail` when `userDispName` is absent. Clients should ping every ~30s to avoid the 60s TTL reaping.

- **POST `/:projectId/leave` handler** — Removes the caller from the project room immediately. @returns 200 `{ projectId, userId, left: true }`; @returns 400 on invalid `projectId`; @returns 401 if token missing/invalid. Intended for tab-close/logout so presence clears without waiting for TTL.

**Shared caveat:** `req.user!` is non-null-asserted after `requireAuth`, so the auth middleware is the only thing standing between callers and a runtime crash on these two POSTs.
