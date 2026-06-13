<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-024 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":2892,"completion_tokens":8000,"total_tokens":10892,"prompt_tokens_details":{"cached_tokens":2816,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5385,"image_tokens":0},"cache_creation_input_tokens":0} | 75s
 generated: 2026-06-13T11:49:36.373Z -->
FILE: innomcp-node/src/services/webhookService.ts
<<<<<<< SEARCH
  // Default JSON
  return { event, timestamp: new Date().toISOString(), data };
}

// ── Delivery ──────────────────────────────────────────────────────────────────
=======
  // Default JSON
  return { event, timestamp: new Date().toISOString(), data };
}

/**
 * Validate a webhook URL to prevent SSRF.
 * Only allow HTTPS, block private/reserved IPs and localhost.
 */
function validateWebhookURL(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid webhook URL: ${url}`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTPS protocol");
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block common private/reserved hostnames and IP addresses
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.startsWith("169.254.") ||  // link-local, e.g., AWS metadata
    hostname.startsWith("10.") ||
    hostname.startsWith("172.16.") || hostname.startsWith("172.17.") || 
    hostname.startsWith("172.18.") || hostname.startsWith("172.19.") ||
    hostname.startsWith("172.20.") || hostname.startsWith("172.21.") ||
    hostname.startsWith("172.22.") || hostname.startsWith("172.23.") ||
    hostname.startsWith("172.24.") || hostname.startsWith("172.25.") ||
    hostname.startsWith("172.26.") || hostname.startsWith("172.27.") ||
    hostname.startsWith("172.28.") || hostname.startsWith("172.29.") ||
    hostname.startsWith("172.30.") || hostname.startsWith("172.31.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("fc") || // fc00::/7 unique local addresses (IPv6 simplified)
    hostname.includes(":") // basic IPv6 block: if it's an IPv6 address, block all for simplicity
  ) {
    throw new Error("Webhook URL hostname is a private/reserved IP address");
  }
}

function sanitizeUrlForLogging(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "<invalid-url>";
  }
}

// ── Delivery ──────────────────────────────────────────────────────────────────
>>>>>>> REPLACE

FILE: innomcp-node/src/services/webhookService.ts
<<<<<<< SEARCH
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
=======
export function createWebhook(
  input: Omit<Webhook, "id" | "createdAt" | "failureCount">
): Webhook {
  validateWebhookURL(input.url);

  const webhook: Webhook = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    failureCount: 0,
  };
  webhooks.set(webhook.id, webhook);
  return webhook;
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/webhookService.ts
<<<<<<< SEARCH
export function listWebhooks(userId?: string): Webhook[] {
  const all = Array.from(webhooks.values());
  if (userId === undefined) return all;
  return all.filter((w) => !w.userId || w.userId === userId);
}
=======
export function listWebhooks(userId?: string): Webhook[] {
  const all = Array.from(webhooks.values()).map(
    ({ secret, ...rest }) => rest as Webhook
  );
  if (userId === undefined) return all;
  return all.filter((w) => !w.userId || w.userId === userId);
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/webhookService.ts
<<<<<<< SEARCH
export function getWebhook(id: string): Webhook | undefined {
  return webhooks.get(id);
}
=======
export function getWebhook(id: string): Webhook | undefined {
  const wh = webhooks.get(id);
  if (!wh) return undefined;
  const { secret, ...rest } = wh;
  return rest as Webhook;
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/webhookService.ts
<<<<<<< SEARCH
export function deleteWebhook(id: string): boolean {
  return webhooks.delete(id);
}
=======
export function deleteWebhook(id: string, userId?: string): boolean {
  const wh = webhooks.get(id);
  if (!wh) return false;
  if (wh.userId && userId !== wh.userId) {
    throw new Error("Forbidden: ownership mismatch");
  }
  return webhooks.delete(id);
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/webhookService.ts
<<<<<<< SEARCH
export function toggleWebhook(id: string, enabled: boolean): Webhook | null {
  const webhook = webhooks.get(id);
  if (!webhook) return null;
  webhook.enabled = enabled;
  return webhook;
}
=======
export function toggleWebhook(id: string, enabled: boolean, userId?: string): Webhook | null {
  const wh = webhooks.get(id);
  if (!wh) return null;
  if (wh.userId && userId !== wh.userId) {
    throw new Error("Forbidden: ownership mismatch");
  }
  wh.enabled = enabled;
  const { secret, ...rest } = wh;
  return rest as Webhook;
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/webhookService.ts
<<<<<<< SEARCH
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
=======
export async function fireWebhookById(
  id: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
  userId?: string
): Promise<void> {
  const wh = webhooks.get(id);
  if (!wh) throw new Error(`webhook ${id} not found`);

  if (wh.userId && userId !== wh.userId) {
    throw new Error("Forbidden: ownership mismatch");
  }

  validateWebhookURL(wh.url);

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
    throw new Error(`HTTP ${resp.status} from ${sanitizeUrlForLogging(wh.url)}`);
  }
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/webhookService.ts
<<<<<<< SEARCH
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
=======
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
      const formatted = formatPayload(event, payload, format
