/**
 * routes/api/motherStats.ts — Aggregate stats for the mother dispatch system
 *
 * GET /api/mother/stats
 * Returns a dashboard-ready stats object aggregating metrics across all
 * history runs (ring buffer, last 50) and the live leaderboard tracker.
 *
 * No auth required (read-only metrics endpoint, 5 s cache applied in app.ts).
 */

import { Router, Request, Response } from "express";
import { getHistory } from "../../services/motherHistory";
import { getProviderStats } from "../../services/leaderboardMetrics";

const router = Router();

interface ProviderAccumulator {
  totalCalls: number;
  successes: number;
  totalLatency: number;
}

interface ProviderBreakdownEntry {
  providerId: string;
  totalCalls: number;
  successes: number;
  avgLatencyMs: number;
  successRate: number;
}

interface MotherStatsResponse {
  totalRuns: number;
  totalProviderCalls: number;
  avgSuccessRate: number;
  avgProvidersPerRun: number;
  fastestProvider: { id: string; avgLatencyMs: number } | null;
  mostReliableProvider: { id: string; successRate: number } | null;
  topProviderByRequests: { id: string; requests: number } | null;
  recentIterations: number;
  lastRunAt: string | null;
  providerBreakdown: ProviderBreakdownEntry[];
}

/**
 * GET /api/mother/stats
 * Aggregates metrics across all history runs + leaderboard metrics.
 */
router.get("/", (_req: Request, res: Response): void => {
  const runs = getHistory(50);
  const providerStats = getProviderStats();

  // --- Accumulate per-provider data from history runs ---
  const accMap = new Map<string, ProviderAccumulator>();

  for (const run of runs) {
    for (const p of run.providers) {
      const existing = accMap.get(p.providerId);
      if (existing) {
        existing.totalCalls += 1;
        existing.totalLatency += p.latencyMs;
        if (p.success) existing.successes += 1;
      } else {
        accMap.set(p.providerId, {
          totalCalls: 1,
          totalLatency: p.latencyMs,
          successes: p.success ? 1 : 0,
        });
      }
    }
  }

  // --- Build providerBreakdown array ---
  const providerBreakdown: ProviderBreakdownEntry[] = [];
  for (const [providerId, acc] of accMap.entries()) {
    providerBreakdown.push({
      providerId,
      totalCalls: acc.totalCalls,
      successes: acc.successes,
      avgLatencyMs: Math.round(acc.totalLatency / acc.totalCalls),
      successRate: Math.round((acc.successes / acc.totalCalls) * 100),
    });
  }

  // --- Scalar aggregates ---
  const totalRuns = runs.length;

  const totalProviderCalls = providerBreakdown.reduce(
    (sum, p) => sum + p.totalCalls,
    0
  );

  let avgSuccessRate = 0;
  if (totalRuns > 0) {
    const runRateSum = runs.reduce((sum, run) => {
      if (run.totalProviders === 0) return sum;
      return sum + (run.successCount / run.totalProviders) * 100;
    }, 0);
    // Only divide by runs that actually had providers
    const validRuns = runs.filter((r) => r.totalProviders > 0).length;
    avgSuccessRate = validRuns > 0 ? Math.round(runRateSum / validRuns) : 0;
  }

  let avgProvidersPerRun = 0;
  if (totalRuns > 0) {
    const totalProviders = runs.reduce((sum, r) => sum + r.totalProviders, 0);
    avgProvidersPerRun =
      Math.round((totalProviders / totalRuns) * 100) / 100;
  }

  const recentIterations = runs.filter(
    (r) => Date.now() - new Date(r.timestamp).getTime() < 300_000
  ).length;

  const lastRunAt = runs[0]?.timestamp ?? null;

  // --- fastestProvider: lowest avgLatencyMs among providers with at least 1 success ---
  const successfulProviders = providerBreakdown.filter(
    (p) => p.successes > 0
  );
  let fastestProvider: { id: string; avgLatencyMs: number } | null = null;
  if (successfulProviders.length > 0) {
    const fastest = successfulProviders.reduce((best, p) =>
      p.avgLatencyMs < best.avgLatencyMs ? p : best
    );
    fastestProvider = {
      id: fastest.providerId,
      avgLatencyMs: fastest.avgLatencyMs,
    };
  }

  // --- mostReliableProvider + topProviderByRequests: from leaderboard tracker ---
  let mostReliableProvider: { id: string; successRate: number } | null = null;
  let topProviderByRequests: { id: string; requests: number } | null = null;

  if (providerStats.size > 0) {
    let bestReliable: { id: string; successRate: number } | null = null;
    let bestRequests: { id: string; requests: number } | null = null;

    for (const [id, stats] of providerStats.entries()) {
      if (stats.requests === 0) continue;

      if (
        bestReliable === null ||
        stats.successRate > bestReliable.successRate
      ) {
        bestReliable = { id, successRate: stats.successRate };
      }

      if (
        bestRequests === null ||
        stats.requests > bestRequests.requests
      ) {
        bestRequests = { id, requests: stats.requests };
      }
    }

    mostReliableProvider = bestReliable;
    topProviderByRequests = bestRequests;
  }

  const response: MotherStatsResponse = {
    totalRuns,
    totalProviderCalls,
    avgSuccessRate,
    avgProvidersPerRun,
    fastestProvider,
    mostReliableProvider,
    topProviderByRequests,
    recentIterations,
    lastRunAt,
    providerBreakdown,
  };

  res.json(response);
});

export default router;
