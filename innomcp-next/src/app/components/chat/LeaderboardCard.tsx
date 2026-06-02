"use client";
import React from "react";
import LatencySparkline from "./LatencySparkline";

interface AgentCardEntry {
  id: string;
  name: string;
  provider: string;
  model: string;
  status: string;
  requests: number;
  avgLatency: number;
  successRate: number;
  role: string;
  score?: number;
  wins?: number;
  sparkline?: number[];
}

interface Props {
  agent: AgentCardEntry;
  rank: number;
  badge?: { label: string; cls: string };
  statusDot?: string;
}

export default function LeaderboardCard({ agent, rank, badge, statusDot = "🔵" }: Props) {
  const isTop = rank <= 3;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

  return (
    <div className={`rounded-lg border ${isTop ? "border-yellow-200/60 dark:border-yellow-800/40 bg-yellow-50/20 dark:bg-yellow-900/5" : "border-border/50 bg-card"} p-3 space-y-1.5`}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {medal ? (
            <span className="text-base leading-none">{medal}</span>
          ) : (
            <span className="text-xs tabular-nums text-muted-foreground w-4">{rank}</span>
          )}
          <span className="text-[13px] font-medium truncate">{agent.name}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {badge && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.cls}`}>
              {badge.label}
            </span>
          )}
          <span className="text-xs">{statusDot}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-1 text-[10px]">
        <div className="flex flex-col">
          <span className="text-muted-foreground">Req</span>
          <span className="font-medium tabular-nums">{agent.requests}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground">Lat</span>
          <span className="font-medium tabular-nums">
            {agent.avgLatency > 0 ? (agent.avgLatency >= 1000 ? `${(agent.avgLatency/1000).toFixed(1)}s` : `${agent.avgLatency}ms`) : "–"}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground">Succ</span>
          <span className="font-medium tabular-nums">{agent.successRate}%</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground">Wins</span>
          <span className={`font-medium tabular-nums ${(agent.wins ?? 0) > 0 ? "text-yellow-600 dark:text-yellow-400" : ""}`}>
            {agent.wins ?? 0}
          </span>
        </div>
      </div>

      {/* Sparkline row */}
      {(agent.sparkline ?? []).length >= 2 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-muted-foreground">Trend</span>
          <LatencySparkline samples={agent.sparkline!} width={60} height={14} />
        </div>
      )}

      {/* Role */}
      <p className="text-[9px] text-muted-foreground/60 truncate">{agent.role}</p>
    </div>
  );
}
