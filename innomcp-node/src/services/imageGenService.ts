/**
 * imageGenService.ts — MDES Innovation MCP
 * AI Image Generation Service Layer
 *
 * Provider priority:
 *  1. MDES Agency Gateway    (IMAGE_GEN_GATEWAY_URL)   — primary, secure
 *  2. Pollinations.ai        (free, no key)             — fallback
 *
 * Contract:
 *   callImageGen(prompt) → ImageGenResult { url, base64?, provider, model, prompt, durationMs }
 */

import { logBoth } from "../utils/mcpLogger";

export interface ImageGenResult {
  /** Public image URL (Pollinations) or data: URI / temp URL (gateway) */
  url: string;
  /** base64-encoded PNG/JPEG when gateway returns raw bytes */
  base64?: string;
  /** Human-readable provider name for display */
  provider: string;
  /** Model identifier returned by provider */
  model: string;
  /** Cleaned prompt that was actually sent */
  prompt: string;
  /** Round-trip duration in milliseconds */
  durationMs: number;
  /** Which provider path was used */
  source: "gateway" | "pollinations";
}

export interface ImageGenError {
  ok: false;
  error: string;
  code: string;
}

export type ImageGenResponse = ({ ok: true } & ImageGenResult) | ImageGenError;

// ── Helpers ──────────────────────────────────────────────────────────────────

function cleanPrompt(raw: string): string {
  return raw
    .replace(/^(สร้าง|วาด|generate|draw|create)\s*(รูป|ภาพ|รูปภาพ|image|picture|img)\s*/i, "")
    .replace(/^(รูป|ภาพ|รูปภาพ|image|picture)\s*(สร้าง|วาด|generate|draw|create)\s*/i, "")
    .trim()
    .slice(0, 500);
}

function buildPollinationsUrl(prompt: string): string {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&nologo=true`;
}

// ── Gateway Provider ──────────────────────────────────────────────────────────

async function callGateway(
  gatewayUrl: string,
  prompt: string,
  timeoutMs: number
): Promise<ImageGenResult> {
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const body = JSON.stringify({ prompt, width: 768, height: 768 });

  try {
    const res = await fetch(gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Gateway HTTP ${res.status}: ${await res.text().catch(() => "")}`);
    }

    const contentType = res.headers.get("content-type") || "";

    // Case A: Gateway returns JSON with { url } or { data: [{ url }] }
    if (contentType.includes("application/json")) {
      const json = await res.json();
      const url: string =
        json?.url ||
        json?.image_url ||
        json?.data?.[0]?.url ||
        json?.result?.url ||
        "";
      const base64: string | undefined =
        json?.base64 || json?.data?.[0]?.b64_json;
      if (!url && !base64) {
        throw new Error("Gateway returned no URL or base64 in JSON response");
      }
      return {
        url: url || `data:image/png;base64,${base64}`,
        base64,
        provider: "MDES Gateway",
        model: json?.model || "agency-model",
        prompt,
        durationMs: Date.now() - t0,
        source: "gateway",
      };
    }

    // Case B: Gateway returns raw image bytes
    const buffer = await res.arrayBuffer();
    const mime = contentType.startsWith("image/") ? contentType : "image/png";
    const b64 = Buffer.from(buffer).toString("base64");
    return {
      url: `data:${mime};base64,${b64}`,
      base64: b64,
      provider: "MDES Gateway",
      model: "agency-model",
      prompt,
      durationMs: Date.now() - t0,
      source: "gateway",
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── Pollinations Fallback ─────────────────────────────────────────────────────

async function callPollinations(prompt: string): Promise<ImageGenResult> {
  const t0 = Date.now();
  const url = buildPollinationsUrl(prompt);
  // Pollinations returns an image URL that is valid after generation.
  // We validate it exists with a HEAD request then return the URL.
  try {
    const check = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    if (!check.ok && check.status !== 200) {
      throw new Error(`Pollinations HEAD check failed: ${check.status}`);
    }
  } catch {
    // Even if HEAD fails, return the URL — browser will load it on render
  }
  return {
    url,
    provider: "Pollinations.ai",
    model: "flux",
    prompt,
    durationMs: Date.now() - t0,
    source: "pollinations",
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate an image from a user prompt.
 * Tries MDES Gateway first; falls back to Pollinations.ai.
 *
 * @param rawPrompt - The user's raw message or extracted prompt
 */
export async function callImageGen(rawPrompt: string): Promise<ImageGenResponse> {
  const prompt = cleanPrompt(rawPrompt) || rawPrompt.slice(0, 500).trim();

  const gatewayUrl = process.env.IMAGE_GEN_GATEWAY_URL?.trim();
  const timeoutMs = parseInt(process.env.IMAGE_GEN_TIMEOUT_MS || "60000", 10);

  // ─ Try MDES Gateway ─
  if (gatewayUrl) {
    try {
      logBoth("info", `[ImageGen] Trying MDES gateway: ${gatewayUrl.replace(/\/\/[^/]*/, "//***")}`);
      const result = await callGateway(gatewayUrl, prompt, timeoutMs);
      logBoth("info", `[ImageGen] Gateway OK in ${result.durationMs}ms`);
      return { ok: true, ...result };
    } catch (err: any) {
      logBoth("warn", `[ImageGen] Gateway failed (${err?.message}), falling back to Pollinations.ai`);
    }
  }

  // ─ Fallback: Pollinations.ai ─
  try {
    logBoth("info", "[ImageGen] Using Pollinations.ai fallback");
    const result = await callPollinations(prompt);
    logBoth("info", `[ImageGen] Pollinations OK in ${result.durationMs}ms`);
    return { ok: true, ...result };
  } catch (err: any) {
    logBoth("error", `[ImageGen] Both providers failed: ${err?.message}`);
    return {
      ok: false,
      error: err?.message || "Unknown image generation error",
      code: "ALL_PROVIDERS_FAILED",
    };
  }
}

/**
 * Build the display text for a successful image generation.
 */
export function buildImageGenText(result: ImageGenResult): string {
  const providerLine =
    result.source === "gateway"
      ? `⚙️ สร้างโดย: **${result.provider}** (${result.model})`
      : `⚙️ สร้างโดย: **Pollinations.ai** (Flux model — ฟรี)`;
  return `🎨 **สร้างรูปภาพ AI ให้แล้วครับ**\n\n📝 คำสั่ง: "${result.prompt}"\n🖼️ ดูภาพด้านล่าง\n\n${providerLine}`;
}
