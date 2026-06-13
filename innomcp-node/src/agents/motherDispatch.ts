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
import { recordProviderCall, recordProviderWin, recordProviderQuality, recordStreaks } from "../services/leaderboardMetrics";
import type { AgentDispatchOptions } from "./parallelDispatch";
import { pushRun } from "../services/motherHistory";
import type { MotherRunProvider } from "../services/motherHistory";
import { errorRecovery } from "../utils/errorRecovery";
import { isProviderEnabled } from "../services/motherProviderToggle";
import { listProviders, resolveApiKey } from "../providers/registry";
import { selectProvider, type SelectOptions } from "../providers/router";

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
  /** Estimated cost of this provider call in USD (rough input-token estimate) */
  estimatedCostUsd?: number;
}

export interface MotherDispatchResult {
  results: MotherResult[];
  /** Best answer from available results — longest successful response or first non-empty */
  synthesis: string;
  totalAgents: number;
  successCount: number;
  /** Sum of per-provider estimated costs across all non-skipped providers (USD) */
  totalEstimatedCostUsd: number;
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

// ── Innova-Bot Oracle provider ────────────────────────────────────────────────

let _oracleToken: { token: string; expiresAt: number } | null = null;

async function getOracleToken(baseUrl: string, signal: AbortSignal): Promise<string | null> {
  const now = Date.now();
  if (_oracleToken && _oracleToken.expiresAt > now + 60_000) return _oracleToken.token;
  try {
    const res = await fetch(`${baseUrl}/api/auth/token?client_id=innomcp&role=user`, {
      method: "POST", signal,
    });
    if (!res.ok) return null;
    const data = await res.json() as { access_token?: string };
    const token = data.access_token ?? "";
    if (!token) return null;
    _oracleToken = { token, expiresAt: now + 23 * 3600 * 1000 };
    return token;
  } catch {
    return null;
  }
}

async function callInnovaOracle(cfg: ProviderConfig, prompt: string, signal: AbortSignal): Promise<string> {
  const token = await getOracleToken(cfg.baseUrl, signal);
  if (!token) throw new Error("innova-oracle: gateway auth failed");

  const res = await fetch(`${cfg.baseUrl}/api/oracle/consult`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ query: prompt.slice(0, 500), max_chars: 1500 }),
    signal,
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      _oracleToken = null;
    }
    throw new Error(`innova-oracle: HTTP ${res.status}`);
  }

  const data = await res.json() as Record<string, unknown>;
  const text = (data.context ?? data.result ?? data.text ?? "") as string;
  if (!text || typeof text !== "string") return JSON.stringify(data).slice(0, 800);
  return `[Oracle]\n${text.trim()}`;
}

/** IDs belonging to the MDES cluster — used to enforce MDES_ONLY */
const MDES_PROVIDER_IDS = new Set(["mdes-cloud", "thai-llm", "seed-mdes-ollama", "seed-thai-llm-specialist"]);
const KEY_FREE_PROVIDER_IDS = new Set(["ollama-local", "seed-local-ollama", "innova-bot", "seed-innova-bot", "innova-oracle"]);

export const INTENT_KEYWORDS: Record<string, string[]> = {
  weather: ["อุณหภูมิ", "สภาพอากาศ", "ฝน", "แดด", "พยากรณ์"],
  geo: ["ที่ตั้ง", "จังหวัด", "ประเทศ", "แผนที่", "พิกัด"],
  knowledge: ["ข้อมูล", "รายละเอียด", "ประวัติ", "ข้อเท็จจริง", "สรุป"],
  code: ["ฟังก์ชัน", "ตัวแปร", "syntax", "implementation", "api", "library"],
  "planning-broad": ["ขั้นตอน", "กลยุทธ์", "แผน", "วิเคราะห์", "เป้าหมาย"],
  greeting: ["สวัสดี", "ยินดี", "ทักทาย"],
  general: ["คำตอบ", "ข้อมูล", "ประเด็น"],
};

export const AI_ISMS = [
  "As an AI language model",
  "I hope this helps",
  "Certainly!",
  "Here is a summary",
  "ขออภัย",
  "ในฐานะ AI",
  "ผมเป็น AI",
  "ข้อมูลนี้เป็นเพียงการจำลอง",
  "หวังว่าข้อมูลนี้จะเป็นประโยชน์",
];

/** Monotonically increasing counter across all dispatchMother calls in this process */
let motherIteration = 0;

const MOTHER_TIMEOUT_MS = 20_000;

