"use client";
import React, { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentEntry {
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

interface LeaderboardResponse {
  agents: AgentEntry[];
  timestamp: string;
  totalAgents: number;
}

// ─── Provider colour map (consistent with previous component) ─────────────────

const PROVIDER_COLORS: Record<string, string> = {
  "mdes-cloud":    "text-sky-600 dark:text-sky-400",
  "anthropic":     "text-rose-600 dark:text-rose-400",
  "openai":        "text-green-600 dark:text-green-400",
  "github":        "text-purple-600 dark:text-purple-400",
  "ollama-local":  "text-amber-600 dark:text-amber-400",
  "ollama-cloud":  "text-teal-600 dark:text-teal-400",
  "google":        "text-blue-600 dark:text-blue-400",
  "mistral":       "text-orange-600 dark:text-orange-400",
  "meta":          "text-indigo-600 dark:text-indigo-400",
  "deepseek":      "text-cyan-600 dark:text-cyan-400",
};

// ─── Status indicator ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { dot: string; label: string; badge: string }> = {
  online:     { dot: "🟢", label: "Online",     badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  configured: { dot: "🔵", label: "Configured", badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  checking:   { dot: "🟡", label: "Checking",   badge: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" },
  offline:    { dot: "🔴", label: "Offline",    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-400" },
};

// ─── URL resolution — same pattern as the rest of the app ────────────────────
// Next.js on :3000 has no rewrites for /api/agent-leaderboard so we hit
// the Express backend on :3011 directly in development.

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

function formatLatency(ms: number): string {
  if (ms <= 0) return "–";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function formatTime(d: Date): string {
  return d.toTimeString().slice(0, 8);
}

const REFRESH_INTERVAL = 30;

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgentLeaderboard({ onClose }: { onClose?: () => void }) {
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [totalAgents, setTotalAgents] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [filter, setFilter] = useState<"all" | "online" | "configured" | "checking" | "offline">("all");
  const [sortBy, setSortBy] = useState<"requests" | "latency" | "success">("requests");

  // ── Fetch leaderboard data ──────────────────────────────────────────────────
  const fetchLeaderboard = useCallback(() => {
    const url = resolveBackendUrl("/api/agent-leaderboard");
    fetch(url, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<LeaderboardResponse>;
      })
      .then((data) => {
        setAgents(data.agents ?? []);
        setTotalAgents(data.totalAgents ?? data.agents?.length ?? 0);
        setLastUpdated(new Date());
        setError(null);
        setCountdown(REFRESH_INTERVAL);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, []);

  // Initial fetch + 30-second auto-refresh
  useEffect(() => {
    fetchLeaderboard();
    const id = setInterval(() => fetchLeaderboard(), REFRESH_INTERVAL * 1000);
    return () => clearInterval(id);
  }, [fetchLeaderboard]);

  // Countdown tick (every second)
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((c) => (c <= 1 ? REFRESH_INTERVAL : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Derived data ───────────────────────────────────────────────────────────

  const statuses = Array.from(new Set(agents.map((a) => a.status)));
  const providers = Array.from(new Set(agents.map((a) => a.provider)));

  const filtered =
    filter === "all" ? agents : agents.filter((a) => a.status === filter);

  const visible = [...filtered].sort((a, b) => {
    if (sortBy === "latency") return (a.avgLatency || Infinity) - (b.avgLatency || Infinity);
    if (sortBy === "success") return b.successRate - a.successRate;
    return b.requests - a.requests; // default: most requests first
  });

  // ── Export CSV ────────────────────────────────────────────────────────────

  function exportCSV() {
    const header = "#,Agent,Provider,Model,Status,Requests,Avg Latency,Success%,Role";
    const rows = visible.map((a, i) =>
      [
        i + 1,
        `"${a.name}"`,
        `"${a.provider}"`,
        `"${a.model}"`,
        a.status,
        a.requests,
        formatLatency(a.avgLatency),
        `${a.successRate}%`,
        `"${a.role}"`,
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-leaderboard-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2 p-1">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-semibold text-foreground leading-tight">
            Agent Leaderboard
          </p>
          <p className="text-[10.5px] text-muted-foreground mt-0.5">
            {totalAgents > 0 ? `${totalAgents} agents` : "Loading…"}
            {" · "}
            <span className="tabular-nums">
              Refreshing in {countdown}s
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={fetchLeaderboard}
            title="Refresh now"
            className="rounded px-1.5 py-0.5 text-[10px] border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            ↻
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground/60 hover:text-foreground text-base leading-none"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Provider legend */}
      {providers.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {providers.map((p) => (
            <span
              key={p}
              className={`text-[9.5px] font-medium ${PROVIDER_COLORS[p] ?? "text-muted-foreground"}`}
            >
              ● {p}
            </span>
          ))}
        </div>
      )}

      {/* Filter + Sort + Export controls */}
      <div className="flex items-center gap-1 flex-wrap">
        {(["all", ...statuses] as const).map((f) => {
          const count =
            f === "all" ? agents.length : agents.filter((a) => a.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f as typeof filter)}
              className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                filter === f
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? `All (${count})` : `${STATUS_CONFIG[f]?.dot ?? ""} ${f} (${count})`}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-1">
          {(["requests", "latency", "success"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`rounded px-1.5 py-0.5 text-[10px] border transition-colors ${
                sortBy === s
                  ? "border-primary/40 bg-primary/10 text-primary font-medium"
                  : "border-border/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "requests" ? "↓ Req" : s === "latency" ? "↑ Lat" : "↓ Succ"}
            </button>
          ))}
          <button
            onClick={exportCSV}
            className="rounded px-1.5 py-0.5 text-[10px] border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            ⬇ CSV
          </button>
        </div>
      </div>

      {/* Loading / Error states */}
      {loading && (
        <p className="text-[11px] text-muted-foreground text-center py-4">
          Loading leaderboard…
        </p>
      )}
      {!loading && error && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-600 dark:text-rose-400">
          Failed to load: {error}
          <button
            onClick={fetchLeaderboard}
            className="ml-2 underline opacity-70 hover:opacity-100"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-border/40">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20 text-[10px] text-muted-foreground">
                <th scope="col" className="px-2 py-1.5 text-left font-medium w-6">#</th>
                <th scope="col" className="px-2 py-1.5 text-left font-medium">Agent</th>
                <th scope="col" className="px-2 py-1.5 text-left font-medium">Provider</th>
                <th scope="col" className="px-2 py-1.5 text-left font-medium">Model</th>
                <th scope="col" className="px-2 py-1.5 text-center font-medium">Status</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Requests</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Avg Latency</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Success%</th>
                <th scope="col" className="px-2 py-1.5 text-left font-medium">Role</th>
              </tr>
            </thead>
            <tbody className="text-[10.5px]">
              {visible.map((agent, i) => {
                const sc = STATUS_CONFIG[agent.status] ?? {
                  dot: "⚪",
                  label: agent.status,
                  badge: "bg-muted/40 text-muted-foreground",
                };
                return (
                  <tr
                    key={agent.id}
                    className="border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    {/* # */}
                    <td className="px-2 py-1.5 text-muted-foreground/50 tabular-nums">
                      {i + 1}
                    </td>
                    {/* Agent */}
                    <td className="px-2 py-1.5 font-medium text-foreground whitespace-nowrap">
                      {agent.requests > 0 && i === 0 ? "🏆 " : ""}{agent.name}
                    </td>
                    {/* Provider */}
                    <td
                      className={`px-2 py-1.5 font-medium text-[10px] whitespace-nowrap ${
                        PROVIDER_COLORS[agent.provider] ?? "text-muted-foreground"
                      }`}
                    >
                      {agent.provider}
                    </td>
                    {/* Model */}
                    <td className="px-2 py-1.5 font-mono text-[9.5px] text-muted-foreground whitespace-nowrap">
                      {agent.model}
                    </td>
                    {/* Status */}
                    <td className="px-2 py-1.5 text-center">
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium whitespace-nowrap ${sc.badge}`}
                      >
                        {sc.dot} {sc.label}
                      </span>
                    </td>
                    {/* Requests */}
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {agent.requests > 0 ? (
                        <span className="font-medium text-foreground">{agent.requests}</span>
                      ) : (
                        <span className="text-muted-foreground/50">–</span>
                      )}
                    </td>
                    {/* Avg Latency */}
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {formatLatency(agent.avgLatency)}
                    </td>
                    {/* Success% */}
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {agent.successRate >= 90 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {agent.successRate}%
                        </span>
                      ) : agent.successRate >= 70 ? (
                        <span className="text-yellow-600 dark:text-yellow-400">
                          {agent.successRate}%
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400">
                          {agent.successRate}%
                        </span>
                      )}
                    </td>
                    {/* Role */}
                    <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                      {agent.role}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-2 py-4 text-center text-muted-foreground text-[11px]"
                  >
                    No agents match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer: last updated */}
      {lastUpdated && (
        <p className="text-[9.5px] text-muted-foreground text-right">
          Last updated: {formatTime(lastUpdated)}
        </p>
      )}
    </div>
  );
}
