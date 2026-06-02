/**
 * routes/api/motherHistory.ts — Mother dispatch run history endpoint
 *
 * GET /api/mother/history?limit=10
 * Returns last N mother dispatch runs with per-provider results.
 * Response: { runs: MotherRun[], total: number, timestamp: string }
 *
 * No auth required (read-only metrics endpoint).
 */

import { Router, Request, Response } from "express";
import { getHistory } from "../../services/motherHistory";

const router = Router();

/**
 * GET /api/mother/history
 * Query params:
 *   limit — number of runs to return (1–50, default 10)
 */
router.get("/", (req: Request, res: Response): void => {
  const raw = parseInt(req.query["limit"] as string, 10);
  const limit = Number.isFinite(raw) ? Math.min(Math.max(1, raw), 50) : 10;

  const runs = getHistory(limit);

  res.json({
    runs,
    total: runs.length,
    timestamp: new Date().toISOString(),
  });
});

export default router;