function buildProviderConfigs(): ProviderConfig[] {
  return listProviders().map((p) => ({
    id: p.id,
    name: p.displayName,
    kind: p.type === "ollama-local" || p.type === "ollama-remote" ? "ollama" :
          p.type === "anthropic-compatible" ? "anthropic" : "openai",
    baseUrl: p.baseUrl,
    model: p.model,
    apiKey: resolveApiKey(p.id) || "",
    isMdes: p.id.includes("mdes"),
  }));
}

function isProviderConfigEligible(cfg: ProviderConfig, mdesOnly = process.env.MDES_ONLY === "1"): boolean {
  if (!isProviderEnabled(cfg.id)) return false;
  const keyRequired = cfg.kind !== "ollama" || !KEY_FREE_PROVIDER_IDS.has(cfg.id);
  if (keyRequired && cfg.apiKey.trim() === "") return false;
  if (mdesOnly && !MDES_PROVIDER_IDS.has(cfg.id)) return false;
  return true;
}

function selectCriticConfig(configs: ProviderConfig[], intent: string): ProviderConfig | null {
  const eligible = configs.filter((cfg) => isProviderConfigEligible(cfg));
  if (eligible.length === 0) return null;

  const capabilities: SelectOptions["capabilities"] =
    intent === "code" ? ["code", "grounding-critic"] : ["grounding-critic", "hard-reasoning"];
  const selection = selectProvider({
    mode: process.env.MDES_ONLY === "1" ? "remote" : "hybrid",
    capabilities,
    privacyLevel: "public",
  });

  const selected = selection.provider ? eligible.find((cfg) => cfg.id === selection.provider?.id) : undefined;
  if (selected) return selected;

  for (const alternate of selection.alternates) {
    const alternateCfg = eligible.find((cfg) => cfg.id === alternate.id);
    if (alternateCfg) return alternateCfg;
  }

  return eligible[0] ?? null;
}
// ── Cost estimation ───────────────────────────────────────────────────────────

/** Cost per 1K input tokens (USD), rough estimates. Self-hosted providers = $0. */
const PROVIDER_COST_PER_1K: Record<string, number> = {
  "mdes-cloud":     0.000,   // self-hosted, no direct cost
  "thai-llm":       0.000,   // self-hosted
  "ollama-local":   0.000,   // local
  "openai-gpt":     0.0015,  // gpt-4o-mini ~$0.15/1M input
  "claude-haiku":   0.00025, // Haiku: $0.25/1M input
  "copilot":        0.000,   // subscription-based, no per-call cost
  "gemini-pro":     0.00015, // gemini-1.5-flash: $0.075/1M
  "mistral-large":  0.002,   // mistral-large: $2/1M
  "deepseek-r1":    0.00055, // deepseek-reasoner: $0.55/1M
  "groq-llama":     0.00006, // llama3.3-70b on groq: $0.059/1M
  "together-llama": 0.0009,  // llama3-70b on together: $0.9/1M
  "claude-sonnet":  0.003,   // Sonnet 4.6: $3/1M input
  "innova-bot":     0.000,   // local qwen2.5:0.5b
};

/** Conservative per-call input token estimate (prompt + system context) */
const ESTIMATED_INPUT_TOKENS = 200;

