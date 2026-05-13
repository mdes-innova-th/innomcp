/**
 * agents/parallelDispatch.ts — Phase 10.16
 * Mother-orchestrated MDES multi-agent dispatch.
 *
 * Architecture:
 *   Every query (even "สวัสดี") uses ≥ 2 MDES child agents.
 *   Thinker agent → Responder agent → optional specialists.
 *   On repeated MDES failure: escalate to Haiku (2x) → Opus (3x).
 *
 * Guard: PARALLEL_AGENTS=0 → skip (smoke/test mode)
 */
import type { AgentId } from "./events";
import { newEnvelope } from "./events";
import { checkAgentEventSafe } from "./eventGuard";
import type { EmitFn } from "./conductor";

// Legacy export kept for backward compatibility
export const INTENT_AGENTS: Record<string, AgentId[]> = {
  weather:           ["weather-analyst", "geo-planner", "critic"],
  geo:               ["geo-planner", "rag-agent", "critic"],
  knowledge:         ["rag-agent", "concierge", "critic"],
  "planning-broad":  ["weather-analyst", "geo-planner", "rag-agent", "critic", "stylist"],
  calc:              ["tool-scout", "critic"],
  code:              ["tool-scout", "concierge"],
  general:           ["concierge", "critic", "stylist"],
  greeting:          ["concierge", "critic"],
  datetime:          ["concierge", "critic"],
};

// Full agent pools — dynamic count selected by scoreComplexity
const INTENT_AGENTS_POOL: Record<string, AgentId[]> = {
  greeting:         ["concierge", "critic"],
  datetime:         ["concierge", "critic"],
  weather:          ["weather-analyst", "geo-planner", "critic"],
  geo:              ["geo-planner", "weather-analyst", "rag-agent", "critic"],
  knowledge:        ["rag-agent", "concierge", "critic", "stylist"],
  "planning-broad": ["weather-analyst", "geo-planner", "rag-agent", "concierge", "critic", "stylist", "tool-scout"],
  calc:             ["tool-scout", "critic"],
  code:             ["tool-scout", "concierge", "critic", "stylist"],
  general:          ["concierge", "critic", "stylist", "rag-agent"],
};

// MDES Ollama model catalog — assign per role, largest where reasoning matters
const AGENT_MODEL_MDES: Record<string, string> = {
  "weather-analyst": "qwen3.6:27b",        // big reasoning for weather analysis
  "geo-planner":     "qwen3.5:27b",        // big reasoning for geo/planning
  "rag-agent":       "qwen3.5:9b",         // medium — knowledge retrieval
  "concierge":       "qwen3.5:9b",         // fast Thai responder
  "tool-scout":      "z-uo/qwen2.5vl_tools:7b", // tool-specific model
  "critic":          "gemma4:e4b",          // fast verifier
  "stylist":         "gemma4:e4b",          // fast polish
};

// Per-model timeouts — larger models need more time for first token
const MODEL_TIMEOUT_MS: Record<string, number> = {
  "qwen3.6:27b":          20_000,
  "qwen3.5:27b":          20_000,
  "qwen2.5-coder:32b":    25_000,
  "qwen3-vl:32b":         25_000,
  "gemma4:26b":           20_000,
  "deepseek-coder:33b":   25_000,
};
const DEFAULT_TIMEOUT_MS = 12_000;

/**
 * Score query complexity → desired agent count.
 * MINIMUM is 2 — every query gets at least thinker + responder.
 * 2  → greeting/datetime/short
 * 4  → medium (weather, calc, 5-25 tokens)
 * 6  → complex (planning-broad, long queries)
 * 8  → very complex (code + multi-tool)
 */
export function scoreComplexity(intent: string, query: string): number {
  if (intent === "planning-broad") return 6;
  if (intent === "code") return 8;
  // greeting and datetime always get 2 agents (thinker + responder) — never skip
  if (["greeting", "datetime"].includes(intent)) return 2;
  const words = query.trim().split(/\s+/).length;
  const tokenEst = Math.max(words, Math.ceil(query.trim().length / 5));
  if (tokenEst <= 4 && intent === "weather") return 2;
  if (tokenEst <= 25) return 4;
  return 6;
}

