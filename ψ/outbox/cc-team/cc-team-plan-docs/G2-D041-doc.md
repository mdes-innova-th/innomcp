<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D041 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1921,"completion_tokens":1172,"total_tokens":3093,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":444,"image_tokens":0},"cache_creation_input_tokens":0} | 14s
 generated: 2026-06-13T11:26:16.369Z -->
- `ChatMode`  
  A string union type representing the three classification categories for a provider's deployment: `"local"`, `"remote"`, or `"hybrid"`. Used by `selectProvider` to filter providers by their physical or network location.

- `SelectOptions`  
  Input configuration for the provider selection algorithm.  
  - `mode`: `ChatMode` – required, determines which provider types are eligible.  
  - `capabilities`: required list of desired `Capability` strings.  
  - `privacyLevel?`: optional privacy constraint to further filter providers.  
  - `preferredProviderId?`: optional – if set and the provider supports at least one requested capability, it is chosen unconditionally.  
  - `excludeDown?`: defaults to `true` – providers with `healthStatus === "down"` are removed.  
  Non-obvious: when `capabilities` is empty, any enabled provider matching mode/privacy/down conditions is considered.

- `SelectionResult`  
  The result of a selection query.  
  - `provider`: the best match or `null` if nothing matched.  
  - `alternates`: other eligible providers sorted by descending score, suitable for fallback chains.  
  - `reason`: a human-readable explanation in Thai describing why this provider was chosen.

- `selectProvider(opts: SelectOptions): SelectionResult`  
  Pure selection function that filters the registry’s enabled providers by mode, privacy, and health, then scores them based on capability overlap and priority.  
  - If `preferredProviderId` is given and that provider matches at least one capability, it is returned immediately with the remainder as alternates.  
  - Otherwise candidates are ranked by `(capabilityScore * 100 + priority)`, highest wins.  
  - Returns a `SelectionResult` with the best candidate (or `null`) and ordered alternates.  
  Caveat: This function does **not** perform the actual LLM call – it only picks a provider record.

- `getAvailableProviders(): string[]`  
  Returns a list of provider IDs that are currently usable based on environment variables. Always includes `"mdes-ollama"`. Other IDs (`"gpt"`, `"github-copilot"`, `"thai-llm"`, `"ollama-local"`) are conditionally added when their required env vars are set.  
  Note: This does **not** consider the runtime registry – it only checks env variables for opt-in providers.

- `resolveProviderEndpoint(providerId: string): { url: string; key: string; model: string } | null`  
  Resolves the connection details for an environment-gated provider. Looks up the provider in the registry, resolves its API key via `resolveApiKey`, and returns the endpoint object. Returns `null` if the provider ID is unknown or not managed by the registry.  
  Caveat: The returned key may be empty string if no env variable is set – the caller should handle missing keys.

- `previewSelection(opts: SelectOptions): { selected, fallbackChain, reason }`  
  Convenience wrapper around `selectProvider` that strips the result to a lightweight JSON‑friendly shape (only `id`, `displayName`, `model`). Designed for API endpoints that need a preview without exposing the full `ProviderRecord`.  
  Returns the same selection logic with the same `reason` string.
