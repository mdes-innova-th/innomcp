<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D061 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1472,"completion_tokens":604,"total_tokens":2076,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":487,"image_tokens":0},"cache_creation_input_tokens":0} | 8s
 generated: 2026-06-13T11:28:38.918Z -->
- **`router`** (default export) – Express Router that defines a `GET /api/mother/config` endpoint. Returns the current mother system configuration: provider list with status (enabled, key configured, circuit state), feature flags, and counts.  
  **Non-obvious**: API keys are never returned; the `envKey` field contains the environment variable name, not the actual key. Circuit breaker state is queried per-request via `errorRecovery.getCircuitStatus()`. Disabled providers are fetched externally via `getDisabledProviders()`.
