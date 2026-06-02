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

export default router;
