<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D074 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":585,"completion_tokens":1136,"total_tokens":1721,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1010,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 10s
 generated: 2026-06-13T11:30:24.956Z -->
* **`default` (Router)**
  * Purpose: Express Router that exposes the `POST /api/providers/test-call` endpoint, which sends a single user message to a specified provider and returns the response text alongside the wall-clock duration.
  * @returns Responds with `{ response: string, durationMs: number }` on success, or `{ error: string, durationMs: number }` on failure (HTTP 502).
  * Caveats: This is a public endpoint (no API key required) that relies on the mounting application to apply rate limiting. It returns HTTP 404 if the provider is not found and HTTP 400 if the provider is disabled or if `providerId`/`message` are missing/empty.
