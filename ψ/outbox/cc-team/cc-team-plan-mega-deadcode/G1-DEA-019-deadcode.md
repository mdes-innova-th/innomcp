<!-- cc-team deliverable
 group: G1 (deadcode division)
 member: DEA-019 role=deadcode model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1396,"completion_tokens":4683,"total_tokens":6079,"prompt_tokens_details":{"cached_tokens":32,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4683,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 42s
 generated: 2026-06-13T12:03:11.640Z -->
| Location | What | Why-safe-to-remove |
|---|---|---|
| `catch` block, `err as { name?: string; status?: number; message?: string }` | `name` property in type assertion | Only `message` and `status` are ever read from `e`; `name` is asserted but never accessed — pure dead type member |
| Module-level `let defaultClient` + `export function getDefaultMcpClient()` | Singleton mutable state and getter | File explicitly documents it is "NOT YET wired"; no caller exists. Adds module-level mutable state (`let … = null`) for zero benefit — consumers already instantiate via `new McpClient()` per the file's own usage example. Re-introduce when/if a singleton is actually needed. |
