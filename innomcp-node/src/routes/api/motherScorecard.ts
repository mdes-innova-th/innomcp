/**
 * routes/api/motherScorecard.ts — Full provider scorecard
 *
 * GET /api/mother/scorecard
 *
 * Returns the most comprehensive view of every provider:
 * all metrics, rankings, streaks, circuit state, and a letter grade.
 * A single authoritative endpoint for provider evaluation.
 */

import { Router, Request, Response } from "express";
import { getProviderStats, getSparklineData } from "../../services/leaderboardMetrics";
import { isProviderEnabled } from "../../services/motherProviderToggle";
import { errorRecovery } from "../../utils/errorRecovery";

const router = Router();

const ALL_PROVIDERS = [
  "mdes-cloud","thai-llm","ollama-local","openai-gpt",
  "claude-haiku","claude-sonnet","copilot","gemini-pro",
  "mistral-large","deepseek-r1","groq-llama","together-llama",
  "innova-bot","innova-oracle",
];

function letterGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return score === 0 ? "—" : "F";
}

function compositeScore(s: ReturnType<typeof getProviderStats> extends Map<string, infer V> ? V : never): number {
  const speed = Math.round(100 * (1 / (1 + (s.p95Latency || s.avgLatency || 1000) / 3000)));
  return Math.round(
    speed * 0.25 +
    s.successRate * 0.30 +
    Math.min(100, (s.requests / 50) * 100) * 0.15 +
    Math.min(100, (s.wins / 10) * 100) * 0.15 +
    (s.avgQuality || 0) * 0.15
  );
}

router.get("/", (_req: Request, res: Response): void => {
  const stats = getProviderStats();

  const providers = ALL_PROVIDERS.map(id => {
    const s = stats.get(id);
    const circuit = errorRecovery.getCircuitStatus(`mother-${id}`);
    const score = s ? compositeScore(s) : 0;

    return {
      id,
      enabled: isProviderEnabled(id),
      hasData: !!s,
      grade: letterGrade(score),
      score,
      // Performance
      requests: s?.requests ?? 0,
      avgLatency: s?.avgLatency ?? 0,
      p95Latency: s?.p95Latency ?? 0,
      successRate: s?.successRate ?? 0,
      // Quality
      avgQuality: s?.avgQuality ?? 0,
      consistencyScore: s?.consistencyScore ?? 0,
      avgResponseLength: s?.avgResponseLength ?? 0,
      // Wins
      wins: s?.wins ?? 0,
      winRate: s?.winRate ?? 0,
      currentStreak: s?.currentStreak ?? 0,
      bestStreak: s?.bestStreak ?? 0,
      topIntent: s?.topIntent,
      // Health
      healthScore: s?.healthScore ?? 0,
      efficiencyScore: s?.efficiencyScore ?? 0,
      circuitState: circuit?.state ?? "UNKNOWN",
      // Trend
      sparkline: getSparklineData(id, 10),
    };
  }).sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1, tier: i < 3 ? "gold" : i < 7 ? "silver" : i < 10 ? "bronze" : "none" }));

  res.json({
    providers,
    totalProviders: ALL_PROVIDERS.length,
    gradeDistribution: {
      "A+": providers.filter(p => p.grade === "A+").length,
      "A":  providers.filter(p => p.grade === "A").length,
      "B":  providers.filter(p => p.grade === "B").length,
      "C":  providers.filter(p => p.grade === "C").length,
      "D":  providers.filter(p => p.grade === "D").length,
      "F":  providers.filter(p => p.grade === "F").length,
      "—":  providers.filter(p => p.grade === "—").length,
    },
    topProvider: providers[0] ?? null,
    timestamp: new Date().toISOString(),
  });
});

export default router;