/** Return the estimated USD cost for one call to the given provider. */
function estimateCost(providerId: string): number {
  const rate = PROVIDER_COST_PER_1K[providerId] ?? 0;
  return rate * (ESTIMATED_INPUT_TOKENS / 1000);
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

/**
 * Compute a detailed quality score (0–100) for a provider response.
 * Based on three pillars:
 * 1. Novelty: Inverse overlap with other successful results (30%)
 * 2. Completeness: Presence of intent-specific keywords (40%)
 * 3. Coherence: Penalizes "AI-isms" and robotic phrasing (30%)
 */
export function computeDetailedQualityScore(results: MotherResult[], target: MotherResult, intent: string): number {
  if (!target.success || !target.text.trim()) return 0;

  // 1. Novelty (Inverse overlap)
  let overlapSum = 0;
  let comparisonCount = 0;
  const targetWords = new Set(target.text.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  results.forEach(r => {
    if (r.providerId === target.providerId || !r.success || !r.text.trim()) return;
    comparisonCount++;
    const otherWords = new Set(r.text.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const intersection = new Set([...targetWords].filter(x => otherWords.has(x)));
    overlapSum += intersection.size / Math.max(targetWords.size, 1);
  });

  const noveltyScore = comparisonCount === 0 ? 100 : (1 - (overlapSum / comparisonCount)) * 100;

  // 2. Completeness (Intent-specific keywords)
  const keywords = INTENT_KEYWORDS[intent] || INTENT_KEYWORDS.general;
  const matchedKeywords = keywords.filter(k => target.text.includes(k)).length;
  const completenessScore = (matchedKeywords / Math.max(keywords.length, 1)) * 100;

  // 3. Coherence (Penalize AI-isms)
  let aiIsmCount = 0;
  AI_ISMS.forEach(ism => {
    if (target.text.toLowerCase().includes(ism.toLowerCase())) {
      aiIsmCount++;
    }
  });
  const coherenceScore = Math.max(0, 100 - (aiIsmCount * 15));

  return (noveltyScore * 0.3) + (completenessScore * 0.4) + (coherenceScore * 0.3);
}

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
    const text = await errorRecovery.withCircuitBreaker(
      `mother-${cfg.id}`,
      () => {
        if (cfg.kind === "anthropic") {
          return callAnthropic(cfg, prompt, ac.signal);
        } else if (cfg.kind === "openai") {
          return callOpenAICompat(cfg, prompt, ac.signal);
        } else if (cfg.id === "innova-oracle") {
          return callInnovaOracle(cfg, prompt, ac.signal);
        } else {
          return callOllamaCompat(cfg, prompt, ac.signal);
        }
      },
      { failureThreshold: 3, resetTimeout: 60_000, halfOpenRequests: 1 }
    );
    clearTimeout(timer);
    const latencyMs = Date.now() - t0;

    recordProviderCall(cfg.id, latencyMs, true, text.length);

    const doneEv = newEnvelope({
      runId,
      messageId,
      type: "agent_finished",
      publicSummary: `${cfg.name} เสร็จสิ้น (${latencyMs}ms)`,
      agentId: "conductor",
    });
    doneEv.provider = cfg.id;
    doneEv.model = cfg.model;
    doneEv.latencyMs = latencyMs;
    doneEv.previewText = text.trim().slice(0, 100);
    if (checkAgentEventSafe(doneEv, { expectedToolUsage: false }).ok) {
      emit(doneEv);
    }

    return {
      providerId: cfg.id,
      providerName: cfg.name,
      text,
      latencyMs,
      success: true,
      estimatedCostUsd: estimateCost(cfg.id),
    };
  } catch (err) {
    clearTimeout(timer);
    const latencyMs = Date.now() - t0;
    const errorMsg = safeErrMsg(err);

    // Circuit breaker is OPEN — emit a dedicated fallback and skip this provider
    if (errorMsg.includes("Circuit breaker is OPEN")) {
      const cbEv = newEnvelope({
        runId,
        messageId,
        type: "fallback",
        publicSummary: `${cfg.id} circuit open — skipping`,
        agentId: "conductor",
      });
      cbEv.provider = cfg.id;
      cbEv.model = cfg.model;
      cbEv.fallbackReason = errorMsg;
      if (checkAgentEventSafe(cbEv, { expectedToolUsage: false }).ok) {
        emit(cbEv);
      }
      return {
        providerId: cfg.id,
        providerName: cfg.name,
        text: "",
        latencyMs,
        success: false,
        errorMsg: "circuit-open",
        estimatedCostUsd: 0,
      };
    }

    recordProviderCall(cfg.id, latencyMs, false, 0);

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
      estimatedCostUsd: estimateCost(cfg.id),
    };
  }
}

/**
 * Critique the parallel results using a high-tier model to identify hallucinations,
 * contradictions, and gaps.
 */
async function critiqueResults(
  results: MotherResult[],
  query: string,
  intent: string,
  emit: EmitFn,
  runId: string,
  messageId: string
): Promise<string> {
  const successful = results.filter((r) => r.success && r.text.trim().length > 0);
  if (successful.length < 2) return "";

  const resultsText = successful
    .map((r, i) => `[Provider ${i + 1} (${r.providerName})]: ${r.text.trim()}`)
    .join("\n\n");

  const critiquePrompt = `คุณเป็น AI ผู้ตรวจสอบ (Critic) หน้าที่ของคุณคือเปรียบเทียบคำตอบจาก AI หลายตัว\n` +
    `คำถาม: ${query}\n` +
    `เจตนา: ${intent}\n\n` +
    `คำตอบที่ได้รับ:\n${resultsText}\n\n` +
    `จงวิเคราะห์และระบุ:\n` +
    `1. จุดที่ขัดแย้งกัน (Contradictions)\n` +
    `2. ข้อมูลที่ดูเหมือนการหลอน (Hallucinations)\n` +
    `3. รายละเอียดที่สำคัญที่หายไป หรือตัวเลือกที่ดีที่สุด\n` +
    `ตอบเป็นภาษาไทย กระชับ ตรงประเด็น ห้ามเกรงใจ`;

  const configs = buildProviderConfigs();
  const criticCfg = selectCriticConfig(configs, intent);
  if (!criticCfg) return "";

  const critEv = newEnvelope({
    runId,
    messageId,
    type: "agent_started",
    publicSummary: `🧐 Critiquing responses via ${criticCfg.name}...`,
    agentId: "conductor",
  });
  critEv.provider = "mother-critic";
  if (checkAgentEventSafe(critEv, { expectedToolUsage: false }).ok) emit(critEv);

  try {
    const critique = await runProvider(criticCfg, critiquePrompt, runId, messageId, emit);
    const doneEv = newEnvelope({
      runId,
      messageId,
      type: "agent_finished",
      publicSummary: `🧐 Critique complete`,
      agentId: "conductor",
    });
    doneEv.provider = "mother-critic";
    if (checkAgentEventSafe(doneEv, { expectedToolUsage: false }).ok) emit(doneEv);
    return critique.text;
  } catch (err) {
    return `Critique failed: ${safeErrMsg(err)}`;
  }
}

