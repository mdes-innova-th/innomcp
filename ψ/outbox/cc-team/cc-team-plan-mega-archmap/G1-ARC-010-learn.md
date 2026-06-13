<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-010 role=learn model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1380,"completion_tokens":308,"total_tokens":1688,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 10s
 generated: 2026-06-13T11:59:01.542Z -->
**Module: `providers/types.ts`**

**Single responsibility:** Define the canonical schema for the AI provider registry — internal `ProviderRecord` (server-side, holds secret refs), public `ProviderPublicView` (wire-safe), and `ProviderUpsertInput` (write API), plus enums (`ProviderType`, `Capability`, `PrivacyLevel`, `HealthStatus`).

**Key exported API:** Types + `toPublicView()` projection + `validateUpsertInput()` (first-error string or `null`). Hard rule: secrets (env-var name or encrypted blob) never reach the wire — collapsed to `hasApiKey: boolean`.

**Upstream callers:** `providers/registry.ts` (CRUD endpoints, GET `/api/ai/providers`), admin UI forms, capability-router that selects providers by tag (e.g. `thai-naturalness`, `hard-reasoning`).

**Downstream deps:** None — pure type/utility module, but consumed transitively by chat/agent pipeline when picking a model and by health-check workers.

**Pipeline role:** Schema contract between registry persistence and the request layer; `toPublicView` is the leak barrier for secrets in list responses.

**Surprising coupling:** `Capability` taxonomy is a closed string union — adding a new agent skill (e.g. `audio`, `web-search`) requires editing this file, breaking every consumer until types propagate. `validateUpsertInput` only checks shape, not capability values, leaving that gap to the route handler.
