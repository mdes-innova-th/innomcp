<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D068 role=doc model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":381,"completion_tokens":1682,"total_tokens":2063,"prompt_tokens_details":{"cached_tokens":84,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1679,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 23s
 generated: 2026-06-13T11:29:56.427Z -->
- **`router`** (default export) — Express `Router` exposing the plugin registry REST endpoints. Side-effect: invokes `ensureBuiltIns()` once on module import to seed built-in plugins.
  - `GET /` → Returns `{ plugins: Plugin[] }`.
  - `PATCH /:id` → Expects request body `{ enabled: boolean }`. Returns `{ plugin: Plugin }` on success; responds `400` if `enabled` is missing or not a boolean, and `404` if the plugin `:id` is not found.
