/**
 * services/leaderboardMetrics.ts — In-memory provider performance tracker
 *
 * Records per-provider call stats (requests, latency, success rate).
 * Used by motherDispatch after each parallel fan-out.
 *
 * Thread-safe for single-process Node.js (synchronous Map operations).
 * DB persistence is fire-and-forget via setImmediate; in-memory always authoritative.
 */

import { withDbConnection } from "../utils/db";

interface RawStats {
  requests: number;
  totalLatency: number;
  successes: number;
  latencySamples: number[];
  wins: number;
  totalResponseChars: number;
  responseSamples: number[];
  qualityScores: number[];
}

export interface ProviderStats {
  requests: number;
  avgLatency: number;
  successRate: number;
  p95Latency: number;
  wins: number;
  avgResponseLength: number;
  avgQuality: number;
}

const store = new Map<string, RawStats>();

function computeP95(samples: number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.ceil(samples.length * 0.95) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * Increment request count, update rolling avgLatency (simple moving average),
 * and update successRate for the given providerId.
 */
export function recordProviderCall(
  providerId: string,
  latencyMs: number,
  success: boolean,
  responseChars?: number
): void {
  const existing = store.get(providerId);
  if (existing) {
    existing.requests += 1;
    existing.totalLatency += latencyMs;
    if (success) existing.successes += 1;
    // Add to sliding window (keep last 100 samples)
    existing.latencySamples.push(latencyMs);
    if (existing.latencySamples.length > 100) {
      existing.latencySamples.shift();
    }
    if (responseChars != null) {
      existing.totalResponseChars += responseChars;
      existing.responseSamples.push(responseChars);
      if (existing.responseSamples.length > 50) existing.responseSamples.shift();
    }
  } else {
    store.set(providerId, {
      requests: 1,
      totalLatency: latencyMs,
      successes: success ? 1 : 0,
      latencySamples: [latencyMs],
      wins: 0,
      totalResponseChars: responseChars ?? 0,
      responseSamples: responseChars != null ? [responseChars] : [],
      qualityScores: [],
    });
  }

  // Write to DB async (non-blocking — never await, never throw to caller)
  setImmediate(() => {
    withDbConnection(async (conn) => {
      await conn.query(
        `INSERT INTO provider_stats (provider_id, requests, successes, total_latency)
         VALUES (?, 1, ?, ?)
         ON DUPLICATE KEY UPDATE
           requests      = requests + 1,
           successes     = successes + VALUES(successes),
           total_latency = total_latency + VALUES(total_latency),
           last_seen     = NOW()`,
        [providerId, success ? 1 : 0, latencyMs]
      );
    }).catch(() => {
      // DB unavailable — in-memory stays authoritative
    });
  });
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
      p95Latency: computeP95(raw.latencySamples),
      wins: raw.wins,
      avgResponseLength: raw.responseSamples.length > 0
        ? Math.round(raw.totalResponseChars / raw.responseSamples.length)
        : 0,
      avgQuality: raw.qualityScores.length > 0
        ? Math.round(raw.qualityScores.reduce((s, v) => s + v, 0) / raw.qualityScores.length)
        : 0,
    });
  }
  return result;
}

/**
 * Returns the last N latency samples for sparkline display.
 * Returns [] if the provider has no calls yet.
 */
export function getSparklineData(providerId: string, n = 10): number[] {
  const raw = store.get(providerId);
  if (!raw || raw.latencySamples.length === 0) return [];
  return raw.latencySamples.slice(-n);
}

/**
 * Record that a provider's response was selected as the synthesis winner
 * (fastest successful response chosen for the final answer).
 */
export function recordProviderWin(providerId: string): void {
  const existing = store.get(providerId);
  if (existing) {
    existing.wins += 1;
  } else {
    store.set(providerId, {
      requests: 0,
      totalLatency: 0,
      successes: 0,
      latencySamples: [],
      wins: 1,
      totalResponseChars: 0,
      responseSamples: [],
      qualityScores: [],
    });
  }

  // Persist win to DB async (fire-and-forget — same pattern as recordProviderCall)
  setImmediate(() => {
    withDbConnection(async (conn) => {
      await conn.query(
        `INSERT INTO provider_stats (provider_id, wins)
         VALUES (?, 1)
         ON DUPLICATE KEY UPDATE wins = wins + 1`,
        [providerId]
      );
    }).catch(() => {
      // DB unavailable — in-memory stays authoritative
    });
  });
}

/**
 * Record a quality score (0–100) for a provider response.
 * Quality is a heuristic: 0=empty/error, 50=minimal, 100=rich+detailed.
 * Callers compute this; this function just accumulates.
 */
export function recordProviderQuality(providerId: string, qualityScore: number): void {
  const clampedScore = Math.max(0, Math.min(100, Math.round(qualityScore)));
  const existing = store.get(providerId);
  if (existing) {
    existing.qualityScores.push(clampedScore);
    if (existing.qualityScores.length > 50) existing.qualityScores.shift();
  } else {
    store.set(providerId, {
      requests: 0, totalLatency: 0, successes: 0, latencySamples: [],
      wins: 0, totalResponseChars: 0, responseSamples: [], qualityScores: [clampedScore],
    });
  }
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

/**
 * Read persisted provider stats from the DB.
 * Returns an empty Map when the DB is unavailable — in-memory remains authoritative.
 */
export async function getDbStats(): Promise<
  Map<string, { requests: number; avgLatency: number; successRate: number; wins?: number }>
> {
  const result = new Map<
    string,
    { requests: number; avgLatency: number; successRate: number; wins?: number }
  >();
  try {
    await withDbConnection(async (conn) => {
      const [rows] = (await conn.query(
        `SELECT provider_id, requests, successes, total_latency, COALESCE(wins, 0) AS wins
         FROM provider_stats
         WHERE requests > 0`
      )) as [
        Array<{
          provider_id: unknown;
          requests: unknown;
          successes: unknown;
          total_latency: unknown;
          wins: unknown;
        }>,
        unknown
      ];
      for (const row of rows) {
        const reqs = Number(row.requests ?? 0);
        result.set(String(row.provider_id), {
          requests: reqs,
          avgLatency:
            reqs > 0
              ? Math.round(Number(row.total_latency) / reqs)
              : 0,
          successRate:
            reqs > 0
              ? Math.round((Number(row.successes) / reqs) * 100)
              : 100,
          wins: Number(row.wins ?? 0),
        });
      }
    });
  } catch {
    // DB unavailable — return empty map
  }
  return result;
}

/** Singleton instance exposing all methods. */
export const leaderboardMetrics = {
  recordProviderCall,
  recordProviderWin,
  recordProviderQuality,
  getProviderStats,
  getSparklineData,
  getDbStats,
  resetStats,
};
