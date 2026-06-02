/**
 * routes/api/agentLeaderboard.ts — Phase 7 agent leaderboard endpoint
 *
 * GET /api/agent-leaderboard
 *
 * Returns a ranked list of all AI providers/agents in the INNOMCP ecosystem.
 * Request counts and latency are pulled from the task_steps DB table when
 * available; falls back to static defaults so the panel always renders.
 *
 * Response shape:
 *   { agents: AgentEntry[], timestamp: string, totalAgents: number }
 */

import { Router, Request, Response } from "express";
import { withDbConnection } from "../../utils/db";
import {
  recordProviderCall,
  getProviderStats,
  getSparklineData,
} from "../../services/leaderboardMetrics";
import {
  runProbe,
  getProbeStatus,
  getAll as getAllProbeResults,
} from "../../services/providerHealthProbe";

const router = Router();

export interface AgentEntry {
  id: string;
  name: string;
  provider: string;
  model: string;
  /** "online" | "configured" | "checking" | "offline" */
  status: string;
  requests: number;
  avgLatency: number;
  successRate: number;
  p95Latency?: number;
  role: string;
  score?: number;
  sparkline?: number[];
  wins?: number;
  avgResponseLength?: number;  // avg chars per response from this provider
}

/**
 * Composite score for provider leaderboard ranking.
 *
 * score = (successRate * 0.5)   // reliability — 50 %
 *       + (speedScore   * 30)   // speed       — 30 %
 *       + (popularity   * 20)   // usage       — 20 %
 *
 * speedScore     = 1 / (1 + avgLatency / 1000)   range 0..1 (faster → higher)
 * popularityScore = Math.min(1, requests / 100)   range 0..1 (caps at 100 req)
 *
 * Special cases:
 *   requests === 0 && status !== "online" → 0  (not yet active)
 *   requests === 0 && status === "online" → successRate * 0.5  (available but unused)
 */
function computeScore(agent: AgentEntry): number {
  if (agent.requests === 0 && agent.status !== "online") return 0;
  const latencyForScore = agent.p95Latency ?? agent.avgLatency;
  const speedScore = 1 / (1 + (latencyForScore || 0) / 1000);
  const popularityScore = Math.min(1, (agent.requests || 0) / 100);
  return (agent.successRate || 0) * 0.5 + speedScore * 30 + popularityScore * 20;
}

/** Static catalogue — source of truth for identity/role fields. */
const AGENT_CATALOGUE: AgentEntry[] = [
  {
    id: "mdes",
    name: "MDES ThaiLLM",
    provider: "mdes-cloud",
    model: "gemma4:26b",
    status: "online",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "Thai NLP backbone",
  },
  {
    id: "claude-sonnet",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    status: "online",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "Main orchestrator",
  },
  {
    id: "claude-haiku",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    model: "claude-haiku-4-5",
    status: "online",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "Fast tasks",
  },
  {
    id: "gpt4o",
    name: "GPT-4o",
    provider: "openai",
    model: "gpt-4o",
    status: "configured",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "General reasoning",
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    provider: "github",
    model: "gpt-4",
    status: "configured",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "Code assist",
  },
  {
    id: "ollama-local",
    name: "Ollama Local",
    provider: "ollama-local",
    model: "llama3.2",
    status: "checking",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "Local inference",
  },
  {
    id: "ollama-cloud",
    name: "Ollama Cloud (MDES)",
    provider: "ollama-cloud",
    model: "gemma4:26b",
    status: "online",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "Thai cloud model",
  },
  {
    id: "gemini",
    name: "Gemini Pro",
    provider: "google",
    model: "gemini-pro",
    status: "configured",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "Multimodal",
  },
  {
    id: "mistral",
    name: "Mistral Large",
    provider: "mistral",
    model: "mistral-large",
    status: "configured",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "EU model",
  },
  {
    id: "llama",
    name: "LLaMA 3.2",
    provider: "meta",
    model: "llama3.2",
    status: "configured",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "Open source",
  },
  {
    id: "deepseek",
    name: "DeepSeek R1",
    provider: "deepseek",
    model: "deepseek-r1",
    status: "configured",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "Reasoning",
  },
  {
    id: "gemini-pro",
    name: "Gemini 1.5 Flash",
    provider: "google",
    model: "gemini-1.5-flash",
    status: "configured",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "Multimodal / Google AI",
  },
  {
    id: "mistral-large",
    name: "Mistral Large",
    provider: "mistral",
    model: "mistral-large-latest",
    status: "configured",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "EU sovereign model",
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    provider: "deepseek",
    model: "deepseek-reasoner",
    status: "configured",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "Chain-of-thought reasoning",
  },
  {
    id: "groq-llama",
    name: "Groq LLaMA 3.3",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    status: "configured",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "Ultra-fast inference",
  },
  {
    id: "together-llama",
    name: "Together LLaMA 3",
    provider: "together",
    model: "meta-llama/Llama-3-70b-chat-hf",
    status: "configured",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "Open-source inference",
  },
  {
    id: "thai-llm",
    name: "Thai LLM (qwen3.5:9b)",
    provider: "mdes-cloud",
    model: "qwen3.5:9b",
    status: "online",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "Thai language specialist",
  },
  {
    id: "innova-bot",
    name: "Innova-Bot",
    provider: "ollama-local",
    model: "qwen2.5:0.5b",
    status: "checking",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "Local agent (Jit organ)",
  },
  {
    id: "innova-oracle",
    name: "Innova Oracle",
    provider: "innova-bot",
    model: "oracle-rag",
    status: "checking",
    requests: 0,
    avgLatency: 0,
    successRate: 100,
    role: "RAG knowledge (Jit)",
  },
];

