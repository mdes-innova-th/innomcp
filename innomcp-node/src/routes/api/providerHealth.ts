/**
 * routes/api/providerHealth.ts — bulk provider health-check endpoint
 *
 * POST /api/providers/health-check
 *
 * Probes every enabled provider concurrently with a 5s per-provider
 * timeout. Marks healthy (<= 3000 ms + 2xx), degraded (> 3000 ms + 2xx),
 * or down (error / timeout / non-2xx). Updates the in-memory registry
 * via setHealth() so subsequent GET /api/ai/providers reflects fresh
 * status.
 *
 * Response shape:
 *   { results: [{ id, displayName, healthStatus, latencyMs }] }
 */

import { Router, Request, Response } from "express";
import { listProviders, setHealth } from "../../providers/registry";

const router = Router();

const PROBE_TIMEOUT_MS = 5_000;
const DEGRADED_THRESHOLD_MS = 3_000;

type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

interface HealthResult {
  id: string;
  displayName: string;
  healthStatus: HealthStatus;
  latencyMs: number;
}

async function probeProvider(
  rec: ReturnType<typeof listProviders>[number]
): Promise<HealthResult> {
  // Ollama variants expose /api/tags; everything else gets /health
  const isOllama =
    rec.type === "ollama-local" || rec.type === "ollama-remote";
  const probeUrl = isOllama
    ? `${rec.baseUrl}/api/tags`
    : `${rec.baseUrl}/health`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const t0 = Date.now();

  let healthStatus: HealthStatus = "down";
  let latencyMs = 0;

  try {
    const resp = await fetch(probeUrl, {
      method: "GET",
      signal: controller.signal,
    });
    latencyMs = Date.now() - t0;

    if (resp.status >= 200 && resp.status < 300) {
      healthStatus =
        latencyMs > DEGRADED_THRESHOLD_MS ? "degraded" : "healthy";
    } else {
      healthStatus = "down";
    }
  } catch {
    latencyMs = Date.now() - t0;
    healthStatus = "down";
  } finally {
    clearTimeout(timer);
  }

  // Persist result to in-memory registry
  setHealth(rec.id, healthStatus);

  return {
    id: rec.id,
    displayName: rec.displayName,
    healthStatus,
    latencyMs,
  };
}

router.post("/", async (_req: Request, res: Response) => {
  const providers = listProviders().filter((p) => p.enabled);

  const settled = await Promise.allSettled(providers.map(probeProvider));

  const results: HealthResult[] = settled.map((outcome, i) => {
    if (outcome.status === "fulfilled") {
      return outcome.value;
    }
    // Should not happen since probeProvider catches internally, but handle anyway
    return {
      id: providers[i].id,
      displayName: providers[i].displayName,
      healthStatus: "down" as HealthStatus,
      latencyMs: 0,
    };
  });

  res.json({ results });
});

export default router;
