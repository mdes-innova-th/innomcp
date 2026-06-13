<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D073 role=doc model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":1080,"completion_tokens":1920,"total_tokens":3000,"prompt_tokens_details":{"cached_tokens":84,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1911,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 29s
 generated: 2026-06-13T11:30:33.915Z -->
- **`default`** — Express `Router` mounting provider CRUD (`GET`, `POST`, `PATCH`, `DELETE`), a connection-test stub (`POST /:id/test`), and a route-preview endpoint (`POST /route-preview`) under `/api/ai/providers`. All list/mutate responses redact `apiKey` and `apiKeyEncrypted`, exposing only `hasApiKey: boolean`. The test endpoint probes `baseUrl` with a fetch timed out at `min(timeoutMs, 3000)` ms; it marks the provider `healthy` on HTTP 2xx–4xx and `degraded` on failure or timeout, but real per-type protocol probing (e.g., Ollama `/api/tags`) is deferred to Phase C-2.5.
