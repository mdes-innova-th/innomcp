<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D060 role=doc model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1318,"completion_tokens":318,"total_tokens":1636,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 70s
 generated: 2026-06-13T11:29:33.658Z -->
- **`router`** — Default-exported Express `Router` exposing the ad-hoc `/api/model-settings/test` and `/api/model-settings/providers` endpoints for testing arbitrary model endpoints without a registered provider. Mount under `/api/model-settings` to match the documented paths.

- **`POST /test`** — Probes an OpenAI-compatible chat endpoint with a trivial "Hi" prompt and returns latency plus a short sample. Body: `{ baseUrl, apiKey?, modelName, provider }`; `baseUrl` and `modelName` are required (returns 400 otherwise), `apiKey` is sent as `Authorization: Bearer …` only when present. Internally appends `/chat/completions`, forces `stream:false` with `max_tokens:5`, and aborts after 8s. Response: `{ success, latencyMs, model?, sample?, error? }` with `sample` truncated to 60 chars and `error` to 120; HTTP failures return the same shape with `success:false` and `error: "HTTP <status>: <truncated body>"`.

- **`GET /providers`** — Returns a static `{ providers: [...] }` list of preset OpenAI-compatible provider configs (`mdes`, `ollama`, `lmstudio`, `vllm`, `openai`, `custom`) for UI consumption. Each entry exposes `id`, `label`, `defaultUrl`, `needsKey`, and `defaultModel`; note that `provider` from the test body is accepted but not used by the test handler.
