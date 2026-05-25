/**
 * agents/parallelDispatch.ts — Phase 10.16
 * Mother-orchestrated MDES multi-agent dispatch.
 *
 * Architecture:
 *   Every query (even "สวัสดี") uses ≥ 2 MDES child agents.
 *   Thinker agent → Responder agent → optional specialists.
 *   On repeated MDES failure: escalate to GPT fallbacks only after 2 MDES attempts.
 *
 * Guard: PARALLEL_AGENTS=0 → skip (smoke/test mode)
 */
import type { AgentId } from "./events";
import { newEnvelope } from "./events";
import { checkAgentEventSafe } from "./eventGuard";
import type { EmitFn } from "./conductor";
import type { ChatMode } from "../providers/router";

export type AgentRunMode = "normal" | "thinking";

type AgentEndpointKind = "local" | "remote";

interface AgentEndpoint {
  kind: AgentEndpointKind;
  url: string;
  key: string;
  model: string;
  timeoutMs: number;
}

export interface AgentPlanItem extends AgentEndpoint {
  agentId: AgentId;
}

export interface AgentDispatchOptions {
  runMode?: AgentRunMode;
  preferredMode?: ChatMode;
  history?: Array<{ sender: string; text: string }>;
}

export interface AgentPlanOptions extends AgentDispatchOptions {
  remoteAvailable?: boolean;
}

// Legacy export kept for backward compatibility
export const INTENT_AGENTS: Record<string, AgentId[]> = {
  weather:           ["weather-analyst", "geo-planner", "critic"],
  geo:               ["geo-planner", "rag-agent", "critic"],
  knowledge:         ["rag-agent", "concierge", "critic"],
  evidence:          ["tool-scout", "critic", "concierge"],
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
  calc:             ["tool-scout", "critic"],
  evidence:         ["tool-scout", "critic", "concierge", "stylist"],
  geo:              ["thinker", "geo-planner", "weather-analyst", "rag-agent", "researcher", "critic", "domain-expert", "linguist"],
  knowledge:        ["thinker", "rag-agent", "researcher", "concierge", "critic", "stylist", "fact-checker", "domain-expert", "linguist"],
  "planning-broad": ["thinker", "weather-analyst", "geo-planner", "rag-agent", "researcher", "concierge", "critic", "stylist", "domain-expert", "fact-checker", "linguist"],
  code:             ["thinker", "tool-scout", "researcher", "concierge", "critic", "stylist", "fact-checker", "domain-expert", "linguist", "rag-agent"],
  factual:          ["thinker", "rag-agent", "researcher", "concierge", "critic", "fact-checker", "domain-expert", "linguist"],
  general:          ["thinker", "concierge", "critic", "stylist", "rag-agent", "researcher", "linguist", "domain-expert", "fact-checker"],
};

// Thai-specialized model — set THAI_LLM_MODEL=openthaigpt:7b (or similar) to override
// rag-agent and linguist for Thai-heavy workloads. null = use default catalog.
const thaiModel = process.env.THAI_LLM_MODEL || null;

// MDES Ollama model catalog — assign per role, largest where reasoning matters
const AGENT_MODEL_MDES: Record<string, string> = {
  "weather-analyst": "qwen3.6:27b",        // big reasoning for weather analysis
  "geo-planner":     "qwen3.5:27b",        // big reasoning for geo/planning
  "rag-agent":       thaiModel ?? "qwen3.5:9b",  // Thai model preferred for RAG
  "concierge":       "qwen3.5:9b",         // fast Thai responder
  "tool-scout":      "z-uo/qwen2.5vl_tools:7b", // tool-specific model
  "critic":          "gemma4:e4b",          // fast verifier
  "stylist":         "gemma4:e4b",          // fast polish
  "thinker":         "gemma3:12b",          // deep analytical thinker
  "researcher":      "gemma3:12b",          // fact/evidence researcher
  "fact-checker":    "gemma3:12b",          // accuracy verifier
  "linguist":        thaiModel ?? "gemma3:12b",  // Thai model preferred for NL polish
  "domain-expert":   "gemma3:12b",          // domain-specific insight
};

