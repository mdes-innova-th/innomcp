<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D014 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1718,"completion_tokens":1782,"total_tokens":3500,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1285,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 53s
 generated: 2026-06-13T11:21:39.903Z -->
- **`ModelConfig`**: Defines the configuration for a model endpoint.
  - *Caveat*: When added via `addModel`, `weight` defaults to `1` and `tags` defaults to `[]` if omitted.

- **`ModelStats`**: Represents the runtime statistics and health metrics for a registered model.

- **`Strategy`**: Defines the load balancing strategy (`'round-robin'`, `'least-latency'`, `'weighted'`, or `'random'`).

- **`ModelLoadBalancer`** (default export): Singleton class that manages load balancing across MDES models using circuit breaking, rolling latency windows, and health probes.
  - *Caveat*: Instantiating via the constructor automatically bootstraps a default MDES model and starts internal health probes.

  - **`getInstance`**: Returns the singleton instance of the `ModelLoadBalancer`.
    - `@returns` `ModelLoadBalancer`

  - **`addModel`**: Registers a new model or updates an existing model's configuration.
    - `@param config` - The model configuration.
    - *Caveat*: If the model ID already exists, its configuration is updated while preserving existing runtime stats.

  - **`removeModel`**: Unregisters a model from the load balancer.
    - `@param id` - The model identifier to remove.

  - **`selectModel`**: Chooses an eligible model based on the active or provided strategy.
    - `@param strategy` - Optional strategy override for this selection only.
    - `@returns` `ModelConfig | null` - The selected model's config, or `null` if no models are eligible.
    - *Caveat*: Excludes circuit-broken (disabled) models and models at their `maxConcurrent` limit. Increments `activeRequests` on the returned model.

  - **`recordLatency`**: Logs a successful request's latency for a specific model.
    - `@param modelId` - The model that handled the request.
    - `@param latencyMs` - Response latency in milliseconds.
    - *Caveat*: Decrements `activeRequests`, resets `consecutiveErrors`, and maintains a rolling window of the last 20 latencies.

  - **`recordError`**: Logs a failed request for a specific model.
    - `@param modelId` - The model that failed.
    - *Caveat*: Decrements `activeRequests`. Triggers a 60-second circuit break (disabling the model) if `consecutiveErrors` reaches 5.

  - **`getStats`**: Retrieves the current runtime statistics for all registered models.
    - `@returns` `ModelStats[]`
