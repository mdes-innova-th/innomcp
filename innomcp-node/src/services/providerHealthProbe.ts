/**
 * services/providerHealthProbe.ts — Startup health probe for all 11 mother dispatch providers
 *
 * Pings each provider with a lightweight request on app startup and caches the
 * result in an in-memory map. agentLeaderboard reads this to display "online" /
 * "offline" instead of static "configured" for each provider.
 *
 * Provider list mirrors motherDispatch.buildProviderConfigs() — defined inline
 * here to avoid a circular import.
 *
 * Probe strategy per kind:
 *   ollama     — GET  {baseUrl}/api/tags                   200 → online, else offline
 *   openai     — POST {baseUrl}/chat/completions (1 token) 200|401 → online, else offline; empty key → configured
 *   anthropic  — POST {baseUrl}/messages         (1 token) 200|400|401 → online, else offline; empty key → configured
 *
 * All probes run concurrently via Promise.allSettled with a 5-second AbortController timeout.
 * No exception ever escapes — all errors are caught per provider.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProbeStatus = "online" | "offline" | "configured" | "checking";

export interface ProviderProbeResult {
  providerId: string;
  status: ProbeStatus;
  latencyMs: number;
  checkedAt: string; // ISO-8601
}

// ── Internal probe target definition ─────────────────────────────────────────

interface ProbeTarget {
  id: string;
  kind: "ollama" | "openai" | "anthropic";
  baseUrl: string;
  apiKey: string;
  model: string;
}

// ── In-memory state ───────────────────────────────────────────────────────────

export const probeStatus: Map<string, ProviderProbeResult> = new Map();

// ── Provider target list (mirrors motherDispatch.buildProviderConfigs) ────────

function buildProbeTargets(): ProbeTarget[] {
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
      kind: "ollama",
      baseUrl: mdesUrl,
      model: process.env.MDES_PRIMARY_MODEL || "gemma4:26b",
      apiKey: mdesKey,
    },
    {
      id: "thai-llm",
      kind: "ollama",
      baseUrl: mdesUrl,
      model: process.env.THAI_LLM_MODEL || "qwen3.5:9b",
      apiKey: mdesKey,
    },
    {
      id: "ollama-local",
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
    },
    {
      id: "openai-gpt",
      kind: "openai",
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      model:
        (process.env.OPENAI_FALLBACK_MODELS ?? "")
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean)[0] || "gpt-4o-mini",
      apiKey: process.env.OPENAI_API_KEY || "",
    },
    {
      id: "claude-haiku",
      kind: "anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      model: "claude-haiku-4-5-20251001",
      apiKey: process.env.ANTHROPIC_API_KEY || "",
    },
    {
      id: "copilot",
      kind: "openai",
      baseUrl:
        process.env.COPILOT_BASE_URL || "https://api.githubcopilot.com",
      model: "gpt-4o",
      apiKey:
        process.env.GITHUB_COPILOT_TOKEN ||
        process.env.GH_COPILOT_TOKEN ||
        "",
    },
    {
      id: "gemini-pro",
      kind: "openai",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "",
    },
    {
      id: "mistral-large",
      kind: "openai",
      baseUrl: "https://api.mistral.ai/v1",
      model: process.env.MISTRAL_MODEL || "mistral-large-latest",
      apiKey: process.env.MISTRAL_API_KEY || "",
    },
    {
      id: "deepseek-r1",
      kind: "openai",
      baseUrl: "https://api.deepseek.com/v1",
      model: process.env.DEEPSEEK_MODEL || "deepseek-reasoner",
      apiKey: process.env.DEEPSEEK_API_KEY || "",
    },
    {
      id: "groq-llama",
      kind: "openai",
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      apiKey: process.env.GROQ_API_KEY || "",
    },
    {
      id: "together-llama",
      kind: "openai",
      baseUrl: "https://api.together.xyz/v1",
      model: process.env.TOGETHER_MODEL || "meta-llama/Llama-3-70b-chat-hf",
      apiKey: process.env.TOGETHER_API_KEY || "",
    },
  ];
}

// ── Per-kind probe implementations ────────────────────────────────────────────

/**
 * Probe an Ollama provider: GET {baseUrl}/api/tags
 * 200 → "online"; any other response or network error → "offline"
 * No auth header added — the probe is intentionally minimal.
 */
