<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from improve)
 member: FX-006 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2243,"completion_tokens":5652,"total_tokens":7895,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4610,"image_tokens":0},"cache_creation_input_tokens":0} | 59s
 generated: 2026-06-13T11:33:19.044Z -->
FILE: innomcp-node/src/agents/eventGuard.ts
<<<<<<< SEARCH
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
=======
export function checkAgentEventSafe(
  ev: AgentEvent,
  opts: { allowMapTerms?: boolean; expectedToolUsage?: boolean } = {}
): GuardResult {
  const shapeError = validateAgentEvent(ev);
  if (shapeError) {
    return { ok: false, reason: `shape: ${shapeError}`, shapeError };
  }

  // Recursive scan for forbidden key names (case-insensitive)
  const forbiddenLower = new Set(FORBIDDEN_KEY_NAMES.map(k => k.toLowerCase()));
  function hasForbiddenKey(obj: unknown): string | undefined {
    if (typeof obj === 'object' && obj !== null) {
      if (Array.isArray(obj)) {
        for (const item of obj) {
          const found = hasForbiddenKey(item);
          if (found) return found;
        }
      } else {
        const record = obj as Record<string, unknown>;
        for (const key of Object.keys(record)) {
          if (forbiddenLower.has(key.toLowerCase())) return key;
          const found = hasForbiddenKey(record[key]);
          if (found) return found;
        }
      }
    }
    return undefined;
  }
  const forbiddenKey = hasForbiddenKey(ev);
  if (forbiddenKey) {
    return {
      ok: false,
      reason: `forbidden key: ${forbiddenKey}`,
      forbiddenKey,
    };
  }

  // Forbidden visible substrings — collected from publicSummary,
  // deltaText, finalText, fallbackReason
  const visibleParts = [
    ev.publicSummary || "",
    ev.deltaText || "",
    ev.finalText || "",
    ev.fallbackReason || "",
  ];
  const visible = visibleParts.join("\n");
  const visibleLower = visible.toLowerCase();

  for (const lit of FORBIDDEN_VISIBLE_LITERALS) {
    if (visibleLower.includes(lit.toLowerCase())) {
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
>>>>>>> REPLACE
