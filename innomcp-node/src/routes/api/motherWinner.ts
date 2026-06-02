/**
 * routes/api/motherWinner.ts — Mother dispatch current win leader
 *
 * GET /api/mother/winner
 *
 * Returns the provider with the most synthesis wins plus a ranked leaderboard.
 * Reads from in-memory leaderboardMetrics (fastest, always current).
 *
 * Response:
 *   {
 *     winner: { providerId, wins, requests, successRate, avgLatency } | null,
 *     ranked: RankedEntry[],   // all providers with wins > 0, desc
 *     totalWins: number,
 *   }
 */

import { Router, Request, Response } from "express";
import { getProviderStats } from "../../services/leaderboardMetrics";

const router = Router();

interface RankedEntry {
  providerId: string;
  wins: number;
  requests: number;
  successRate: number;
  avgLatency: number;
}

router.get("/", (_req: Request, res: Response): void => {
  const stats = getProviderStats();

  const ranked: RankedEntry[] = [];
  for (const [id, s] of stats.entries()) {
    if (s.wins > 0) {
      ranked.push({
        providerId: id,
        wins: s.wins,
        requests: s.requests,
        successRate: s.successRate,
        avgLatency: s.avgLatency,
      });
    }
  }

  ranked.sort((a, b) => b.wins - a.wins);

  const winner = ranked.length > 0 ? ranked[0] : null;
  const totalWins = ranked.reduce((sum, e) => sum + e.wins, 0);

  res.json({ winner, ranked, totalWins });
});

export default router;
