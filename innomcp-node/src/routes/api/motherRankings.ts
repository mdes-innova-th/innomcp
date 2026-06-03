/**
 * routes/api/motherRankings.ts — Mother provider multi-metric rankings
 *
 * GET /api/mother/rankings
 *
 * Ranks all 14 providers by composite score across three dimensions:
 *   - Speed rank: lower avgLatency = higher rank
 *   - Reliability rank: higher successRate = higher rank
 *   - Popularity rank: more requests = higher rank
 *   - Win rank: more wins = higher rank
 *
 * Returns providers ranked 1-14 (or fewer if no stats), plus tier badges:
 *   "gold" (top 3), "silver" (4-7), "bronze" (8-10), "none" (11+)
 */

import { Router, Request, Response } from "express";
import { getProviderStats } from "../../services/leaderboardMetrics";

const router = Router();

interface RankingEntry {
  providerId: string;
  rank: number;
  tier: "gold" | "silver" | "bronze" | "none";
  compositeScore: number;
  speedScore: number;
  reliabilityScore: number;
  popularityScore: number;
  winScore: number;
  qualityScore: number;
  efficiencyScore: number;
  healthScore: number;
  requests: number;
  avgLatency: number;
  successRate: number;
  wins: number;
}

router.get("/", (_req: Request, res: Response): void => {
  const stats = getProviderStats();

  if (stats.size === 0) {
    res.json({ rankings: [], totalRanked: 0, timestamp: new Date().toISOString() });
    return;
  }

  const entries: RankingEntry[] = [];

  for (const [id, s] of stats.entries()) {
    if (s.requests === 0) continue;

    // Normalize each dimension to 0–100
    const speedScore    = Math.round(100 * (1 / (1 + (s.p95Latency || s.avgLatency) / 3000)));
    const reliabilityScore = Math.round(s.successRate);
    const popularityScore  = Math.round(Math.min(100, (s.requests / 50) * 100));
    const winScore         = Math.round(Math.min(100, (s.wins / 10) * 100));

    const qualityScore = Math.round(s.avgQuality || 0);
    const hasQuality = qualityScore > 0;

    // Composite: if quality data available — speed 25%, reliability 30%, popularity 15%, wins 15%, quality 15%
    //            otherwise — speed 30%, reliability 35%, popularity 20%, wins 15%
    const compositeScore = hasQuality
      ? Math.round(
          speedScore * 0.25 +
          reliabilityScore * 0.30 +
          popularityScore * 0.15 +
          winScore * 0.15 +
          qualityScore * 0.15
        )
      : Math.round(
          speedScore * 0.30 +
          reliabilityScore * 0.35 +
          popularityScore * 0.20 +
          winScore * 0.15
        );

    entries.push({
      providerId: id,
      rank: 0, // filled below
      tier: "none",
      compositeScore,
      speedScore,
      reliabilityScore,
      popularityScore,
      winScore,
      qualityScore,
      efficiencyScore: s.efficiencyScore || 0,
      healthScore: s.healthScore || 0,
      requests: s.requests,
      avgLatency: s.avgLatency,
      successRate: s.successRate,
      wins: s.wins,
    });
  }

  // Sort by composite score descending
  entries.sort((a, b) => b.compositeScore - a.compositeScore);

  // Assign rank and tier
  entries.forEach((e, i) => {
    e.rank = i + 1;
    e.tier = i < 3 ? "gold" : i < 7 ? "silver" : i < 10 ? "bronze" : "none";
  });

  res.json({
    rankings: entries,
    totalRanked: entries.length,
    timestamp: new Date().toISOString(),
  });
});

export default router;
