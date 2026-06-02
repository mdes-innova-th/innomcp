"use client";
import React, { useState, useEffect, useCallback } from "react";
import LatencySparkline from "./LatencySparkline";
import LeaderboardCard from "./LeaderboardCard";

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
  p95Latency?: number;
  role: string;
  score?: number;
  wins?: number;
  sparkline?: number[];
}

interface LeaderboardResponse {
  agents: AgentEntry[];
  timestamp: string;
  totalAgents: number;
}

// ─── Provider type badge ──────────────────────────────────────────────────────

function getProviderBadge(provider: string): { label: string; cls: string } {
  if (provider === "anthropic")
    return { label: "Claude",   cls: "bg-purple-500/15 text-purple-700 dark:text-purple-300" };
  if (provider === "openai")
    return { label: "GPT",      cls: "bg-emerald-800/15 text-emerald-800 dark:text-emerald-300" };
  if (provider === "mdes-cloud" || provider === "ollama-cloud")
    return { label: "MDES",     cls: "bg-orange-500/15 text-orange-700 dark:text-orange-300" };
  if (provider === "ollama-local")
    return { label: "Local",    cls: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300" };
  if (provider === "github" || provider === "copilot")
    return { label: "Copilot",  cls: "bg-zinc-900/10 text-zinc-800 dark:text-zinc-200" };
  if (provider === "google")
    return { label: "Gemini",   cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300" };
  if (provider === "mistral")
    return { label: "Mistral",  cls: "bg-red-900/15 text-red-900 dark:text-red-300" };
  if (provider === "deepseek")
    return { label: "DeepSeek", cls: "bg-teal-500/15 text-teal-700 dark:text-teal-300" };
  if (provider === "groq")
    return { label: "Groq",     cls: "bg-orange-500/15 text-orange-700 dark:text-orange-300" };
  if (provider === "together")
    return { label: "Together", cls: "bg-violet-500/15 text-violet-700 dark:text-violet-300" };
  if (provider === "meta")
    return { label: "Meta",     cls: "bg-slate-500/15 text-slate-700 dark:text-slate-300" };
  if (provider === "innova-bot")
    return { label: "Innova",   cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" };
  if (provider === "innova-oracle")
    return { label: "Oracle",    cls: "bg-emerald-700/15 text-emerald-800 dark:text-emerald-200" };
  return { label: provider,     cls: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300" };
}

// ─── Provider display label map ───────────────────────────────────────────────

const PROVIDER_LABEL: Record<string, string> = {
  "mdes-cloud":    "MDES",
  "thai-llm":      "ThaiLLM",
  "ollama-local":  "Local",
  "openai-gpt":    "GPT",
  "claude-haiku":  "Haiku",
  "claude-sonnet": "Sonnet",
  "copilot":       "Copilot",
  "gemini-pro":    "Gemini",
  "mistral-large": "Mistral",
  "deepseek-r1":   "DeepSeek",
  "groq-llama":    "Groq",
  "together-llama":"Together",
  "innova-bot":    "Innova",
  "innova-oracle": "Oracle",
};

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
  "innova-bot":    "text-emerald-600 dark:text-emerald-400",
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgentLeaderboard({
  onClose,
  motherActive = false,
}: {
  onClose?: () => void;
  motherActive?: boolean;
}) {
  const activeInterval = motherActive ? 5 : 30;

  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [totalAgents, setTotalAgents] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(activeInterval);
  const [filter, setFilter] = useState<"all" | "online" | "configured" | "checking" | "offline">("all");
  const [sortBy, setSortBy] = useState<"requests" | "latency" | "success" | "score" | "wins">(
    motherActive ? "wins" : "requests"
  );
  const [rosterEligible, setRosterEligible] = useState<number | null>(null);

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
        setCountdown(activeInterval);
        // Also fetch roster key-availability count
        const rosterUrl = url.replace("agent-leaderboard", "mother/roster");
        fetch(rosterUrl, { credentials: "include" })
          .then((r) => r.ok ? r.json() : null)
          .then((d) => { if (d?.eligibleCount != null) setRosterEligible(d.eligibleCount); })
          .catch(() => {});
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInterval]);

  // Initial fetch + auto-refresh (5s when motherActive, 30s otherwise)
  useEffect(() => {
    fetchLeaderboard();
    const id = setInterval(() => fetchLeaderboard(), activeInterval * 1000);
    return () => clearInterval(id);
  }, [fetchLeaderboard, activeInterval]);

  // Countdown tick (every second)
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((c) => (c <= 1 ? activeInterval : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [activeInterval]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const statuses = Array.from(new Set(agents.map((a) => a.status)));
  const providers = Array.from(new Set(agents.map((a) => a.provider)));

  const filtered =
    filter === "all" ? agents : agents.filter((a) => a.status === filter);

  const visible = [...filtered].sort((a, b) => {
    if (sortBy === "latency") return (a.avgLatency || Infinity) - (b.avgLatency || Infinity);
    if (sortBy === "success") return b.successRate - a.successRate;
    if (sortBy === "score") return (b.score ?? 0) - (a.score ?? 0);
    if (sortBy === "wins") return (b.wins ?? 0) - (a.wins ?? 0);
    return b.requests - a.requests; // default: most requests first
  });

  const activeCount = visible.filter(a => a.requests > 0).length;
  const fastestAgent = visible.filter(a => a.requests > 0 && a.avgLatency > 0)
    .sort((a, b) => a.avgLatency - b.avgLatency)[0];
  const topWinner = visible.filter(a => (a.wins ?? 0) > 0)
    .sort((a, b) => (b.wins ?? 0) - (a.wins ?? 0))[0];

  // Top performer: first agent (in sort order) with at least one request
  const topAgent = visible.find((a) => a.requests > 0);

  // ── Export CSV ────────────────────────────────────────────────────────────

  function exportCSV() {
    const header = "#,Agent,Provider,Model,Status,Requests,Avg Latency,Trend,Success%,Score,Wins,Role";
    const rows = visible.map((a, i) =>
      [
        i + 1,
        `"${a.name}"`,
        `"${a.provider}"`,
        `"${a.model}"`,
        a.status,
        a.requests,
        formatLatency(a.avgLatency),
        (a.sparkline ?? []).join('|'),
        `${a.successRate}%`,
        a.score?.toFixed(1) ?? "—",
        (a as AgentEntry & { wins?: number }).wins ?? 0,
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
      {/* Mother Mode banner */}
      {motherActive && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"
            aria-hidden="true"
          />
          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            🧠 Mother dispatch active — 11 providers in parallel
          </span>
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-semibold text-foreground leading-tight">
            Agent Leaderboard
            {rosterEligible !== null && (
              <span className="ml-2 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full px-2 py-0.5 font-medium">
                {rosterEligible}/13 ready
              </span>
            )}
          </p>
          <p className="text-[10.5px] text-muted-foreground mt-0.5">
            {totalAgents > 0 ? `${totalAgents} agents` : "Loading…"}
            {" · "}
            <span className="tabular-nums">
              Refreshing in {countdown}s
            </span>
          </p>
          {/* Aggregate stats row */}
          {activeCount > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground mt-0.5">
              <span>{activeCount} active</span>
              {fastestAgent && (
                <span>⚡ {PROVIDER_LABEL[fastestAgent.id] ?? fastestAgent.name} ({formatLatency(fastestAgent.avgLatency)})</span>
              )}
              {topWinner && (
                <span>🏆 {PROVIDER_LABEL[topWinner.id] ?? topWinner.name} ({topWinner.wins} wins)</span>
              )}
            </div>
          )}
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
          {(["wins", "score", "requests", "latency", "success"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`rounded px-1.5 py-0.5 text-[10px] border transition-colors ${
                sortBy === s
                  ? "border-primary/40 bg-primary/10 text-primary font-medium"
                  : "border-border/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "wins" ? "🏆 Wins" : s === "score" ? "↓ Score" : s === "requests" ? "↓ Req" : s === "latency" ? "↑ Lat" : "↓ Succ"}
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
        <>
        {/* Mobile card grid (hidden on sm+) */}
        <div className="sm:hidden px-1 pb-2 space-y-2">
          {visible.map((agent, i) => (
            <LeaderboardCard
              key={agent.id}
              agent={agent}
              rank={i + 1}
              badge={getProviderBadge(agent.provider)}
              statusDot={STATUS_CONFIG[agent.status]?.dot ?? "🔵"}
            />
          ))}
        </div>
        <div className="hidden sm:block overflow-x-auto rounded-lg border border-border/40">
          <table className="w-full min-w-[780px]">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20 text-[10px] text-muted-foreground">
                <th scope="col" className="px-2 py-1.5 text-left font-medium w-6">#</th>
                <th scope="col" className="px-2 py-1.5 text-left font-medium">Agent</th>
                <th scope="col" className="px-2 py-1.5 text-left font-medium">Provider</th>
                <th scope="col" className="px-2 py-1.5 text-left font-medium">Model</th>
                <th scope="col" className="px-2 py-1.5 text-center font-medium">Status</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Requests</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Avg Latency</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium w-16">Trend</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">P95</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Success%</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium w-14">Score</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium w-10">Wins</th>
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
                    className={`border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors${
                      topAgent && agent.id === topAgent.id ? " border-l-2 border-yellow-400" : ""
                    }`}
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
                      <span className="flex items-center gap-1">
                        {agent.provider}
                        {(() => {
                          const badge = getProviderBadge(agent.provider);
                          return (
                            <span
                              className={`rounded px-1 py-0.5 text-[8.5px] font-semibold leading-none ${badge.cls}`}
                            >
                              {badge.label}
                            </span>
                          );
                        })()}
                      </span>
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
                    {/* Sparkline trend */}
                    <td className="px-2 py-1.5 text-right">
                      <LatencySparkline samples={agent.sparkline ?? []} />
                    </td>
                    {/* P95 Latency */}
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {agent.p95Latency !== undefined ? formatLatency(agent.p95Latency) : "–"}
                    </td>
                    {/* Success% */}
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {agent.successRate >= 95 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {agent.successRate}%
                        </span>
                      ) : agent.successRate >= 80 ? (
                        <span className="text-yellow-600 dark:text-yellow-400">
                          {agent.successRate}%
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400">
                          {agent.successRate}%
                        </span>
                      )}
                    </td>
                    {/* Score */}
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                      {agent.score !== undefined ? (
                        <span
                          className={
                            agent.score > 60
                              ? "text-emerald-600 dark:text-emerald-400"
                              : agent.score >= 40
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-muted-foreground/60"
                          }
                        >
                          {agent.score.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    {/* Wins */}
                    <td className="px-2 py-1.5 text-right tabular-nums text-[11px]">
                      {agent.wins != null && agent.wins > 0 ? (
                        <span className="text-yellow-600 dark:text-yellow-400 font-medium">🏆 {agent.wins}</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
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
                    colSpan={13}
                    className="px-2 py-4 text-center text-muted-foreground text-[11px]"
                  >
                    No agents match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>
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
