/**
 * routes/api/motherRoster.ts — Mother dispatch provider roster
 *
 * GET /api/mother/roster
 *
 * Returns all 14 configured mother providers with their key-availability status.
 * Used by the frontend to show "configured" vs "active" state correctly.
 *
 * Response shape:
 *   { providers: RosterEntry[], totalProviders: number, alwaysOnCount: number }
 */

import { Router, Request, Response } from "express";
import { getProviderStats, getSparklineData } from "../../services/leaderboardMetrics";
import { isProviderEnabled } from "../../services/motherProviderToggle";

const router = Router();

interface RosterEntry {
  id: string;
  name: string;
  kind: "ollama" | "openai" | "anthropic";
  model: string;
  alwaysOn: boolean;
  keyAvailable: boolean;
  envVar: string;
  score?: number;          // composite score from leaderboard (0–100), undefined if no calls yet
  requests?: number;       // total calls recorded
  wins?: number;
  quality?: number;       // average quality score (0–100)
  sparkline?: number[];
  enabled?: boolean;
}

const ROSTER: Omit<RosterEntry, "keyAvailable">[] = [
  { id: "mdes-cloud",     name: "MDES Cloud (gemma4:26b)",  kind: "ollama",    model: "gemma4:26b",                  alwaysOn: false, envVar: "REMOTE_OLLAMA_TOKEN" },
  { id: "thai-llm",       name: "Thai LLM (qwen3.5:9b)",   kind: "ollama",    model: "qwen3.5:9b",                  alwaysOn: false, envVar: "REMOTE_OLLAMA_TOKEN" },
  { id: "ollama-local",   name: "Local Ollama",             kind: "ollama",    model: "llama3.2",                    alwaysOn: true,  envVar: "" },
  { id: "openai-gpt",     name: "OpenAI GPT",               kind: "openai",    model: "gpt-4o-mini",                 alwaysOn: false, envVar: "OPENAI_API_KEY" },
  { id: "claude-haiku",   name: "Claude Haiku 4.5",         kind: "anthropic", model: "claude-haiku-4-5-20251001",   alwaysOn: false, envVar: "ANTHROPIC_API_KEY" },
  { id: "claude-sonnet",  name: "Claude Sonnet 4.6",        kind: "anthropic", model: "claude-sonnet-4-6",           alwaysOn: false, envVar: "ANTHROPIC_API_KEY" },
  { id: "copilot",        name: "GitHub Copilot",           kind: "openai",    model: "gpt-4o",                      alwaysOn: false, envVar: "GITHUB_COPILOT_TOKEN" },
  { id: "gemini-pro",     name: "Gemini Pro",               kind: "openai",    model: "gemini-1.5-flash",            alwaysOn: false, envVar: "GEMINI_API_KEY" },
  { id: "mistral-large",  name: "Mistral Large",            kind: "openai",    model: "mistral-large-latest",        alwaysOn: false, envVar: "MISTRAL_API_KEY" },
  { id: "deepseek-r1",    name: "DeepSeek R1",              kind: "openai",    model: "deepseek-reasoner",           alwaysOn: false, envVar: "DEEPSEEK_API_KEY" },
  { id: "groq-llama",     name: "Groq LLaMA 3.3",          kind: "openai",    model: "llama-3.3-70b-versatile",     alwaysOn: false, envVar: "GROQ_API_KEY" },
  { id: "together-llama", name: "Together LLaMA 3",        kind: "openai",    model: "meta-llama/Llama-3-70b-chat-hf", alwaysOn: false, envVar: "TOGETHER_API_KEY" },
  { id: "innova-bot",     name: "Innova-Bot",               kind: "ollama",    model: "qwen2.5:0.5b",                alwaysOn: true,  envVar: "" },
  { id: "innova-oracle", name: "Innova Oracle (RAG)",       kind: "ollama",    model: "oracle-rag",                  alwaysOn: true,  envVar: "" },
];

router.get("/", (_req: Request, res: Response): void => {
  const stats = getProviderStats();

  const providers: RosterEntry[] = ROSTER.map((p) => {
    const keyAvailable = p.alwaysOn || (p.envVar !== "" && !!process.env[p.envVar]?.trim());
    const s = stats.get(p.id);
    const score = s
      ? Math.round(s.successRate * 0.5 + (1 / (1 + (s.p95Latency || s.avgLatency) / 1000)) * 50)
      : undefined;
    return {
      ...p,
      keyAvailable,
      score,
      requests: s?.requests,
      wins: s?.wins,
      quality: s?.avgQuality,
      sparkline: getSparklineData(p.id, 10),
      enabled: isProviderEnabled(p.id),
    };
  });

  res.json({
    providers,
    totalProviders: providers.length,
    alwaysOnCount: providers.filter((p) => p.alwaysOn).length,
    eligibleCount: providers.filter((p) => p.keyAvailable).length,
    enabledCount: providers.filter((p) => p.enabled).length,
  });
});

export default router;
