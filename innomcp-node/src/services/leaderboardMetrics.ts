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
  avgQuality: number;
  qualitySamples: number;
  intentWins: Record<string, number>;
  currentStreak: number;
  bestStreak: number;
}

export interface ProviderStats {
  requests: number;
  avgLatency: number;
  successRate: number;
  p95Latency: number;
  wins: number;
  avgResponseLength: number;
  avgQuality: number;
  winRate: number;         // wins / requests * 100 (0 when requests=0)
  topIntent?: string;      // intent this provider wins most often
  healthScore: number;      // 0-100: combines successRate + circuit state availability
  efficiencyScore: number;  // wins per 1000 requests (0-100, capped)
  currentStreak: number;
  bestStreak: number;
  consistencyScore: number; // 0-100: 100 = very consistent response lengths, 0 = highly variable
}

const store = new Map<string, RawStats>();

function persistLeaderboardStats(operation: () => void | Promise<void>): void {
  if (process.env.NODE_ENV === "test") return;
  setImmediate(() => {
    Promise.resolve(operation()).catch(() => {
      // DB unavailable - in-memory stays authoritative
    });
  });
}

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
      avgQuality: 0,
      qualitySamples: 0,
      intentWins: {},
      currentStreak: 0,
      bestStreak: 0,
    });
  }

  // Write to DB async (non-blocking — never await, never throw to caller)
  persistLeaderboardStats(() => {
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

function computeStdDev(samples: number[]): number {
  if (samples.length < 2) return 0;
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  const variance = samples.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / samples.length;
  return Math.sqrt(variance);
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
      avgQuality: Math.round(raw.avgQuality),
      winRate: raw.requests > 0 ? Math.round((raw.wins / raw.requests) * 100) : 0,
      topIntent: Object.keys(raw.intentWins).length > 0
        ? Object.entries(raw.intentWins).sort((a, b) => b[1] - a[1])[0][0]
        : undefined,
      efficiencyScore: raw.requests > 0
        ? Math.min(100, Math.round((raw.wins / raw.requests) * 100))
        : 0,
      healthScore: raw.requests > 0
        ? Math.round(Math.round((raw.successes / raw.requests) * 100) * 0.7 +
                     (raw.wins > 0 ? 30 : 0))
        : 0,
      currentStreak: raw.currentStreak ?? 0,
      bestStreak: raw.bestStreak ?? 0,
      // Consistency: 100 = very consistent (low stddev), 0 = very variable
      // Based on response length variance
      consistencyScore: (() => {
        const lengthStdDev = computeStdDev(raw.responseSamples);
        return raw.responseSamples.length < 2 ? 0
          : Math.max(0, Math.round(100 - Math.min(100, (lengthStdDev / 500) * 100)));
      })(),
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
 * Returns a snapshot of intent-based wins across all providers.
 * Map<intent, Map<providerId, winCount>>
 */
export function getIntentWinsSnapshot(): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  for (const [providerId, raw] of store.entries()) {
    for (const [intent, count] of Object.entries(raw.intentWins)) {
      if (!result.has(intent)) result.set(intent, new Map());
      result.get(intent)!.set(providerId, count);
    }
  }
  return result;
}

/**
 * Record that a provider's response was selected as the synthesis winner
 * (fastest successful response chosen for the final answer).
 */
export function recordProviderWin(providerId: string, intent?: string): void {
  const existing = store.get(providerId);
  if (existing) {
    existing.wins += 1;
    if (intent) {
      existing.intentWins[intent] = (existing.intentWins[intent] ?? 0) + 1;
    }
  } else {
    store.set(providerId, {
      requests: 0,
      totalLatency: 0,
      successes: 0,
      latencySamples: [],
      wins: 1,
      totalResponseChars: 0,
      responseSamples: [],
      avgQuality: 0,
      qualitySamples: 0,
      intentWins: intent ? { [intent]: 1 } : {},
      currentStreak: 0,
      bestStreak: 0,
    });
  }

  // Persist win to DB async (fire-and-forget — same pattern as recordProviderCall)
  persistLeaderboardStats(() => {
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
    const samples = existing.qualitySamples ?? (existing.avgQuality > 0 ? 1 : 0);
    existing.avgQuality = (existing.avgQuality * samples + clampedScore) / (samples + 1);
    existing.qualitySamples = samples + 1;
  } else {
    store.set(providerId, {
      requests: 0, totalLatency: 0, successes: 0, latencySamples: [],
      wins: 0, totalResponseChars: 0, responseSamples: [], avgQuality: clampedScore,
      qualitySamples: 1,
      intentWins: {}, currentStreak: 0, bestStreak: 0,
    });
  }
}

/**
 * Record streak update after a dispatch win.
 * Increments winner's streak, resets all other providers.
 */
export function recordStreaks(winnerId: string): void {
  for (const [pid, raw] of store.entries()) {
    if (pid === winnerId) {
      raw.currentStreak = (raw.currentStreak ?? 0) + 1;
      raw.bestStreak = Math.max(raw.bestStreak ?? 0, raw.currentStreak);
    } else {
      raw.currentStreak = 0;
    }
  }
  // Ensure winner entry exists
  if (!store.has(winnerId)) {
    store.set(winnerId, {
      requests: 0, totalLatency: 0, successes: 0, latencySamples: [],
      wins: 0, totalResponseChars: 0, responseSamples: [], avgQuality: 0,
      qualitySamples: 0,
      intentWins: {}, currentStreak: 1, bestStreak: 1,
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
  recordStreaks,
  getProviderStats,
  getSparklineData,
  getIntentWinsSnapshot,
  getDbStats,
  resetStats,
};
