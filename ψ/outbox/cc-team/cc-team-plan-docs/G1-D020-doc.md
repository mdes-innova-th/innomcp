<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D020 role=doc model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1955,"completion_tokens":715,"total_tokens":2670,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-13T11:22:19.848Z -->
- **`ProviderConfig`** — Configuration shape for a single provider. `priority` is sorted descending (higher = preferred); `healthStatus` defaults to `'unknown'`, `capabilities` to `[]`, `enabled` to `true`, and `priority` to `0` when omitted during registration. Optional `apiKey`, `latencyMs`, and `lastChecked` carry health-probe state.

- **`ProviderManager`** — In-memory registry that tracks providers, runs health checks, and selects the best provider for a task. The constructor auto-registers an MDES Ollama primary provider sourced from `MDES_OLLAMA_URL` / `MDES_OLLAMA_MODEL` env vars (defaults `http://localhost:11434` / `mdes-llm-v1`); id `mdes-primary-ollama` is reserved and can be overridden via `register()`.

  - **`register(config)`** — Add or merge a provider by `id`. Throws if `id`, `baseUrl`, or `model` is missing. On update, preserves previous `healthStatus`, `latencyMs`, and `lastChecked` if the new config omits them.

  - **`unregister(id)`** — Remove a provider by id; no-op if not present.

  - **`getAll()`** — Returns shallow copies of every registered provider; safe to mutate without affecting the registry.

  - **`getBest(capability?)`** — Returns the highest-ranked enabled provider, optionally filtered to those whose `capabilities` include the given string. Ranking: `priority` desc, then `healthStatus` (`healthy` < `degraded` < `unknown`), then `latencyMs` asc with `undefined` treated as `Infinity`. Returns `undefined` if no enabled provider (or no matching capability) exists.

  - **`checkHealth(id)`** — Pings `{baseUrl}/health` with a 10s `AbortController` timeout and `Authorization: Bearer <apiKey>` when an `apiKey` is set. Any response with status `< 500` is treated as healthy; throws/errors mark the provider `'degraded'`. Mutates the provider's `healthStatus`, `latencyMs`, and `lastChecked`, and returns `{ healthy, latencyMs }`. Throws if `id` is unknown.

  - **`checkAllHealth()`** — Runs `checkHealth` concurrently across all providers via `Promise.allSettled` (one failure won't abort the rest), then returns the updated configs.

  - **`getMDESPrimary()`** — Returns a copy of the auto-registered `mdes-primary-ollama` provider. Throws if it has been unregistered.

  - **`selectForTask(task)`** — Picks the best provider for `'thai' | 'code' | 'reasoning' | 'fast' | 'general'` by mapping to capability strings (`thai-language`, `code-generation`, `reasoning`, `low-latency`, `general-purpose`). If no provider matches the capability, falls back to `getBest()` with no filter; throws if no enabled provider exists at all.

Caveat: all methods are declared `async` but the registry is purely synchronous — `await`ing them is unnecessary. Health checks assume a `GET /health` endpoint; providers whose health path differs (e.g., Ollama, which typically exposes `/api/tags`) will be reported `'degraded'` even when reachable.
