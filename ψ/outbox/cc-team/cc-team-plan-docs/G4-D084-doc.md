<!-- cc-team deliverable
 group: G4 (Doc generation)
 member: D084 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":393,"completion_tokens":656,"total_tokens":1049,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":561,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 7s
 generated: 2026-06-13T11:31:27.515Z -->
- **`router`**
  - Purpose: Express Router defining endpoints for listing and downloading task artifacts.
  - `@returns` `Router` - The configured Express router.
  - Caveats: The specific artifact download route (`/tasks/:taskId/artifacts/:name`) forces a file download via the `Content-Disposition: attachment` header and defaults `Content-Type` to `application/octet-stream` if `mimeType` is undefined.
