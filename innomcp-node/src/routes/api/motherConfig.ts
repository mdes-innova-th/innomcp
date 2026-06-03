/**
 * routes/api/motherConfig.ts — Current mother system configuration export
 *
 * GET /api/mother/config
 *
 * Returns the current configuration state: which providers are enabled,
 * their models, base URLs (redacted for security), and feature flags.
 * API keys are NEVER included in the response.
 */

import { Router, Request, Response } from "express";
import { isProviderEnabled, getDisabledProviders } from "../../services/motherProviderToggle";
import { errorRecovery } from "../../utils/errorRecovery";

const router = Router();

const PROVIDER_CONFIG = [
  { id: "mdes-cloud",     name: "MDES Cloud",      model: "gemma4:26b",              kind: "ollama",    alwaysOn: false, envKey: "REMOTE_OLLAMA_TOKEN" },
  { id: "thai-llm",       name: "Thai LLM",         model: "qwen3.5:9b",              kind: "ollama",    alwaysOn: false, envKey: "REMOTE_OLLAMA_TOKEN" },
  { id: "ollama-local",   name: "Local Ollama",     model: "llama3.2",                kind: "ollama",    alwaysOn: true,  envKey: "" },
  { id: "openai-gpt",     name: "OpenAI GPT",       model: "gpt-4o-mini",             kind: "openai",    alwaysOn: false, envKey: "OPENAI_API_KEY" },
  { id: "claude-haiku",   name: "Claude Haiku",     model: "claude-haiku-4-5-20251001",kind: "anthropic", alwaysOn: false, envKey: "ANTHROPIC_API_KEY" },
  { id: "claude-sonnet",  name: "Claude Sonnet",    model: "claude-sonnet-4-6",       kind: "anthropic", alwaysOn: false, envKey: "ANTHROPIC_API_KEY" },
  { id: "copilot",        name: "GitHub Copilot",   model: "gpt-4o",                  kind: "openai",    alwaysOn: false, envKey: "GITHUB_COPILOT_TOKEN" },
  { id: "gemini-pro",     name: "Gemini Pro",       model: "gemini-1.5-flash",        kind: "openai",    alwaysOn: false, envKey: "GEMINI_API_KEY" },
  { id: "mistral-large",  name: "Mistral Large",    model: "mistral-large-latest",    kind: "openai",    alwaysOn: false, envKey: "MISTRAL_API_KEY" },
  { id: "deepseek-r1",    name: "DeepSeek R1",      model: "deepseek-reasoner",       kind: "openai",    alwaysOn: false, envKey: "DEEPSEEK_API_KEY" },
  { id: "groq-llama",     name: "Groq LLaMA",       model: "llama-3.3-70b-versatile", kind: "openai",    alwaysOn: false, envKey: "GROQ_API_KEY" },
  { id: "together-llama", name: "Together LLaMA",   model: "meta-llama/Llama-3-70b",  kind: "openai",    alwaysOn: false, envKey: "TOGETHER_API_KEY" },
  { id: "innova-bot",     name: "Innova-Bot",        model: "qwen2.5:0.5b",            kind: "ollama",    alwaysOn: true,  envKey: "" },
  { id: "innova-oracle",  name: "Innova Oracle",    model: "oracle-rag",              kind: "oracle",    alwaysOn: true,  envKey: "" },
];

router.get("/", (_req: Request, res: Response): void => {
  const disabled = getDisabledProviders();

  const providers = PROVIDER_CONFIG.map(p => {
    const circuit = errorRecovery.getCircuitStatus(`mother-${p.id}`);
    const keyConfigured = p.alwaysOn || (p.envKey !== "" && !!(process.env[p.envKey]?.trim()));
    return {
      id: p.id,
      name: p.name,
      model: p.model,
      kind: p.kind,
      alwaysOn: p.alwaysOn,
      enabled: isProviderEnabled(p.id),
      keyConfigured,
      circuitState: circuit?.state ?? "UNKNOWN",
      envKey: p.envKey || "(none)",
    };
  });

  const featureFlags = {
    mdesOnly: process.env.MDES_ONLY === "1",
    motherDispatch: process.env.MOTHER_DISPATCH !== "0",
    parallelAgents: process.env.PARALLEL_AGENTS !== "0",
    synthesisModel: process.env.MDES_SYNTHESIS_MODEL || "gemma4:e4b",
    motherTimeout: 20_000,
    minAgents: 5,
  };

  res.json({
    providers,
    featureFlags,
    totalProviders: providers.length,
    alwaysOnCount: providers.filter(p => p.alwaysOn).length,
    enabledCount: providers.filter(p => p.enabled).length,
    keyConfiguredCount: providers.filter(p => p.keyConfigured).length,
    disabledProviders: disabled,
    timestamp: new Date().toISOString(),
  });
});

export default router;
