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
  role: string;
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
];

/** Attempt to pull live request counts and latency from task_steps. */
async function fetchLiveStats(): Promise<
  Map<string, { requests: number; avgLatency: number; successRate: number }>
> {
  const result = new Map<
    string,
    { requests: number; avgLatency: number; successRate: number }
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

router.get("/", async (_req: Request, res: Response) => {
  const liveStats = await fetchLiveStats();

  const agents: AgentEntry[] = AGENT_CATALOGUE.map((entry) => {
    const live = liveStats.get(entry.id);
    return live
      ? {
          ...entry,
          requests: live.requests,
          avgLatency: live.avgLatency,
          successRate: live.successRate,
        }
      : { ...entry };
  });

  // Sort by request count descending so the most-used agents appear first.
  agents.sort((a, b) => b.requests - a.requests);

  res.json({
    agents,
    timestamp: new Date().toISOString(),
    totalAgents: agents.length,
  });
});

export default router;