// Per-model timeouts — larger models need more time for first token
const MODEL_TIMEOUT_MS: Record<string, number> = {
  "qwen3.6:27b":              35_000,
  "qwen3.5:27b":              30_000,
  "qwen3.5:9b":               20_000,
  "gemma4:e4b":               15_000,
  "z-uo/qwen2.5vl_tools:7b":  18_000,
  "qwen2.5-coder:32b":        25_000,
  "qwen3-vl:32b":             25_000,
  "gemma4:26b":               20_000,
  "deepseek-coder:33b":       25_000,
};
const DEFAULT_TIMEOUT_MS = 12_000;

function normalizeRunMode(mode: AgentRunMode | undefined): AgentRunMode {
  return mode === "thinking" ? "thinking" : "normal";
}

function hasRemoteEndpoint(): boolean {
  return Boolean(
    process.env.REMOTE_OLLAMA_BASE_URL ||
    process.env.OLLAMA_REMOTE_BASE_URL ||
    process.env.OLLAMA_REMOTE_URL ||
    process.env.OLLAMA_URL ||
    process.env.REMOTE_OLLAMA_TOKEN ||
    process.env.OLLAMA_API_KEY ||
    process.env.OLLAMA_REMOTE_API_KEY
  );
}

function resolveEndpoint(kind: AgentEndpointKind, agentId: AgentId, runMode: AgentRunMode): AgentEndpoint {
  const timeoutFactor = runMode === "thinking" ? 2 : 1;
  if (kind === "local") {
    const model =
      process.env.LOCAL_OLLAMA_MODEL ||
      process.env.OLLAMA_LOCAL_DEFAULT_MODEL ||
      process.env.OLLAMA_MODEL ||
      AGENT_MODEL_MDES[agentId] ||
      "qwen2.5:14b";
    return {
      kind,
      url:
        process.env.LOCAL_OLLAMA_BASE_URL ||
        process.env.OLLAMA_LOCAL_BASE_URL ||
        process.env.OLLAMA_BASE_URL ||
        process.env.OLLAMA_HOST ||
        "http://localhost:11434",
      key: process.env.LOCAL_OLLAMA_TOKEN || process.env.OLLAMA_LOCAL_API_KEY || "",
      model,
      timeoutMs: (MODEL_TIMEOUT_MS[model] ?? DEFAULT_TIMEOUT_MS) * timeoutFactor,
    };
  }

  const model =
    process.env.REMOTE_OLLAMA_MODEL ||
    process.env.OLLAMA_REMOTE_DEFAULT_MODEL ||
    process.env.MDES_PRIMARY_MODEL ||
    AGENT_MODEL_MDES[agentId] ||
    "qwen3.5:9b";
  return {
    kind,
    url:
      process.env.REMOTE_OLLAMA_BASE_URL ||
      process.env.OLLAMA_REMOTE_BASE_URL ||
      process.env.OLLAMA_REMOTE_URL ||
      process.env.OLLAMA_URL ||
      "https://ollama.mdes-innova.online",
    key:
      process.env.REMOTE_OLLAMA_TOKEN ||
      process.env.OLLAMA_REMOTE_API_KEY ||
      process.env.OLLAMA_API_KEY ||
      "",
    model,
    timeoutMs: (MODEL_TIMEOUT_MS[model] ?? DEFAULT_TIMEOUT_MS) * timeoutFactor,
  };
}

/**
 * Score query complexity → desired agent count.
 *
 * Phase 10.64 — parsimony rewrite. The earlier matrix sprayed 4 agents at
 * any sub-25-token query, which produced 4 cards on the panel for trivial
 * NASA/Artemis-class questions and made simple Q&A feel slow + chaotic.
 *
 * New floor: 2 (thinker + responder). Only escalate when the intent or
 * length genuinely warrants more reasoners.
 *
 * 2 → greeting / datetime / weather / general / knowledge / geo / calc
 *     when query is ≤ 25 tokens (the vast majority of chat traffic)
 * 3 → same intents above with 25-50 tokens (medium-depth ask)
 * 4 → general / knowledge with > 50 tokens (essays, multi-part Qs)
 * 6 → planning-broad (always — these require multiple specialist lenses)
 * 8 → code (multi-tool reasoning + style + critic)
 */
