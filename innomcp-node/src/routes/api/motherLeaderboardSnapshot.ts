/**
 * routes/api/motherLeaderboardSnapshot.ts — Full leaderboard snapshot
 *
 * GET /api/mother/leaderboard-snapshot
 *
 * Returns a combined snapshot of all leaderboard data in one call:
 * - All 14 providers with full stats
 * - Rankings (tier badges)
 * - Intent leaders
 * - Win leaders
 * - Session context
 *
 * Designed for external dashboards or status displays.
 */

import { Router, Request, Response } from "express";
import { getProviderStats, getSparklineData, getIntentWinsSnapshot } from "../../services/leaderboardMetrics";
import { isProviderEnabled } from "../../services/motherProviderToggle";
import { errorRecovery } from "../../utils/errorRecovery";

const router = Router();

const ALL_PROVIDERS = [
  "mdes-cloud","thai-llm","ollama-local","openai-gpt",
  "claude-haiku","claude-sonnet","copilot","gemini-pro",
  "mistral-large","deepseek-r1","groq-llama","together-llama",
  "innova-bot","innova-oracle",
];

function compositeScore(s: { avgLatency: number; p95Latency: number; successRate: number; wins: number; requests: number; avgQuality: number }): number {
  const speed = Math.round(100 * (1 / (1 + (s.p95Latency || s.avgLatency || 1000) / 3000)));
  const reliability = s.successRate;
  const popularity = Math.min(100, (s.requests / 50) * 100);
  const winScore = Math.min(100, (s.wins / 10) * 100);
  const quality = s.avgQuality || 0;
  return Math.round(speed * 0.25 + reliability * 0.30 + popularity * 0.15 + winScore * 0.15 + quality * 0.15);
}

router.get("/", (_req: Request, res: Response): void => {
  const stats = getProviderStats();
  const intentSnapshot = getIntentWinsSnapshot();

  // Build ranked providers
  const providers = ALL_PROVIDERS.map((id) => {
    const s = stats.get(id);
    const score = s ? compositeScore(s) : 0;
    const circuitStatus = errorRecovery.getCircuitStatus(`mother-${id}`);
    return {
      id,
      enabled: isProviderEnabled(id),
      circuitState: circuitStatus?.state ?? "UNKNOWN",
      score,
      requests: s?.requests ?? 0,
      avgLatency: s?.avgLatency ?? 0,
      successRate: s?.successRate ?? 0,
      wins: s?.wins ?? 0,
      winRate: s?.winRate ?? 0,
      avgQuality: s?.avgQuality ?? 0,
      topIntent: s?.topIntent,
      sparkline: getSparklineData(id, 5),
    };
  }).sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1, tier: i < 3 ? "gold" : i < 7 ? "silver" : i < 10 ? "bronze" : "none" }));

  // Intent leaders
  const intentLeaders: Array<{intent: string; leaderId: string; wins: number}> = [];
  for (const [intent, providerMap] of intentSnapshot.entries()) {
    let topId = ""; let topWins = 0;
    for (const [pid, w] of providerMap.entries()) {
      if (w > topWins) { topWins = w; topId = pid; }
    }
    if (topId) intentLeaders.push({ intent, leaderId: topId, wins: topWins });
  }

  res.json({
    providers,
    intentLeaders,
    totalProviders: ALL_PROVIDERS.length,
    activeCount: providers.filter(p => p.requests > 0).length,
    enabledCount: providers.filter(p => p.enabled).length,
    timestamp: new Date().toISOString(),
  });
});

export default router;
