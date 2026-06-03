/**
 * routes/api/motherStreaks.ts — Current win streaks per provider
 *
 * GET /api/mother/streaks
 */

import { Router, Request, Response } from "express";
import { getProviderStats } from "../../services/leaderboardMetrics";

const router = Router();

router.get("/", (_req: Request, res: Response): void => {
  const stats = getProviderStats();

  const streaks = Array.from(stats.entries())
    .filter(([, s]) => s.bestStreak > 0 || s.currentStreak > 0)
    .map(([id, s]) => ({
      providerId: id,
      currentStreak: s.currentStreak,
      bestStreak: s.bestStreak,
      isStreaking: s.currentStreak >= 3,
    }))
    .sort((a, b) => b.currentStreak - a.currentStreak);

  const currentLeader = streaks.find(s => s.currentStreak > 0) ?? null;

  res.json({
    streaks,
    currentLeader: currentLeader ? { id: currentLeader.providerId, streak: currentLeader.currentStreak } : null,
    timestamp: new Date().toISOString(),
  });
});

export default router;
