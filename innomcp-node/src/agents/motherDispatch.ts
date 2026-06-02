/**
 * agents/motherDispatch.ts — Mother Orchestrator multi-provider fan-out
 *
 * Dispatches to 5+ real AI providers simultaneously, tracks latency per
 * provider, and returns all results plus a synthesis. Called from conductor
 * in thinking mode.
 *
 * Provider roster:
 *   mdes-cloud   — MDES Ollama remote (gemma4:26b)
 *   thai-llm     — MDES Ollama remote, Thai-specialized model (qwen3.5:9b)
 *   ollama-local — Local Ollama (llama3.2)
 *   openai-gpt   — OpenAI chat completions
 *   claude-haiku — Anthropic Messages API
 *   copilot      — GitHub Copilot (OpenAI-compat)
 *
 * Providers with no API key configured are skipped silently (no network call).
 * Set MDES_ONLY=1 to restrict to mdes-cloud + thai-llm only.
 */

import { newEnvelope } from "./events";
import { checkAgentEventSafe } from "./eventGuard";
import type { EmitFn } from "./conductor";
import { recordProviderCall } from "../services/leaderboardMetrics";
import type { AgentDispatchOptions } from "./parallelDispatch";
import { pushRun } from "../services/motherHistory";
import type { MotherRunProvider } from "../services/motherHistory";

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface MotherResult {
  /** Stable provider key: "mdes-cloud", "thai-llm", "ollama-local", etc. */
  providerId: string;
  /** Human-readable display name */
  providerName: string;
  text: string;
  latencyMs: number;
  success: boolean;
  errorMsg?: string;
}

export interface MotherDispatchResult {
  results: MotherResult[];
  /** Best answer from available results — longest successful response or first non-empty */
  synthesis: string;
  totalAgents: number;
  successCount: number;
}

// ── Provider config ───────────────────────────────────────────────────────────

interface ProviderConfig {
  id: string;
  name: string;
  kind: "ollama" | "openai" | "anthropic";
  baseUrl: string;
  model: string;
  apiKey: string;
  isMdes: boolean;
}

/** IDs belonging to the MDES cluster — used to enforce MDES_ONLY */
const MDES_PROVIDER_IDS = new Set(["mdes-cloud", "thai-llm"]);

/** Monotonically increasing counter across all dispatchMother calls in this process */
let motherIteration = 0;

const MOTHER_TIMEOUT_MS = 20_000;

function buildProviderConfigs(): ProviderConfig[] {
  const mdesUrl =
    process.env.REMOTE_OLLAMA_BASE_URL ||
    process.env.OLLAMA_REMOTE_BASE_URL ||
    process.env.OLLAMA_REMOTE_URL ||
    "https://ollama.mdes-innova.online";
  const mdesKey =
    process.env.REMOTE_OLLAMA_TOKEN ||
    process.env.OLLAMA_REMOTE_API_KEY ||
    process.env.OLLAMA_API_KEY ||
    "";

  return [
    {
      id: "mdes-cloud",
      name: "MDES Cloud (gemma4:26b)",
      kind: "ollama",
      baseUrl: mdesUrl,
      model: process.env.MDES_PRIMARY_MODEL || "gemma4:26b",
      apiKey: mdesKey,
      isMdes: true,
    },
    {
      id: "thai-llm",
      name: "Thai LLM (qwen3.5:9b)",
      kind: "ollama",
      baseUrl: mdesUrl,
      model: process.env.THAI_LLM_MODEL || "qwen3.5:9b",
      apiKey: mdesKey,
      isMdes: true,
    },
    {
      id: "ollama-local",
      name: "Local Ollama",
      kind: "ollama",
      baseUrl:
        process.env.LOCAL_OLLAMA_BASE_URL ||
        process.env.OLLAMA_LOCAL_BASE_URL ||
        process.env.OLLAMA_BASE_URL ||
        "http://localhost:11434",
      model:
        process.env.LOCAL_OLLAMA_MODEL ||
        process.env.OLLAMA_LOCAL_DEFAULT_MODEL ||
        "llama3.2",
      apiKey: process.env.LOCAL_OLLAMA_TOKEN || "",
      isMdes: false,
    },
    {
      id: "openai-gpt",
      name: "OpenAI GPT",
      kind: "openai",
      baseUrl:
        process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      model:
        (process.env.OPENAI_FALLBACK_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean)[0] ||
        "gpt-4o-mini",
      apiKey: process.env.OPENAI_API_KEY || "",
      isMdes: false,
    },
    {
      id: "claude-haiku",
      name: "Claude Haiku",
      kind: "anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      model: "claude-haiku-4-5-20251001",
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      isMdes: false,
    },
    {
      id: "copilot",
      name: "GitHub Copilot",
      kind: "openai",
      baseUrl:
        process.env.COPILOT_BASE_URL || "https://api.githubcopilot.com",
      model: "gpt-4o",
      apiKey:
        process.env.GITHUB_COPILOT_TOKEN ||
        process.env.GH_COPILOT_TOKEN ||
        "",
      isMdes: false,
    },
    {
      id: "gemini-pro",
      name: "Gemini Pro",
      kind: "openai",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "",
      isMdes: false,
    },
    {
      id: "mistral-large",
      name: "Mistral Large",
      kind: "openai",
      baseUrl: "https://api.mistral.ai/v1",
      model: process.env.MISTRAL_MODEL || "mistral-large-latest",
      apiKey: process.env.MISTRAL_API_KEY || "",
      isMdes: false,
    },
    {
      id: "deepseek-r1",
      name: "DeepSeek R1",
      kind: "openai",
      baseUrl: "https://api.deepseek.com/v1",
      model: process.env.DEEPSEEK_MODEL || "deepseek-reasoner",
      apiKey: process.env.DEEPSEEK_API_KEY || "",
      isMdes: false,
    },
    {
      id: "groq-llama",
      name: "Groq LLaMA",
      kind: "openai",
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      apiKey: process.env.GROQ_API_KEY || "",
      isMdes: false,
    },
    {
      id: "together-llama",
      name: "Together LLaMA",
      kind: "openai",
      baseUrl: "https://api.together.xyz/v1",
      model: process.env.TOGETHER_MODEL || "meta-llama/Llama-3-70b-chat-hf",
      apiKey: process.env.TOGETHER_API_KEY || "",
      isMdes: false,
    },
  ];
}

