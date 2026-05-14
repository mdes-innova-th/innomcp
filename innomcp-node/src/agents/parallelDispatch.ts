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
  "weather-analyst": (q) => `คุณเป็นผู้เชี่ยวชาญด้านสภาพอากาศ วิเคราะห์และตอบ: "${q}"\n[ตอบตรงๆ เป็นภาษาไทย 2-3 ประโยค ไม่ต้องขึ้นต้นด้วย "ผม" หรือ "ขออนุญาต"]`,
  "geo-planner":     (q) => `คุณเป็นผู้เชี่ยวชาญด้านภูมิศาสตร์และการเดินทาง วิเคราะห์และตอบ: "${q}"\n[ตอบตรงๆ เป็นภาษาไทย 2-3 ประโยค]`,
  "rag-agent":       (q) => `ค้นหาและสรุปความรู้เกี่ยวกับ: "${q}"\n[ตอบเป็นภาษาไทย กระชับ ตรงประเด็น]`,
  "concierge":       (q) => `ตอบคำถามต่อไปนี้อย่างฉลาดและตรงประเด็น ห้ามใช้คำสุภาพนำ เช่น "ขออนุญาต" หรือ "ผมจะ":\n"${q}"\n[ตอบเป็นภาษาไทย กระชับ เป็นมืออาชีพ ไม่เกิน 3 ประโยค]`,
  "tool-scout":      (q) => `ระบุ tool และวิธีการที่เหมาะสมที่สุดสำหรับ: "${q}"\n[ชื่อ tool + เหตุผล 1-2 ประโยคภาษาไทย]`,
  "critic":          (q) => `[THINK] วิเคราะห์คำถาม: "${q}"\n→ ระบุประเด็นหลัก\n→ คิดคำตอบที่ดีที่สุด\n[ANSWER] ตอบเป็นภาษาไทยที่ถูกต้อง ครบถ้วน กระชับ ไม่เกิน 3 ประโยค`,
  "stylist":         (q) => `เรียบเรียงคำตอบสำหรับ: "${q}"\n[ตอบภาษาไทยที่เป็นธรรมชาติ อ่านง่าย มืออาชีพ ไม่ฟุ้มเฟ้อ]`,
};

// ── Ollama (MDES) call ──────────────────────────────────────────────────────
// Two modes: non-streaming (default) and streaming with chunk callback.
// Streaming gives token-by-token UX in the chat bubble preview.

