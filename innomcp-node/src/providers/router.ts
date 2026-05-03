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

  const ranked = candidates
    .map((p) => ({
      p,
      score: capabilityScore(p, opts.capabilities) * 100 + p.priority,
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
