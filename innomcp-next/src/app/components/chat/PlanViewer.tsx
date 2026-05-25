"use client";
import React, { useState, useMemo } from "react";
import type { AgentEvent } from "./useAgentEventStream";
import { buildPlanFromEvents } from "@/utils/planExtractor";

export type PhaseStatus = "pending" | "running" | "completed" | "failed" | "blocked";

export interface PlanPhase {
  id: string;
  title: string;
  description?: string;
  status: PhaseStatus;
  agentId?: string;
  toolsUsed?: string[];
  startedAt?: number;
  completedAt?: number;
  output?: string;
}

export interface Plan {
  id: string;
  title: string;
  phases: PlanPhase[];
  createdAt: number;
  status: "running" | "completed" | "failed";
}

interface Props {
  plan?: Plan | null;
  events?: AgentEvent[];
  onClose?: () => void;
}

const STATUS_CONFIG: Record<PhaseStatus, { icon: string; color: string; label: string }> = {
  pending:   { icon: "○", color: "text-muted-foreground/50", label: "รอดำเนินการ" },
  running:   { icon: "⟳", color: "text-blue-500 animate-spin", label: "กำลังทำงาน" },
  completed: { icon: "✓", color: "text-emerald-500", label: "เสร็จแล้ว" },
  failed:    { icon: "✗", color: "text-rose-500", label: "ล้มเหลว" },
  blocked:   { icon: "⊘", color: "text-amber-500", label: "ถูกบล็อก" },
};

function PhaseCard({ phase, index }: { phase: PlanPhase; index: number }) {
  const [expanded, setExpanded] = useState(phase.status === "running");
  const cfg = STATUS_CONFIG[phase.status];

  return (
    <div className={`relative pl-6 pb-3 ${index > 0 ? "border-l border-border/40 ml-[9px]" : ""}`}>
      {/* Timeline dot */}
      <div className={`absolute -left-[9px] flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 text-[10px] font-bold
        ${phase.status === "completed" ? "border-emerald-500 bg-emerald-500/10" :
          phase.status === "running" ? "border-blue-500 bg-blue-500/10" :
          phase.status === "failed" ? "border-rose-500 bg-rose-500/10" :
          phase.status === "blocked" ? "border-amber-500 bg-amber-500/10" :
          "border-border/60 bg-background"}`}>
        <span className={cfg.color}>{cfg.icon}</span>
      </div>

      <div className="rounded-lg border border-border/30 bg-background/60 p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[12px] font-medium text-foreground">{phase.title}</p>
              <span className={`text-[10px] ${cfg.color}`}>{cfg.label}</span>
            </div>
            {phase.agentId && (
              <p className="text-[10.5px] text-muted-foreground mt-0.5">
                🤖 {phase.agentId}
                {phase.toolsUsed && phase.toolsUsed.length > 0 && (
                  <span className="ml-1">· {phase.toolsUsed.join(", ")}</span>
                )}
              </p>
            )}
          </div>
          {phase.output && (
            <button onClick={() => setExpanded(e => !e)}
              className="text-[10px] text-muted-foreground hover:text-foreground shrink-0">
              {expanded ? "▲" : "▼"}
            </button>
          )}
        </div>

        {phase.description && !expanded && (
          <p className="text-[11px] text-muted-foreground mt-1">{phase.description}</p>
        )}

        {expanded && phase.output && (
          <div className="mt-2 rounded border border-border/30 bg-muted/30 p-2">
            <p className="text-[11px] font-mono text-foreground/80 whitespace-pre-wrap leading-relaxed">
              {phase.output.slice(0, 300)}{phase.output.length > 300 ? "..." : ""}
            </p>
          </div>
        )}

        {phase.completedAt && phase.startedAt && (
          <p className="text-[10px] text-muted-foreground/50 mt-1">
            {((phase.completedAt - phase.startedAt) / 1000).toFixed(1)}s
          </p>
        )}
      </div>
    </div>
  );
}

export default function PlanViewer({ plan, events, onClose }: Props) {
  // Derive a plan from events when no plan prop is provided
  const derivedPlan = useMemo(() => {
    if (!events || events.length === 0) return null;
    return buildPlanFromEvents(events, events[0]?.runId ?? "");
  }, [events]);

  // plan prop takes precedence (backward compat with ChatPage.tsx); fall back to derived
  const effectivePlan = plan ?? derivedPlan;

  if (!effectivePlan) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
        <span className="text-2xl">📋</span>
        <p className="text-[12.5px]">ยังไม่มีแผนงาน</p>
        <p className="text-[11px]">ยังไม่มีแผนงาน — เริ่มงานใหม่เพื่อดูแผน</p>
      </div>
    );
  }

  const done = effectivePlan.phases.filter(p => p.status === "completed").length;
  const total = effectivePlan.phases.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 p-1">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-semibold text-foreground">📋 {effectivePlan.title}</p>
          <p className="text-[10.5px] text-muted-foreground">{done}/{total} phases · {pct}%</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-foreground">✕</button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-muted/40">
        <div className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }} />
      </div>

      {/* Phase timeline */}
      <div className="flex flex-col gap-0 ml-[9px]">
        {effectivePlan.phases.map((phase, i) => (
          <PhaseCard key={phase.id} phase={phase} index={i} />
        ))}
      </div>
    </div>
  );
}
