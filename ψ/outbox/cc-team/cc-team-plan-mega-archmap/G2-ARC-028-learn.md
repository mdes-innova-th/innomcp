<!-- cc-team deliverable
 group: G2 (archmap division)
 member: ARC-028 role=learn model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":2049,"completion_tokens":1980,"total_tokens":4029,"prompt_tokens_details":{"cached_tokens":56,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2061,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 25s
 generated: 2026-06-13T12:01:02.163Z -->
**Single responsibility:** In-memory accumulator for per-provider telemetry (latency, success, wins, quality) and derived score computation (health, efficiency, consistency).

**Key exported API:** `recordProviderCall`, `recordProviderWin`, `getProviderStats`, `getSparklineData`, `getIntentWinsSnapshot`.

**Upstream callers:** `motherDispatch` (after parallel fan-out) and synthesis winner-selection logic.

**Downstream deps:** `../utils/db` (`withDbConnection`) for fire-and-forget persistence; Node `setImmediate`.

**Pipeline role:** Feedback/learn pass for multi-provider routing—captures dispatch outcomes to inform future provider ranking and intent-based affinity.

**Surprising coupling:** Hardcoded MySQL `ON DUPLICATE KEY UPDATE` SQL inside the "in-memory" tracker, secretly coupling it to a specific DB schema/dialect; plus `process.env.NODE_ENV` branching in production persistence logic.
