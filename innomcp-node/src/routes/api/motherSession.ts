/**
 * routes/api/motherSession.ts — Current process session statistics
 *
 * GET /api/mother/session
 *
 * Returns statistics accumulated since the current process started.
 * Derived from in-memory motherHistory (ring buffer) and leaderboard metrics.
 * No auth required (read-only, session-scoped).
 */

import { Router, Request, Response } from "express";
import { getHistory } from "../../services/motherHistory";
import { getProviderStats } from "../../services/leaderboardMetrics";

const router = Router();

const SESSION_START = new Date().toISOString();

router.get("/", (_req: Request, res: Response): void => {
  const runs = getHistory(50);
  const stats = getProviderStats();

  const totalDispatches = runs.length;
  const totalProviderCalls = runs.reduce((sum, r) => sum + r.totalProviders, 0);
  const totalSuccesses = runs.reduce((sum, r) => sum + r.successCount, 0);

  const avgProvidersPerDispatch = totalDispatches > 0
    ? Math.round((totalProviderCalls / totalDispatches) * 10) / 10
    : 0;

  const sessionSuccessRate = totalProviderCalls > 0
    ? Math.round((totalSuccesses / totalProviderCalls) * 100)
    : 0;

  const mostActiveProvider = (() => {
    let topId = "";
    let topReqs = 0;
    for (const [id, s] of stats.entries()) {
      if (s.requests > topReqs) { topReqs = s.requests; topId = id; }
    }
    return topId ? { providerId: topId, requests: topReqs } : null;
  })();

  const topWinner = (() => {
    let topId = "";
    let topWins = 0;
    for (const [id, s] of stats.entries()) {
      if (s.wins > topWins) { topWins = s.wins; topId = id; }
    }
    return topId ? { providerId: topId, wins: topWins } : null;
  })();

  res.json({
    sessionStart: SESSION_START,
    totalDispatches,
    totalProviderCalls,
    avgProvidersPerDispatch,
    sessionSuccessRate,
    mostActiveProvider,
    topWinner,
    activeProviders: stats.size,
    timestamp: new Date().toISOString(),
  });
});

export default router;