export function scoreComplexity(intent: string, query: string): number {
  if (intent === "planning-broad") return 10;
  if (intent === "code") return 10;
  if (["greeting", "datetime"].includes(intent)) return 2;
  const words = query.trim().split(/\s+/).length;
  const tokenEst = Math.max(words, Math.ceil(query.trim().length / 5));
  if (tokenEst <= 25) return 2;
  if (tokenEst <= 50) return 4;
  if (tokenEst <= 100) return 6;
  return 8;
}

export function selectAgentPlan(
  intent: string,
  query: string,
  opts: AgentPlanOptions = {}
): AgentPlanItem[] {
  const runMode = normalizeRunMode(opts.runMode);
  const preferredMode = opts.preferredMode ?? "hybrid";
  const remoteAvailable = opts.remoteAvailable ?? hasRemoteEndpoint();
  const pool = INTENT_AGENTS_POOL[intent] ?? INTENT_AGENTS_POOL["general"];

  if (runMode === "normal") {
    // Normal mode keeps a professional two-reader path: local + remote in
    // hybrid mode when MDES is reachable. Thinking mode expands beyond this.
    let agents: AgentId[];
    if (pool.length >= 2) {
      // In normal mode, slot-1 should be a domain responder, not a meta-agent.
      // Skip thinker/researcher/fact-checker/linguist/domain-expert as the primary slot.
      const NORMAL_SKIP = new Set(["thinker", "researcher", "fact-checker", "linguist", "domain-expert"]);
      let head = pool.find(a => !NORMAL_SKIP.has(a)) ?? pool[0];
      // C.09: ถ้า pool มี critic, ให้ critic เป็นตัวที่ 2 (เพื่อให้ synthesizeAnswer
      // มี polished output เสมอ). ถ้าไม่มี critic, ใช้ slice(0,2) เดิม
      if (head !== "critic" && pool.includes("critic")) {
        agents = [head, "critic"];
      } else {
        agents = pool.slice(0, 2) as AgentId[];
      }
    } else {
      agents = ["concierge", "critic"];
    }
    const endpointKinds: AgentEndpointKind[] =
      preferredMode === "local"
        ? ["local", "local"]
        : preferredMode === "remote"
          ? ["remote", "remote"]
          : ["local", remoteAvailable ? "remote" : "local"];

    return agents.map((agentId, idx) => ({
      agentId,
      ...resolveEndpoint(endpointKinds[idx] ?? "local", agentId, runMode),
    }));
  }

  const count = Math.max(2, scoreComplexity(intent, query));
  const agents = pool.slice(0, Math.min(count, pool.length));
  return agents.map((agentId, idx) => {
    const endpointKind: AgentEndpointKind =
      preferredMode === "local"
        ? "local"
        : preferredMode === "remote"
          ? "remote"
          : remoteAvailable && (idx === 0 || ["critic", "rag-agent", "weather-analyst", "geo-planner"].includes(agentId))
            ? "remote"
            : "local";
    return {
      agentId,
      ...resolveEndpoint(endpointKind, agentId, runMode),
    };
  });
}

function compressHistory(history: Array<{ sender: string; text: string }>, keepLast = 4): string {
  if (!history || history.length === 0) return "";
  const relevant = history.filter(m => m.text && m.text.trim().length > 5);
  if (relevant.length === 0) return "";
  if (relevant.length <= keepLast) {
    return relevant.map(m =>
      `${m.sender === "user" ? "ผู้ใช้" : "AI"}: ${m.text.slice(0, 250)}`
    ).join("\n");
  }
  // Older messages: extract key phrases only (first 80 chars each)
  const older = relevant.slice(0, relevant.length - keepLast);
  const recent = relevant.slice(-keepLast);
  const olderSummary = older
    .filter(m => m.sender === "user")  // only user messages for summary
    .map(m => m.text.slice(0, 80).replace(/\n/g, " "))
    .join(", ");
  const recentFmt = recent.map(m =>
    `${m.sender === "user" ? "ผู้ใช้" : "AI"}: ${m.text.slice(0, 250)}`
  ).join("\n");
  return `[บริบทก่อนหน้า: ${olderSummary}]\n\nการสนทนาล่าสุด:\n${recentFmt}`;
}

