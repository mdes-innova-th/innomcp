<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D044 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":2210,"completion_tokens":1105,"total_tokens":3315,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1026,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 12s
 generated: 2026-06-13T11:26:46.226Z -->
- **`AgentEntry`**: Interface defining the data shape for a single AI provider/agent on the leaderboard, encompassing identity, operational status, and performance/scoring metrics.
  - Caveats: `status` is a string union (`"online" | "configured" | "checking" | "offline"`). `winRate` is a percentage (`wins / requests * 100`). `avgResponseLength` is measured in characters per response. `p95Latency` is optional but used as a fallback for `avgLatency` in score computations.
