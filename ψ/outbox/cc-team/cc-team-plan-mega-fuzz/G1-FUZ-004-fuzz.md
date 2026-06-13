<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-004 role=fuzz model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":2390,"completion_tokens":2963,"total_tokens":5353,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2117,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 27s
 generated: 2026-06-13T11:59:06.827Z -->
- Provider Eligibility Filtering → `MDES_ONLY=1` env var set, registry contains `openai-gpt` and `mdes-cloud` → Invariant: `results` array contains zero entries for `openai-gpt`; `totalAgents` equals count of eligible MDES providers only.
- Key-Free Provider Bypass → Provider config with `id="ollama-local"`, `kind="ollama"`, and `apiKey=""` → Invariant: Provider passes `isProviderConfigEligible` and is dispatched (empty key allowed for `KEY_FREE_PROVIDER_IDS`).
- Whitespace API Key Rejection → Provider config with `id="openai-gpt"`, `kind="openai"`, and `apiKey="   \t "` → Invariant: Provider fails `isProviderConfigEligible` (trim check) and is skipped without a network call.
- Synthesis Longest Success Selection → Provider A returns `text="short"`, Provider B returns `text="a much longer response text"`, Provider C returns `success=false` → Invariant: `synthesis` equals `"a much longer response text"`.
- Synthesis Fallback on Empty → Provider A returns `text=""`, Provider B returns `text="valid"`, Provider C returns `text=null` → Invariant: `synthesis` equals `"valid"` (first non-empty successful response).
- Cost Summation Integrity → 3 providers return `estimatedCostUsd` of `0.0015`, `0.00025`, and `0.000` → Invariant: `totalEstimatedCostUsd` strictly equals `0.00175` (sum of all non-skipped provider costs).
- Cost Non-Negativity → Provider returns malformed negative token count causing negative cost calculation → Invariant: `totalEstimatedCostUsd` >= 0 and individual `estimatedCostUsd` >= 0.
- Oracle Auth Token Invalidation → Oracle endpoint returns HTTP 401/403 → Invariant: `_oracleToken` is set to `null`; `callInnovaOracle` throws Error; subsequent call attempts fresh re-authentication.
- Oracle Token Caching → Valid token fetched with `expiresAt` 23 hours in the future, second call issued immediately → Invariant: Exactly 1 HTTP POST to `/api/auth/token`; second call uses cached token without network request.
- Malformed Oracle JSON Response → Oracle `/api/oracle/consult` returns `{ "context": null, "result": undefined, "text": 123 }` → Invariant: Returns stringified JSON fallback `JSON.stringify(data).slice(0, 800)`.
- Timeout Enforcement → Provider endpoint delayed by 30,000ms → Invariant: Provider result has `success: false`, `latencyMs` <= 20,500ms (respects `MOTHER_TIMEOUT_MS`), `errorMsg` indicates abort/timeout.
- Intent-Based Critic Selection → Intent string `"code"` vs `"weather"` → Invariant: `selectCriticConfig` for "code" requests `["code", "grounding-critic"]` capabilities; "weather" requests `["grounding-critic", "hard-reasoning"]`.
- Iteration Monotonicity → 10 concurrent `dispatchMother` invocations → Invariant: `motherIteration` increments exactly 10 times; no duplicate iteration values.
- Oracle Query Truncation → Prompt string of length 10,000 characters → Invariant: `callInnovaOracle` sends `query: prompt.slice(0, 500)` to the API; payload never exceeds 500 chars.
- Disabled Provider Skipping → `isProviderEnabled(cfg.id)` returns `false` for `mdes-cloud` → Invariant: Provider is excluded from `results` and `totalAgents` count regardless of valid API key.
- Empty Registry Fan-Out → `listProviders()` returns `[]` → Invariant: `MotherDispatchResult` returns `{ results: [], synthesis: "", totalAgents: 0, successCount: 0, totalEstimatedCostUsd: 0 }`.
