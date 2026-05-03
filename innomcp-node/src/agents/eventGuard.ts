/**
 * agents/eventGuard.ts — public-safe gate for SSE events
 *
 * The contract: every AgentEvent that is about to be written to the SSE
 * stream is first serialized and scanned for forbidden field names and
 * forbidden visible substrings. If any are found, the emission is BLOCKED
 * — the orchestrator must replace the event with a safe `error` or
 * `fallback` envelope and surface the violation to logs (without leaking
 * the offending payload).
 *
 * This guard is intentionally a stupid string scanner. Type checks can be
 * bypassed at runtime by spread operators, untyped JSON merges, or third-
 * party libraries; a pre-write substring scan cannot.
 *
 * Reference: docs/brain/AGENT_WORKSTREAM_CONTRACT.md
 */

import type { AgentEvent } from "./events";
import { validateAgentEvent } from "./events";

/**
 * Forbidden top-level/nested key names. If the JSON serialization of an
 * event contains any of these as a quoted key (`"keyname":`), the event
 * is rejected. The check is case-insensitive.
 */
const FORBIDDEN_KEY_NAMES = [
  "privateThought",
  "hiddenReasoning",
  "chainOfThought",
  "rawThought",
  "innerMonologue",
  "secret",
  "apiKey",
  "password",
];

/**
 * Forbidden visible substrings that may NEVER appear in publicSummary,
 * deltaText, finalText, or fallbackReason. These exist to keep
 * placeholder/debug noise out of user-facing surfaces.
 *
 * `placeholder` is intentionally a *standalone* word match; the regex
 * below uses word boundaries to avoid false positives like
 * "placeholderless" or "ngoutplaceholder" (unlikely but possible).
 */
const FORBIDDEN_VISIBLE_LITERALS = [
  "Weather Map Placeholder",
  "Deterministic Local Static Tile",
  "ข้อมูลไม่ครบสำหรับการแสดงแผนที่",
];

const PLACEHOLDER_WORD_RE = /\bplaceholder\b/i;

const USED_TOOLS_NONE_RE = /Used tools:\s*none/i;

export interface GuardResult {
  ok: boolean;
  reason?: string;
  /** True if the violation is a forbidden key (always blocking) */
  forbiddenKey?: string;
  /** True if the violation is a forbidden visible substring */
  forbiddenSubstring?: string;
  /** Shape validation error from validateAgentEvent, if any */
  shapeError?: string;
}

/**
 * Check whether an event is safe to emit. Returns ok:true if all gates
 * pass; otherwise ok:false with the reason. The caller is responsible
 * for replacing or dropping the event.
 *
 * Options:
 *  - allowMapTerms: when the intent is `map`, the map placeholder
 *    strings are still blocked (we never want them on the wire) but
 *    the `Used tools: none` check is skipped because the map intent
 *    legitimately may not need a tool.
 *  - expectedToolUsage: when true, "Used tools: none" anywhere in
 *    visible fields is rejected.
 */
export function checkAgentEventSafe(
  ev: AgentEvent,
  opts: { allowMapTerms?: boolean; expectedToolUsage?: boolean } = {}
): GuardResult {
  const shapeError = validateAgentEvent(ev);
  if (shapeError) {
    return { ok: false, reason: `shape: ${shapeError}`, shapeError };
  }

  const serialized = JSON.stringify(ev);
  const lower = serialized.toLowerCase();

  // 1) Forbidden key-name scan (case-insensitive on the quoted key form)
  for (const key of FORBIDDEN_KEY_NAMES) {
    const needle = `"${key.toLowerCase()}":`;
    if (lower.includes(needle)) {
      return {
        ok: false,
        reason: `forbidden key: ${key}`,
        forbiddenKey: key,
      };
    }
  }

  // 2) Forbidden visible substrings — collected from publicSummary,
  //    deltaText, finalText, fallbackReason
  const visibleParts = [
    ev.publicSummary || "",
    ev.deltaText || "",
    ev.finalText || "",
    ev.fallbackReason || "",
  ];
  const visible = visibleParts.join("\n");

  for (const lit of FORBIDDEN_VISIBLE_LITERALS) {
    if (visible.includes(lit)) {
      return {
        ok: false,
        reason: `forbidden visible literal: ${lit}`,
        forbiddenSubstring: lit,
      };
    }
  }
  if (PLACEHOLDER_WORD_RE.test(visible) && !opts.allowMapTerms) {
    return {
      ok: false,
      reason: "forbidden visible word: placeholder",
      forbiddenSubstring: "placeholder",
    };
  }
  if (USED_TOOLS_NONE_RE.test(visible) && opts.expectedToolUsage) {
    return {
      ok: false,
      reason: "forbidden visible phrase: Used tools: none (expected tool usage)",
      forbiddenSubstring: "Used tools: none",
    };
  }

  return { ok: true };
}

/**
 * Convenience: scan an arbitrary string (e.g. a draft answer) for the
 * same forbidden visible content. Used by the naturalness guard when
 * the candidate answer is not yet wrapped in an event envelope.
 */
export function checkVisibleTextSafe(
  text: string,
  opts: { allowMapTerms?: boolean; expectedToolUsage?: boolean } = {}
): GuardResult {
  const wrapped: AgentEvent = {
    type: "draft_delta",
    runId: "scan",
    messageId: "scan",
    publicSummary: "scan",
    isSafeForUser: true,
    timestamp: new Date().toISOString(),
    deltaText: text,
  };
  return checkAgentEventSafe(wrapped, opts);
}
