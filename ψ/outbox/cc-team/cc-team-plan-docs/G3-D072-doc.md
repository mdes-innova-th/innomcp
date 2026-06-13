<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D072 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1105,"completion_tokens":2020,"total_tokens":3125,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1660,"image_tokens":0},"cache_creation_input_tokens":0} | 39s
 generated: 2026-06-13T11:30:35.491Z -->
* **`default`** (Express `Router`)
  * **Purpose:** Express router exposing the `POST /` endpoint (intended for `/api/providers/health-check`) to concurrently probe all enabled AI providers and update their health statuses in the in-memory registry.
  * **@returns:** `200 OK` with a JSON payload shaped as `{ results: Array<{ id: string, displayName: string, healthStatus: HealthStatus, latencyMs: number }> }`.
  * **Caveats & Non-obvious Behavior:**
    * **Timeouts & Thresholds:** Enforces a hard 5-second abort timeout per probe. Classifies status as `healthy` (2xx and ≤3000ms), `degraded` (2xx and >3000ms), or `down` (non-2xx, network error, or timeout).
    * **Dynamic Probe URLs:** Routes probes based on provider type: Ollama uses `/api/tags`, CommandCode uses `/models`, and all other providers default to `/health`.
    * **Authentication:** Automatically injects `Authorization: Bearer <token>` headers for Ollama and CommandCode probes if the provider's `apiKeyRef` resolves to a value in `process.env`.
    * **State Mutation:** Silently mutates global state by invoking `setHealth()` on the provider registry for every probed provider, affecting subsequent `GET /api/ai/providers` responses.
    * **Error Handling:** Uses `Promise.allSettled` to ensure one failing provider probe does not block the rest; unhandled rejections (though caught internally) fallback to a `down` status with `0` latency.
