<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D064 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1282,"completion_tokens":2730,"total_tokens":4012,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2217,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 23s
 generated: 2026-06-13T11:29:22.041Z -->
*   **`default` (Router)**: Express Router exposing endpoints to list, toggle, and retrieve stats/history for mother providers.
    *   *Caveat*: Validates `providerId` against a hardcoded list (`ALL_PROVIDER_IDS`); returns 404 for unknown IDs.

*   **`GET /`**: Lists all recognized providers with their current enabled state and aggregate counts.
    *   *@returns* `{ providers: Array<{providerId: string, enabled: boolean}>, enabledCount: number, totalProviders: number }`

*   **`POST /:providerId/enable`**: Enables a specific provider.
    *   *@param* `providerId` - URL parameter for the target provider.
    *   *@returns* `{ ok: boolean, providerId: string, enabled: true }`

*   **`POST /:providerId/disable`**: Disables a specific provider.
    *   *@param* `providerId` - URL parameter for the target provider.
    *   *@returns* `{ ok: boolean, providerId: string, enabled: false }`

*   **`POST /:providerId/toggle`**: Toggles the enabled state of a specific provider.
    *   *@param* `providerId` - URL parameter for the target provider.
    *   *@returns* `{ ok: boolean, providerId: string, enabled: boolean }` (reflects the new state)

*   **`GET /:providerId/stats`**: Retrieves detailed metrics and sparkline data for a specific provider.
    *   *@param* `providerId` - URL parameter for the target provider.
    *   *@returns* `{ providerId, enabled, stats: object | null, sparkline, timestamp }`
    *   *Caveat*: Lazily requires `leaderboardMetrics` on every request. `stats` is `null` if no metrics exist for the provider.

*   **`GET /:providerId/history`**: Retrieves dispatch runs where the specified provider participated.
    *   *@param* `providerId` - URL parameter for the target provider.
    *   *@param* `limit` - Query parameter for max runs to return (defaults to 10, clamped between 1 and 50).
    *   *@returns* `{ providerId, runs: Array<object>, total, timestamp }`
    *   *Caveat*: Lazily requires `motherHistory` on every request. Truncates `query` text to 60 characters. `isWinner` is currently identical to `isFastest`.
