"use client";
import { useMemo, useState } from "react";
import type { AgentEvent, StreamStatus } from "./useAgentEventStream";

const MDES_MODEL_BADGE: Record<string, string> = {
  "qwen3.5:9b": "Q3.5-9B",
  "qwen3.6:27b": "Q3.6-27B",
  "qwen3.5:27b": "Q3.5-27B",
  "gemma4:e4b": "G4-E4B",
  "gemma4:26b": "G4-26B",
  "z-uo/qwen2.5vl_tools:7b": "VL-7B",
  "qwen2.5-coder:32b": "Coder-32B",
  "claude-haiku-4-5-20251001": "Haiku↑",
  "claude-opus-4-7": "Opus↑↑",
};

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

const AGENT_ROLE_DESC: Record<string, string> = {
  "weather-analyst": "วิเคราะห์สภาพอากาศและแนวโน้ม",
  "geo-planner": "วางแผนพื้นที่และเส้นทาง",
  "rag-agent": "สืบค้นความรู้จากฐานข้อมูล",
  concierge: "เรียบเรียงและสรุปคำตอบ",
  "tool-scout": "เลือกเครื่องมือที่เหมาะสม",
  critic: "ตรวจสอบความถูกต้องและครบถ้วน",
  stylist: "ขัดเกลาภาษาให้ราบรื่น",
  broker: "คัดเลือกผู้ให้บริการ AI",
  conductor: "ประสานงานระหว่างตัวแทน",
  scribe: "จัดเก็บความรู้และบริบท",
};

interface AgentState {
  agentId: string;
  status: "active" | "done" | "error";
  events: AgentEvent[];
  lastSummary: string;
  thinkingText: string;
  toolNames: string[];
  model?: string;
}

interface Props {
  events: AgentEvent[];
  status: StreamStatus;
  expandAll?: boolean;
  onToggleExpandAll?: () => void;
  /** When true (default), the panel renders collapsed by default. */
  defaultCollapsed?: boolean;
  /** Compact mode — slimmer chrome for inline embedding inside a chat bubble. */
  inline?: boolean;
}