/** Attempt to pull live request counts and latency from task_steps. */
async function fetchLiveStats(): Promise<
  Map<string, { requests: number; avgLatency: number; successRate: number; p95Latency?: number; wins?: number }>
> {
  const result = new Map<
    string,
    { requests: number; avgLatency: number; successRate: number; p95Latency?: number; wins?: number }
  >();

  try {
    await withDbConnection(async (conn) => {
      // agent_id in task_steps is expected to match our catalogue ids (e.g. "claude-sonnet").
      // avg_latency_ms and success columns may not exist in all schema versions — handled below.
      const [rows] = (await conn.query(
        `SELECT
           agent_id,
           COUNT(*) AS requests,
           COALESCE(AVG(latency_ms), 0) AS avg_latency,
           COALESCE(
             100.0 * SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
             100
           ) AS success_rate
         FROM task_steps
         WHERE agent_id IS NOT NULL
         GROUP BY agent_id`
      )) as any[];

      for (const row of rows as any[]) {
        result.set(String(row.agent_id), {
          requests: Number(row.requests ?? 0),
          avgLatency: Math.round(Number(row.avg_latency ?? 0)),
          successRate: Math.round(Number(row.success_rate ?? 100)),
        });
      }
    });
  } catch {
    // DB unavailable or schema mismatch — silently return empty map so
    // the endpoint still returns a valid response with static defaults.
  }

  return result;
}

/**
 * Maps AGENT_CATALOGUE IDs to providerHealthProbe provider IDs.
 * Used to look up probe results when enriching agent status.
 * Where probe ID == catalogue ID the entry is still listed explicitly for clarity.
 */
const CATALOGUE_ID_TO_PROBE_ID: Record<string, string> = {
  "mdes": "mdes-cloud",
  "claude-sonnet": "claude-haiku", // no dedicated sonnet probe; share anthropic reachability
  "claude-haiku": "claude-haiku",
  "gpt4o": "openai-gpt",
  "copilot": "copilot",
  "ollama-local": "ollama-local",
  "ollama-cloud": "mdes-cloud",
  "gemini": "gemini-pro",
  "mistral": "mistral-large",
  "llama": "ollama-local",
  "deepseek": "deepseek-r1",
  "gemini-pro": "gemini-pro",
  "mistral-large": "mistral-large",
  "deepseek-r1": "deepseek-r1",
  "groq-llama": "groq-llama",
  "together-llama": "together-llama",
  "thai-llm": "mdes-cloud",
  "innova-bot": "ollama-local",
  "innova-oracle": "innova-oracle",
};

