/**
 * motherHistory.ts — Per-run mother dispatch history
 * Ring buffer of last 50 runs. Each entry records which providers responded,
 * their latency, success, and a preview of their answer.
 */

export interface MotherRunProvider {
  providerId: string;
  providerName: string;
  latencyMs: number;
  success: boolean;
  preview: string;   // first 200 chars of text (trimmed), empty string if failed
  errorMsg?: string;
}

export interface MotherRun {
  runId: string;           // conductor runId
  timestamp: string;       // ISO-8601
  intent: string;          // e.g. "knowledge", "code", "general"
  query: string;           // first 120 chars of user query
  iteration: number;       // motherIteration counter value
  totalProviders: number;
  successCount: number;
  fastestProvider: string; // providerId of fastest successful response
  slowestMs: number;
  synthesis: string;       // first 200 chars of final synthesized answer
  providers: MotherRunProvider[];
  /** Sum of per-provider estimated input costs in USD for this run */
  totalEstimatedCostUsd?: number;
}

const MAX_RUNS = 50;
const HISTORY: MotherRun[] = [];

/**
 * Prepend a new run to the history, trimming to MAX_RUNS entries.
 */
export function pushRun(run: MotherRun): void {
  HISTORY.unshift(run);
  if (HISTORY.length > MAX_RUNS) {
    HISTORY.length = MAX_RUNS;
  }
}

/**
 * Return the most recent `limit` runs (most recent first).
 * Clamps limit to the range [1, MAX_RUNS].
 */
export function getHistory(limit = 10): MotherRun[] {
  const clamped = Math.min(Math.max(1, limit), MAX_RUNS);
  return HISTORY.slice(0, clamped);
}

/**
 * Look up a single run by its runId. Returns null if not found.
 */
export function getRunById(runId: string): MotherRun | null {
  return HISTORY.find((r) => r.runId === runId) ?? null;
}

/**
 * Clear all stored runs. Primarily for use in tests.
 */
export function clearHistory(): void {
  HISTORY.length = 0;
}

/** Singleton object exposing all operations. */
export const motherHistory = {
  push: pushRun,
  get: getHistory,
  getById: getRunById,
  clear: clearHistory,
};
