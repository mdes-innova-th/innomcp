<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D069 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":858,"completion_tokens":1135,"total_tokens":1993,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1097,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 13s
 generated: 2026-06-13T11:29:46.656Z -->
* **`default` (router)**
  * Purpose: Express router providing `GET /` and `PUT /` endpoints for retrieving and partially updating user preferences against an in-memory store.
  * Caveats: Data is volatile (stored in a local `Map`, lost on process restart). User identity falls back to `"guest"` if no JWT or API key is provided. `PUT` performs a shallow merge and strictly validates enum fields, returning a `400` for invalid values.
