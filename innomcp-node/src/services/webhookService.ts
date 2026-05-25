/**
 * Webhook Registry Service — Phase 4
 *
 * In-memory store for webhook registrations (DB persistence in Phase 5).
 * Supports fire-and-forget delivery with HMAC-SHA256 signing.
 */

import { createHmac } from "node:crypto";

export type WebhookEvent =
  | "task.completed"
  | "task.failed"
  | "artifact.created"
  | "approval.required";

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  enabled: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
  failureCount: number;
}

// In-memory store (DB persistence in Phase 5)
const webhooks = new Map<string, Webhook>();

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function listWebhooks(): Webhook[] {
  return Array.from(webhooks.values());
}

export function getWebhook(id: string): Webhook | undefined {
  return webhooks.get(id);
}

export function createWebhook(
  input: Omit<Webhook, "id" | "createdAt" | "failureCount">
): Webhook {
  const webhook: Webhook = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    failureCount: 0,
  };
  webhooks.set(webhook.id, webhook);
  return webhook;
}

export function deleteWebhook(id: string): boolean {
  return webhooks.delete(id);
}

export function toggleWebhook(id: string, enabled: boolean): Webhook | null {
  const webhook = webhooks.get(id);
  if (!webhook) return null;
  webhook.enabled = enabled;
  return webhook;
}

// ── Delivery ──────────────────────────────────────────────────────────────────

export async function fireWebhook(
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const targets = Array.from(webhooks.values()).filter(
    (wh) => wh.enabled && wh.events.includes(event)
  );

  if (targets.length === 0) return;

  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  await Promise.allSettled(
    targets.map(async (wh) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "INNOMCP-Webhook/1.0",
      };

      if (wh.secret) {
        const sig = createHmac("sha256", wh.secret)
          .update(body)
          .digest("hex");
        headers["X-INNOMCP-Signature"] = `sha256=${sig}`;
      }

      try {
        const resp = await fetch(wh.url, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(10_000),
        });

        wh.lastTriggeredAt = new Date().toISOString();

        if (!resp.ok) {
          wh.failureCount++;
          console.warn(
            `[webhook] delivery failed: ${wh.id} → ${wh.url} — HTTP ${resp.status}`
          );
        }
      } catch (err: unknown) {
        wh.failureCount++;
        wh.lastTriggeredAt = new Date().toISOString();
        console.warn(
          `[webhook] delivery error: ${wh.id} → ${wh.url} —`,
          (err as Error)?.message ?? err
        );
      }
    })
  );
}
