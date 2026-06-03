/**
 * routes/api/motherProviders.ts — Per-provider runtime toggle
 *
 * GET  /api/mother/providers          — list all providers with enabled state
 * POST /api/mother/providers/:id/enable   — enable a provider
 * POST /api/mother/providers/:id/disable  — disable a provider
 * POST /api/mother/providers/:id/toggle   — toggle a provider
 */

import { Router, Request, Response } from "express";
import {
  isProviderEnabled,
  enableProvider,
  disableProvider,
  toggleProvider,
  getDisabledProviders,
} from "../../services/motherProviderToggle";

const router = Router();

const ALL_PROVIDER_IDS = [
  "mdes-cloud", "thai-llm", "ollama-local", "openai-gpt",
  "claude-haiku", "claude-sonnet", "copilot", "gemini-pro",
  "mistral-large", "deepseek-r1", "groq-llama", "together-llama",
  "innova-bot", "innova-oracle",
];

router.get("/", (_req: Request, res: Response): void => {
  const providers = ALL_PROVIDER_IDS.map((id) => ({
    providerId: id,
    enabled: isProviderEnabled(id),
  }));
  const enabledCount = providers.filter((p) => p.enabled).length;
  res.json({ providers, enabledCount, totalProviders: providers.length });
});

router.post("/:providerId/enable", (req: Request, res: Response): void => {
  const { providerId } = req.params;
  if (!ALL_PROVIDER_IDS.includes(providerId)) {
    res.status(404).json({ ok: false, error: "Unknown provider" });
    return;
  }
  enableProvider(providerId);
  res.json({ ok: true, providerId, enabled: true });
});

router.post("/:providerId/disable", (req: Request, res: Response): void => {
  const { providerId } = req.params;
  if (!ALL_PROVIDER_IDS.includes(providerId)) {
    res.status(404).json({ ok: false, error: "Unknown provider" });
    return;
  }
  disableProvider(providerId);
  res.json({ ok: true, providerId, enabled: false });
});

router.post("/:providerId/toggle", (req: Request, res: Response): void => {
  const { providerId } = req.params;
  if (!ALL_PROVIDER_IDS.includes(providerId)) {
    res.status(404).json({ ok: false, error: "Unknown provider" });
    return;
  }
  const newState = toggleProvider(providerId);
  res.json({ ok: true, providerId, enabled: newState });
});

/**
 * GET /api/mother/providers/:providerId/stats
 * Returns detailed per-provider metrics from leaderboardMetrics.
 */
router.get("/:providerId/stats", (req: Request, res: Response): void => {
  const { providerId } = req.params;
  if (!ALL_PROVIDER_IDS.includes(providerId)) {
    res.status(404).json({ ok: false, error: "Unknown provider" });
    return;
  }

  const { getProviderStats, getSparklineData } = require("../../services/leaderboardMetrics") as typeof import("../../services/leaderboardMetrics");
  const stats = getProviderStats();
  const s = stats.get(providerId);
  const sparkline = getSparklineData(providerId, 20);

  res.json({
    providerId,
    enabled: isProviderEnabled(providerId),
    stats: s
      ? {
          requests: s.requests,
          avgLatency: s.avgLatency,
          p95Latency: s.p95Latency,
          successRate: s.successRate,
          wins: s.wins,
          winRate: s.winRate,
          avgResponseLength: s.avgResponseLength,
          avgQuality: s.avgQuality,
          topIntent: s.topIntent,
        }
      : null,
    sparkline,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/mother/providers/:providerId/history?limit=10
 * Returns dispatch runs where this provider participated.
 */
router.get("/:providerId/history", (req: Request, res: Response): void => {
  const { providerId } = req.params;
  if (!ALL_PROVIDER_IDS.includes(providerId)) {
    res.status(404).json({ ok: false, error: "Unknown provider" });
    return;
  }

  const raw = parseInt((req.query as { limit?: string }).limit ?? "10", 10);
  const limit = Math.min(Math.max(1, Number.isFinite(raw) ? raw : 10), 50);

  const { getHistory } = require("../../services/motherHistory") as typeof import("../../services/motherHistory");
  const allRuns = getHistory(50);

  const providerRuns = allRuns
    .filter(run => run.providers.some(p => p.providerId === providerId))
    .slice(0, limit)
    .map(run => {
      const p = run.providers.find(pr => pr.providerId === providerId)!;
      return {
        runId: run.runId,
        timestamp: run.timestamp,
        query: run.query.slice(0, 60),
        latencyMs: p.latencyMs,
        success: p.success,
        preview: p.preview,
        isFastest: run.fastestProvider === providerId,
        isWinner: run.fastestProvider === providerId,
      };
    });

  res.json({
    providerId,
    runs: providerRuns,
    total: providerRuns.length,
    timestamp: new Date().toISOString(),
  });
});

export default router;