/**
 * Maps motherDispatch provider IDs to AGENT_CATALOGUE IDs.
 * In-memory stats use motherDispatch IDs; the catalogue uses its own IDs.
 */
const DISPATCH_ID_TO_CATALOGUE_ID: Record<string, string> = {
  "mdes-cloud": "mdes",
  "thai-llm": "thai-llm",
  "openai-gpt": "gpt4o",
  "claude-sonnet": "claude-sonnet",
  "claude-haiku": "claude-haiku",
  copilot: "copilot",
  "ollama-local": "ollama-local",
  "innova-bot": "innova-bot",
  "gemini-pro": "gemini-pro",
  "mistral-large": "mistral-large",
  "deepseek-r1": "deepseek-r1",
  "groq-llama": "groq-llama",
  "together-llama": "together-llama",
};

router.get("/", async (_req: Request, res: Response) => {
  const liveStats = await fetchLiveStats();

  // Translate in-memory (motherDispatch) stats to catalogue IDs, then merge.
  // In-memory takes priority over DB stats for the same catalogue ID.
  const memStats = getProviderStats();
  for (const [dispatchId, stats] of memStats.entries()) {
    const catalogueId = DISPATCH_ID_TO_CATALOGUE_ID[dispatchId];
    if (catalogueId) {
      liveStats.set(catalogueId, stats);
    }
  }

  const agents: AgentEntry[] = AGENT_CATALOGUE.map((entry) => {
    const live = liveStats.get(entry.id);
    return live
      ? {
          ...entry,
          requests: live.requests,
          avgLatency: live.avgLatency,
          successRate: live.successRate,
          p95Latency: live.p95Latency,
          wins: live.wins,
          avgResponseLength: live.avgResponseLength,
        }
      : { ...entry };
  });

  // Override status with probe result when probe has data
  const enrichedAgents: AgentEntry[] = agents.map((agent) => {
    const probeId = CATALOGUE_ID_TO_PROBE_ID[agent.id];
    if (probeId !== undefined) {
      const probeResult = getProbeStatus(probeId);
      // Only override if probe ran (not "checking")
      if (probeResult !== "checking") {
        return { ...agent, status: probeResult };
      }
    }
    return agent;
  });

  // Compute composite score and sort by it descending.
  const scoredAgents = enrichedAgents
    .map((a) => {
      // Map catalogue ID back to dispatch IDs to get sparkline data
      const dispatchIds = Object.entries(DISPATCH_ID_TO_CATALOGUE_ID)
        .filter(([, catId]) => catId === a.id)
        .map(([dispId]) => dispId);
      // Use first dispatch ID that has samples
      let sparkline: number[] = [];
      for (const dispId of dispatchIds) {
        const samples = getSparklineData(dispId, 10);
        if (samples.length > 0) { sparkline = samples; break; }
      }
      return { ...a, score: Math.round(computeScore(a) * 10) / 10, sparkline };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  res.json({
    agents: scoredAgents,
    timestamp: new Date().toISOString(),
    totalAgents: scoredAgents.length,
  });
});

/**
 * POST /api/agent-leaderboard/record
 * Body: { providerId: string; latencyMs: number; success: boolean }
 * Called by motherDispatch after each parallel fan-out to record live stats.
 */
router.post(
  "/record",
  (req: Request, res: Response): void => {
    const { providerId, latencyMs, success } = req.body as {
      providerId: string;
      latencyMs: number;
      success: boolean;
    };

    if (
      typeof providerId !== "string" ||
      typeof latencyMs !== "number" ||
      typeof success !== "boolean"
    ) {
      res
        .status(400)
        .json({ ok: false, error: "providerId (string), latencyMs (number), success (boolean) required" });
      return;
    }

    recordProviderCall(providerId, latencyMs, success);
    res.json({ ok: true });
  }
);

/**
 * GET /api/agent-leaderboard/probe
 * Triggers a fresh probe run and returns all cached probe results.
 * Useful for debugging or forcing a status refresh from the dashboard.
 */
router.get("/probe", async (_req: Request, res: Response) => {
  await runProbe();
  return res.json({ results: getAllProbeResults(), timestamp: new Date().toISOString() });
});

export default router;
