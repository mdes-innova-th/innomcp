"use client";
import React, { useState, useEffect, useCallback } from "react";

interface AgentEntry {
  id: string;
  name: string;
  role: string;
  provider: string;
  model: string;
  status: "active" | "standby";
}

const PROVIDER_COLORS: Record<string, string> = {
  "MDES": "text-sky-600 dark:text-sky-400",
  "ThaiLLM": "text-teal-600 dark:text-teal-400",
  "Ollama Local": "text-amber-600 dark:text-amber-400",
  "GPT": "text-green-600 dark:text-green-400",
  "GitHub Copilot": "text-purple-600 dark:text-purple-400",
  "Claude Haiku": "text-orange-600 dark:text-orange-400",
  "Claude Sonnet": "text-rose-600 dark:text-rose-400",
};

/** Resolve backend URL the same way as useAgentEventStream (Next.js :3000 → Express :3011 in dev) */
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

interface LiveStats {
  totalTasks: number;
  avgRating: number | null;
}

const ALL_AGENTS: AgentEntry[] = [
  { id: "concierge",     name: "Concierge",      role: "Thai Responder",        provider: "MDES",           model: "gemma3:12b",        status: "active"  },
  { id: "critic",        name: "Critic",          role: "Quality Verifier",      provider: "MDES",           model: "gemma3:12b",        status: "active"  },
  { id: "stylist",       name: "Stylist",         role: "Language Polish",       provider: "MDES",           model: "gemma3:12b",        status: "active"  },
  { id: "thinker",       name: "Thinker",         role: "Deep Analyzer",         provider: "MDES",           model: "gemma3:12b",        status: "active"  },
  { id: "researcher",    name: "Researcher",      role: "Fact Finder",           provider: "MDES",           model: "gemma3:12b",        status: "active"  },
  { id: "fact-checker",  name: "Fact Checker",    role: "Accuracy Guard",        provider: "MDES",           model: "gemma3:12b",        status: "active"  },
  { id: "linguist",      name: "Linguist",        role: "Thai Language Expert",  provider: "ThaiLLM",        model: "gemma3:12b",        status: "active"  },
  { id: "domain-expert", name: "Domain Expert",   role: "Specialist Insight",    provider: "MDES",           model: "gemma3:12b",        status: "active"  },
  { id: "weather",       name: "Weather Analyst", role: "Weather & Climate",     provider: "MDES",           model: "llama3.1:8b",       status: "active"  },
  { id: "geo-planner",   name: "Geo Planner",     role: "Route & Geography",     provider: "MDES",           model: "llama3.1:8b",       status: "active"  },
  { id: "rag-agent",     name: "RAG Agent",       role: "Knowledge Retrieval",   provider: "MDES",           model: "gemma3:12b",        status: "active"  },
  { id: "tool-scout",    name: "Tool Scout",      role: "Tool Selector",         provider: "MDES",           model: "gemma3:12b",        status: "active"  },
  { id: "gpt-advisor",   name: "GPT Advisor",     role: "External Fallback",     provider: "GPT",            model: "gpt-4o-mini",       status: "standby" },
  { id: "copilot-coder", name: "Copilot Coder",   role: "Code Generation",       provider: "GitHub Copilot", model: "gpt-4o",            status: "standby" },
  { id: "claude-haiku",  name: "Claude Haiku",    role: "Fast Thai Responder",   provider: "Claude Haiku",   model: "claude-haiku-4-5",  status: "standby" },
  { id: "claude-sonnet", name: "Claude Sonnet",   role: "Complex Reasoning",     provider: "Claude Sonnet",  model: "claude-sonnet-4-6", status: "standby" },
];

/** Compute score for an agent. Per-agent stats not available from /api/stats,
 *  so tasks=0 and avgMs=0 are used, making score purely status-driven. */
function agentScore(agent: AgentEntry): number {
  const tasks = 0;
  const avgMs = 0;
  return tasks * 10 + (agent.status === "active" ? 50 : 0) - avgMs / 100;
}

/** Format a Date as HH:MM:SS */
function formatTime(d: Date): string {
  return d.toTimeString().slice(0, 8);
}

