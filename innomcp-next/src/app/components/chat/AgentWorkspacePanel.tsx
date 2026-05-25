"use client";

import { useState } from "react";
import type { AgentEvent } from "./useAgentEventStream";

interface Props {
  events: AgentEvent[];
  isStreaming: boolean;
  runId?: string;
}

const STEP_TYPES = new Set([
  "route_selected",
  "agent_started",
  "tool_call_started",
  "tool_call_finished",
  "fact_found",
  "final_answer",
]);

const EVENT_LABEL: Record<string, string> = {
  route_selected: "วิเคราะห์คำถาม",
  agent_started: "เริ่มทำงาน",
  tool_call_started: "เรียกใช้เครื่องมือ",
  tool_call_finished: "เครื่องมือเสร็จแล้ว",
  fact_found: "พบข้อมูล",
  final_answer: "สรุปคำตอบ",
};

function getStepLabel(event: AgentEvent): string {
  const base = EVENT_LABEL[event.type] ?? event.type;
  if (
    event.publicSummary &&
    event.publicSummary !== event.type &&
    event.publicSummary.trim().length > 0
  ) {
    return event.publicSummary;
  }
  return base;
}

export default function AgentWorkspacePanel({ events, isStreaming, runId }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const steps = events.filter((e) => STEP_TYPES.has(e.type));
  const isDone = events.some((e) => e.type === "final_answer");
  const total = steps.length;

  // Determine current step index: first incomplete step after the last completed one
  const activeToolEvent = isStreaming
    ? [...events].reverse().find((e) => e.type === "tool_call_started")
    : undefined;
  const lastDoneIdx = steps.reduce((acc, ev, i) =>
    (ev.type === "tool_call_finished" || ev.type === "agent_finished" || ev.type === "fact_found") ? i : acc, -1);
  const activeStepIdx = lastDoneIdx >= 0 ? Math.min(lastDoneIdx + 1, steps.length - 1) : 0;
  const lastActiveIndex = isStreaming && !isDone ? activeStepIdx : -1;

  const progressPct = total === 0 ? 0 : isDone ? 100 : Math.round(((total - 1) / Math.max(total, 3)) * 100);

  if (collapsed) {
    return (
      <div className="bg-background border border-border/60 rounded-xl p-3 shadow-sm flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">INNOMCP&apos;s Computer</span>
        <button
          onClick={() => setCollapsed(false)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Expand panel"
        >
          ▲ ขยาย
        </button>
      </div>
    );
  }

  return (
    <div className="bg-background border border-border/60 rounded-xl p-4 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">INNOMCP&apos;s Computer</span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
              <span className="animate-pulse">●</span>
              LIVE
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Collapse panel"
        >
          ▼ ซ่อน
        </button>
      </div>

      {/* Step tracker */}
      {total > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>ขั้นตอน {isDone ? total : Math.max(lastActiveIndex + 1, 1)} / {total}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-primary/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Step checklist */}
      {steps.length > 0 && (
        <ul className="space-y-1.5 mt-1">
          {steps.map((step, idx) => {
            const isActive = isStreaming && !isDone && idx === lastActiveIndex;
            const isDoneStep = isDone || idx < lastActiveIndex;

            return (
              <li key={`${step.type}-${step.timestamp}-${idx}`} className="flex items-start gap-2 text-xs">
                {isDoneStep ? (
                  <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                ) : isActive ? (
                  <span className="text-amber-500 mt-0.5 shrink-0 animate-spin inline-block">⟳</span>
                ) : (
                  <span className="text-muted-foreground mt-0.5 shrink-0">·</span>
                )}
                <span
                  className={
                    isDoneStep
                      ? "text-foreground"
                      : isActive
                      ? "text-amber-600 dark:text-amber-400 font-medium"
                      : "text-muted-foreground"
                  }
                >
                  {getStepLabel(step)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Active tool block */}
      {activeToolEvent && isStreaming && !isDone && (
        <div className="bg-muted/60 rounded-lg p-2 font-mono text-xs space-y-0.5">
          <div className="text-foreground font-semibold">
            {activeToolEvent.toolName ?? "tool"}
          </div>
          {activeToolEvent.publicSummary && activeToolEvent.publicSummary !== activeToolEvent.type && (
            <div className="text-muted-foreground truncate">{activeToolEvent.publicSummary}</div>
          )}
          {activeToolEvent.provider && (
            <div className="text-muted-foreground/70">provider: {activeToolEvent.provider}</div>
          )}
        </div>
      )}

      {/* Done banner */}
      {isDone && (
        <div className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm font-medium text-center">
          ✅ เสร็จสิ้น
        </div>
      )}

      {/* Empty state */}
      {steps.length === 0 && !isStreaming && (
        <p className="text-xs text-muted-foreground text-center py-2">รอคำสั่ง...</p>
      )}
    </div>
  );
}
