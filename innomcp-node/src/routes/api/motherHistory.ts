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
import { getHistory, getRunById } from "../../services/motherHistory";

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

/**
 * GET /api/mother/history/:runId
 * Returns a single run with full provider detail.
 */
router.get("/:runId", (req: Request, res: Response): void => {
  const { runId } = req.params;
  if (!runId || !/^[a-zA-Z0-9_-]{1,128}$/.test(runId)) {
    res.status(400).json({ error: "invalid runId" });
    return;
  }
  const run = getRunById(runId);
  if (!run) {
    res.status(404).json({ error: "run not found" });
    return;
  }
  res.json({ run, timestamp: new Date().toISOString() });
});

export default router;
