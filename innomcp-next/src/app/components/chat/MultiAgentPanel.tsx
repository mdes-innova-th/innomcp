"use client";
import React, { useMemo, useState } from "react";
import type { AgentEvent, StreamStatus } from "./useAgentEventStream";

const MDES_MODEL_BADGE: Record<string, string> = {
  "qwen3.5:9b": "Q3.5-9B",
  "qwen3.6:27b": "Q3.6-27B",
  "qwen3.5:27b": "Q3.5-27B",
  "gemma4:e4b": "G4-E4B",
  "gemma4:26b": "G4-26B",
  "z-uo/qwen2.5vl_tools:7b": "VL-7B",
  "qwen2.5-coder:32b": "Coder-32B",
  "gpt-5.4": "GPT-5.4",
  "gpt-5.4-mini": "GPT-5.4 Mini",
  "gpt-5.3-codex": "GPT-5.3 Codex",
  "minimax-m2.5:cloud": "MMx-M2.5",
};

// Phase 10.23 — model family → accent color for left-border + badge tint.
// Picks the family by string prefix so unknown models still get a sane default.
function getModelAccent(model?: string): { hex: string; pill: string } {
  const m = (model || "").toLowerCase();
  if (m.startsWith("qwen") || m.includes("qwen2.5vl")) return { hex: "#0ea5e9", pill: "bg-sky-500/15 text-sky-600 dark:text-sky-300" };
  if (m.startsWith("gemma")) return { hex: "#10b981", pill: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" };
  if (m.startsWith("gpt-")) return { hex: "#8b5cf6", pill: "bg-violet-500/15 text-violet-600 dark:text-violet-300" };
  if (m.startsWith("claude")) return { hex: "#f59e0b", pill: "bg-amber-500/15 text-amber-600 dark:text-amber-300" };
  if (m.startsWith("minimax")) return { hex: "#f43f5e", pill: "bg-rose-500/15 text-rose-600 dark:text-rose-300" };
  return { hex: "#64748b", pill: "bg-slate-500/15 text-slate-600 dark:text-slate-300" };
}

const EVENT_LABEL_TH: Record<string, string> = {
  agent_started: "เริ่ม",
  agent_delta: "ร่าง",
  agent_finished: "เสร็จ",
  tool_call_started: "เรียกเครื่องมือ",
  tool_call_finished: "เครื่องมือเสร็จ",
  fact_found: "พบข้อมูล",
  critique: "ตรวจคำตอบ",
  fallback: "ทางสำรอง",
  error: "ผิดพลาด",
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

// Phase 10.28 — role-specific SVG glyphs (16×16 viewBox).
// Tiny, monoline, render in currentColor so they pick up the accent.
function AgentRoleIcon({ agentId, className }: { agentId: string; className?: string }) {
  const common = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const cls = `h-3 w-3 ${className || ""}`;
  switch (agentId) {
    case "weather-analyst":
      // sun + cloud
      return (<svg {...common} className={cls} aria-hidden><circle cx="6" cy="6" r="2.4" /><path d="M11 11.5h-6a2 2 0 0 1 0-4 3 3 0 0 1 5.8.6 1.8 1.8 0 0 1 .2 3.4Z" /></svg>);
    case "geo-planner":
      // pin
      return (<svg {...common} className={cls} aria-hidden><path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14Z" /><circle cx="8" cy="6.3" r="1.5" /></svg>);
    case "rag-agent":
      // magnifying glass over book lines
      return (<svg {...common} className={cls} aria-hidden><circle cx="7" cy="7" r="3.6" /><path d="m10 10 3 3" /></svg>);
    case "concierge":
      // chat bubble with dots
      return (<svg {...common} className={cls} aria-hidden><path d="M2.5 4.5h11v6h-7L4 13v-2.5H2.5z" /><circle cx="6" cy="7.5" r="0.5" fill="currentColor" /><circle cx="8" cy="7.5" r="0.5" fill="currentColor" /><circle cx="10" cy="7.5" r="0.5" fill="currentColor" /></svg>);
    case "tool-scout":
      // wrench
      return (<svg {...common} className={cls} aria-hidden><path d="M11 3a3 3 0 0 1 0 4.2L13 9.5 9.5 13 7.3 11a3 3 0 1 1-4.2-4.2L5 8.5 8.5 5 6.7 3a3 3 0 0 1 4.3 0Z" /></svg>);
    case "critic":
      // shield with check
      return (<svg {...common} className={cls} aria-hidden><path d="M8 2 3 4v4.5C3 11 5 13 8 14c3-1 5-3 5-5.5V4Z" /><path d="m6 8 1.5 1.5L10.5 6.5" /></svg>);
    case "stylist":
      // pen nib
      return (<svg {...common} className={cls} aria-hidden><path d="M3 13 9 7l3.5 3.5L7 16Z" transform="translate(-1 -3)" /><path d="m11 4 1.5 1.5" /></svg>);
    case "broker":
      // intersecting circles (network)
      return (<svg {...common} className={cls} aria-hidden><circle cx="5.5" cy="8" r="3" /><circle cx="10.5" cy="8" r="3" /></svg>);
    case "conductor":
      // baton / node
      return (<svg {...common} className={cls} aria-hidden><circle cx="8" cy="4.5" r="1.6" /><path d="M8 6v8" /><path d="M5 14h6" /></svg>);
    case "scribe":
      // scroll
      return (<svg {...common} className={cls} aria-hidden><path d="M3 4h8v8H3z" /><path d="M11 4h2v8" /><path d="M5 7h4M5 9h3" /></svg>);
    default:
      // generic spark
      return (<svg {...common} className={cls} aria-hidden><path d="M8 2v4M8 10v4M2 8h4M10 8h4" /></svg>);
  }
}

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
  status: "active" | "recovering" | "done" | "error";
  events: AgentEvent[];
  lastSummary: string;
  thinkingText: string;
  toolNames: string[];
  fallbackCount: number;
  lastFallback?: string;
  model?: string;
  /** Epoch ms of the first agent_started event */
  startedAt?: number;
  /** Epoch ms of the most recent finishing event (done / error). */
  finishedAt?: number;
}

/** ms → human-readable ("1.4s", "320ms", "12s"). */
function fmtLatency(ms: number | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
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
          fallbackCount: 0,
        });
      }
      const s = map.get(ev.agentId)!;
      s.events.push(ev);

      // Track started/finished epoch ms for latency display.
      const ts = ev.timestamp ? Date.parse(ev.timestamp) : NaN;
      if (Number.isFinite(ts)) {
        if (ev.type === "agent_started" && s.startedAt == null) s.startedAt = ts;
        if (ev.type === "agent_finished" || ev.type === "error") s.finishedAt = ts;
      }

      // Capture model from agent_started events
      if (ev.type === "agent_started" && ev.model) {
        s.model = ev.model;
        s.status = "active";
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
      if (ev.type === "fallback") {
        s.fallbackCount += 1;
        s.lastFallback = ev.publicSummary || ev.fallbackReason || "";
        s.lastSummary = s.lastFallback;
        if (s.status !== "done") s.status = "recovering";
      } else if (ev.type === "error") {
        s.status = "error";
      } else if ((ev.type as string) === "agent_finished") {
        s.status = "done";
      }
    }
    if (status === "done") {
      for (const [, s] of map) {
        if (s.status === "active") s.status = "done";
        if (s.status === "recovering") s.status = "error";
      }
    }
    return map;
  }, [events, status]);

  const agents = Array.from(agentMap.values());
  const doneCount = agents.filter((a) => a.status === "done").length;
  const recoveringCount = agents.filter((a) => a.status === "recovering").length;
  const errorCount = agents.filter((a) => a.status === "error").length;
  const runSummary = events.find((ev) => ev.type === "agent_run_started")?.publicSummary;
  
  // Phase 10.24: dormant idle state — instead of vanishing, render a calm
  // single-row strip so multi-agent feels "always present" / "ready".
  if (status === "idle" && agents.length === 0) {
    return (
      <div
        data-testid="multiagent-panel-dormant"
        className={`flex items-center gap-2 rounded-md border border-border/30 bg-muted/15 px-3 py-1 text-[10.5px] opacity-60 ${
          inline ? "mb-0" : "mb-2"
        }`}
        title="ทีม AI พร้อมทำงาน — เริ่มสนทนาเพื่อเปิดใช้"
      >
        <span className="inline-flex h-2.5 w-2.5 items-center justify-center rounded-full border border-slate-400/50" aria-hidden="true">
          <span className="block h-1 w-1 rounded-full bg-slate-400/70" />
        </span>
        <span className="font-display uppercase tracking-[0.18em] text-muted-foreground/85">
          ทีม AI พร้อม
        </span>
        <span className="text-muted-foreground/60">· เปิดใช้เมื่อสนทนา</span>
      </div>
    );
  }

  // Phase 10.29: warming-up state — streaming has begun but no agent_started
  // event arrived yet (typical 200-800 ms window). Show a thin animated strip
  // that says "เรียกทีมตัวแทน..." with the radar-ping dot so the user knows
  // something is happening RIGHT NOW, not stuck.
  if (status === "streaming" && agents.length === 0) {
    return (
      <div
        data-testid="multiagent-panel-warming"
        className={`flex items-center gap-2 rounded-md border border-primary/20 bg-gradient-to-r from-primary/8 via-sky-500/5 to-transparent px-3 py-1 text-[10.5px] ${
          inline ? "mb-0" : "mb-2"
        }`}
      >
        <span className="relative inline-flex h-3 w-3 shrink-0 items-center justify-center">
          <span className="absolute inline-flex h-3 w-3 animate-radar-ping rounded-full bg-emerald-500 opacity-75" aria-hidden="true" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        </span>
        <span className="font-display uppercase tracking-[0.18em] text-foreground/85">
          เรียกทีมตัวแทน
        </span>
        <span className="font-mono text-muted-foreground/80">
          <span className="animate-pulse">·</span>
          <span className="animate-pulse [animation-delay:120ms]">·</span>
          <span className="animate-pulse [animation-delay:240ms]">·</span>
        </span>
        <span className="ml-auto text-muted-foreground/60">conductor</span>
      </div>
    );
  }

  const isOpen = open || expandAll;
  const rootClass = inline
    ? "rounded-md border border-border/40 bg-muted/20 text-xs overflow-hidden"
    : "mb-2 rounded-lg border border-border/30 bg-card/20 text-xs overflow-hidden";

  // Collect distinct models in firing order for the marquee strip.
  const activeModels = Array.from(new Set(
    agents.map((a) => a.model).filter((m): m is string => Boolean(m))
  ));
  const isStreaming = status === "streaming";
  const headerTone =
    status === "error" || errorCount > 0
      ? "from-rose-500/12 via-rose-500/6 to-transparent"
      : recoveringCount > 0
      ? "from-amber-500/12 via-amber-500/6 to-transparent"
      : isStreaming
      ? "from-emerald-500/14 via-primary/8 to-sky-500/10"
      : "from-primary/8 via-sky-500/6 to-violet-500/6";
  const radarColor =
    status === "error" || errorCount > 0 ? "bg-rose-500"
    : recoveringCount > 0 ? "bg-amber-500"
    : isStreaming ? "bg-emerald-500"
    : "bg-sky-500";

  return (
    <div data-testid="multiagent-panel" className={rootClass}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          onToggleExpandAll?.();
        }}
        className={`group/header relative w-full overflow-hidden bg-gradient-to-r ${headerTone} px-3 py-2 text-left transition-colors hover:brightness-110`}
        aria-expanded={isOpen}
        data-testid="multiagent-expand-all"
        title="Ctrl+O"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 font-medium text-foreground/85">
            {/* Radar ping — two concentric rings, outer one animates */}
            <span className="relative inline-flex h-3 w-3 shrink-0 items-center justify-center">
              <span
                className={`absolute inline-flex h-3 w-3 rounded-full opacity-75 ${radarColor} ${isStreaming ? "animate-radar-ping" : ""}`}
                aria-hidden="true"
              />
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${radarColor}`} aria-hidden="true" />
            </span>
            <span className="font-display text-[11px] uppercase tracking-[0.18em] text-foreground/85">
              ทีม AI
            </span>
            <span className="hidden text-[11px] text-muted-foreground/85 sm:inline">
              · {agents.length} ตัวแทน
              {isStreaming && agents.length > 0 && (
                <> · {doneCount}/{agents.length}</>
              )}
              {recoveringCount > 0 && <> · กู้คืน {recoveringCount}</>}
              {errorCount > 0 && <> · ล้มเหลว {errorCount}</>}
            </span>
          </span>

          {/* Right side: model marquee + expand caret */}
          <span className="flex shrink-0 items-center gap-1.5">
            {!isOpen && activeModels.length > 0 && (
              <span className="hidden items-center gap-1 md:inline-flex">
                {activeModels.slice(0, 3).map((m) => {
                  const accent = getModelAccent(m);
                  return (
                    <span
                      key={m}
                      className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[9.5px] ${accent.pill}`}
                      title={m}
                    >
                      {MDES_MODEL_BADGE[m] ?? m.split(":")[0]}
                    </span>
                  );
                })}
                {activeModels.length > 3 && (
                  <span className="text-[9.5px] text-muted-foreground/70">+{activeModels.length - 3}</span>
                )}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
              {isOpen ? "▾ ซ่อน" : "▸ ดู"}
            </span>
          </span>
        </div>
      </button>
      {isOpen && agents.length > 0 && isStreaming && (
        <div className="h-1 bg-card/40 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500/85 via-primary/80 to-sky-400/85 transition-all duration-700 ease-out"
            style={{
              width: `${Math.round((doneCount / agents.length) * 100)}%`,
              boxShadow: "0 0 8px currentColor",
            }}
          />
        </div>
      )}

      {/* Phase 10.24: pipeline micro-row — chain of agent pills with → arrows
          so the orchestration reads as a sequence, not just a parallel grid. */}
      {isOpen && agents.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border/20 bg-card/30 px-3 py-1.5">
          {agents.map((agent, i) => {
            const accent = getModelAccent(agent.model);
            const pillTone =
              agent.status === "done"
                ? `${accent.pill} ring-1 ring-inset`
                : agent.status === "active"
                ? `${accent.pill} agent-shimmer-active`
                : agent.status === "recovering"
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                : agent.status === "error"
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"
                : "bg-muted/40 text-muted-foreground/70";
            return (
              <React.Fragment key={agent.agentId}>
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className={`shrink-0 select-none font-mono text-[11px] ${
                      agents[i - 1].status === "done" ? "text-foreground/60" : "text-muted-foreground/40"
                    }`}
                  >
                    →
                  </span>
                )}
                <span
                  style={{ ['--agent-accent' as any]: accent.hex }}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium leading-tight transition-colors ${pillTone}`}
                  title={`${AGENT_LABEL_TH[agent.agentId] ?? agent.agentId} · ${agent.status}${agent.model ? ` · ${agent.model}` : ""}${
                    agent.startedAt && agent.finishedAt
                      ? ` · ${fmtLatency(agent.finishedAt - agent.startedAt)}`
                      : ""
                  }`}
                >
                  <span className="inline-block h-1 w-1 shrink-0 rounded-full" style={{ background: accent.hex }} aria-hidden="true" />
                  <span className="truncate max-w-[6.5rem]">{AGENT_LABEL_TH[agent.agentId] ?? agent.agentId}</span>
                  {/* Latency badge — only when agent has finished cleanly */}
                  {agent.status === "done" && agent.startedAt && agent.finishedAt && (
                    <span className="font-mono text-[9px] opacity-75 tabular-nums">
                      {fmtLatency(agent.finishedAt - agent.startedAt)}
                    </span>
                  )}
                  {agent.status === "done" && <span aria-hidden="true">✓</span>}
                  {agent.status === "recovering" && <span aria-hidden="true">↻</span>}
                  {agent.status === "error" && <span aria-hidden="true">✗</span>}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      )}
      {isOpen && agents.length > 0 && (
        <div>
          {runSummary && (
            <div className="border-t border-border/20 px-3 py-1.5 text-[11px] leading-4 text-muted-foreground">
              {runSummary}
            </div>
          )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border/10 p-px">
          {agents.map((agent) => {
            const isExpanded = expandAll || expandedAgents.has(agent.agentId);
            const roleDesc = AGENT_ROLE_DESC[agent.agentId];
            const accent = getModelAccent(agent.model);

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
              agent.status === "done" ? "✓" : agent.status === "error" ? "✗" : agent.status === "recovering" ? "↻" : "";
            const dotClass =
              agent.status === "active"
                ? "animate-pulse bg-emerald-500"
                : agent.status === "recovering"
                ? "animate-pulse bg-amber-500"
                : agent.status === "error"
                ? "bg-rose-500"
                : "bg-sky-400";

            const cardShimmerClass = agent.status === "active" ? "agent-shimmer-active" : "";

            return (
              <div
                key={agent.agentId}
                data-testid={`multiagent-agent-${agent.agentId}`}
                style={{ ['--agent-accent' as any]: accent.hex, borderLeftColor: accent.hex }}
                className={`relative border-l-2 bg-card/40 px-3 py-2 pl-3 cursor-pointer hover:bg-card/60 transition-colors ${cardShimmerClass}`}
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
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ring-inset"
                    style={{
                      color: accent.hex,
                      background: `color-mix(in oklab, ${accent.hex} 12%, transparent)`,
                      borderColor: `color-mix(in oklab, ${accent.hex} 35%, transparent)`,
                    }}
                    aria-hidden="true"
                  >
                    <AgentRoleIcon agentId={agent.agentId} />
                  </span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotClass}`}
                  />
                  <span className="font-medium text-foreground/85 truncate flex items-center gap-1">
                    {AGENT_LABEL_TH[agent.agentId] ?? agent.agentId}
                    {statusIcon && (
                      <span
                        className={`text-[10px] ${
                          agent.status === "done"
                            ? "text-sky-400"
                            : agent.status === "recovering"
                            ? "text-amber-500"
                            : "text-rose-400"
                        }`}
                      >
                        {statusIcon}
                      </span>
                    )}
                  </span>
                  {/* Latency badge appears between status icon and model — only when finished */}
                  {agent.status !== "active" && agent.startedAt && agent.finishedAt && (
                    <span
                      className="ml-auto font-mono text-[9.5px] tabular-nums text-muted-foreground/85"
                      title="ระยะเวลาทำงาน"
                    >
                      {fmtLatency(agent.finishedAt - agent.startedAt)}
                    </span>
                  )}
                  {agent.model && (
                    <span
                      className={`text-[9px] font-mono px-1 py-0.5 rounded flex-shrink-0 ${accent.pill} ${
                        agent.status !== "active" && agent.startedAt && agent.finishedAt ? "" : "ml-auto"
                      }`}
                    >
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
                    agent.status === "error" ? "text-rose-400/70" : agent.status === "recovering" ? "text-amber-600/80 dark:text-amber-300/80" : ""
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
                    agent.status === "recovering" && agent.lastFallback
                      ? `${agent.lastFallback} · กำลังลองทางสำรอง`
                      : displayText
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
                              {EVENT_LABEL_TH[ev.type] ?? ev.type}
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
        </div>
      )}
    </div>
  );
}
