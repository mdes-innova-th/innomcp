"use client";
import { useMemo, useState } from "react";
import type { AgentEvent, StreamStatus } from "./useAgentEventStream";

const AGENT_LABEL_TH: Record<string, string> = {
  conductor: "ผู้กำกับงาน",
  concierge: "ผู้เรียบเรียงคำตอบ",
  "tool-scout": "ผู้เลือกเครื่องมือ",
  "weather-analyst": "นักวิเคราะห์อากาศ",
  "geo-planner": "นักวางแผนพื้นที่",
  "rag-agent": "ผู้สืบค้นความรู้",
  critic: "ผู้ตรวจสอบ",
  stylist: "ผู้ขัดเกลาภาษา",
  broker: "ผู้คัดเลือกบริการ",
  scribe: "ผู้บันทึกความจำ",
};

interface AgentState {
  agentId: string;
  status: "active" | "done" | "error";
  events: AgentEvent[];
  lastSummary: string;
  toolNames: string[];
}

interface Props {
  events: AgentEvent[];
  status: StreamStatus;
  expandAll?: boolean;
  onToggleExpandAll?: () => void;
}

export default function MultiAgentPanel({
  events,
  status,
  expandAll = false,
  onToggleExpandAll,
}: Props) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  const agentMap = useMemo(() => {
    const map = new Map<string, AgentState>();
    for (const ev of events) {
      if (!ev.agentId || ev.agentId === "conductor" || ev.agentId === "broker") continue;
      if (!map.has(ev.agentId)) {
        map.set(ev.agentId, {
          agentId: ev.agentId,
          status: "active",
          events: [],
          lastSummary: "",
          toolNames: [],
        });
      }
      const s = map.get(ev.agentId)!;
      s.events.push(ev);
      if (ev.publicSummary) s.lastSummary = ev.publicSummary;
      if (
        ev.type === "tool_call_started" &&
        ev.toolName &&
        !s.toolNames.includes(ev.toolName)
      ) {
        s.toolNames.push(ev.toolName);
      }
      if (ev.type === "fallback" || ev.type === "error") {
        s.status = "error";
      } else if ((ev.type as string) === "agent_finished") {
        s.status = "done";
      }
    }
    if (status === "done") {
      for (const [, s] of map) {
        if (s.status === "active") s.status = "done";
      }
    }
    return map;
  }, [events, status]);

  const agents = Array.from(agentMap.values());
  if (status === "idle" && agents.length === 0) return null;

  return (
    <div
      data-testid="multiagent-panel"
      className="mb-2 rounded-lg border border-border/30 bg-card/20 text-xs overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/20 bg-card/30">
        <span className="flex items-center gap-2 font-medium text-foreground/80">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === "streaming"
                ? "animate-pulse bg-emerald-500"
                : status === "error"
                ? "bg-rose-500"
                : "bg-sky-500"
            }`}
          />
          multiagent
          <span className="text-muted-foreground/70">• {agents.length} ตัวแทน</span>
        </span>
        <button
          data-testid="multiagent-expand-all"
          type="button"
          onClick={onToggleExpandAll}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors rounded px-1.5 py-0.5 hover:bg-muted/50"
          title="Ctrl+O"
        >
          {expandAll ? "▾ ซ่อน" : "▸ ดูทั้งหมด"}
          <span className="text-[10px] opacity-60 ml-0.5">[Ctrl+O]</span>
        </button>
      </div>
      {agents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border/10 p-px">
          {agents.map((agent) => {
            const isExpanded = expandAll || expandedAgents.has(agent.agentId);
            return (
              <div
                key={agent.agentId}
                data-testid={`multiagent-agent-${agent.agentId}`}
                className="bg-card/40 px-3 py-2 cursor-pointer hover:bg-card/60 transition-colors"
                onClick={() =>
                  setExpandedAgents((prev) => {
                    const n = new Set(prev);
                    n.has(agent.agentId) ? n.delete(agent.agentId) : n.add(agent.agentId);
                    return n;
                  })
                }
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                      agent.status === "active"
                        ? "animate-pulse bg-emerald-500"
                        : agent.status === "error"
                        ? "bg-rose-500"
                        : "bg-sky-400"
                    }`}
                  />
                  <span className="font-medium text-foreground/85 truncate">
                    {AGENT_LABEL_TH[agent.agentId] ?? agent.agentId}
                  </span>
                  {agent.toolNames.length > 0 && (
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground/70 truncate max-w-[80px]">
                      {agent.toolNames[0]}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-muted-foreground/80 leading-4 line-clamp-2">
                  {agent.lastSummary.substring(0, 80)}
                </p>
                {isExpanded && agent.events.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-border/20 pt-1.5">
                    {agent.events.map((ev, i) => (
                      <li key={i} className="text-muted-foreground/70 leading-4">
                        <span className="text-[10px] font-mono text-muted-foreground/50 mr-1">
                          {ev.type}
                        </span>
                        {ev.publicSummary}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
