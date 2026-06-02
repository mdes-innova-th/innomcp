/**
 * services/leaderboardMetrics.ts — In-memory provider performance tracker
 *
 * Records per-provider call stats (requests, latency, success rate).
 * Used by motherDispatch after each parallel fan-out.
 *
 * Thread-safe for single-process Node.js (synchronous Map operations).
 */

interface RawStats {
  requests: number;
  totalLatency: number;
  successes: number;
}

export interface ProviderStats {
  requests: number;
  avgLatency: number;
  successRate: number;
}

const store = new Map<string, RawStats>();

/**
 * Increment request count, update rolling avgLatency (simple moving average),
 * and update successRate for the given providerId.
 */
export function recordProviderCall(
  providerId: string,
  latencyMs: number,
  success: boolean
): void {
  const existing = store.get(providerId);
  if (existing) {
    existing.requests += 1;
    existing.totalLatency += latencyMs;
    if (success) existing.successes += 1;
  } else {
    store.set(providerId, {
      requests: 1,
      totalLatency: latencyMs,
      successes: success ? 1 : 0,
    });
  }
}

/**
 * Returns a snapshot of all tracked providers with computed derived fields.
 */
export function getProviderStats(): Map<string, ProviderStats> {
  const result = new Map<string, ProviderStats>();
  for (const [id, raw] of store.entries()) {
    result.set(id, {
      requests: raw.requests,
      avgLatency: Math.round(raw.totalLatency / raw.requests),
      successRate: Math.round((raw.successes / raw.requests) * 100),
    });
  }
  return result;
}

/**
 * Reset stats for one provider (by id) or all providers (no argument).
 */
export function resetStats(providerId?: string): void {
  if (providerId !== undefined) {
    store.delete(providerId);
  } else {
    store.clear();
  }
}

/** Singleton instance exposing all three methods. */
export const leaderboardMetrics = {
  recordProviderCall,
  getProviderStats,
  resetStats,
};
