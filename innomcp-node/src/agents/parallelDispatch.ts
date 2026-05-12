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

export const INTENT_AGENTS: Record<string, AgentId[]> = {
  weather:           ["weather-analyst", "geo-planner", "critic"],
  geo:               ["geo-planner", "rag-agent", "critic"],
  knowledge:         ["rag-agent", "concierge", "critic"],
  "planning-broad":  ["weather-analyst", "geo-planner", "rag-agent", "critic", "stylist"],
  calc:              ["tool-scout", "critic"],
  code:              ["tool-scout", "concierge"],
  general:           ["concierge", "critic", "stylist"],
};

const AGENT_MODEL: Record<string, string> = {
  "weather-analyst": "gemma4:e4b",
  "geo-planner":     "qwen2.5-coder:7b",
  "rag-agent":       "gemma4:e4b",
  "concierge":       "gemma4:e4b",
  "tool-scout":      "qwen2.5-coder:7b",
  "critic":          "qwen3.5:9b",
  "stylist":         "gemma4:e4b",
};

const AGENT_TIMEOUT_MS = 8_000;

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

  const model = AGENT_MODEL[agentId] ?? "gemma4:e4b";
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
      publicSummary: text.substring(0, 120) + (text.length > 120 ? "..." : ""), agentId,
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

  const agents = INTENT_AGENTS[intent] ?? INTENT_AGENTS["general"];
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
