"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MotherRunProvider {
  providerId: string;
  providerName: string;
  latencyMs: number;
  success: boolean;
  preview: string;
  errorMsg?: string;
}

interface MotherRun {
  runId: string;
  timestamp: string;
  intent: string;
  query: string;
  iteration: number;
  totalProviders: number;
  successCount: number;
  fastestProvider: string;
  slowestMs: number;
  synthesis: string;
  providers: MotherRunProvider[];
  totalEstimatedCostUsd?: number;
}

interface HistoryResponse {
  runs: MotherRun[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 10_000;

const PROVIDER_LABEL: Record<string, string> = {
  "mdes-cloud": "MDES", "thai-llm": "ThaiLLM", "ollama-local": "Local",
  "openai-gpt": "GPT", "claude-haiku": "Haiku", "claude-sonnet": "Sonnet",
  "copilot": "Copilot", "gemini-pro": "Gemini", "mistral-large": "Mistral",
  "deepseek-r1": "DeepSeek", "groq-llama": "Groq", "together-llama": "Together",
  "innova-bot": "Innova",
};

// ─── URL resolution — same pattern as ProviderHealthPanel ────────────────────

function resolveBackendUrl(path: string): string {
  const envUrl =
    typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_BACKEND_URL
      ? String(process.env.NEXT_PUBLIC_BACKEND_URL).replace(/\/$/, "")
      : "";
  if (envUrl) return `${envUrl}${path}`;
  if (typeof window !== "undefined" && window.location) {
    const { protocol, hostname, port } = window.location;
    if (hostname === "localhost" && port === "3000") {
      return `${protocol}//${hostname}:3011${path}`;
    }
    return `${protocol}//${window.location.host}${path}`;
  }
  return `http://localhost:3011${path}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toTimeString().slice(0, 8);
  } catch {
    return isoString;
  }
}

function formatNow(d: Date): string {
  return d.toTimeString().slice(0, 8);
}

function latencyClass(ms: number): string {
  if (ms < 500) return "text-emerald-600 dark:text-emerald-400";
  if (ms < 2000) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

// ─── ProviderRow ──────────────────────────────────────────────────────────────

function ProviderRow({ p }: { p: MotherRunProvider }) {
  return (
    <tr className="border-t border-border/20 hover:bg-muted/20 transition-colors">
      <td className="py-1 px-2 text-[10.5px] text-foreground/80 truncate max-w-[90px]">
        {p.providerName || p.providerId}
      </td>
      <td className={`py-1 px-2 text-[10.5px] tabular-nums font-medium ${latencyClass(p.latencyMs)}`}>
        {p.latencyMs > 0 ? `${p.latencyMs}ms` : "–"}
      </td>
      <td className="py-1 px-2 text-[11px]">
        {p.success ? (
          <span className="text-emerald-500" title="success">✅</span>
        ) : (
          <span className="text-rose-500" title={p.errorMsg ?? "failed"}>❌</span>
        )}
      </td>
      <td className="py-1 px-2 text-[10px] text-muted-foreground/70 truncate max-w-[140px]">
        {p.success ? p.preview : (p.errorMsg ?? "–")}
      </td>
    </tr>
  );
}

// ─── RunRow ───────────────────────────────────────────────────────────────────

function RunRow({ run }: { run: MotherRun }) {
  const [expanded, setExpanded] = useState(false);

  const allOk = run.successCount === run.totalProviders;
  const okBadgeClass = allOk
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : "bg-amber-500/10 text-amber-700 dark:text-amber-400";

  return (
    <div className="rounded-lg border border-border/25 bg-background/50 overflow-hidden">
      {/* Header / trigger row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-muted/20 transition-colors"
      >
        {/* Expand caret */}
        <span className="text-[10px] text-muted-foreground/50 mt-0.5 shrink-0 w-3">
          {expanded ? "▼" : "▶"}
        </span>

        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          {/* Top line */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10.5px] font-semibold text-foreground/90 shrink-0">
              #{run.iteration}
            </span>
            <span className="text-[9px] font-mono text-gray-500 ml-1">#{run.runId.slice(0, 8)}</span>
            <span className="text-[10px] text-muted-foreground/60 truncate flex-1 min-w-0">
              {run.intent || run.query}
            </span>
            <span className="text-[9.5px] text-muted-foreground/50 shrink-0">
              {formatTime(run.timestamp)}
            </span>
          </div>

          {/* Bottom line */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9.5px] font-medium rounded px-1.5 py-0.5 ${okBadgeClass}`}>
              {run.successCount}/{run.totalProviders} ok
            </span>
            {run.fastestProvider && (
              <span className="text-[9.5px] text-muted-foreground/60 truncate">
                fastest:{" "}
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  ⚡ {PROVIDER_LABEL[run.fastestProvider] ?? run.fastestProvider}
                </span>
                {run.providers.find((p) => p.providerId === run.fastestProvider || p.providerName === run.fastestProvider)?.latencyMs != null && (
                  <span>
                    {" "}({run.providers.find((p) => p.providerId === run.fastestProvider || p.providerName === run.fastestProvider)!.latencyMs}ms)
                  </span>
                )}
              </span>
            )}
            {run.totalEstimatedCostUsd != null && run.totalEstimatedCostUsd > 0 && (
              <span
                className="text-[9.5px] text-amber-600 dark:text-amber-400 font-mono shrink-0"
                title="Estimated input cost for this dispatch run"
              >
                💰 ${run.totalEstimatedCostUsd.toFixed(5)}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border/20 px-3 pb-2">
          {run.providers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[300px]">
                <thead>
                  <tr>
                    <th className="py-1 px-2 text-left text-[9.5px] font-semibold text-muted-foreground/60 uppercase tracking-wide">
                      Provider
                    </th>
                    <th className="py-1 px-2 text-left text-[9.5px] font-semibold text-muted-foreground/60 uppercase tracking-wide">
                      Latency
                    </th>
                    <th className="py-1 px-2 text-left text-[9.5px] font-semibold text-muted-foreground/60 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="py-1 px-2 text-left text-[9.5px] font-semibold text-muted-foreground/60 uppercase tracking-wide">
                      Preview
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {run.providers.map((p) => (
                    <ProviderRow key={p.providerId} p={p} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/50 py-1.5">
              No provider detail available.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MotherDispatchPanel ──────────────────────────────────────────────────────

export default function MotherDispatchPanel() {
  const [runs, setRuns] = useState<MotherRun[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        resolveBackendUrl("/api/mother/history?limit=5"),
        { method: "GET", credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: HistoryResponse = await res.json();
      setRuns(data.runs ?? []);
      setUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    poll();
  }, [poll]);

  // Poll every 10s
  useEffect(() => {
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [poll]);

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-foreground">
          🧠 Mother Dispatch History
        </p>
        <button
          onClick={() => { setLoading(true); poll(); }}
          title="Refresh dispatch history"
          className="rounded-lg border border-border/40 px-2 py-0.5 text-[10.5px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          ↻
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-border/25 bg-background/50 h-[52px] animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2 text-[11px] text-rose-600 dark:text-rose-400">
          ⚠ {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && runs.length === 0 && (
        <p className="text-[11px] text-muted-foreground/60 leading-snug">
          No mother dispatch runs yet. Enable thinking mode (🧠) to start.
        </p>
      )}

      {/* Run list */}
      {!loading && !error && runs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {runs.map((run) => (
            <RunRow key={run.runId} run={run} />
          ))}
        </div>
      )}

      {/* Footer */}
      {updatedAt && !loading && (
        <p className="text-[9.5px] text-muted-foreground/40 text-right">
          polls every 10s · last {formatNow(updatedAt)}
        </p>
      )}
    </div>
  );
}
