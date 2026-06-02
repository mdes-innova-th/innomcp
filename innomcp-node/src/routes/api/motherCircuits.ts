/**
 * routes/api/motherCircuits.ts — Mother dispatch circuit breaker status
 *
 * GET /api/mother/circuits
 *
 * Returns the actual circuit breaker state for all 14 mother providers.
 * Keys in errorRecovery are "mother-{providerId}" (set by motherDispatch).
 *
 * Response:
 *   { circuits: CircuitEntry[], openCount: number, timestamp: string }
 */

import { Router, Request, Response } from "express";
import { errorRecovery } from "../../utils/errorRecovery";

const router = Router();

const PROVIDER_IDS = [
  "mdes-cloud", "thai-llm", "ollama-local", "openai-gpt",
  "claude-haiku", "claude-sonnet", "copilot", "gemini-pro",
  "mistral-large", "deepseek-r1", "groq-llama", "together-llama",
  "innova-bot", "innova-oracle",
];

interface CircuitEntry {
  providerId: string;
  /** CLOSED = healthy, OPEN = tripped (too many failures), HALF_OPEN = testing recovery */
  state: "CLOSED" | "OPEN" | "HALF_OPEN" | "UNKNOWN";
  failures: number;
}

router.get("/", (_req: Request, res: Response): void => {
  const circuits: CircuitEntry[] = PROVIDER_IDS.map((id) => {
    const status = errorRecovery.getCircuitStatus(`mother-${id}`);
    return {
      providerId: id,
      state: status ? (status.state as "CLOSED" | "OPEN" | "HALF_OPEN") : "UNKNOWN",
      failures: status?.failures ?? 0,
    };
  });

  const openCount = circuits.filter((c) => c.state === "OPEN").length;

  res.json({
    circuits,
    openCount,
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/mother/circuits/:providerId/reset
 * Manually reset a tripped circuit breaker.
 */
router.post("/:providerId/reset", (req: Request, res: Response): void => {
  const { providerId } = req.params;
  if (!PROVIDER_IDS.includes(providerId)) {
    res.status(404).json({ ok: false, error: "Unknown provider" });
    return;
  }
  errorRecovery.resetCircuit(`mother-${providerId}`);
  res.json({ ok: true, providerId, state: "CLOSED" });
});

export default router;
