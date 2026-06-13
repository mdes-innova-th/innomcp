<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D003 role=doc model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":213,"completion_tokens":1582,"total_tokens":1795,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1541,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 17s
 generated: 2026-06-13T11:19:27.017Z -->
- **`artifactService`** — Service object that exposes operations for listing and retrieving task artifacts.

- **`artifactService.listArtifacts(taskId)`** — Returns the names of all artifacts associated with a task.
  - `@param` `taskId` — The task identifier.
  - `@returns` Promise resolving to an array of artifact name strings.

- **`artifactService.getArtifact(taskId, name)`** — Retrieves a specific artifact and reshapes its fields for the router.
  - `@param` `taskId` — The task identifier.
  - `@param` `name` — The artifact name.
  - `@returns` Promise resolving to an object with `name`, `mimeType`, and `buffer` (the artifact content as a UTF-8 `Buffer`).
  - **Caveat:** Renames the underlying `mime` property to `mimeType` and converts the stored string `content` into a `Buffer`; the router expects exactly these field names.
