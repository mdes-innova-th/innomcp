-- 07-provider-stats.sql
-- Persistent provider stats for the mother dispatch leaderboard.
-- In-memory leaderboardMetrics writes here async (fire-and-forget).
-- agentLeaderboard GET merges this with in-memory for best-of-both.

CREATE TABLE IF NOT EXISTS provider_stats (
  provider_id   VARCHAR(64)   NOT NULL PRIMARY KEY,
  requests      INT           NOT NULL DEFAULT 0,
  successes     INT           NOT NULL DEFAULT 0,
  total_latency BIGINT        NOT NULL DEFAULT 0,
  last_seen     DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_requests (requests DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