export default function AgentLeaderboard({ onClose }: { onClose?: () => void }) {
  const [filter, setFilter] = useState<"all" | "active" | "standby">("all");
  const [liveStats, setLiveStats] = useState<LiveStats>({ totalTasks: 0, avgRating: null });
  const [sortByScore, setSortByScore] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = useCallback(() => {
    const url = resolveBackendUrl("/api/stats");
    fetch(url, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const completed = (d.tasks as Array<{ status: string; count: number }> ?? [])
          .find((t) => t.status === "completed");
        setLiveStats({
          totalTasks: completed ? Number(completed.count) : 0,
          avgRating: d.feedback?.avg_rating != null ? Number(d.feedback.avg_rating) : null,
        });
        setLastUpdated(new Date());
      })
      .catch(() => {/* non-critical */});
  }, []);

  useEffect(() => {
    fetchStats();
    const id = setInterval(() => fetchStats(), 30_000);
    return () => clearInterval(id);
  }, [fetchStats]);

  const providers = Array.from(new Set(ALL_AGENTS.map((a) => a.provider)));
  const active = ALL_AGENTS.filter((a) => a.status === "active").length;
  const standby = ALL_AGENTS.filter((a) => a.status === "standby").length;

  const filtered = filter === "all" ? ALL_AGENTS : ALL_AGENTS.filter((a) => a.status === filter);
  const visible = sortByScore
    ? [...filtered].sort((a, b) => agentScore(b) - agentScore(a))
    : filtered;

  /** Export the current visible list as a CSV download */
  function exportCSV() {
    const header = "#,Agent,Provider,Model,Role,Tasks,Avg ms,Score,Status";
    const rows = visible.map((agent, i) =>
      [
        i + 1,
        `"${agent.name}"`,
        `"${agent.provider}"`,
        `"${agent.model}"`,
        `"${agent.role}"`,
        "–",
        "–",
        Math.round(agentScore(agent)),
        agent.status,
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

  return (
    <div className="flex flex-col gap-3 p-1">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-semibold text-foreground">Agent Leaderboard</p>
          <p className="text-[10.5px] text-muted-foreground">{active} active · {standby} standby · {ALL_AGENTS.length} total</p>
        </div>
        {onClose && <button onClick={onClose} className="text-muted-foreground/60 hover:text-foreground text-base leading-none">✕</button>}
      </div>

      {/* Provider legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {providers.map((p) => (
          <span key={p} className={`text-[10px] font-medium ${PROVIDER_COLORS[p] ?? "text-muted-foreground"}`}>
            ● {p}
          </span>
        ))}
      </div>

      {/* Live stats bar */}
      {(liveStats.totalTasks > 0 || liveStats.avgRating != null) && (
        <div className="flex gap-3 text-[10.5px] text-muted-foreground border border-border/30 rounded-lg px-2.5 py-1.5 bg-muted/20">
          {liveStats.totalTasks > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {liveStats.totalTasks} tasks completed
            </span>
          )}
          {liveStats.avgRating != null && (
            <span className="text-amber-600 dark:text-amber-400 font-medium tabular-nums">
              ★ {liveStats.avgRating.toFixed(1)} avg rating
            </span>
          )}
        </div>
      )}

      {/* Filter tabs + Sort + Export */}
      <div className="flex items-center gap-1 flex-wrap">
        {(["all", "active", "standby"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded px-2 py-0.5 text-[10.5px] transition-colors ${filter === f ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}>
            {f === "all" ? `All (${ALL_AGENTS.length})` : f === "active" ? `Active (${active})` : `Standby (${standby})`}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setSortByScore((s) => !s)}
            className={`rounded px-2 py-0.5 text-[10.5px] transition-colors border ${sortByScore ? "border-primary/40 bg-primary/10 text-primary font-medium" : "border-border/40 text-muted-foreground hover:text-foreground"}`}
          >
            Sort by score
          </button>
          <button
            onClick={exportCSV}
            className="rounded px-2 py-0.5 text-[10.5px] border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            ⬇ CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border/40">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border/40 bg-muted/20 text-[10.5px] text-muted-foreground">
              <th scope="col" className="px-2.5 py-1.5 text-left font-medium">#</th>
              <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Agent</th>
              <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Provider</th>
              <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Model</th>
              <th scope="col" className="px-2.5 py-1.5 text-right font-medium">Tasks</th>
              <th scope="col" className="px-2.5 py-1.5 text-right font-medium">Avg ms</th>
              <th scope="col" className="px-2.5 py-1.5 text-right font-medium">Score</th>
              <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Role</th>
              <th scope="col" className="px-2.5 py-1.5 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="text-[11px]">
            {visible.map((agent, i) => (
              <tr key={agent.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                <td className="px-2.5 py-1.5 text-muted-foreground/50 tabular-nums">{i + 1}</td>
                <td className="px-2.5 py-1.5 font-medium text-foreground">{agent.name}</td>
                <td className={`px-2.5 py-1.5 font-medium text-[10.5px] ${PROVIDER_COLORS[agent.provider] ?? "text-muted-foreground"}`}>{agent.provider}</td>
                <td className="px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">{agent.model}</td>
                {/* Tasks — no per-agent breakdown available */}
                <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground/60">–</td>
                {/* Avg ms — no per-agent breakdown available */}
                <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground/60">–</td>
                {/* Score */}
                <td className="px-2.5 py-1.5 text-right tabular-nums font-medium text-foreground">
                  {Math.round(agentScore(agent))}
                </td>
                <td className="px-2.5 py-1.5 text-muted-foreground">{agent.role}</td>
                <td className="px-2.5 py-1.5 text-center">
                  {agent.status === "active" ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium bg-muted/40 text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                      Standby
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Last updated timestamp */}
      {lastUpdated && (
        <p className="text-[10px] text-muted-foreground text-right">
          Last updated: {formatTime(lastUpdated)}
        </p>
      )}
    </div>
  );
}
