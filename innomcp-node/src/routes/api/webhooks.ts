/**
 * routes/api/webhooks.ts — Webhook registry CRUD (Phase 4)
 *
 *   GET    /api/webhooks        → list webhooks (secret masked as hasSecret)
 *   POST   /api/webhooks        → create webhook
 *   PATCH  /api/webhooks/:id    → toggle enabled/disabled
 *   DELETE /api/webhooks/:id    → remove webhook
 */

import { Router, Request, Response } from "express";
import {
  listWebhooks,
  createWebhook,
  deleteWebhook,
  toggleWebhook,
  type Webhook,
  type WebhookEvent,
} from "../../services/webhookService";

const router = Router();

const VALID_EVENTS: WebhookEvent[] = [
  "task.completed",
  "task.failed",
  "artifact.created",
  "approval.required",
];

function maskSecret(wh: Webhook): Omit<Webhook, "secret"> & { hasSecret: boolean } {
  const { secret, ...rest } = wh;
  return { ...rest, hasSecret: !!secret };
}

// ── GET /api/webhooks ─────────────────────────────────────────────────────────
router.get("/", (_req: Request, res: Response) => {
  res.json({ webhooks: listWebhooks().map(maskSecret) });
});

// ── POST /api/webhooks ────────────────────────────────────────────────────────
router.post("/", (req: Request, res: Response) => {
  const { name, url, events, secret } = req.body as {
    name?: string;
    url?: string;
    events?: unknown;
    secret?: string;
  };

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required" });
  }
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: "url must be a valid URL" });
  }
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: "events must be a non-empty array" });
  }
  const invalidEvents = (events as string[]).filter(
    (e) => !VALID_EVENTS.includes(e as WebhookEvent)
  );
  if (invalidEvents.length > 0) {
    return res
      .status(400)
      .json({ error: `invalid events: ${invalidEvents.join(", ")}` });
  }

  const webhook = createWebhook({
    name: name.trim(),
    url,
    events: events as WebhookEvent[],
    secret: secret || undefined,
    enabled: true,
  });

  res.status(201).json({ webhook: maskSecret(webhook) });
});

// ── PATCH /api/webhooks/:id ───────────────────────────────────────────────────
router.patch("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { enabled } = req.body as { enabled?: unknown };

  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "enabled (boolean) is required" });
  }

  const updated = toggleWebhook(id, enabled);
  if (!updated) {
    return res.status(404).json({ error: "webhook not found" });
  }

  res.json({ webhook: maskSecret(updated) });
});

// ── DELETE /api/webhooks/:id ──────────────────────────────────────────────────
router.delete("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = deleteWebhook(id);
  if (!deleted) {
    return res.status(404).json({ error: "webhook not found" });
  }
  res.json({ ok: true });
});

export default router;