const AGENT_PROMPT: Record<string, (q: string) => string> = {
  "weather-analyst": (q) => `วิเคราะห์สภาพอากาศสำหรับ: "${q}"\nตอบเป็นภาษาไทย 2-3 ประโยค`,
  "geo-planner":     (q) => `วางแผนพื้นที่/การเดินทางสำหรับ: "${q}"\nตอบเป็นภาษาไทย 2-3 ประโยค`,
  "rag-agent":       (q) => `ค้นหาความรู้เกี่ยวกับ: "${q}"\nตอบเป็นภาษาไทย 2-3 ประโยค`,
  "concierge":       (q) => `ตอบคำถามต่อไปนี้อย่างฉลาด กระชับ เป็นมืออาชีพ เป็นภาษาไทย: "${q}"`,
  "tool-scout":      (q) => `ระบุ tool ที่เหมาะสำหรับ: "${q}"\nชื่อ tool + เหตุผล 1 ประโยค`,
  "critic":          (q) => `ตรวจสอบและปรับปรุงคำตอบสำหรับ: "${q}"\nให้คำตอบที่ถูกต้อง ครบถ้วน เป็นภาษาไทย`,
  "stylist":         (q) => `เรียบเรียงและขัดเกลาคำตอบสำหรับ: "${q}"\nตอบภาษาไทยที่ราบรื่น อ่านง่าย เป็นมืออาชีพ`,
};

// ── Ollama (MDES) call ──────────────────────────────────────────────────────

