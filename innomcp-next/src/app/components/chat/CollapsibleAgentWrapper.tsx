"use client";

import React, { useState, useEffect } from "react";
import MultiAgentPanel from "./MultiAgentPanel";
import type { AgentEvent, StreamStatus } from "./useAgentEventStream";

interface CollapsibleAgentWrapperProps {
  events: AgentEvent[];
  status: StreamStatus;
  expandAll?: boolean;
  onToggleExpandAll?: () => void;
  className?: string;
}

function countActiveAgents(events: AgentEvent[]): number {
  const agents = new Set(events.filter(e => e.agentId && e.agentId !== "conductor" && e.agentId !== "broker").map(e => e.agentId!));
  return agents.size || 0;
}

function getLatestModel(events: AgentEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].model) return events[i].model!;
  }
  return null;
}

function getTotalElapsed(events: AgentEvent[]): number {
  if (events.length < 2) return 0;
  try {
    const first = new Date(events[0].timestamp).getTime();
    const last  = new Date(events[events.length - 1].timestamp).getTime();
    return Math.round((last - first) / 1000);
  } catch {
    return 0;
  }
}

const CollapsibleAgentWrapper: React.FC<CollapsibleAgentWrapperProps> = ({
  events,
  status,
  expandAll,
  onToggleExpandAll,
  className = "",
}) => {
  const isStreaming = status === "streaming";
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isStreaming) setIsExpanded(true);
    else if (status === "done" && events.length > 0) setIsExpanded(false);
  }, [isStreaming, status, events.length]);

  const agentCount  = countActiveAgents(events);
  const latestModel = getLatestModel(events);
  const elapsed     = getTotalElapsed(events);
  const isDone      = status === "done" && events.some(e => e.type === "final_answer");

  const summaryText = isDone
    ? `ประมวลผลเสร็จแล้ว · ${agentCount > 0 ? `${agentCount} agents` : ""} · ${elapsed}s`
    : isStreaming
    ? `MDES กำลังวิเคราะห์${agentCount > 0 ? ` ${agentCount} ส่วน` : ""}${latestModel ? ` · ${latestModel}` : ""}`
    : `${events.length} events`;

  if (events.length === 0) return null;

  return (
    <div className={`rounded-lg border border-border/60 bg-card overflow-hidden ${className}`}>
      {/* Summary header — always visible */}
      <button
        onClick={() => setIsExpanded(v => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
        aria-expanded={isExpanded}
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            isStreaming ? "animate-pulse bg-indigo-500" : isDone ? "bg-emerald-500" : "bg-muted-foreground/50"
          }`}
          aria-hidden="true"
        />
        <span className="flex-1 truncate text-[12px] text-muted-foreground">
          {summaryText}
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-[11px] text-muted-foreground/60">
          {isExpanded ? "ซ่อน" : "ดูรายละเอียด"}
        </span>
      </button>

      {/* Expandable panel body */}
      <div
        className="agent-panel-collapse"
        style={{ maxHeight: isExpanded ? "600px" : "0px" }}
      >
        <div className="border-t border-border/40">
          <MultiAgentPanel
            events={events}
            status={status}
            expandAll={expandAll}
            onToggleExpandAll={onToggleExpandAll}
            defaultCollapsed={false}
            inline
          />
        </div>
      </div>
    </div>
  );
};

export default CollapsibleAgentWrapper;
