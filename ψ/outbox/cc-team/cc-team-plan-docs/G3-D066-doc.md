<!-- cc-team deliverable
 group: G3 (Doc generation)
 member: D066 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1996,"completion_tokens":1448,"total_tokens":3444,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":858,"image_tokens":0},"cache_creation_input_tokens":0} | 18s
 generated: 2026-06-13T11:29:33.668Z -->
- **`default` (Express Router)**  
  Exports a router that exposes two endpoints for aggregated mother dispatch statistics and a reset action. The routes are read-only (GET) and admin-level (POST). No authentication is enforced; caching (5 s) is applied externally via `app.ts`.

  - **GET `/api/mother/stats`**  
    Aggregates metrics from the in-memory history ring buffer (last 50 runs) and the live leaderboard tracker.  
    **Returns:** `MotherStatsResponse` object containing:  
    - `totalRuns` — number of runs in history.  
    - `totalProviderCalls` — sum of all provider calls across runs.  
    - `avgSuccessRate` — average success rate among runs that had at least one provider (0 if none).  
    - `avgProvidersPerRun` — mean providers per run.  
    - `fastestProvider` — provider with lowest average latency among those with ≥1 success, or `null`.  
    - `mostReliableProvider` — provider with highest success rate from leaderboard metrics (only providers with >0 requests), or `null`.  
    - `topProviderByRequests` — provider with most requests from leaderboard metrics (only providers with >0 requests), or `null`.  
    - `recentIterations` — count of runs within the last 5 minutes.  
    - `lastRunAt` — ISO timestamp of the most recent run (first element of history), or `null`.  
    - `providerBreakdown` — array of per-provider stats (total calls, successes, avg latency, success rate).  
    **Caveats:**  
    - `fastestProvider` excludes providers with zero successful calls.  
    - `avgSuccessRate` averaged only over runs with `totalProviders > 0`.  
    - `mostReliableProvider` and `topProviderByRequests` are derived from a separate in-memory tracker (`leaderboardMetrics`), not from history runs.  
    - History order assumed most-recent-first; if `getHistory()` changes order, `lastRunAt` may be incorrect.

  - **POST `/api/mother/stats/reset`**  
    Clears all in-memory leaderboard metrics and history ring buffer.  
    **Returns:** `{ ok: true, message: string, timestamp: string }`.  
    **Caveats:**  
    - Uses dynamic `require()` calls (not top-level imports) — may affect bundlers or tree-shaking.  
    - `clearHistory` is called with optional chaining (`?.()`), but the imported module exports it as a defined function; the `?.` is defensive but currently unnecessary.  
    - This operation is irreversible and resets both aggregated and live data.