// ── Prompt builder ────────────────────────────────────────────────────────────

/**
 * Build a Thai prompt appropriate for the intent + query.
 * Follows the same pattern as AGENT_PROMPT in parallelDispatch.ts.
 */
export function buildMotherPrompt(intent: string, query: string): string {
  const safeQ = query.replace(/["\\\n\r]/g, " ").trim().slice(0, 500);
  switch (intent) {
    case "weather":
      return `คุณเป็นผู้เชี่ยวชาญด้านสภาพอากาศ วิเคราะห์และตอบ: "${safeQ}"\n[ตอบตรงๆ เป็นภาษาไทย 2-3 ประโยค ไม่ต้องขึ้นต้นด้วย "ผม" หรือ "ขออนุญาต"]`;
    case "geo":
      return `คุณเป็นผู้เชี่ยวชาญด้านภูมิศาสตร์และการเดินทาง วิเคราะห์และตอบ: "${safeQ}"\n[ตอบตรงๆ เป็นภาษาไทย 2-3 ประโยค]`;
    case "knowledge":
      return `ค้นหาและสรุปความรู้เกี่ยวกับ: "${safeQ}"\nตอบตรงๆ เป็นภาษาไทย 2-4 ประโยค ระบุแหล่งที่มาสั้นๆ ถ้าทราบ ห้ามเดา ห้ามสร้างข้อมูลขึ้นมา`;
    case "code":
      return `ช่วยเขียนโค้ดหรืออธิบายเรื่อง: "${safeQ}"\n[ตอบเป็นภาษาไทยผสมภาษาอังกฤษตามความเหมาะสม กระชับตรงประเด็น]`;
    case "planning-broad":
      return `คุณเป็นนักวางแผนที่เชี่ยวชาญ วิเคราะห์อย่างรอบด้านสำหรับ: "${safeQ}"\nคิดเชิงระบบ หาสาเหตุและผล แล้วตอบเป็นภาษาไทยที่ชัดเจน 3-5 ประโยค`;
    case "greeting":
      return `ตอบการทักทายนี้อย่างเป็นธรรมชาติ: "${safeQ}"\n[ตอบสั้น กระชับ ภาษาไทยเหมือนคนจริงๆ คุย ไม่ต้องบอกที่มา]`;
    default:
      return `ตอบคำถามต่อไปนี้ตรงประเด็น ห้ามใช้คำนำ เช่น "ขออนุญาต" หรือ "ผมจะ" — เริ่มตอบได้เลย:\n"${safeQ}"\n[ตอบเป็นภาษาไทยมืออาชีพ ใช้ bullet points ถ้ามีหลายประเด็น ไม่เกิน 4 ประโยคหรือ 4 bullets]`;
  }
}

// ── Per-provider callers ──────────────────────────────────────────────────────

/** Call Ollama (or any OpenAI-compat) via /v1/chat/completions, non-streaming */
async function callOllamaCompat(
  cfg: ProviderConfig,
  prompt: string,
  signal: AbortSignal
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cfg.apiKey.trim()) {
    headers["Authorization"] = `Bearer ${cfg.apiKey}`;
  }
  const res = await fetch(
    `${cfg.baseUrl.replace(/\/$/, "")}/v1/chat/completions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
      signal,
    }
  );
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return (json.choices?.[0]?.message?.content ?? "").trim();
}

/** Call OpenAI (or Copilot) via /chat/completions */
async function callOpenAICompat(
  cfg: ProviderConfig,
  prompt: string,
  signal: AbortSignal
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  // GitHub Copilot requires an extra header
  if (cfg.id === "copilot") {
    headers["Copilot-Integration-Id"] = "vscode-chat";
  }
  const res = await fetch(
    `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          {
            role: "system",
            content:
              "คุณเป็นผู้ช่วย AI ของ INNOMCP ตอบภาษาไทย กระชับ ถูกต้อง",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 512,
      }),
      signal,
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return (json.choices?.[0]?.message?.content ?? "").trim();
}

/** Call Anthropic Messages API */
async function callAnthropic(
  cfg: ProviderConfig,
  prompt: string,
  signal: AbortSignal
): Promise<string> {
  const res = await fetch(
    `${cfg.baseUrl.replace(/\/$/, "")}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
      signal,
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
  }
  const json = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  return (
    json.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("") ?? ""
  ).trim();
}

function safeErrMsg(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/x-api-key[^,}\]"]*/gi, "x-api-key [redacted]")
    .slice(0, 200);
}

// ── Core provider runner ──────────────────────────────────────────────────────

async function runProvider(
  cfg: ProviderConfig,
  prompt: string,
  runId: string,
  messageId: string,
  emit: EmitFn
): Promise<MotherResult> {
  // Emit agent_started
  const startEv = newEnvelope({
    runId,
    messageId,
    type: "agent_started",
    publicSummary: `mother → ${cfg.name}`,
    agentId: "conductor",
  });
  startEv.provider = cfg.id;
  startEv.model = cfg.model;
  if (checkAgentEventSafe(startEv, { expectedToolUsage: false }).ok) {
    emit(startEv);
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), MOTHER_TIMEOUT_MS);
  const t0 = Date.now();

  try {
    let text: string;
    if (cfg.kind === "anthropic") {
      text = await callAnthropic(cfg, prompt, ac.signal);
    } else if (cfg.kind === "openai") {
      text = await callOpenAICompat(cfg, prompt, ac.signal);
    } else {
      text = await callOllamaCompat(cfg, prompt, ac.signal);
    }
    clearTimeout(timer);
    const latencyMs = Date.now() - t0;

    recordProviderCall(cfg.id, latencyMs, true);

    const doneEv = newEnvelope({
      runId,
      messageId,
      type: "agent_finished",
      publicSummary: `${cfg.name} เสร็จสิ้น (${latencyMs}ms)`,
      agentId: "conductor",
    });
    doneEv.provider = cfg.id;
    doneEv.model = cfg.model;
    if (checkAgentEventSafe(doneEv, { expectedToolUsage: false }).ok) {
      emit(doneEv);
    }

    return {
      providerId: cfg.id,
      providerName: cfg.name,
      text,
      latencyMs,
      success: true,
    };
  } catch (err) {
    clearTimeout(timer);
    const latencyMs = Date.now() - t0;
    const errorMsg = safeErrMsg(err);

    recordProviderCall(cfg.id, latencyMs, false);

    const fbEv = newEnvelope({
      runId,
      messageId,
      type: "fallback",
      publicSummary: `${cfg.name} ล้มเหลว: ${errorMsg.slice(0, 80)}`,
      agentId: "conductor",
    });
    fbEv.provider = cfg.id;
    fbEv.model = cfg.model;
    fbEv.fallbackReason = errorMsg;
    if (checkAgentEventSafe(fbEv, { expectedToolUsage: false }).ok) {
      emit(fbEv);
    }

    return {
      providerId: cfg.id,
      providerName: cfg.name,
      text: "",
      latencyMs,
      success: false,
      errorMsg,
    };
  }
}

// ── Synthesis ────────────────────────────────────────────────────────────────

/**
 * Pick the best answer from all successful results.
 * Strategy: longest successful response wins (indicates most complete answer).
 * Falls back to first non-empty response if all are short.
 */
function synthesizeResults(results: MotherResult[]): string {
  const successful = results.filter((r) => r.success && r.text.trim().length > 0);
  if (successful.length === 0) return "";

  // Sort by text length descending — longest = most complete answer
  const sorted = successful.slice().sort((a, b) => b.text.length - a.text.length);
  return sorted[0].text;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fan out the given query to all configured providers in parallel.
 *
 * - Providers with an empty API key are skipped silently.
 * - When MDES_ONLY=1, only mdes-cloud and thai-llm are dispatched.
 * - Each provider has a hard 20-second AbortController timeout.
 * - Results arrive via Promise.allSettled so a single provider failure
 *   never blocks the others.
 */
export async function dispatchMother(
  intent: string,
  query: string,
  runId: string,
  messageId: string,
  emit: EmitFn,
  options: AgentDispatchOptions = {}
): Promise<MotherDispatchResult> {
  const mdesOnly = process.env.MDES_ONLY === "1";
  const prompt = buildMotherPrompt(intent, query);

  const allConfigs = buildProviderConfigs();

  // Filter: skip providers with no key; enforce MDES_ONLY
  const eligible = allConfigs.filter((cfg) => {
    // Local Ollama has no required key — always include unless MDES_ONLY
    const keyRequired = cfg.kind !== "ollama" || cfg.id !== "ollama-local";
    if (keyRequired && cfg.apiKey.trim() === "") return false;
    if (mdesOnly && !MDES_PROVIDER_IDS.has(cfg.id)) return false;
    return true;
  });

  if (eligible.length === 0) {
    return { results: [], synthesis: "", totalAgents: 0, successCount: 0 };
  }

  // Emit iteration counter event (fires once per dispatchMother call, after filtering)
  motherIteration++;
  const iterEv = newEnvelope({
    runId,
    messageId,
    type: "agent_started",
    publicSummary: `🧠 Mother iteration #${motherIteration} — dispatching to ${eligible.length} providers`,
    agentId: "conductor",
  });
  iterEv.provider = "mother";
  if (checkAgentEventSafe(iterEv, { expectedToolUsage: false }).ok) emit(iterEv);

  // Dispatch all eligible providers in parallel
  const settled = await Promise.allSettled(
    eligible.map((cfg) => runProvider(cfg, prompt, runId, messageId, emit))
  );

  const results: MotherResult[] = settled.map((outcome, idx) => {
    if (outcome.status === "fulfilled") {
      return outcome.value;
    }
    // Promise itself rejected (should not happen — runProvider catches internally)
    const cfg = eligible[idx];
    const errorMsg = safeErrMsg(outcome.reason);
    recordProviderCall(cfg.id, 0, false);
    return {
      providerId: cfg.id,
      providerName: cfg.name,
      text: "",
      latencyMs: 0,
      success: false,
      errorMsg,
    };
  });

  const successCount = results.filter((r) => r.success).length;
  const synthesis = synthesizeResults(results);

  // Record this run in history
  const runProviders: MotherRunProvider[] = results.map((r) => ({
    providerId: r.providerId,
    providerName: r.providerName,
    latencyMs: r.latencyMs,
    success: r.success,
    preview: r.text.slice(0, 80),
    errorMsg: r.errorMsg,
  }));
  const fastest = results
    .filter((r) => r.success)
    .sort((a, b) => a.latencyMs - b.latencyMs)[0];
  pushRun({
    runId,
    timestamp: new Date().toISOString(),
    intent: options?.intent ?? "general",
    query: query.slice(0, 120),
    iteration: motherIteration,
    totalProviders: results.length,
    successCount: results.filter((r) => r.success).length,
    fastestProvider: fastest?.providerId ?? "",
    slowestMs: Math.max(...results.map((r) => r.latencyMs), 0),
    synthesis: synthesis.slice(0, 200),
    providers: runProviders,
  });

  return {
    results,
    synthesis,
    totalAgents: results.length,
    successCount,
  };
}
