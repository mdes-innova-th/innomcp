<!-- cc-team deliverable
 group: G4 (Doc generation)
 member: D083 role=doc model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":2227,"completion_tokens":3040,"total_tokens":5267,"prompt_tokens_details":{"cached_tokens":84,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3236,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 69s
 generated: 2026-06-13T11:32:25.295Z -->
- **`router`** — The module’s exported Express `Router` mounting session-scoped workspace endpoints (`GET /files`, `POST /files`, `DELETE /files`, `GET /stats`).
  - **Caveats**: Session ID resolution prefers `req.query.sessionId`, then falls back to decoding a Bearer JWT via `jwt.verify` using `process.env.JWT_SECRET` (hard-coded fallback `'innomcp-secret'`). All file paths are hardened against traversal by `isPathTraversalSafe`, which rejects `..`, null bytes, absolute paths, and leading `/` or `\` separators. `POST /files` additionally enforces a 10 MB UTF-8 content limit via `Buffer.byteLength`.
