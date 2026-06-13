<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D058 role=doc model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":1415,"completion_tokens":2770,"total_tokens":4185,"prompt_tokens_details":{"cached_tokens":84,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2954,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 22s
 generated: 2026-06-13T11:28:23.314Z -->
- **`default` (`router`)** — Express router for the Project Memory API mounted at `/api/memories`. Supports listing (max 50), searching by key/value substring (max 20), upserting (`ON DUPLICATE KEY UPDATE`), and deleting memory records scoped to session, project, or user; applies `optionalAuth` to all routes. **Caveats:** `POST /` does not persist `user_id`, so memories may not be associated with the caller; `DELETE /:id` deletes by primary key without verifying ownership or project access; database errors on `GET` routes silently yield empty arrays.
