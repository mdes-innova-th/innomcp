/**
 * responseComposer.ts — Phase 6C foundation
 * Shared service that turns compact tool/API facts into a coherent Thai
 * answer for the user. Deterministic-first, gated, optional.
 *
 * Hard rules:
 *  - Do NOT run on every route — caller decides eligibility.
 *  - Do NOT chain LLM calls. The optional LLM hook stays as a stub here.
 *  - Output must remain in Thai by default.
 *  - Caller is responsible for not re-running this on already-polished text.
 */

export interface ToolFact {
  /** Origin tool / API name (e.g. "tmd_seismic", "weather", "evidence") */
  source: string;
  /** Short Thai-ready summary of the fact. Composer concatenates these. */
  summary: string;
  /** Optional confidence — facts < 0.3 are de-emphasized */
  confidence?: number;
  /** Free-form metadata (units, times, ids) — not currently rendered */
  metadata?: Record<string, unknown>;
}

export interface ResponseComposerInput {
  /** Logical route name for tracing — e.g. "weather", "evidence" */
  route: string;
  /** Raw user query — preserved for context, not rendered verbatim */
  userQuery: string;
  /** Facts gathered from tools/APIs */
  facts: ToolFact[];
  /** Optional Thai header to lead the answer with */
  header?: string;
  /** Optional Thai footer (e.g. source attribution line) */
  footer?: string;
}

export interface ResponseComposerOutput {
  text: string;
  mode: "deterministic" | "llm-fallback" | "passthrough";
  reasons: string[];
  latencyMs: number;
  factCount: number;
}

const FACT_BULLET = "•";

function trimFact(s: string): string {
  return String(s || "").replace(/\s+/g, " ").trim();
}

/**
 * Deterministic composer.
 *
 * Strategy:
 *  - Keep header (if any) on its own line.
 *  - Render each fact as a Thai bullet, prefixed with its source label.
 *  - Drop facts with confidence below 0.3 unless they are the only ones.
 *  - Append footer if any.
 *
 * The composer never invents facts. If the input is empty, it returns
 * a polite Thai "no data" line with mode = "passthrough".
 */
export function composeThaiAnswer(input: ResponseComposerInput): ResponseComposerOutput {
  const t0 = Date.now();
  const reasons: string[] = [];
  const facts = Array.isArray(input.facts) ? input.facts : [];
  const usable = facts
    .map((f) => ({ ...f, summary: trimFact(f.summary) }))
    .filter((f) => f.summary.length > 0);

  if (usable.length === 0) {
    reasons.push("no-facts");
    return {
      text: "ขออภัย ไม่พบข้อมูลที่เกี่ยวข้องในขณะนี้",
      mode: "passthrough",
      reasons,
      latencyMs: Date.now() - t0,
      factCount: 0,
    };
  }

  // Confidence filter — keep all if every fact is below threshold.
  const highConf = usable.filter((f) => Number(f.confidence ?? 1) >= 0.3);
  const rendered = highConf.length > 0 ? highConf : usable;
  if (rendered.length < usable.length) {
    reasons.push(`dropped-low-conf:${usable.length - rendered.length}`);
  }

  const lines: string[] = [];
  if (input.header && input.header.trim()) {
    lines.push(input.header.trim());
    lines.push("");
  }

  for (const f of rendered) {
    const conf =
      typeof f.confidence === "number" && f.confidence < 0.6
        ? ` _(ความมั่นใจ ${(f.confidence * 100).toFixed(0)}%)_`
        : "";
    const sourceLabel = f.source ? `**${f.source}**: ` : "";
    lines.push(`${FACT_BULLET} ${sourceLabel}${f.summary}${conf}`);
  }

  if (input.footer && input.footer.trim()) {
    lines.push("");
    lines.push(input.footer.trim());
  }

  reasons.push(`composed:${rendered.length}`);
  reasons.push(`route:${input.route || "unknown"}`);

  return {
    text: lines.join("\n").trim(),
    mode: "deterministic",
    reasons,
    latencyMs: Date.now() - t0,
    factCount: rendered.length,
  };
}

/**
 * Placeholder for future LLM-backed composer. Currently unused — kept as a
 * named export so call sites can opt-in later without a structural rewrite.
 *
 * When implemented, this should:
 *   - run only when caller explicitly requests it
 *   - call the LLM at most once
 *   - return strict JSON with a single Thai answer string
 *   - be protected by a short timeout (<= 1500ms)
 */
export async function composeThaiAnswerWithLLM(
  input: ResponseComposerInput
): Promise<ResponseComposerOutput> {
  // Intentionally falls back to deterministic until wired up. This keeps
  // existing callers safe even if they flip the flag prematurely.
  return composeThaiAnswer(input);
}
