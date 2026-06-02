/**
 * routes/api/motherSummary.ts — Complete mother system snapshot
 *
 * GET /api/mother/summary
 *
 * Single-call endpoint returning a complete dashboard snapshot for the
 * mother dispatch system. Aggregates all in-memory metrics into one response.
 * Useful for building external dashboards or status widgets.
 */

import { Router, Request, Response } from "express";
import { getHistory } from "../../services/motherHistory";
import { getProviderStats } from "../../services/leaderboardMetrics";
import { getDisabledProviders } from "../../services/motherProviderToggle";
import { errorRecovery } from "../../utils/errorRecovery";

const router = Router();

const ALL_PROVIDERS = [
  "mdes-cloud","thai-llm","ollama-local","openai-gpt",
  "claude-haiku","claude-sonnet","copilot","gemini-pro",
  "mistral-large","deepseek-r1","groq-llama","together-llama",
  "innova-bot","innova-oracle",
];

router.get("/", (_req: Request, res: Response): void => {
  const stats = getProviderStats();
  const runs = getHistory(10);
  const disabled = getDisabledProviders();

  // Top provider by composite score
  let topProvider: { id: string; score: number } | null = null;
  for (const [id, s] of stats.entries()) {
    if (s.requests === 0) continue;
    const score = Math.round(
      (1/(1+(s.p95Latency||s.avgLatency)/3000))*100*0.25 +
      s.successRate*0.30 +
      Math.min(100,(s.requests/50)*100)*0.15 +
      Math.min(100,(s.wins/10)*100)*0.15 +
      (s.avgQuality||0)*0.15
    );
    if (!topProvider || score > topProvider.score) topProvider = { id, score };
  }

  // Session stats
  const totalDispatches = runs.length;
  const totalCalls = runs.reduce((s, r) => s + r.totalProviders, 0);
  const totalWins = Array.from(stats.values()).reduce((s, v) => s + v.wins, 0);
  const activeProviders = stats.size;
  const enabledCount = ALL_PROVIDERS.length - disabled.length;

  // Fastest provider this session
  let fastestId = "";
  let fastestMs = Infinity;
  for (const [id, s] of stats.entries()) {
    if (s.requests > 0 && (s.p95Latency || s.avgLatency) < fastestMs) {
      fastestMs = s.p95Latency || s.avgLatency;
      fastestId = id;
    }
  }

  res.json({
    totalProviders: ALL_PROVIDERS.length,
    enabledCount,
    activeProviders,
    disabledProviders: disabled,
    totalDispatches,
    totalCalls,
    totalWins,
    topProvider,
    fastestProvider: fastestId ? { id: fastestId, avgMs: Math.round(fastestMs) } : null,
    recentRuns: runs.slice(0, 3).map(r => ({
      runId: r.runId,
      query: r.query.slice(0, 60),
      successCount: r.successCount,
      totalProviders: r.totalProviders,
      fastestProvider: r.fastestProvider,
    })),
    timestamp: new Date().toISOString(),
  });
});

export default router;
