/**
 * agents/parallelDispatch.ts — Phase 10.15
 * Real parallel MDES Ollama dispatch.
 * Guard: PARALLEL_AGENTS=0 → skip (smoke/test mode)
 * Guard: no OLLAMA_API_KEY → skip silently
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
};

// Full agent pools — dynamic count selected by scoreComplexity
const INTENT_AGENTS_POOL: Record<string, AgentId[]> = {
  weather:          ["weather-analyst", "geo-planner", "critic"],
  geo:              ["geo-planner", "weather-analyst", "rag-agent", "critic"],
  knowledge:        ["rag-agent", "concierge", "critic", "stylist"],
  "planning-broad": ["weather-analyst", "geo-planner", "rag-agent", "concierge", "critic", "stylist", "tool-scout"],
  calc:             ["tool-scout", "critic"],
  code:             ["tool-scout", "concierge", "critic", "stylist"],
  general:          ["concierge", "critic", "stylist", "rag-agent"],
};

const AGENT_MODEL_CLOUD: Record<string, string> = {
  "weather-analyst": "gemma4:e4b",
  "geo-planner":     "gemma4:e4b",
  "rag-agent":       "gemma4:e4b",
  "concierge":       "gemma4:e4b",
  "tool-scout":      "gemma4:e4b",
  "critic":          "gemma4:e4b",
  "stylist":         "gemma4:e4b",
};

const AGENT_MODEL_LOCAL: Record<string, string> = {
  "weather-analyst": "qwen2.5-coder:7b",
  "geo-planner":     "qwen2.5-coder:7b",
  "rag-agent":       "qwen2.5-coder:7b",
  "concierge":       "qwen2.5-coder:7b",
  "tool-scout":      "qwen2.5-coder:7b",
  "critic":          "qwen2.5-coder:7b",
  "stylist":         "qwen2.5-coder:7b",
};

const AGENT_TIMEOUT_MS = 8_000;

/**
 * Score query complexity and return desired agent count (0 = skip MDES entirely).
 * 0  → simple/greeting/datetime (≤5 words) — skip
 * 2  → low (single-topic weather, 6-15 words)
 * 4  → medium (multi-topic, 16-40 words)
 * 6  → high (planning-broad, 41+ words)
 * 8  → very complex (code + multi-tool, 80+ words)
 */
export function scoreComplexity(intent: string, query: string): number {
  if (["greeting", "datetime"].includes(intent)) return 0;
  const words = query.trim().split(/\s+/).length;
  // Thai text has no word separators — use char-count estimate as fallback
  const tokenEst = Math.max(words, Math.ceil(query.trim().length / 5));
  if (tokenEst < 2) return 0;                           // extremely short
  if (intent === "planning-broad") return 6;             // always multi-agent
  if (intent === "code") return 8;                       // always high
  if (tokenEst <= 4 && intent === "weather") return 2;  // short weather
  if (tokenEst <= 25) return 4;                         // medium
  return 6;                                              // long / complex
}

const AGENT_PROMPT: Record<string, (q: string) => string> = {
  "weather-analyst": (q) => `วิเคราะห์สภาพอากาศสำหรับ: "${q}"\nตอบเป็นภาษาไทย 2-3 ประโยค`,
  "geo-planner":     (q) => `วางแผนพื้นที่/การเดินทางสำหรับ: "${q}"\nตอบเป็นภาษาไทย 2-3 ประโยค`,
  "rag-agent":       (q) => `ค้นหาความรู้เกี่ยวกับ: "${q}"\nตอบเป็นภาษาไทย 2-3 ประโยค`,
  "concierge":       (q) => `เรียบเรียงคำตอบสำหรับ: "${q}"\nตอบเป็นภาษาไทยที่ราบรื่น`,
  "tool-scout":      (q) => `ระบุ tool ที่เหมาะสำหรับ: "${q}"\nชื่อ tool + เหตุผล 1 ประโยค`,
  "critic":          (q) => `ตรวจสอบความถูกต้องสำหรับ: "${q}"\nจุดดี + จุดระวัง`,
  "stylist":         (q) => `ขัดเกลาภาษาไทยสำหรับ: "${q}"\nตอบที่ราบรื่น อ่านง่าย`,
};

async function runAgent(
  agentId: AgentId,
  query: string,
  runId: string,
  messageId: string,
  emit: EmitFn,
  ollamaUrl: string,
  ollamaKey: string
): Promise<{ agentId: AgentId; text: string }> {
  const startEv = newEnvelope({
    runId, messageId, type: "agent_started",
    publicSummary: `เริ่มงาน: ${agentId}`, agentId,
  });
  if (checkAgentEventSafe(startEv, { expectedToolUsage: false }).ok) emit(startEv);

  const isLocal = ollamaUrl.includes("localhost");
  const modelMap = isLocal ? AGENT_MODEL_LOCAL : AGENT_MODEL_CLOUD;
  const model = modelMap[agentId] ?? (isLocal ? "qwen2.5-coder:7b" : "gemma4:e4b");
  // Sanitize: strip newlines, quotes, and cap length to prevent prompt injection
  const safeQ = query.replace(/["\\\n\r]/g, " ").trim().slice(0, 500);
  const promptFn = AGENT_PROMPT[agentId];
  const prompt = promptFn ? promptFn(safeQ) : `ช่วยตอบ: "${safeQ}"`;
  const endpoint = `${ollamaUrl.replace(/\/$/, "")}/v1/chat/completions`;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), AGENT_TIMEOUT_MS);

  try {
    const res = await fetch(endpoint, {
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
    const text = (json.choices?.[0]?.message?.content ?? "").trim();

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
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    const fbEv = newEnvelope({
      runId, messageId, type: "fallback",
      publicSummary: `${agentId}: ${msg.substring(0, 80)}`, agentId,
    });
    if (checkAgentEventSafe(fbEv, { expectedToolUsage: false }).ok) emit(fbEv);
    return { agentId, text: "" };
  }
}

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

  const count = scoreComplexity(intent, query);
  if (count === 0) return {}; // skip for simple queries (greeting, datetime, ≤5 words)

  const pool = INTENT_AGENTS_POOL[intent] ?? INTENT_AGENTS_POOL["general"];
  const agents = pool.slice(0, Math.min(count, pool.length));

  const settled = await Promise.allSettled(
    agents.map((agentId) =>
      runAgent(agentId, query, runId, messageId, emit, ollamaUrl, ollamaKey)
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
  if (agentOutputs["stylist"] && agentOutputs["stylist"].length > 20) return agentOutputs["stylist"];
  if (agentOutputs["concierge"] && agentOutputs["concierge"].length > 20) return agentOutputs["concierge"];
  const first = Object.values(agentOutputs).find((t) => t.length > 20);
  return first ?? fallbackText;
}
