<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D018 role=doc model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":1663,"completion_tokens":4849,"total_tokens":6512,"prompt_tokens_details":{"cached_tokens":82,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4450,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 62s
 generated: 2026-06-13T11:22:41.786Z -->
- **`ProviderStatus`** — Runtime health snapshot for a provider. Tracks `id`, `healthy`, `latencyMs`, `failCount`, and `lastCheck` (timestamp ms).

- **`HealthCheckFn`** — Injectable async probe used to test provider reachability.  
  `@param providerId` — Provider to probe.  
  `@returns` Promise resolving to `{ healthy: boolean; latencyMs: number }`.

- **`ProviderFailover`** — Circuit-breaker failover manager for a primary and ordered backups.  
  **Caveat:** While the constructor accepts custom IDs, `selectProvider` and `getStats` hardcode the default primary (`mdes-ollama`) and default backups.

- **`ProviderFailover.constructor(primaryId?, backupIds?, failThreshold?, cooldownMs?)`** — Initializes status entries for the given primary and backups; sets active provider to `primaryId`.  
  `@param primaryId` — Defaults to `'mdes-ollama'`.  
  `@param backupIds` — Defaults to `['ollama-local', 'openai-compatible']`.  
  `@param failThreshold` — Consecutive failures before marking unhealthy. Default `3`.  
  `@param cooldownMs` — Milliseconds before re-checking an unhealthy provider. Default `60000`.

- **`ProviderFailover.setHealthChecker(fn)`** — Registers the async probe used by `checkProvider`.  
  `@param fn` — `HealthCheckFn`.  
  **Caveat:** If unset, `checkProvider` returns cached state without probing.

- **`ProviderFailover.selectProvider(_task?)`** — Returns the best provider ID. Prefers the primary if healthy, then the first healthy backup; if all are unhealthy, falls back to the primary and logs a warning.  
  `@param _task` — Optional task hint (currently ignored).  
  `@returns` Selected provider ID.  
  **Caveat:** Always references the hardcoded default primary and backups, ignoring custom IDs passed to the constructor.

- **`ProviderFailover.markFailed(providerId)`** — Records a failure, incrementing the provider's fail counter and marking it unhealthy when `failThreshold` is reached.  
  `@param providerId` — Target provider.  
  **Caveat:** Warns and silently ignores unknown IDs.

- **`ProviderFailover.markHealthy(providerId, latencyMs)`** — Records a success, resetting the failure count and storing latency.  
  `@param providerId` — Target provider.  
  `@param latencyMs` — Observed latency in milliseconds.  
  **Caveat:** Warns and silently ignores unknown IDs.

- **`ProviderFailover.checkProvider(providerId)`** — Probes a provider via the injected health checker, but only when it is currently unhealthy and `cooldownMs` has elapsed.  
  `@param providerId` — Provider to verify.  
  `@returns` `true` if currently healthy.  
  **Caveat:** Returns cached state if no checker is set, or if the provider is healthy/cooldown has not passed. Caught exceptions mark the provider failed and return `false`.

- **`ProviderFailover.getStats()`** — Returns a snapshot of statuses and the active provider ID.  
  `@returns` `{ primary, backups, activeProvider }` with shallow-copied status objects.  
  **Caveat:** Always resolves the primary and backups using the hardcoded default IDs, not custom constructor arguments.

- **`ProviderFailover.resetAll()`** — Resets every tracked provider to healthy, zero failures, and current timestamp, clearing circuit-breaker state.
