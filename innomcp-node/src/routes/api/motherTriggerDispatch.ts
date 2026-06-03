/**
 * routes/api/motherTriggerDispatch.ts — Trigger a test mother dispatch
 *
 * POST /api/mother/trigger-dispatch
 * Body: { query?: string; intent?: string }
 *
 * Fires a real mother dispatch from the admin UI without needing a chat message.
 * Uses a simple emit function that discards events (no SSE needed).
 * Returns the dispatch result.
 */

import { Router, Request, Response } from "express";
import { dispatchMother } from "../../agents/motherDispatch";
import { randomUUID } from "node:crypto";

const router = Router();

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { query = "test dispatch from admin", intent = "general" } = req.body as {
    query?: string;
    intent?: string;
  };

  if (typeof query !== "string" || query.trim().length === 0) {
    res.status(400).json({ ok: false, error: "query must be a non-empty string" });
    return;
  }

  const runId = `admin-trigger-${randomUUID().slice(0, 8)}`;
  const messageId = `msg-${randomUUID().slice(0, 8)}`;

  // No-op emit — events discarded for admin trigger
  const noop = () => {};

  try {
    const result = await dispatchMother(
      intent.trim() || "general",
      query.trim().slice(0, 200),
      runId,
      messageId,
      noop,
      { responseMode: "normal" }
    );

    res.json({
      ok: true,
      runId,
      totalAgents: result.totalAgents,
      successCount: result.successCount,
      synthesis: result.synthesis.slice(0, 300),
      totalEstimatedCostUsd: result.totalEstimatedCostUsd,
      providers: result.results.map(r => ({
        id: r.providerId,
        success: r.success,
        latencyMs: r.latencyMs,
        preview: r.text.trim().slice(0, 100),
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
