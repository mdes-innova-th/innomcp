/**
 * routes/api/motherCompare.ts — Head-to-head provider comparison
 *
 * GET /api/mother/compare/:id1/:id2
 *
 * Compares two providers side-by-side across all tracked metrics.
 * Returns raw stats plus a "winner" per dimension.
 */

import { Router, Request, Response } from "express";
import { getProviderStats } from "../../services/leaderboardMetrics";

const router = Router();

interface ComparisonResult {
  provider1: { id: string; stats: Record<string, number> };
  provider2: { id: string; stats: Record<string, number> };
  winners: {
    speed: string;        // lower latency wins
    reliability: string;  // higher successRate wins
    verbosity: string;    // higher avgResponseLength wins
    wins: string;         // more wins wins
    overall: string;      // composite score winner
  };
}

function compositeScore(s: { avgLatency: number; successRate: number; wins: number; avgResponseLength: number; requests: number }): number {
  const speed = 100 * (1 / (1 + (s.avgLatency || 1000) / 3000));
  const reliability = s.successRate;
  const popularity = Math.min(100, (s.requests / 50) * 100);
  const winScore = Math.min(100, (s.wins / 10) * 100);
  return Math.round(speed * 0.30 + reliability * 0.35 + popularity * 0.20 + winScore * 0.15);
}

router.get("/:id1/:id2", (req: Request, res: Response): void => {
  const { id1, id2 } = req.params;
  if (!id1 || !id2 || id1 === id2) {
    res.status(400).json({ error: "Two different provider IDs required" });
    return;
  }

  const stats = getProviderStats();
  const s1 = stats.get(id1);
  const s2 = stats.get(id2);

  if (!s1 && !s2) {
    res.status(404).json({ error: "Neither provider has stats yet" });
    return;
  }

  const zero = { requests: 0, avgLatency: 0, successRate: 0, p95Latency: 0, wins: 0, avgResponseLength: 0 };
  const a = s1 ?? zero;
  const b = s2 ?? zero;

  const winners = {
    speed:       a.avgLatency <= b.avgLatency ? id1 : id2,
    reliability: a.successRate >= b.successRate ? id1 : id2,
    verbosity:   a.avgResponseLength >= b.avgResponseLength ? id1 : id2,
    wins:        a.wins >= b.wins ? id1 : id2,
    overall:     compositeScore(a) >= compositeScore(b) ? id1 : id2,
  };

  const result: ComparisonResult = {
    provider1: {
      id: id1,
      stats: {
        requests: a.requests,
        avgLatency: a.avgLatency,
        p95Latency: a.p95Latency,
        successRate: a.successRate,
        wins: a.wins,
        avgResponseLength: a.avgResponseLength,
        compositeScore: compositeScore(a),
      },
    },
    provider2: {
      id: id2,
      stats: {
        requests: b.requests,
        avgLatency: b.avgLatency,
        p95Latency: b.p95Latency,
        successRate: b.successRate,
        wins: b.wins,
        avgResponseLength: b.avgResponseLength,
        compositeScore: compositeScore(b),
      },
    },
    winners,
  };

  res.json({ comparison: result, timestamp: new Date().toISOString() });
});

export default router;
