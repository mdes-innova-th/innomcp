<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D065 role=doc model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1312,"completion_tokens":414,"total_tokens":1726,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-13T11:29:15.978Z -->
## Exported Members

- **default export (`router`)**
  Express `Router` handling `GET /api/mother/scorecard`. Returns a full provider evaluation snapshot: an array of every provider (sorted by composite score, ranked, and assigned a gold/silver/bronze tier), a grade distribution histogram, the top provider, and an ISO timestamp. Providers with no stats are included with `score: 0` and grade `"—"`. A non-zero score always renders as a letter grade; only zero maps to `"—"`. Circuit state is read from `errorRecovery` under the key `mother-<providerId>` and defaults to `"UNKNOWN"` when absent.

- **`letterGrade(score: number): string`**
  Converts a numeric score to a letter grade using thresholds: `≥90` → `A+`, `≥80` → `A`, `≥70` → `B`, `≥60` → `C`, `≥40` → `D`, otherwise `F` — except an exact `0` returns `"—"`. Note: the `F` branch only fires for non-zero scores below 40, so `0` is reserved for the em-dash sentinel.

- **`compositeScore(s): number`**
  Computes a 0–100 composite score from a provider's stats as a weighted sum: speed (25%) from p95/avg latency capped at ~3000ms, success rate (30%), volume via requests/50 (15%), wins via wins/10 (15%), and average quality (15%). Speed uses `1 / (1 + latency/3000)`; if both `p95Latency` and `avgLatency` are falsy, it falls back to 1000ms. Volume and wins contributions are clamped to 100.

- **`ALL_PROVIDERS`**
  Hardcoded list of the 14 provider IDs enumerated in the scorecard; ordering here is the canonical provider set but the response order is determined by score-descending sort.
