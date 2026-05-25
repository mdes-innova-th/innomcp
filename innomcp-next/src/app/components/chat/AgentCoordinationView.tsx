"use client";

import { useMemo } from "react";
import type { AgentEvent } from "./useAgentEventStream";

interface AgentRun {
  agentId: string;
  displayName: string;
  startedAt: number;
  finishedAt?: number;
  status: "running" | "done" | "error";
  publicSummary?: string;
}

interface CoordinationViewProps {
  events: AgentEvent[];
  isStreaming: boolean;
}

function cleanAgentId(agentId: string): string {
  // Convert snake_case / kebab-case to Title Case
  return agentId
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseTimestamp(ts: string): number {
  const n = Date.parse(ts);
  return isNaN(n) ? Date.now() : n;
}

export default function AgentCoordinationView({ events, isStreaming }: CoordinationViewProps) {
  const agentRuns = useMemo<AgentRun[]>(() => {
    const map = new Map<string, AgentRun>();

    for (const ev of events) {
      if (ev.type === "agent_started" && ev.agentId) {
        if (!map.has(ev.agentId)) {
          map.set(ev.agentId, {
            agentId: ev.agentId,
            displayName: cleanAgentId(ev.agentId),
            startedAt: parseTimestamp(ev.timestamp),
            status: "running",
            publicSummary: ev.publicSummary || undefined,
          });
        }
      } else if (ev.type === "agent_finished" && ev.agentId) {
        const existing = map.get(ev.agentId);
        if (existing) {
          map.set(ev.agentId, {
            ...existing,
            finishedAt: parseTimestamp(ev.timestamp),
            status: "done",
            publicSummary: ev.publicSummary || existing.publicSummary,
          });
        }
      } else if (ev.type === "error" && ev.agentId) {
        const existing = map.get(ev.agentId);
        if (existing) {
          map.set(ev.agentId, {
            ...existing,
            finishedAt: parseTimestamp(ev.timestamp),
            status: "error",
          });
        }
      }
    }

    return Array.from(map.values());
  }, [events]);

  if (agentRuns.length === 0) return null;

  const now = Date.now();
  const activeCount = agentRuns.filter((r) => r.status === "running").length;
  const headerCount = isStreaming && activeCount > 0 ? activeCount : agentRuns.length;

  return (
    <div className="mt-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span>🤖</span>
        <span>Agent Coordination ({headerCount} agent{headerCount !== 1 ? "s" : ""} active)</span>
      </div>
      <ul className="space-y-1.5">
        {agentRuns.map((run) => {
          const durationMs = (run.finishedAt ?? now) - run.startedAt;
          const durationLabel = `${(durationMs / 1000).toFixed(1)}s`;
          const summary = run.publicSummary
            ? run.publicSummary.length > 50
              ? run.publicSummary.slice(0, 50) + "…"
              : run.publicSummary
            : undefined;

          const dotColor =
            run.status === "running"
              ? "bg-blue-500 animate-pulse"
              : run.status === "done"
              ? "bg-emerald-500"
              : "bg-rose-500";

          return (
            <li
              key={run.agentId}
              className="flex items-center gap-2 text-[11.5px]"
            >
              <span
                className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${dotColor}`}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                {run.displayName}
              </span>
              <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {durationLabel}
              </span>
              {summary && (
                <span className="ml-1 min-w-0 flex-1 truncate text-[10.5px] text-muted-foreground/70">
                  {summary}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