export default function MultiAgentPanel({
  events,
  status,
  expandAll = false,
  onToggleExpandAll,
  defaultCollapsed = true,
  inline = false,
}: Props) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<boolean>(!defaultCollapsed);

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
          thinkingText: "",
          toolNames: [],
        });
      }
      const s = map.get(ev.agentId)!;
      s.events.push(ev);

      // Capture model from agent_started events
      if (ev.type === "agent_started" && ev.model) {
        s.model = ev.model;
      }

      // Prefer agent_delta text (actual LLM response) over status messages
      if (ev.type === "agent_delta" && ev.publicSummary && ev.publicSummary.length > 20) {
        s.thinkingText = ev.publicSummary;
      } else if (!s.thinkingText && ev.publicSummary) {
        s.lastSummary = ev.publicSummary;
      }
      
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
  const doneCount = agents.filter((a) => a.status !== "active").length;
  
  if (status === "idle" && agents.length === 0) return null;

  const isOpen = open || expandAll;
  const rootClass = inline
    ? "rounded-md border border-border/40 bg-muted/20 text-xs overflow-hidden"
    : "mb-2 rounded-lg border border-border/30 bg-card/20 text-xs overflow-hidden";

  return (
    <div data-testid="multiagent-panel" className={rootClass}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          onToggleExpandAll?.();
        }}
        className={`w-full flex items-center justify-between gap-2 px-3 ${inline ? "py-1.5" : "py-1.5"} text-left transition-colors hover:bg-card/40`}
        aria-expanded={isOpen}
        data-testid="multiagent-expand-all"
        title="Ctrl+O"
      >
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
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground/80">
            เบื้องหลังการคิด
          </span>
          <span className="text-muted-foreground/70">
            · {agents.length} ตัวแทน
            {status === "streaming" && agents.length > 0 && (
              <> · {doneCount}/{agents.length} เสร็จ</>
            )}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground/70 text-[10px]">
          {isOpen ? "▾ ซ่อน" : "▸ ดู"}
        </span>
      </button>
      {isOpen && agents.length > 0 && status === "streaming" && (
        <div className="h-0.5 bg-card/40 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500/80 to-sky-400/80 transition-all duration-500 ease-out"
            style={{ width: `${Math.round((doneCount / agents.length) * 100)}%` }}
          />
        </div>
      )}
      {isOpen && agents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border/10 p-px">
          {agents.map((agent) => {
            const isExpanded = expandAll || expandedAgents.has(agent.agentId);
            const roleDesc = AGENT_ROLE_DESC[agent.agentId];
            
            // Determine display text
            let displayText = "";
            let isThinking = false;
            if (agent.thinkingText) {
              displayText = agent.thinkingText.substring(0, 150);
            } else if (agent.status === "active") {
              isThinking = true;
              displayText = roleDesc || "กำลังประมวลผล...";
            } else if (agent.lastSummary) {
              displayText = agent.lastSummary.substring(0, 100);
            } else {
              displayText = roleDesc || "พร้อม";
            }
            
            // Status icon
            const statusIcon =
              agent.status === "done" ? "✓" : agent.status === "error" ? "✗" : "";
            
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
                  <span className="font-medium text-foreground/85 truncate flex items-center gap-1">
                    {AGENT_LABEL_TH[agent.agentId] ?? agent.agentId}
                    {statusIcon && (
                      <span
                        className={`text-[10px] ${
                          agent.status === "done"
                            ? "text-sky-400"
                            : "text-rose-400"
                        }`}
                      >
                        {statusIcon}
                      </span>
                    )}
                  </span>
                  {agent.model && (
                    <span className="ml-auto text-[9px] font-mono px-1 py-0.5 rounded bg-sky-500/15 text-sky-400/90 flex-shrink-0">
                      {MDES_MODEL_BADGE[agent.model] ?? agent.model.split(":")[0]}
                    </span>
                  )}
                  {agent.toolNames.length > 0 && (
                    <span className="font-mono text-[10px] text-muted-foreground/70 truncate max-w-[80px]">
                      {agent.toolNames[0]}
                    </span>
                  )}
                </div>
                <p
                  className={`mt-0.5 text-muted-foreground/80 leading-4 line-clamp-2 ${
                    agent.status === "error" ? "text-rose-400/70" : ""
                  }`}
                >
                  {isThinking ? (
                    <>
                      <span className="animate-pulse text-emerald-500/70">กำลังคิด</span>
                      <span className="animate-pulse text-emerald-500/50 inline-block ml-0.5">
                        ⋯
                      </span>
                      <span className="animate-pulse text-emerald-400 ml-0.5">▌</span>
                      <span className="ml-1.5">{displayText}</span>
                    </>
                  ) : (
                    displayText
                  )}
                </p>
                {isExpanded && agent.events.length > 0 && (
                  <div className="mt-2 border-t border-border/20 pt-1.5 space-y-1">
                    {/* Show model info if available */}
                    {agent.model && (
                      <div className="text-[10px] font-mono text-sky-400/60 mb-1">
                        🤖 {agent.model}
                      </div>
                    )}
                    {/* Show thinking text prominently if available */}
                    {agent.thinkingText && (
                      <div className="bg-muted/30 rounded px-2 py-1 text-foreground/80 text-[11px] leading-relaxed">
                        💭 {agent.thinkingText}
                      </div>
                    )}
                    {/* Group events by type */}
                    <ul className="space-y-0.5">
                      {agent.events.map((ev, i) => {
                        if (ev.type === "agent_delta" && agent.thinkingText) return null; // Already shown above
                        return (
                          <li key={i} className="text-muted-foreground/70 leading-4">
                            <span className="text-[10px] font-mono text-muted-foreground/50 mr-1">
                              {ev.type}
                            </span>
                            {ev.publicSummary && (
                              <span className="text-[11px]">{ev.publicSummary}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