const AGENT_PROMPT: Record<string, (q: string, ctx?: string) => string> = {
  "weather-analyst": (q, ctx) => `${ctx ? `บริบทการสนทนา:\n${ctx}\n\n` : ""}คุณเป็นผู้เชี่ยวชาญด้านสภาพอากาศ วิเคราะห์และตอบ: "${q}"\n[ตอบตรงๆ เป็นภาษาไทย 2-3 ประโยค ไม่ต้องขึ้นต้นด้วย "ผม" หรือ "ขออนุญาต"]`,
  "geo-planner":     (q, ctx) => `${ctx ? `บริบทการสนทนา:\n${ctx}\n\n` : ""}คุณเป็นผู้เชี่ยวชาญด้านภูมิศาสตร์และการเดินทาง วิเคราะห์และตอบ: "${q}"\n[ตอบตรงๆ เป็นภาษาไทย 2-3 ประโยค]`,
  "rag-agent":       (q, ctx) => `${ctx ? `บริบทการสนทนา:\n${ctx}\n\n` : ""}ค้นหาและสรุปความรู้เกี่ยวกับ: "${q}"
หากพบข้อมูล: ตอบตรงๆ เป็นภาษาไทย 2-4 ประโยค ระบุแหล่งที่มาสั้นๆ ถ้าทราบ (เช่น "จากกฎหมาย PDPA...", "จากข้อมูลราชการ...", "จากหลักวิทยาศาสตร์...")
หากไม่พบข้อมูลชัดเจน: บอกตรงๆว่า "ไม่มีข้อมูลเพียงพอ" แล้วแนะนำแหล่งที่น่าค้นหาต่อ
ห้ามเดา ห้ามสร้างข้อมูลขึ้นมา`,
  "concierge":       (q, ctx) => `${ctx ? `บริบทการสนทนา:\n${ctx}\n\n` : ""}ตอบคำถามต่อไปนี้ตรงประเด็น ห้ามใช้คำนำ เช่น "ขออนุญาต" หรือ "ผมจะ" — เริ่มตอบได้เลย:\n"${q}"\n[ตอบเป็นภาษาไทยมืออาชีพ ใช้ bullet points ถ้ามีหลายประเด็น ไม่เกิน 4 ประโยคหรือ 4 bullets]`,
  "tool-scout":      (q, ctx) => `${ctx ? `บริบทการสนทนา:\n${ctx}\n\n` : ""}ระบุ tool และวิธีการที่เหมาะสมที่สุดสำหรับ: "${q}"\n[ชื่อ tool + เหตุผล 1-2 ประโยคภาษาไทย]`,
  "critic":          (q, ctx) => `${ctx ? `บริบทการสนทนา:\n${ctx}\n\n` : ""}วิเคราะห์และตอบ: "${q}"\n→ ระบุประเด็นหลัก → ให้คำตอบที่ถูกต้องและครบถ้วน\nตอบตรงๆ เป็นภาษาไทย ไม่เกิน 3 ประโยค ห้ามเกริ่นนำ`,
  "stylist":         (q, ctx) => `${ctx ? `บริบทการสนทนา:\n${ctx}\n\n` : ""}ตอบเลย ไม่ต้องบอกว่าเป็น AI: "${q}"\nพูดแบบเพื่อนที่รู้เรื่องดี ภาษาไทยเป็นธรรมชาติ กระชับ ไม่เกิน 3 ประโยค ห้ามขึ้นต้นด้วย "ขออนุญาต" หรือ "แน่นอน"`,
  "thinker":         (q, ctx) => `${ctx ? `บริบทการสนทนา:\n${ctx}\n\n` : ""}คุณเป็นนักคิดเชิงวิเคราะห์ขั้นสูง วิเคราะห์อย่างรอบด้านก่อนตอบ:\n${q}\n\nคิดเชิงระบบ หาสาเหตุและผล แล้วตอบเป็นภาษาไทยที่ชัดเจน 2-4 ประโยค ห้ามเริ่มด้วย "ขออนุญาต"`,
  "researcher":      (q, ctx) => `${ctx ? `บริบทการสนทนา:\n${ctx}\n\n` : ""}ค้นหาข้อมูลและหลักฐานที่เกี่ยวข้องกับ: "${q}"\n1. ข้อเท็จจริงหลัก\n2. แหล่งที่มาหรือบริบท\n3. ประเด็นที่ควรรู้เพิ่มเติม\nตอบเป็นภาษาไทยกระชับตรงประเด็น`,
  "fact-checker":    (q, ctx) => `${ctx ? `บริบทการสนทนา:\n${ctx}\n\n` : ""}ตรวจสอบข้อมูลเกี่ยวกับ: "${q}"
1. ระบุว่าข้อมูลใดน่าเชื่อถือ (มีหลักฐานรองรับชัดเจน)
2. ระบุข้อมูลที่ไม่แน่ใจหรือต้องการการตรวจสอบเพิ่มเติม
3. ถ้าไม่มีข้อมูลเพียงพอ บอกตรงๆ อย่าเดา
ตอบสั้น 2-3 ประโยค ห้ามปั้นข้อมูลขึ้นมา`,
  "linguist":        (q, ctx) => `${ctx ? `บริบทการสนทนา:\n${ctx}\n\n` : ""}สมมติเป็นผู้รู้เรื่องนี้ดี ตอบตรงๆ เลย: "${q}"\nภาษาไทยเหมือนคนจริงๆ คุย ไม่ต้องบอกที่มา ไม่ต้องขึ้นต้นด้วย "แน่นอน" หรือ "ดีใจที่ถาม" ตอบสั้นไม่เกิน 3 ประโยค`,
  "domain-expert":   (q, ctx) => `${ctx ? `บริบทการสนทนา:\n${ctx}\n\n` : ""}เป็นผู้เชี่ยวชาญเรื่องนี้ ตอบตรงโดยไม่ต้องแนะนำตัว: "${q}"\nให้ข้อมูลจากมุมมองผู้รู้จริง ภาษาไทยกระชับ ไม่เกิน 4 ประโยค ห้ามเกริ่นนำ`,
};

