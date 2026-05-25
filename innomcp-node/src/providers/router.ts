/**
 * providers/router.ts — Phase C provider broker
 *
 * Capability-aware selector. Given a desired capability set, a chat mode
 * (local/remote/hybrid), and a privacy level, return the best provider
 * record from the registry. Pure function over the registry — does not
 * itself perform the LLM call.
 */

import { listProviders } from "./registry";
import type { Capability, PrivacyLevel, ProviderRecord } from "./types";

export type ChatMode = "local" | "remote" | "hybrid";

export interface SelectOptions {
  mode: ChatMode;
  capabilities: Capability[];
  privacyLevel?: PrivacyLevel;
  preferredProviderId?: string;
  /** Block providers whose latest health is `down`. Default true. */
  excludeDown?: boolean;
}

export interface SelectionResult {
  /** The chosen provider, or null if nothing matched. */
  provider: ProviderRecord | null;
  /** Other candidates in priority order, useful for fallback chains. */
  alternates: ProviderRecord[];
  /** Short human-readable reason for the selection (Thai). */
  reason: string;
}

function matchesMode(p: ProviderRecord, mode: ChatMode): boolean {
  if (mode === "local") return p.type === "ollama-local";
  if (mode === "remote") {
    return (
      p.type === "ollama-remote" ||
      p.type === "openai-compatible" ||
      p.type === "anthropic-compatible" ||
      p.type === "custom"
    );
  }
  // hybrid: anything goes
  return true;
}

function matchesPrivacy(p: ProviderRecord, want?: PrivacyLevel): boolean {
  if (!want) return true;
  // confidential demands confidential or internal; public demands any.
  if (want === "confidential") return p.privacyLevel === "confidential" || p.privacyLevel === "internal";
  if (want === "internal") return p.privacyLevel !== "public";
  return true;
}

function capabilityScore(p: ProviderRecord, wanted: Capability[]): number {
  if (wanted.length === 0) return 1;
  const hits = wanted.filter((c) => p.capabilities.includes(c)).length;
  return hits / wanted.length;
}

export function selectProvider(opts: SelectOptions): SelectionResult {
  const all = listProviders().filter((p) => p.enabled);
  const candidates = all
    .filter((p) => matchesMode(p, opts.mode))
    .filter((p) => matchesPrivacy(p, opts.privacyLevel))
    .filter((p) => (opts.excludeDown !== false ? p.healthStatus !== "down" : true));

  if (candidates.length === 0) {
    return {
      provider: null,
      alternates: [],
      reason: "ไม่พบผู้ให้บริการที่เข้าเงื่อนไขการเลือก",
    };
  }

  const capabilityCandidates =
    opts.capabilities.length > 0
      ? candidates.filter((p) => capabilityScore(p, opts.capabilities) > 0)
      : candidates;
  const eligible = capabilityCandidates.length > 0 ? capabilityCandidates : candidates;
  const rank = (p: ProviderRecord) => capabilityScore(p, opts.capabilities) * 100 + p.priority;
  const preferred = opts.preferredProviderId
    ? eligible.find((p) => p.id === opts.preferredProviderId)
    : undefined;

  if (preferred && capabilityScore(preferred, opts.capabilities) > 0) {
    const alternates = eligible
      .filter((p) => p.id !== preferred.id)
      .sort((a, b) => rank(b) - rank(a));
    const matched = opts.capabilities.filter((c) => preferred.capabilities.includes(c));
    const reason =
      `เลือก ${preferred.displayName} ตาม provider ที่ผู้ใช้ระบุ` +
      (matched.length > 0 ? `: ตรงความสามารถ ${matched.join(", ")}` : "");

    return { provider: preferred, alternates, reason };
  }

  const ranked = eligible
    .map((p) => ({
      p,
      score: rank(p),
    }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0].p;
  const alternates = ranked.slice(1).map((r) => r.p);
  const matched = opts.capabilities.filter((c) => top.capabilities.includes(c));
  const reason =
    `เลือก ${top.displayName} (priority=${top.priority})` +
    (matched.length > 0 ? `: ตรงความสามารถ ${matched.join(", ")}` : "");

  return { provider: top, alternates, reason };
}

/**
 * Return the list of provider IDs that are available given the current env vars.
 * "mdes-ollama" is always included; the others require opt-in via env.
 */
export function getAvailableProviders(): string[] {
  const providers = ["mdes-ollama"];
  if (process.env.OPENAI_API_KEY || process.env.GPT_API_KEY) providers.push("gpt");
  if (process.env.GITHUB_COPILOT_TOKEN || process.env.COPILOT_API_KEY) providers.push("github-copilot");
  if (process.env.THAI_LLM_MODEL) providers.push("thai-llm");
  if (process.env.LOCAL_OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL) providers.push("ollama-local");
  return providers;
}

/**
 * Resolve the endpoint config for an env-gated provider by ID.
 * Returns null for unknown or registry-managed providers.
 */
export function resolveProviderEndpoint(
  providerId: string
): { url: string; key: string; model: string } | null {
  switch (providerId) {
    case "gpt":
      return {
        url: process.env.GPT_BASE_URL || "https://api.openai.com/v1",
        key: process.env.OPENAI_API_KEY || process.env.GPT_API_KEY || "",
        model: process.env.GPT_MODEL || "gpt-4o-mini",
      };
    case "github-copilot":
      return {
        url: process.env.GITHUB_COPILOT_BASE_URL || "https://api.githubcopilot.com",
        key: process.env.GITHUB_COPILOT_TOKEN || process.env.COPILOT_API_KEY || "",
        model: process.env.COPILOT_MODEL || "gpt-4o",
      };
    default:
      return null;
  }
}

/**
 * Preview the selection without committing — used by /api/ai/providers/route-preview.
 */
export function previewSelection(opts: SelectOptions): {
  selected: { id: string; displayName: string; model: string } | null;
  fallbackChain: Array<{ id: string; displayName: string; model: string }>;
  reason: string;
} {
  const result = selectProvider(opts);
  return {
    selected: result.provider
      ? {
          id: result.provider.id,
          displayName: result.provider.displayName,
          model: result.provider.model,
        }
      : null,
    fallbackChain: result.alternates.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      model: p.model,
    })),
    reason: result.reason,
  };
}