async function probeOllama(
  target: ProbeTarget,
  signal: AbortSignal
): Promise<ProbeStatus> {
  const url = `${target.baseUrl.replace(/\/$/, "")}/api/tags`;
  const res = await fetch(url, { method: "GET", signal });
  return res.status === 200 ? "online" : "offline";
}

/**
 * Probe an OpenAI-compat provider: POST {baseUrl}/chat/completions (max_tokens:1)
 * Empty API key → "configured" (skip probe).
 * HTTP 200 or 401 → "online" (endpoint reachable, auth may fail — that's ok).
 * Network error or other HTTP status → "offline".
 */
async function probeOpenAI(
  target: ProbeTarget,
  signal: AbortSignal
): Promise<ProbeStatus> {
  if (target.apiKey.trim() === "") return "configured";

  const url = `${target.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${target.apiKey}`,
    },
    body: JSON.stringify({
      model: target.model,
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 1,
    }),
    signal,
  });
  return res.status === 200 || res.status === 401 ? "online" : "offline";
}

/**
 * Probe the Anthropic Messages API: POST https://api.anthropic.com/v1/messages
 * Empty API key → "configured" (skip probe).
 * HTTP 200, 400, or 401 → "online" (endpoint reachable).
 * Network error or other HTTP status → "offline".
 */
async function probeAnthropic(
  target: ProbeTarget,
  signal: AbortSignal
): Promise<ProbeStatus> {
  if (target.apiKey.trim() === "") return "configured";

  const url = `${target.baseUrl.replace(/\/$/, "")}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": target.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 1,
    }),
    signal,
  });
  return res.status === 200 || res.status === 400 || res.status === 401
    ? "online"
    : "offline";
}

// ── Single-provider probe orchestrator ───────────────────────────────────────

async function runSingleProbe(target: ProbeTarget): Promise<ProviderProbeResult> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5_000);
  const t0 = Date.now();

  try {
    let status: ProbeStatus;

    if (target.kind === "ollama") {
      status = await probeOllama(target, ac.signal);
    } else if (target.kind === "anthropic") {
      status = await probeAnthropic(target, ac.signal);
    } else {
      status = await probeOpenAI(target, ac.signal);
    }

    clearTimeout(timer);
    return {
      providerId: target.id,
      status,
      latencyMs: Date.now() - t0,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    // Network error, AbortError (timeout), or any unexpected throw
    clearTimeout(timer);
    return {
      providerId: target.id,
      status: "offline",
      latencyMs: Date.now() - t0,
      checkedAt: new Date().toISOString(),
    };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fire all 11 provider probes concurrently.
 * Uses Promise.allSettled so one failure never blocks the others.
 * Populates the in-memory `probeStatus` map on completion.
 */
export async function runProbe(): Promise<void> {
  const targets = buildProbeTargets();

  const settled = await Promise.allSettled(
    targets.map((t) => runSingleProbe(t))
  );

  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      probeStatus.set(outcome.value.providerId, outcome.value);
    }
    // "rejected" should never happen — runSingleProbe catches all errors.
    // If it somehow does, we simply omit that provider (it stays "checking").
  }
}

/**
 * Returns the current probe status for a given provider ID.
 * Returns "checking" if the provider has not yet been probed.
 */
export function getProbeStatus(providerId: string): ProbeStatus {
  return probeStatus.get(providerId)?.status ?? "checking";
}

/**
 * Returns all probe results sorted alphabetically by providerId.
 */
export function getAll(): ProviderProbeResult[] {
  return Array.from(probeStatus.values()).sort((a, b) =>
    a.providerId < b.providerId ? -1 : a.providerId > b.providerId ? 1 : 0
  );
}