// ── Synthesis ────────────────────────────────────────────────────────────────

const SYNTHESIS_TIMEOUT_MS = 10_000;
const SYNTHESIS_MIN_CHARS = 30;
const SYNTHESIS_MODEL = process.env.MDES_SYNTHESIS_MODEL || "gemma4:e4b";

/**
 * Pick the best answer from all successful results.
 *
 * When responseMode === "thinking" and at least 2 valid responses exist, this
 * calls the MDES fast model (gemma4:e4b) to produce a merged Thai answer.
 * Falls back to longest-wins if the synthesis call fails or the condition
 * isn't met.
 */
async function synthesizeResults(
  results: MotherResult[],
  intent: string,
  query: string,
  emit: EmitFn,
  runId: string,
  messageId: string,
  responseMode?: string,
  critique?: string,
): Promise<{ text: string; winnerId: string | null }> {
  // Score each result by in-run quality: fast + successful > slow + failed.
  // score = 1 / (1 + latencyMs/1000)  →  range (0, 1], faster = higher
  // Avoids cold-start problem of historical stats: works from iteration 1.
  function inRunScore(r: MotherResult): number {
    return r.success ? 1 / (1 + r.latencyMs / 1000) : 0;
  }

  // Collect successful responses above minimum length, rank by in-run score
  const successful = results
    .filter((r) => r.success && r.text.trim().length >= SYNTHESIS_MIN_CHARS)
    .sort((a, b) => inRunScore(b) - inRunScore(a))
    .slice(0, 3);

  if (successful.length === 0) return { text: "", winnerId: null };
  if (successful.length === 1) return { text: successful[0].text, winnerId: successful[0].providerId };

  // For normal mode: return fastest-successful response (top of score-ranked list)
  if (responseMode !== "thinking") {
    return { text: successful[0].text, winnerId: successful[0].providerId };
  }

  // ── LLM synthesis path (thinking mode, 2-3 responses) ───────────────────
  const count = successful.length;

  // Emit synthesis started event
  const startEv = newEnvelope({
    runId,
    messageId,
    type: "agent_started",
    publicSummary: `🧬 Synthesizing ${count} provider responses...`,
    agentId: "conductor",
  });
  startEv.provider = "mother";
  if (checkAgentEventSafe(startEv, { expectedToolUsage: false }).ok) {
    emit(startEv);
  }

  // Build the synthesis prompt
  const agentLines = successful
    .map((r, i) => `[Agent ${i + 1}]: ${r.text.trim()}`)
    .join("\n");
  const safeQuery = query.replace(/["\\\n\r]/g, " ").trim().slice(0, 300);
  const synthesisPrompt =
    `คุณเป็น AI synthesizer รวมคำตอบจากหลาย AI agents ดังนี้:\n` +
    `${agentLines}\n\n` +
    (critique ? `🧐 ผลการตรวจสอบโดย Critic:\n${critique}\n\n` : "") +
    `คำถามเดิม: ${safeQuery}\n` +
    `สรุปและรวมเข้าด้วยกัน ให้คำตอบที่ดีที่สุด ภาษาไทย กระชับ ไม่เกิน 5 ประโยค โดยใช้ผลการวิเคราะห์ของ Critic เพื่อลดความผิดพลาด`;

  // Resolve MDES endpoint config (same env vars as mdes-cloud provider)
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

  const synthCfg: ProviderConfig = {
    id: "mdes-synthesis",
    name: "MDES Synthesis",
    kind: "ollama",
    baseUrl: mdesUrl,
    model: SYNTHESIS_MODEL,
    apiKey: mdesKey,
    isMdes: true,
  };

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), SYNTHESIS_TIMEOUT_MS);
    let synthesized: string;
    try {
      synthesized = await callOllamaCompat(synthCfg, synthesisPrompt, ac.signal);
    } finally {
      clearTimeout(timer);
    }

    const doneEv = newEnvelope({
      runId,
      messageId,
      type: "agent_finished",
      publicSummary: `🧬 Synthesis complete`,
      agentId: "conductor",
    });
    doneEv.provider = "mother";
    if (checkAgentEventSafe(doneEv, { expectedToolUsage: false }).ok) {
      emit(doneEv);
    }

    if (synthesized.trim().length > 0) {
      return { text: synthesized.trim(), winnerId: successful[0].providerId };
    }
    // Empty synthesis — fall through to longest-wins
  } catch {
    // Synthesis failed — emit fallback event and fall through to longest-wins
    const fbEv = newEnvelope({
      runId,
      messageId,
      type: "fallback",
      publicSummary: `🧬 Synthesis failed — using longest response`,
      agentId: "conductor",
    });
    fbEv.provider = "mother";
    fbEv.fallbackReason = "synthesis-timeout-or-error";
    if (checkAgentEventSafe(fbEv, { expectedToolUsage: false }).ok) {
      emit(fbEv);
    }
  }

  // Fallback: fastest-successful (already sorted by inRunScore)
  return { text: successful[0].text, winnerId: successful[0].providerId };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fan out the given query to all configured providers in parallel (Manus-style).
 *
 * Roster: 14 providers — mdes-cloud, thai-llm, ollama-local, openai-gpt,
 * claude-haiku, claude-sonnet, copilot, gemini-pro, mistral-large,
 * deepseek-r1, groq-llama, together-llama, innova-bot, innova-oracle.
 *
 * - Always-on (key-free): ollama-local, innova-bot (local Ollama), innova-oracle (gateway).
 * - Other providers are skipped silently when their API key is absent.
 * - When MDES_ONLY=1, only mdes-cloud and thai-llm are dispatched.
 * - Each provider has a hard 20-second AbortController timeout.
 * - Results arrive via Promise.allSettled so a single provider failure
 *   never blocks the others.
 * - Warns to console when fewer than 5 providers are eligible.
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
  const eligible = allConfigs.filter((cfg) => isProviderConfigEligible(cfg, mdesOnly));

  if (eligible.length === 0) {
    return { results: [], synthesis: "", totalAgents: 0, successCount: 0, totalEstimatedCostUsd: 0 };
  }

  // Warn when fewer than 5 providers are eligible — Manus-like parallel dispatch needs diversity.
  // Always-on (key-free) providers: ollama-local, innova-bot — always 2.
  // Configure MDES_KEY + at least 3 cloud keys (ANTHROPIC/OPENAI/GROQ etc.) for full power.
  const MIN_AGENTS = 5;
  if (eligible.length < MIN_AGENTS && !mdesOnly) {
    console.warn(
      `[mother] ⚠️  only ${eligible.length}/${allConfigs.length} providers eligible — ` +
      `configure REMOTE_OLLAMA_TOKEN + cloud keys to reach ${MIN_AGENTS}+ concurrent agents`
    );
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
    if (!cfg) {
      return { providerId: "unknown", providerName: "unknown", text: "", latencyMs: 0, success: false, errorMsg: "no provider config" };
    }
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

  // Manus-style: Critique before synthesis
  const critique = await critiqueResults(results, query, intent, emit, runId, messageId);

  const { text: synthesis, winnerId } = await synthesizeResults(
    results,
    intent,
    query,
    emit,
    runId,
    messageId,
    options.responseMode,
    critique
  );
  if (winnerId) recordProviderWin(winnerId, intent);
  if (winnerId) recordStreaks(winnerId);
  const totalEstimatedCostUsd = results.reduce(
    (sum, r) => sum + (r.estimatedCostUsd ?? 0),
    0
  );

  // Record this run in history
  const runProviders: MotherRunProvider[] = results.map((r) => {
    let qualityScore: number | undefined;
    if (r.success) {
      qualityScore = computeDetailedQualityScore(results, r, intent);
      recordProviderQuality(r.providerId, qualityScore);
    }
    return {
      providerId: r.providerId,
      providerName: r.providerName,
      latencyMs: r.latencyMs,
      success: r.success,
      preview: r.text.trim().slice(0, 200),
      errorMsg: r.errorMsg,
      qualityScore,
    };
  });
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
    totalEstimatedCostUsd,
  });

  return {
    results,
    synthesis,
    totalAgents: results.length,
    successCount,
    totalEstimatedCostUsd,
  };
}