async function callOllama(
  model: string,
  prompt: string,
  ollamaUrl: string,
  ollamaKey: string
): Promise<string> {
  const timeout = MODEL_TIMEOUT_MS[model] ?? DEFAULT_TIMEOUT_MS;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(`${ollamaUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ollamaKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
      signal: ac.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return (json.choices?.[0]?.message?.content ?? "").trim();
  } finally {
    clearTimeout(timer);
  }
}

// ── Anthropic (Claude) escalation call ─────────────────────────────────────

async function callAnthropic(
  model: string,
  prompt: string,
  anthropicKey: string
): Promise<string> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: ac.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const json = await res.json() as { content?: Array<{ text?: string }> };
    return (json.content?.[0]?.text ?? "").trim();
  } finally {
    clearTimeout(timer);
  }
}

// ── Core agent runner ────────────────────────────────────────────────────────

async function runAgent(
  agentId: AgentId,
  query: string,
  runId: string,
  messageId: string,
  emit: EmitFn,
  ollamaUrl: string,
  ollamaKey: string,
  modelOverride?: string
): Promise<{ agentId: AgentId; text: string }> {
  const model = modelOverride ?? AGENT_MODEL_MDES[agentId] ?? "qwen3.5:9b";

  const startEv = newEnvelope({
    runId, messageId, type: "agent_started",
    publicSummary: `เริ่มงาน: ${agentId}`, agentId,
  });
  startEv.model = model;
  if (checkAgentEventSafe(startEv, { expectedToolUsage: false }).ok) emit(startEv);
  const safeQ = query.replace(/["\\\n\r]/g, " ").trim().slice(0, 500);
  const promptFn = AGENT_PROMPT[agentId];
  const prompt = promptFn ? promptFn(safeQ) : `ช่วยตอบอย่างฉลาดและกระชับ: "${safeQ}"`;

  try {
    const text = await callOllama(model, prompt, ollamaUrl, ollamaKey);

    const deltaEv = newEnvelope({
      runId, messageId, type: "agent_delta",
      publicSummary: text.substring(0, 150) + (text.length > 150 ? "..." : ""), agentId,
    });
    if (checkAgentEventSafe(deltaEv, { expectedToolUsage: false }).ok) emit(deltaEv);

    const doneEv = newEnvelope({
      runId, messageId, type: "agent_finished",
      publicSummary: `${agentId} เสร็จสิ้น`, agentId,
    });
    if (checkAgentEventSafe(doneEv, { expectedToolUsage: false }).ok) emit(doneEv);

    return { agentId, text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const fbEv = newEnvelope({
      runId, messageId, type: "fallback",
      publicSummary: `${agentId}[MDES]: ${msg.substring(0, 80)}`, agentId,
    });
    if (checkAgentEventSafe(fbEv, { expectedToolUsage: false }).ok) emit(fbEv);
    return { agentId, text: "" };
  }
}

// ── Escalating agent runner ─────────────────────────────────────────────────
// MDES attempt 1 → MDES attempt 2 → Haiku → Opus

async function runAgentWithEscalation(
  agentId: AgentId,
  query: string,
  runId: string,
  messageId: string,
  emit: EmitFn,
  ollamaUrl: string,
  ollamaKey: string
): Promise<{ agentId: AgentId; text: string }> {
  // Attempt 1 — MDES
  const r1 = await runAgent(agentId, query, runId, messageId, emit, ollamaUrl, ollamaKey);
  if (r1.text) return r1;

  // Attempt 2 — MDES retry with smaller fallback model
  const fallbackMdesModel = "gemma4:e4b"; // fast fallback within MDES
  const r2 = await runAgent(agentId, query, runId, messageId, emit, ollamaUrl, ollamaKey, fallbackMdesModel);
  if (r2.text) return r2;

  // Attempt 3 — Claude Haiku escalation
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
  if (anthropicKey.trim()) {
    try {
      const safeQ = query.replace(/["\\\n\r]/g, " ").trim().slice(0, 500);
      const promptFn = AGENT_PROMPT[agentId];
      const prompt = promptFn ? promptFn(safeQ) : `ช่วยตอบ: "${safeQ}"`;

      const haikuEv = newEnvelope({
        runId, messageId, type: "agent_started",
        publicSummary: `${agentId} → ยกระดับ Haiku`, agentId,
      });
      haikuEv.model = "claude-haiku-4-5-20251001";
      if (checkAgentEventSafe(haikuEv, { expectedToolUsage: false }).ok) emit(haikuEv);

      const haikuText = await callAnthropic("claude-haiku-4-5-20251001", prompt, anthropicKey);
      if (haikuText) {
        const haikuDone = newEnvelope({
          runId, messageId, type: "agent_finished",
          publicSummary: `${agentId} Haiku เสร็จสิ้น`, agentId,
        });
        if (checkAgentEventSafe(haikuDone, { expectedToolUsage: false }).ok) emit(haikuDone);
        return { agentId, text: haikuText };
      }

      // Attempt 4 — Claude Opus (heavy artillery)
      const opusEv = newEnvelope({
        runId, messageId, type: "agent_started",
        publicSummary: `${agentId} → ยกระดับ Opus`, agentId,
      });
      opusEv.model = "claude-opus-4-7";
      if (checkAgentEventSafe(opusEv, { expectedToolUsage: false }).ok) emit(opusEv);

      const opusText = await callAnthropic("claude-opus-4-7", prompt, anthropicKey);
      if (opusText) {
        const opusDone = newEnvelope({
          runId, messageId, type: "agent_finished",
          publicSummary: `${agentId} Opus เสร็จสิ้น`, agentId,
        });
        if (checkAgentEventSafe(opusDone, { expectedToolUsage: false }).ok) emit(opusDone);
        return { agentId, text: opusText };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[parallelDispatch] Claude escalation failed for ${agentId}: ${msg}`);
    }
  }

  return { agentId, text: "" };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function dispatchAgents(
  intent: string,
  query: string,
  runId: string,
  messageId: string,
  emit: EmitFn
): Promise<Record<string, string>> {
  if (process.env.PARALLEL_AGENTS === "0") return {};
  const ollamaUrl = process.env.OLLAMA_URL ?? "https://ollama.mdes-innova.online";
  const ollamaKey = process.env.OLLAMA_API_KEY ?? "";
  if (!ollamaKey.trim()) return {};

  const count = Math.max(2, scoreComplexity(intent, query)); // ALWAYS minimum 2 agents

  const pool = INTENT_AGENTS_POOL[intent] ?? INTENT_AGENTS_POOL["general"];
  const agents = pool.slice(0, Math.min(count, pool.length));

  const settled = await Promise.allSettled(
    agents.map((agentId) =>
      runAgentWithEscalation(agentId, query, runId, messageId, emit, ollamaUrl, ollamaKey)
    )
  );

  const outputs: Record<string, string> = {};
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value.text) {
      outputs[r.value.agentId] = r.value.text;
    }
  }
  return outputs;
}

export function synthesizeAnswer(
  agentOutputs: Record<string, string>,
  fallbackText: string
): string {
  // Priority: stylist > concierge > critic > first valid > fallback
  if (agentOutputs["stylist"] && agentOutputs["stylist"].length > 20) return agentOutputs["stylist"];
  if (agentOutputs["concierge"] && agentOutputs["concierge"].length > 20) return agentOutputs["concierge"];
  if (agentOutputs["critic"] && agentOutputs["critic"].length > 20) return agentOutputs["critic"];
  const first = Object.values(agentOutputs).find((t) => t.length > 20);
  return first ?? fallbackText;
}