async function callOllama(
  model: string,
  prompt: string,
  ollamaUrl: string,
  ollamaKey: string,
  onChunk?: (accumulatedText: string) => void
): Promise<string> {
  const timeout = MODEL_TIMEOUT_MS[model] ?? DEFAULT_TIMEOUT_MS;
  const useStream = onChunk !== undefined && process.env.OLLAMA_STREAM !== "0";
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
        stream: useStream,
      }),
      signal: ac.signal,
    });
    if (!res.ok) {
      clearTimeout(timer);
      throw new Error(`HTTP ${res.status}`);
    }
    if (!useStream) {
      clearTimeout(timer);
      const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      return (json.choices?.[0]?.message?.content ?? "").trim();
    }
    // Streaming path — parse SSE chunks from Ollama OpenAI-compat endpoint
    const reader = res.body?.getReader();
    if (!reader) {
      clearTimeout(timer);
      throw new Error("no response body");
    }
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";
    let lastEmitLen = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
          const piece = parsed.choices?.[0]?.delta?.content ?? "";
          if (piece) {
            accumulated += piece;
            // Throttle: emit every 30 chars to avoid event flood
            if (accumulated.length - lastEmitLen >= 30) {
              onChunk?.(accumulated);
              lastEmitLen = accumulated.length;
            }
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }
    clearTimeout(timer);
    return accumulated.trim();
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
  modelOverride?: string,
  partialSink?: (agentId: AgentId, partialText: string) => void
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
    // Streaming callback: emit progressive agent_delta as tokens arrive
    // AND surface partial text to liveOutputs so polling sees content
    // even when the model doesn't finish before race-timeout.
    const onChunk = (accumulated: string) => {
      const preview = accumulated.substring(0, 220) + (accumulated.length > 220 ? "..." : "");
      const chunkEv = newEnvelope({
        runId, messageId, type: "agent_delta",
        publicSummary: preview, agentId,
      });
      chunkEv.model = model;
      if (checkAgentEventSafe(chunkEv, { expectedToolUsage: false }).ok) emit(chunkEv);
      if (partialSink) partialSink(agentId, accumulated);
    };
    const text = await callOllama(model, prompt, ollamaUrl, ollamaKey, onChunk);

    // Final agent_delta with the complete text (replaces last progressive chunk)
    const deltaEv = newEnvelope({
      runId, messageId, type: "agent_delta",
      publicSummary: text.substring(0, 220) + (text.length > 220 ? "..." : ""), agentId,
    });
    deltaEv.model = model;
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
    fbEv.fallbackReason = msg.slice(0, 200);
    fbEv.model = model;
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
  ollamaKey: string,
  partialSink?: (agentId: AgentId, partialText: string) => void
): Promise<{ agentId: AgentId; text: string }> {
  // Attempt 1 — MDES
  const r1 = await runAgent(agentId, query, runId, messageId, emit, ollamaUrl, ollamaKey, undefined, partialSink);
  if (r1.text) return r1;

  // Attempt 2 — MDES retry with smaller fallback model
  const fallbackMdesModel = "gemma4:e4b"; // fast fallback within MDES
  const r2 = await runAgent(agentId, query, runId, messageId, emit, ollamaUrl, ollamaKey, fallbackMdesModel, partialSink);
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
  emit: EmitFn,
  liveOutputs?: Record<string, string>
): Promise<Record<string, string>> {
  if (process.env.PARALLEL_AGENTS === "0") return {};
  const ollamaUrl = process.env.OLLAMA_URL ?? "https://ollama.mdes-innova.online";
  const ollamaKey = process.env.OLLAMA_API_KEY ?? "";
  if (!ollamaKey.trim()) return {};

  const count = Math.max(2, scoreComplexity(intent, query)); // ALWAYS minimum 2 agents

  const pool = INTENT_AGENTS_POOL[intent] ?? INTENT_AGENTS_POOL["general"];
  const agents = pool.slice(0, Math.min(count, pool.length));

  const outputs: Record<string, string> = liveOutputs ?? {};

  // Fire all agents in parallel; capture each result the moment it settles
  // AND stream partial accumulated tokens into outputs so the conductor's
  // poll loop sees content immediately, not only after the agent finishes.
  const partialSink = (id: AgentId, partialText: string) => {
    if (partialText && partialText.length > 20) {
      outputs[id] = partialText;
    }
  };
  const tasks = agents.map((agentId) =>
    runAgentWithEscalation(agentId, query, runId, messageId, emit, ollamaUrl, ollamaKey, partialSink)
      .then((r) => {
        if (r.text) outputs[r.agentId] = r.text;
        return r;
      })
      .catch(() => null)
  );

  await Promise.allSettled(tasks);
  return outputs;
}

export function synthesizeAnswer(
  agentOutputs: Record<string, string>,
  fallbackText: string
): string {
  // Priority: tool data > stylist > concierge > critic > first valid > fallback
  // Tool data is authoritative (real-world numbers) — beats MDES commentary.
  if (agentOutputs["__tool__"] && agentOutputs["__tool__"].length > 20) return agentOutputs["__tool__"];
  if (agentOutputs["stylist"] && agentOutputs["stylist"].length > 20) return agentOutputs["stylist"];
  if (agentOutputs["concierge"] && agentOutputs["concierge"].length > 20) return agentOutputs["concierge"];
  if (agentOutputs["critic"] && agentOutputs["critic"].length > 20) return agentOutputs["critic"];
  const first = Object.values(agentOutputs).find((t) => t.length > 20);
  return first ?? fallbackText;
}