// ── Ollama (MDES) call ──────────────────────────────────────────────────────
// Two modes: non-streaming (default) and streaming with chunk callback.
// Streaming gives token-by-token UX in the chat bubble preview.

async function callOllama(
  model: string,
  prompt: string,
  ollamaUrl: string,
  ollamaKey: string,
  onChunk?: (accumulatedText: string) => void,
  timeoutOverrideMs?: number
): Promise<string> {
  const timeout = timeoutOverrideMs ?? MODEL_TIMEOUT_MS[model] ?? DEFAULT_TIMEOUT_MS;
  const useStream = onChunk !== undefined && process.env.OLLAMA_STREAM !== "0";
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (ollamaKey.trim()) headers.Authorization = `Bearer ${ollamaKey}`;

    const res = await fetch(`${ollamaUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers,
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

// ── GPT fallback call ──────────────────────────────────────────────────────

function parseModelList(raw: string | undefined, fallback: string[]): string[] {
  const models = (raw ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const ordered = (models.length > 0 ? models : fallback).filter((model) => {
    if (seen.has(model)) return false;
    seen.add(model);
    return true;
  });
  return ordered;
}

function getGptFallbackModels(): string[] {
  const primary = parseModelList(
    process.env.OPENAI_FALLBACK_MODELS ?? process.env.OPENAI_FALLBACK_MODEL,
    ["gpt-5.4", "gpt-5.3-codex"]
  );

  // Emergency model is intentionally opt-in and not part of this phase.
  if (process.env.OPENAI_EMERGENCY_FALLBACK === "1") {
    const emergency = (process.env.OPENAI_EMERGENCY_MODEL || "gpt-5.4").trim();
    if (emergency && !primary.includes(emergency)) primary.push(emergency);
  }

  return primary;
}

function safeErr(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]").slice(0, 200);
}

async function callGptFallback(
  model: string,
  prompt: string,
  apiKey: string,
  baseUrl: string
): Promise<string> {
  const ac = new AbortController();
  const timeout = Number(process.env.OPENAI_FALLBACK_TIMEOUT_MS || 30_000);
  const maxTokens = Number(process.env.OPENAI_FALLBACK_MAX_TOKENS || 512);
  const timer = setTimeout(() => ac.abort(), timeout);
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const post = async (tokenField: "max_completion_tokens" | "max_tokens") => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "คุณเป็น GPT fallback ของ INNOMCP ใช้เฉพาะเมื่อ MDES Ollama ล้ม 2 รอบแล้ว ตอบภาษาไทย กระชับ ถูกต้อง และไม่กล่าวอ้างว่าใช้เครื่องมือหากไม่มีข้อมูลเครื่องมือ",
          },
          { role: "user", content: prompt },
        ],
        [tokenField]: maxTokens,
      }),
      signal: ac.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  };

  try {
    let res = await post("max_completion_tokens");
    if (!res.ok && res.status === 400) {
      res = await post("max_tokens");
    }
    clearTimeout(timer);
    if (!res.ok) throw new Error(`OpenAI-compatible HTTP ${res.status}: ${res.text.slice(0, 120)}`);
    const json = JSON.parse(res.text) as {
      choices?: Array<{ message?: { content?: string } }>;
      output_text?: string;
    };
    return (json.choices?.[0]?.message?.content ?? json.output_text ?? "").trim();
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
  endpoint: AgentEndpoint,
  partialSink?: (agentId: AgentId, partialText: string) => void,
  ctx?: string
): Promise<{ agentId: AgentId; text: string }> {
  const model = endpoint.model;

  const startEv = newEnvelope({
    runId, messageId, type: "agent_started",
    publicSummary: `เริ่มงาน: ${agentId} (${endpoint.kind})`, agentId,
  });
  startEv.model = model;
  startEv.provider = endpoint.kind;
  if (checkAgentEventSafe(startEv, { expectedToolUsage: false }).ok) emit(startEv);
  const safeQ = query.replace(/["\\\n\r]/g, " ").trim().slice(0, 500);
  const promptFn = AGENT_PROMPT[agentId];
  const prompt = promptFn ? promptFn(safeQ, ctx) : `ช่วยตอบอย่างฉลาดและกระชับ: "${safeQ}"`;

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
      chunkEv.provider = endpoint.kind;
      if (checkAgentEventSafe(chunkEv, { expectedToolUsage: false }).ok) emit(chunkEv);
      if (partialSink) partialSink(agentId, accumulated);
    };
    const text = await callOllama(
      model,
      prompt,
      endpoint.url,
      endpoint.key,
      onChunk,
      endpoint.timeoutMs
    );

    // Final agent_delta with the complete text (replaces last progressive chunk)
    const deltaEv = newEnvelope({
      runId, messageId, type: "agent_delta",
      publicSummary: text.substring(0, 220) + (text.length > 220 ? "..." : ""), agentId,
    });
    deltaEv.model = model;
    deltaEv.provider = endpoint.kind;
    if (checkAgentEventSafe(deltaEv, { expectedToolUsage: false }).ok) emit(deltaEv);

    const doneEv = newEnvelope({
      runId, messageId, type: "agent_finished",
      publicSummary: `${agentId} เสร็จสิ้น`, agentId,
    });
    doneEv.provider = endpoint.kind;
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
    fbEv.provider = endpoint.kind;
    if (checkAgentEventSafe(fbEv, { expectedToolUsage: false }).ok) emit(fbEv);
    return { agentId, text: "" };
  }
}

// ── Escalating agent runner ─────────────────────────────────────────────────
// MDES attempt 1 → MDES attempt 2 → GPT fallback models (GPT skipped if MDES_ONLY=1)
// Set MDES_ONLY=1 in .env to restrict all agents to ollama.mdes — no localhost, no GPT.

const MDES_ONLY = process.env.MDES_ONLY === "1";

async function runAgentWithEscalation(
  agentId: AgentId,
  query: string,
  runId: string,
  messageId: string,
  emit: EmitFn,
  endpoint: AgentEndpoint,
  partialSink?: (agentId: AgentId, partialText: string) => void,
  ctx?: string
): Promise<{ agentId: AgentId; text: string }> {
  // Attempt 1 — MDES (remote or local per endpoint config)
  const r1 = await runAgent(agentId, query, runId, messageId, emit, endpoint, partialSink, ctx);
  if (r1.text) return r1;

  // Attempt 2:
  // - MDES_ONLY=1 → retry on the same MDES remote with the lighter gemma4:e4b model
  //   (keeps everything on ollama.mdes, no localhost).
  // - Default → force local Ollama at localhost:11434 with gemma4:e4b as a real second chance.
  const fallbackEndpoint: AgentEndpoint = MDES_ONLY
    ? {
        kind: "remote",
        url: endpoint.url, // same MDES remote
        key: endpoint.key,
        model: "gemma4:e4b",
        timeoutMs: MODEL_TIMEOUT_MS["gemma4:e4b"] ?? DEFAULT_TIMEOUT_MS,
      }
    : {
        kind: "local",
        url: process.env.LOCAL_OLLAMA_BASE_URL || "http://localhost:11434",
        key: process.env.LOCAL_OLLAMA_TOKEN || "",
        model: "gemma4:e4b",
        timeoutMs: MODEL_TIMEOUT_MS["gemma4:e4b"] ?? DEFAULT_TIMEOUT_MS,
      };
  const r2 = await runAgent(agentId, query, runId, messageId, emit, fallbackEndpoint, partialSink, ctx);
  if (r2.text) return r2;

  // Attempt 3+ — GPT fallback. Skipped when MDES_ONLY=1.
  if (MDES_ONLY) return { agentId, text: "" };

  const openAiKey = process.env.OPENAI_API_KEY ?? "";
  if (process.env.OPENAI_FALLBACK_ENABLED !== "0" && openAiKey.trim()) {
    const safeQ = query.replace(/["\\\n\r]/g, " ").trim().slice(0, 500);
    const promptFn = AGENT_PROMPT[agentId];
    const prompt = promptFn ? promptFn(safeQ, ctx) : `ช่วยตอบ: "${safeQ}"`;
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

    for (const model of getGptFallbackModels()) {
      const gptStart = newEnvelope({
        runId, messageId, type: "agent_started",
        publicSummary: `${agentId} → fallback GPT หลัง MDES ล้ม 2 รอบ`, agentId,
      });
      gptStart.model = model;
      if (checkAgentEventSafe(gptStart, { expectedToolUsage: false }).ok) emit(gptStart);

      try {
        const gptText = await callGptFallback(model, prompt, openAiKey, baseUrl);
        if (gptText) {
          const gptDone = newEnvelope({
            runId, messageId, type: "agent_finished",
            publicSummary: `${agentId} GPT fallback เสร็จสิ้น`, agentId,
          });
          gptDone.model = model;
          if (checkAgentEventSafe(gptDone, { expectedToolUsage: false }).ok) emit(gptDone);
          return { agentId, text: gptText };
        }
      } catch (err) {
        const msg = safeErr(err);
        const gptFail = newEnvelope({
          runId, messageId, type: "fallback",
          publicSummary: `${agentId}[GPT ${model}]: ${msg.substring(0, 80)}`, agentId,
        });
        gptFail.fallbackReason = msg;
        gptFail.model = model;
        if (checkAgentEventSafe(gptFail, { expectedToolUsage: false }).ok) emit(gptFail);
        console.warn(`[parallelDispatch] GPT fallback failed for ${agentId}/${model}: ${msg}`);
      }
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
  liveOutputs?: Record<string, string>,
  options: AgentDispatchOptions = {}
): Promise<Record<string, string>> {
  if (process.env.PARALLEL_AGENTS === "0") return {};
  const plan = selectAgentPlan(intent, query, options);
  if (plan.length === 0) return {};

  const outputs: Record<string, string> = liveOutputs ?? {};
  const ctxStr = options.history && options.history.length > 0 ? compressHistory(options.history) : undefined;

  // Fire all agents in parallel; capture each result the moment it settles
  // AND stream partial accumulated tokens into outputs so the conductor's
  // poll loop sees content immediately, not only after the agent finishes.
  const partialSink = (id: AgentId, partialText: string) => {
    if (partialText && partialText.length > 20) {
      outputs[`__partial_${id}`] = partialText;
    }
  };
  const tasks = plan.map((item) =>
    runAgentWithEscalation(item.agentId, query, runId, messageId, emit, item, partialSink, ctxStr)
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
  fallbackText: string,
  options: { runMode?: AgentRunMode } = {}
): string {
  // Priority: tool data > stylist > concierge > critic > first valid > fallback
  // Phase C.02: tool data is authoritative in BOTH modes — real-world numbers
  // always beat MDES commentary. Previously only normal mode short-circuited
  // on tool text; thinking mode could ignore a valid weather/geo result when
  // agents returned empty strings, falling through to fallbackText.
  const runMode = normalizeRunMode(options.runMode);
  const toolText = agentOutputs["__tool__"];

  if (runMode === "thinking") {
    const ordered = ["linguist", "stylist", "thinker", "researcher", "concierge", "rag-agent", "weather-analyst", "geo-planner", "critic", "tool-scout", "fact-checker", "domain-expert"];
    const useful = ordered
      .map((id) => agentOutputs[id])
      .filter((text): text is string => typeof text === "string" && text.trim().length > 20);
    const unique = useful.filter((text, idx) => useful.findIndex((other) => other.trim() === text.trim()) === idx);
    if (toolText && toolText.length > 20) {
      const synthesis = unique.find((text) => !toolText.includes(text.slice(0, 80)));
      return synthesis
        ? `${toolText}\n\nสรุปเพิ่มเติมจากทีมวิเคราะห์:\n${synthesis}`
        : toolText;
    }
    // Return the single best answer — linguist/stylist already outrank raw thinker.
    // Stitching two answers creates a confusing "dual-voice" response; one polished
    // answer reads as a whole and feels natural to the user.
    if (unique.length >= 1) {
      const notFoundMarkers = ["ไม่พบข้อมูล", "ไม่มีข้อมูล", "not found", "cannot find", "ไม่มีข้อมูลเพียงพอ"];
      const allNotFound = unique.every((t) =>
        notFoundMarkers.some((m) => t.toLowerCase().includes(m.toLowerCase()))
      );
      if (allNotFound) {
        return "ขออภัย ไม่พบข้อมูลที่ชัดเจนสำหรับคำถามนี้ ลองถามด้วยคำที่เฉพาะเจาะจงมากขึ้น หรือลองค้นหาจากแหล่งข้อมูลอื่นเพิ่มเติม";
      }
      return unique[0];
    }
  }

  if (toolText && toolText.length > 20) return toolText;
  // Ranked priority: prefer roles that polish/respond first, then the
  // domain analysts. This replaces insertion-order luck with a deterministic
  // quality ranking when no toolText/thinking-mode synthesis applies.
  const RANKED = ["linguist", "stylist", "thinker", "concierge", "researcher", "critic", "fact-checker", "domain-expert", "rag-agent", "weather-analyst", "geo-planner"];
  for (const key of RANKED) {
    if (agentOutputs[key] && agentOutputs[key].length > 20) return agentOutputs[key];
  }
  const first = Object.entries(agentOutputs)
    .filter(([key]) => !key.startsWith("__partial_"))
    .map(([, text]) => text)
    .find((t) => t.length > 20);

  // NOT_FOUND handling: if ALL non-partial outputs contain "not found" markers,
  // return a helpful fallback instead of raw agent text or fallbackText.
  if (first) {
    const notFoundMarkers = ["ไม่พบข้อมูล", "ไม่มีข้อมูล", "not found", "cannot find", "ไม่มีข้อมูลเพียงพอ"];
    const useful = Object.entries(agentOutputs)
      .filter(([key]) => !key.startsWith("__partial_"))
      .map(([, text]) => text)
      .filter((t) => t.length > 20);
    const allNotFound = useful.length > 0 && useful.every((t) =>
      notFoundMarkers.some((m) => t.toLowerCase().includes(m.toLowerCase()))
    );
    if (allNotFound) {
      return "ขออภัย ไม่พบข้อมูลที่ชัดเจนสำหรับคำถามนี้ ลองถามด้วยคำที่เฉพาะเจาะจงมากขึ้น หรือลองค้นหาจากแหล่งข้อมูลอื่นเพิ่มเติม";
    }
  }

  return first ?? fallbackText;
}
