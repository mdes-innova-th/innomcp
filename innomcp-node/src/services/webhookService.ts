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
  userId?: string;
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

export function listWebhooks(userId?: string): Webhook[] {
  const all = Array.from(webhooks.values());
  if (userId === undefined) return all;
  return all.filter((w) => !w.userId || w.userId === userId);
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

// ── Format helpers ────────────────────────────────────────────────────────────

function detectFormat(url: string): "json" | "slack" | "line" {
  if (url.includes("hooks.slack.com") || url.includes("slack.com/services")) return "slack";
  if (url.includes("api.line.me") || url.includes("notify-api.line.me")) return "line";
  return "json";
}

function formatPayload(
  event: WebhookEvent,
  data: Record<string, unknown>,
  format: "json" | "slack" | "line"
): Record<string, unknown> {
  const emoji =
    event === "task.completed" ? "✅" :
    event === "task.failed" ? "❌" :
    event === "approval.required" ? "⚠️" : "ℹ️";

  const title =
    event === "task.completed" ? "งานเสร็จแล้ว" :
    event === "task.failed" ? "งานล้มเหลว" :
    event === "approval.required" ? "ต้องการการอนุมัติ" : "การแจ้งเตือน";

  const body = (data.title as string) || (data.message as string) || "INNOMCP notification";

  if (format === "slack") {
    return {
      text: `${emoji} *${title}*`,
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: `${emoji} *${title}*\n${body}` },
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: `INNOMCP • ${new Date().toLocaleString("th-TH")}` },
          ],
        },
      ],
    };
  }

  if (format === "line") {
    return {
      messages: [
        {
          type: "text",
          text: `${emoji} ${title}\n\n${body}\n\n— INNOMCP`,
        },
      ],
    };
  }

  // Default JSON
  return { event, timestamp: new Date().toISOString(), data };
}

// ── Delivery ──────────────────────────────────────────────────────────────────

/**
 * Fire a webhook event to a single specific webhook by ID,
 * bypassing the enabled and event-subscription filters.
 * Used for manual test deliveries.
 */
export async function fireWebhookById(
  id: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const wh = webhooks.get(id);
  if (!wh) throw new Error(`webhook ${id} not found`);

  const format = detectFormat(wh.url);
  const formatted = formatPayload(event, payload, format);
  const body = JSON.stringify(formatted);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "INNOMCP-Webhook/1.0",
  };

  if (format === "line" && wh.secret) {
    headers["Authorization"] = `Bearer ${wh.secret}`;
  } else if (wh.secret) {
    const sig = createHmac("sha256", wh.secret)
      .update(body)
      .digest("hex");
    headers["X-INNOMCP-Signature"] = `sha256=${sig}`;
  }

  const resp = await fetch(wh.url, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  });

  wh.lastTriggeredAt = new Date().toISOString();

  if (!resp.ok) {
    wh.failureCount++;
    throw new Error(`HTTP ${resp.status} from ${wh.url}`);
  }
}

export async function fireWebhook(
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const targets = Array.from(webhooks.values()).filter(
    (wh) => wh.enabled && wh.events.includes(event)
  );

  if (targets.length === 0) return;

  await Promise.allSettled(
    targets.map(async (wh) => {
      const format = detectFormat(wh.url);
      const formatted = formatPayload(event, payload, format);
      const body = JSON.stringify(formatted);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "INNOMCP-Webhook/1.0",
      };

      // LINE uses Bearer token auth; other services use HMAC signing
      if (format === "line" && wh.secret) {
        headers["Authorization"] = `Bearer ${wh.secret}`;
      } else if (wh.secret) {
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
