<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D019 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1992,"completion_tokens":888,"total_tokens":2880,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":628,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 9s
 generated: 2026-06-13T11:21:50.114Z -->
- **`ProbeStatus`** — Union type representing the lifecycle state of a provider probe result.
  - `"checking"` is transient (probe in-flight); `"configured"` means the provider is registered but has no API key to validate; `"online"`/`"offline"` reflect reachability.

- **`ProviderProbeResult`** — Shape of a single provider's probe outcome stored in `probeStatus`.
  - `@param providerId` — Matches the `id` field from the internal probe-target list (e.g. `"mdes-cloud"`, `"openai-gpt"`).
  - `@param status` — Current `ProbeStatus`.
  - `@param latencyMs` — Round-trip time of the probe request in milliseconds; `0` if the provider was marked `"configured"` without a network call.
  - `@param checkedAt` — ISO-8601 timestamp of when the probe completed.

- **`probeStatus`** — Module-level `Map<string, ProviderProbeResult>` keyed by provider ID.
  - Populated by the startup probe run; read by `agentLeaderboard` to display live online/offline state instead of static "configured".
  - **Caveat:** In-memory only — resets on process restart; not shared across cluster workers.

*(The truncated portion likely exports a `runStartupProbe` or similar async function that executes all 14+ probes concurrently via `Promise.allSettled` with a 5 s `AbortController` timeout, catches every error per-provider, and writes results into `probeStatus`.)*
