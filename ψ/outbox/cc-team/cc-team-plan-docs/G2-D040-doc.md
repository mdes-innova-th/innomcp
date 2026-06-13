<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D040 role=doc model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":2318,"completion_tokens":237,"total_tokens":2555,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 44s
 generated: 2026-06-13T11:26:46.108Z -->
```typescript
/** Map of provider ID → record; the in-memory backing store for the registry. */
const registry: Map<string, ProviderRecord>;

/**
 * Returns the current time as an ISO-8601 string.
 * @returns ISO-8601 timestamp (e.g. `"2025-01-15T12:34:56.000Z"`).
 */
function nowIso(): string;

/**
 * Constructs the built-in provider seed list at boot time.
 * Always includes the local Ollama entry and `innova-bot`; conditionally adds
 * MDES remote, OpenAI, GitHub Copilot, Anthropic, DeepSeek, and Gemini
 * providers based on the presence of the relevant API-key/base-URL env vars.
 * @returns Array of `ProviderRecord`s to populate the registry.
 */
function buildSeed(): ProviderRecord[];
```

I can only document the symbols visible in the snippet you provided — the file is truncated after the `GEMINI_API` check, so the remaining seed entries, validation helpers, CRUD functions, and any other exports aren't shown. If you share the rest of the file, I'll continue the list for those members.
