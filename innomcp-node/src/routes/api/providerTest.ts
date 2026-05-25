/**
 * routes/api/providerTest.ts — Phase 3 provider test-call endpoint
 *
 * POST /api/providers/test-call
 * Body: { providerId: string, message: string }
 * → calls callProvider() with the message, returns { response, durationMs }
 *
 * This endpoint is public (no API key required) — same auth level as
 * /api/ai/providers and /api/model-settings. Rate limiting is applied
 * by the caller (app.ts) via generalRateLimit.
 */

import { Router, Request, Response } from "express";
import { getProvider } from "../../providers/registry";
import { callProvider } from "../../services/providerAdapter";

const router = Router();

/**
 * POST /api/providers/test-call
 *
 * Sends a single user message to the specified provider and returns
 * the full response text along with wall-clock duration.
 */
router.post("/", async (req: Request, res: Response) => {
  const { providerId, message } = (req.body ?? {}) as {
    providerId?: unknown;
    message?: unknown;
  };

  if (typeof providerId !== "string" || providerId.trim().length === 0) {
    return res.status(400).json({ error: "providerId is required (string)" });
  }
  if (typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "message is required (string)" });
  }

  const provider = getProvider(providerId.trim());
  if (!provider) {
    return res.status(404).json({ error: `provider not found: ${providerId}` });
  }
  if (!provider.enabled) {
    return res.status(400).json({ error: `provider is disabled: ${provider.displayName}` });
  }

  const start = Date.now();
  try {
    const response = await callProvider(provider, {
      messages: [{ role: "user", content: message.trim() }],
    });
    const durationMs = Date.now() - start;
    return res.json({ response, durationMs });
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: errorMsg, durationMs });
  }
});

export default router;
