"use client";
import React, { useMemo, useState } from "react";
import type { AgentEvent, StreamStatus } from "./useAgentEventStream";
import { getThinkingReportToneClass, resolveThinkingReportSummary } from "./multiAgentExperience";
import MotherRaceView from "./MotherRaceView";

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

function getModelAccent(model?: string): { hex: string; pill: string } {
  const m = (model || "").toLowerCase();
  if (m.startsWith("qwen") || m.includes("qwen2.5vl")) return { hex: "#0ea5e9", pill: "bg-sky-500/15 text-sky-600 dark:text-sky-300" };
  if (m.startsWith("gemma")) return { hex: "#10b981", pill: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" };
  if (m.startsWith("gpt-")) return { hex: "#475569", pill: "bg-slate-500/15 text-slate-700 dark:text-slate-200" };
  if (m.startsWith("claude")) return { hex: "#f59e0b", pill: "bg-amber-500/15 text-amber-600 dark:text-amber-300" };
  if (m.startsWith("minimax")) return { hex: "#f43f5e", pill: "bg-rose-500/15 text-rose-600 dark:text-rose-300" };
  return { hex: "#64748b", pill: "bg-slate-500/15 text-slate-600 dark:text-slate-300" };
}

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

function AgentRoleIcon({ agentId, className }: { agentId: string; className?: string }) {
  const common = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const cls = `h-3 w-3 ${className || ""}`;
  switch (agentId) {
    case "weather-analyst":
      return (<svg {...common} className={cls} aria-hidden><circle cx="6" cy="6" r="2.4" /><path d="M11 11.5h-6a2 2 0 0 1 0-4 3 3 0 0 1 5.8.6 1.8 1.8 0 0 1 .2 3.4Z" /></svg>);
    case "geo-planner":
      return (<svg {...common} className={cls} aria-hidden><path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14Z" /><circle cx="8" cy="6.3" r="1.5" /></svg>);
    case "rag-agent":
      return (<svg {...common} className={cls} aria-hidden><circle cx="7" cy="7" r="3.6" /><path d="m10 10 3 3" /></svg>);
    case "concierge":
      return (<svg {...common} className={cls} aria-hidden><path d="M2.5 4.5h11v6h-7L4 13v-2.5H2.5z" /><circle cx="6" cy="7.5" r="0.5" fill="currentColor" /><circle cx="8" cy="7.5" r="0.5" fill="currentColor" /><circle cx="10" cy="7.5" r="0.5" fill="currentColor" /></svg>);
    case "tool-scout":
      return (<svg {...common} className={cls} aria-hidden><path d="M11 3a3 3 0 0 1 0 4.2L13 9.5 9.5 13 7.3 11a3 3 0 1 1-4.2-4.2L5 8.5 8.5 5 6.7 3a3 3 0 0 1 4.3 0Z" /></svg>);
    case "critic":
      return (<svg {...common} className={cls} aria-hidden><path d="M8 2 3 4v4.5C3 11 5 13 8 14c3-1 5-3 5-5.5V4Z" /><path d="m6 8 1.5 1.5L10.5 6.5" /></svg>);
    case "stylist":
      return (<svg {...common} className={cls} aria-hidden><path d="M3 13 9 7l3.5 3.5L7 16Z" transform="translate(-1 -3)" /><path d="m11 4 1.5 1.5" /></svg>);
    case "broker":
      return (<svg {...common} className={cls} aria-hidden><circle cx="5.5" cy="8" r="3" /><circle cx="10.5" cy="8" r="3" /></svg>);
    case "conductor":
      return (<svg {...common} className={cls} aria-hidden><circle cx="8" cy="4.5" r="1.6" /><path d="M8 6v8" /><path d="M5 14h6" /></svg>);
    case "scribe":
      return (<svg {...common} className={cls} aria-hidden><path d="M3 4h8v8H3z" /><path d="M11 4h2v8" /><path d="M5 7h4M5 9h3" /></svg>);
    default:
      return (<svg {...common} className={cls} aria-hidden><path d="M8 2v4M8 10v4M2 8h4M10 8h4" /></svg>);
  }
}

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
  startedAt?: number;
  finishedAt?: number;
}

function fmtLatency(ms: number | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

function cleanAgentText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (/openai-compatible|http\s+\d{3}|rate limit|exceeded|gateway|timeout|api key/i.test(trimmed)) {
    return "เส้นทางโมเดลหลักตอบกลับไม่สำเร็จ ระบบกำลังจัดลำดับทางสำรองและเก็บเฉพาะข้อมูลที่ปลอดภัยสำหรับคำตอบสุดท้าย";
  }
  return trimmed.length > 520 ? `${trimmed.slice(0, 520).trimEnd()}...` : trimmed;
}

function getMotherProviderBadge(provider: string | undefined): { label: string; color: string } | null {
  if (!provider) return null;
  const map: Record<string, { label: string; color: string }> = {
    "mdes-cloud":      { label: "MDES",      color: "bg-orange-500/20 text-orange-300" },
    "thai-llm":        { label: "ThaiLLM",   color: "bg-orange-400/20 text-orange-200" },
    "ollama-local":    { label: "Local",     color: "bg-gray-500/20 text-gray-300" },
    "openai-gpt":      { label: "GPT",       color: "bg-green-600/20 text-green-300" },
    "claude-haiku":    { label: "Claude",    color: "bg-purple-500/20 text-purple-300" },
    "copilot":         { label: "Copilot",   color: "bg-gray-800/40 text-gray-200" },
    "claude-sonnet":  { label: "Sonnet",   color: "bg-purple-600/20 text-purple-200" },
    "gemini-pro":      { label: "Gemini",    color: "bg-blue-500/20 text-blue-300" },
    "mistral-large":   { label: "Mistral",   color: "bg-red-700/20 text-red-300" },
    "deepseek-r1":     { label: "DeepSeek",  color: "bg-teal-500/20 text-teal-300" },
    "groq-llama":      { label: "Groq",      color: "bg-orange-600/20 text-orange-300" },
    "together-llama":  { label: "Together",  color: "bg-violet-500/20 text-violet-300" },
    "innova-bot":    { label: "InnBot",   color: "bg-emerald-500/20 text-emerald-300" },
    "mother":          { label: "🧠 Mother", color: "bg-yellow-400/20 text-yellow-300" },
  };
  return map[provider] ?? null;
}

function getAgentParagraph(agent: AgentState): { text: string; live: boolean } {
  const roleDesc = AGENT_ROLE_DESC[agent.agentId];
  if (agent.status === "recovering" && agent.lastFallback) {
    return { text: `${cleanAgentText(agent.lastFallback)} กำลังลองทางสำรองเพื่อให้คำตอบเดินต่อได้อย่างปลอดภัย`, live: false };
  }
  if (agent.thinkingText) return { text: cleanAgentText(agent.thinkingText), live: false };
  if (agent.lastSummary) return { text: cleanAgentText(agent.lastSummary), live: false };
  if (agent.status === "active") {
    return { text: `${roleDesc || "กำลังตรวจสอบข้อมูล"} และรอข้อมูลถัดไปจากระบบ`, live: true };
  }
  if (agent.status === "error") {
    return { text: "ตัวแทนนี้พบข้อผิดพลาดระหว่างทำงาน ระบบจะใช้ข้อมูลที่เชื่อถือได้จากส่วนอื่นประกอบคำตอบ", live: false };
  }
  return { text: roleDesc || "ดำเนินงานส่วนนี้เสร็จแล้ว", live: false };
}

function getStatusLabel(status: AgentState["status"]): string {
  if (status === "active") return "กำลังคิด";
  if (status === "recovering") return "สำรอง";
  if (status === "error") return "ติดขัด";
  return "เสร็จ";
}

interface Props {
  events: AgentEvent[];
  status: StreamStatus;
  expandAll?: boolean;
  onToggleExpandAll?: () => void;
  defaultCollapsed?: boolean;
  inline?: boolean;
}

export default function MultiAgentPanel({
  events,
  status,
  expandAll = false,
  defaultCollapsed = true,
  inline = false,
}: Props) {
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

      const ts = ev.timestamp ? Date.parse(ev.timestamp) : NaN;
      if (Number.isFinite(ts)) {
        if (ev.type === "agent_started" && s.startedAt == null) s.startedAt = ts;
        if (ev.type === "agent_finished" || ev.type === "error") s.finishedAt = ts;
      }

      if (ev.type === "agent_started" && ev.model) {
        s.model = ev.model;
        s.status = "active";
      }

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

  if (status === "idle" && agents.length === 0) {
    return (
      <div
        data-testid="multiagent-panel-dormant"
        className={`flex items-center gap-2 rounded-md border border-border/50 bg-background/70 px-3 py-1.5 text-[11px] text-muted-foreground ${
          inline ? "mb-0" : "mb-2"
        }`}
        title="ทีม AI พร้อมทำงาน — เริ่มสนทนาเพื่อเปิดใช้"
      >
        <span className="inline-flex h-2 w-2 rounded-full bg-slate-400/80" aria-hidden="true" />
        <span className="font-medium text-foreground/75">ทีม AI พร้อม</span>
        <span>เปิดใช้เมื่อเริ่มสนทนา</span>
      </div>
    );
  }

  if (status === "streaming" && agents.length === 0) {
    return (
      <div
        data-testid="multiagent-panel-warming"
        className={`flex items-center gap-2 rounded-md border border-emerald-500/25 bg-emerald-50/55 px-3 py-1.5 text-[11px] text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-100 ${
          inline ? "mb-0" : "mb-2"
        }`}
      >
        <span className="relative inline-flex h-3 w-3 shrink-0 items-center justify-center">
          <span className="absolute inline-flex h-3 w-3 animate-radar-ping rounded-full bg-emerald-500 opacity-75" aria-hidden="true" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        </span>
        <span className="font-medium">เรียกทีมตัวแทน</span>
        <span className="font-mono text-emerald-700/80 dark:text-emerald-200/80">
          <span className="animate-pulse">·</span>
          <span className="animate-pulse [animation-delay:120ms]">·</span>
          <span className="animate-pulse [animation-delay:240ms]">·</span>
        </span>
        <span className="ml-auto hidden text-emerald-800/70 dark:text-emerald-200/70 sm:inline">กำลังเตรียมบทความความคิด</span>
      </div>
    );
  }

  const isOpen = open || expandAll;
  const rootClass = inline
    ? "border-y border-border/45 bg-transparent text-xs overflow-hidden"
    : "mb-2 rounded-lg border border-border/60 bg-background/80 text-xs overflow-hidden";
  const activeModels = Array.from(new Set(
    agents.map((a) => a.model).filter((m): m is string => Boolean(m))
  ));
  const isStreaming = status === "streaming";
  const reportSummary = resolveThinkingReportSummary({
    streamStatus: status,
    agentCount: agents.length,
    doneCount,
    recoveringCount,
    errorCount,
  });
  const reportToneClass = getThinkingReportToneClass(reportSummary.tone);
  const radarColor =
    status === "error" || errorCount > 0 ? "bg-rose-500"
    : recoveringCount > 0 ? "bg-amber-500"
    : isStreaming ? "bg-emerald-500"
    : "bg-sky-500";

  return (
    <div data-testid="multiagent-panel" className={rootClass}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group/header relative w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/45"
        aria-expanded={isOpen}
        data-testid="multiagent-expand-all"
        title="Ctrl+O"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 items-start gap-2 font-medium text-foreground/85">
            <span className="relative inline-flex h-3 w-3 shrink-0 items-center justify-center">
              <span
                className={`absolute inline-flex h-3 w-3 rounded-full opacity-75 ${radarColor} ${isStreaming ? "animate-radar-ping" : ""}`}
                aria-hidden="true"
              />
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${radarColor}`} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[13px] font-semibold text-foreground/90">{reportSummary.title}</span>
                <span className={`text-[11.5px] ${reportToneClass}`}>
                  {agents.length} ตัวแทน · {reportSummary.statusText}
                </span>
              </span>
              <span className="mt-0.5 hidden max-w-[62ch] truncate text-[11.5px] leading-5 text-muted-foreground/85 sm:block">
                {reportSummary.digest}
              </span>
            </span>
          </span>

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
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/75">
              {isOpen ? "ซ่อน" : "ดู"}
            </span>
          </span>
        </div>
      </button>

      {isOpen && agents.length > 0 && isStreaming && (
        <div className="h-px bg-border/45">
          <div
            className="h-full bg-emerald-500 transition-all duration-700 ease-out"
            style={{ width: `${Math.round((doneCount / agents.length) * 100)}%` }}
          />
        </div>
      )}

      {isOpen && agents.length > 0 && (
        <article className="border-t border-border/40 px-3.5 py-3 text-[13px] leading-6">
          <header className="mb-3 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-[1fr_auto] sm:items-center">
            <span className="min-w-0">
              <span className="block">
                <span className="font-medium text-foreground/80">ทีมอ่านโจทย์เป็นบทความเดียว</span>
                <span className="ml-2 text-muted-foreground/85">{reportSummary.digest}</span>
              </span>
              {runSummary && <span className="mt-1 block truncate text-muted-foreground/75">{runSummary}</span>}
            </span>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border/50 bg-muted/35 px-2 py-1 text-[10.5px] font-medium text-foreground/75">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              unified answer
            </span>
          </header>

          {/* Mother dispatch conductor events — filtered out of agentMap, rendered separately */}
          {(() => {
            const conductorEvs = events.filter(
              (ev) => ev.agentId === "conductor" && ev.publicSummary
            );
            if (conductorEvs.length === 0) return null;
            return (
              <div className="mb-3 space-y-1 border-b border-border/35 pb-3">
                {conductorEvs.map((ev, i) => {
                  const badge = getMotherProviderBadge(ev.provider);
                  const isMotherIteration = ev.publicSummary?.startsWith("🧠 Mother iteration");
                  const isCircuitOpen =
                    ev.type === "fallback" && ev.publicSummary?.includes("circuit open");

                  if (isMotherIteration) {
                    return (
                      <div
                        key={`conductor-${i}`}
                        className="flex flex-wrap items-center gap-1.5 rounded-md bg-yellow-400/10 px-2 py-1 text-[11px] ring-1 ring-inset ring-yellow-400/20"
                      >
                        {badge && (
                          <span className={`text-[9px] px-1 rounded ${badge.color}`}>
                            {badge.label}
                          </span>
                        )}
                        <strong className="font-semibold text-yellow-200/90">{ev.publicSummary}</strong>
                      </div>
                    );
                  }

                  if (isCircuitOpen) {
                    return (
                      <div
                        key={`conductor-${i}`}
                        className="flex flex-wrap items-center gap-1.5 px-2 py-0.5 text-[11px] text-rose-400/70"
                      >
                        <span aria-hidden="true">⚠️</span>
                        {badge && (
                          <span className={`text-[9px] px-1 rounded ${badge.color}`}>
                            {badge.label}
                          </span>
                        )}
                        <span>{ev.publicSummary}</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`conductor-${i}`}
                      className="flex flex-wrap items-center gap-1.5 px-2 py-0.5 text-[11px] text-muted-foreground/75"
                    >
                      {badge && (
                        <span className={`text-[9px] px-1 rounded ${badge.color}`}>
                          {badge.label}
                        </span>
                      )}
                      <span>{ev.publicSummary}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Phase 20 — Mother race display */}
          <MotherRaceView events={events} hideWhenEmpty />

          <div className="space-y-4">
            {agents.map((agent) => {
              const accent = getModelAccent(agent.model);
              const latency = agent.startedAt && agent.finishedAt ? fmtLatency(agent.finishedAt - agent.startedAt) : null;
              const paragraph = getAgentParagraph(agent);
              const statusTone =
                agent.status === "active"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : agent.status === "recovering"
                  ? "text-amber-700 dark:text-amber-300"
                  : agent.status === "error"
                  ? "text-rose-700 dark:text-rose-300"
                  : "text-sky-700 dark:text-sky-300";

              return (
                <section
                  key={agent.agentId}
                  data-testid={`multiagent-agent-${agent.agentId}`}
                  className="border-t border-border/35 pt-3 first:border-t-0 first:pt-0"
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px] leading-5">
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full ring-1 ring-inset"
                      style={{
                        color: accent.hex,
                        background: `color-mix(in oklab, ${accent.hex} 10%, transparent)`,
                        borderColor: `color-mix(in oklab, ${accent.hex} 28%, transparent)`,
                      }}
                      aria-hidden="true"
                    >
                      <AgentRoleIcon agentId={agent.agentId} />
                    </span>
                    <span className="font-semibold text-foreground/90">
                      {AGENT_LABEL_TH[agent.agentId] ?? agent.agentId}
                    </span>
                    <span className={statusTone}>
                      {agent.status === "active" && (
                        <span className="mr-1 animate-pulse text-blue-500" aria-hidden="true">●</span>
                      )}
                      {agent.status === "done" && (
                        <span className="mr-1 text-emerald-500" aria-hidden="true">✓</span>
                      )}
                      {agent.status !== "active" && agent.status !== "done" && (
                        <span className="mr-1 text-muted-foreground/50" aria-hidden="true">–</span>
                      )}
                      {getStatusLabel(agent.status)}
                      {paragraph.live && <span className="ml-0.5 animate-pulse">...</span>}
                    </span>
                    {agent.model && (
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] ${accent.pill}`} title={agent.model}>
                        {MDES_MODEL_BADGE[agent.model] ?? agent.model.split(":")[0]}
                      </span>
                    )}
                    {latency && (
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground/80" title="ระยะเวลาทำงาน">
                        {latency}
                      </span>
                    )}
                    {agent.toolNames.length > 0 && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9.5px] text-amber-700 dark:text-amber-300" title={agent.toolNames.join(", ")}>
                        {agent.toolNames[0].replace(/^[^:]+:/, "")}
                        {agent.toolNames.length > 1 ? ` +${agent.toolNames.length - 1}` : ""}
                      </span>
                    )}
                  </div>
                  <p className="max-w-[72ch] text-[13.5px] leading-6 text-foreground/85">
                    {paragraph.text}
                  </p>
                </section>
              );
            })}
          </div>
        </article>
      )}
    </div>
  );
}
