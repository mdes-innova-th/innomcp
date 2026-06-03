/**
 * routes/api/motherTrends.ts — Winner trend across recent runs
 *
 * GET /api/mother/trends?limit=20
 *
 * Returns a timeline of which provider won each recent dispatch run,
 * plus a frequency summary. Used for trend charts.
 */

import { Router, Request, Response } from "express";
import { getHistory } from "../../services/motherHistory";

const router = Router();

router.get("/", (req: Request, res: Response): void => {
  const raw = parseInt((req.query as { limit?: string }).limit ?? "20", 10);
  const limit = Math.min(Math.max(1, Number.isFinite(raw) ? raw : 20), 50);

  const runs = getHistory(limit);

  // Build timeline: each run → winner
  const timeline = runs.map(r => ({
    runId: r.runId.slice(0, 8),
    timestamp: r.timestamp,
    winner: r.fastestProvider || "—",
    successCount: r.successCount,
    totalProviders: r.totalProviders,
    slowestMs: r.slowestMs,
    fastestMs: r.providers.filter(p => p.success).sort((a, b) => a.latencyMs - b.latencyMs)[0]?.latencyMs ?? 0,
  }));

  // Frequency: how many times each provider won
  const frequency: Record<string, number> = {};
  for (const t of timeline) {
    if (t.winner !== "—") frequency[t.winner] = (frequency[t.winner] ?? 0) + 1;
  }

  const dominantWinner = Object.entries(frequency).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const avgSuccessRate = timeline.length > 0
    ? Math.round(timeline.reduce((s, t) => s + (t.successCount / Math.max(t.totalProviders, 1)) * 100, 0) / timeline.length)
    : 0;

  res.json({
    timeline: timeline.reverse(), // oldest first for charts
    frequency,
    dominantWinner,
    avgSuccessRate,
    totalRuns: timeline.length,
    timestamp: new Date().toISOString(),
  });
});

export default router;
