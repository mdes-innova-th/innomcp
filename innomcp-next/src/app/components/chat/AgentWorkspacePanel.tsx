"use client";

import { useState, useEffect, useRef } from "react";
import type { AgentEvent } from "./useAgentEventStream";
import ShellOutputView from "@/app/components/tools/ShellOutputView";
import LiveTerminal from "@/app/components/tools/LiveTerminal";

/** Format seconds as MM:SS */
function formatElapsed(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

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

/** Detect if an event is shell/exec-related */
function isShellEvent(event: AgentEvent): boolean {
  const name = event.toolName?.toLowerCase() ?? "";
  const summary = event.publicSummary?.toLowerCase() ?? "";
  return (
    name.includes("shell") ||
    name.includes("exec") ||
    name.includes("bash") ||
    name.includes("cmd") ||
    summary.includes("shell") ||
    summary.includes("exec") ||
    summary.includes("รัน") ||
    summary.includes("bash")
  );
}

/** Return a tool type badge label + emoji for a given event, or null */
function getToolBadge(event: AgentEvent): string | null {
  const name = event.toolName?.toLowerCase() ?? "";
  const summary = event.publicSummary?.toLowerCase() ?? "";
  if (
    name.includes("shell") || name.includes("exec") || name.includes("bash") || name.includes("cmd") ||
    summary.includes("shell") || summary.includes("exec") || summary.includes("รัน") || summary.includes("bash")
  ) {
    return "🖥️ Terminal";
  }
  if (
    name.includes("web") || name.includes("fetch") || name.includes("http") || name.includes("url") ||
    summary.includes("fetch") || summary.includes("web") || summary.includes("url") || summary.includes("ดาวน์โหลด")
  ) {
    return "🌐 Web Fetch";
  }
  if (
    name.includes("file") || name.includes("read") || name.includes("write") || name.includes("fs") ||
    summary.includes("file") || summary.includes("อ่าน") || summary.includes("เขียน")
  ) {
    return "📄 File";
  }
  if (
    name.includes("analys") || name.includes("data") || name.includes("chart") || name.includes("stat") ||
    summary.includes("วิเคราะห์") || summary.includes("data") || summary.includes("สถิติ")
  ) {
    return "📊 Analysis";
  }
  return null;
}

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

  // Elapsed timer — starts when isStreaming becomes true, freezes when done
  const [elapsedSec, setElapsedSec] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  // Reset timer when a new run starts (runId changes)
  const prevRunIdRef = useRef<string | undefined>(runId);
  useEffect(() => {
    if (runId !== prevRunIdRef.current) {
      prevRunIdRef.current = runId;
      setElapsedSec(0);
      startTimeRef.current = null;
    }
  }, [runId]);

  const steps = events.filter((e) => STEP_TYPES.has(e.type));
  const isDone = events.some((e) => e.type === "final_answer");
  const total = steps.length;

  // Start/tick/stop timer: ticks every second while streaming and not done
  useEffect(() => {
    if (isStreaming && !isDone) {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now() - elapsedSec * 1000;
      }
      const id = setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startTimeRef.current!) / 1000));
      }, 1000);
      return () => clearInterval(id);
    }
    // Freeze on done — keep last elapsed value, no interval
  }, [isStreaming, isDone, elapsedSec]);

  // Determine current step index: first incomplete step after the last completed one
  const activeToolEvent = isStreaming
    ? [...events].reverse().find((e) => e.type === "tool_call_started")
    : undefined;
  const lastDoneIdx = steps.reduce((acc, ev, i) =>
    (ev.type === "tool_call_finished" || ev.type === "agent_finished" || ev.type === "fact_found") ? i : acc, -1);
  const activeStepIdx = lastDoneIdx >= 0 ? Math.min(lastDoneIdx + 1, steps.length - 1) : 0;
  const lastActiveIndex = isStreaming && !isDone ? activeStepIdx : -1;

  const progressPct = total === 0 ? 0 : isDone ? 100 : Math.round(((total - 1) / Math.max(total, 3)) * 100);

  // Find the most recent shell-related tool event for the ShellOutputView
  const shellToolEvents = events.filter(
    (e) =>
      (e.type === "tool_call_started" || e.type === "tool_call_finished") &&
      isShellEvent(e)
  );
  const lastShellEvent = shellToolEvents.length > 0 ? shellToolEvents[shellToolEvents.length - 1] : null;
  const shellStatus = lastShellEvent?.type === "tool_call_started" ? "running" : "completed";
  // Use publicSummary only when it looks like an actual command (not a generic Thai label)
  const shellCommand = (() => {
    const summary = lastShellEvent?.publicSummary ?? "";
    const isGeneric =
      !summary ||
      summary === lastShellEvent?.type ||
      summary === "เรียกใช้เครื่องมือ" ||
      summary.trim().length === 0;
    return isGeneric ? (lastShellEvent?.toolName ?? "shell") : summary;
  })();

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
          {isStreaming && !isDone && (
            <span
              className="flex items-center gap-1 text-xs text-emerald-500 font-medium"
              aria-live="polite"
              aria-label="Task in progress"
            >
              <span className="animate-pulse">●</span>
              LIVE
            </span>
          )}
          {(isStreaming || elapsedSec > 0) && (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {formatElapsed(elapsedSec)}
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
                {isActive && getToolBadge(step) && (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary shrink-0">
                    {getToolBadge(step)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Shell output view — live streaming when running, static when completed */}
      {lastShellEvent && (
        <div className="mt-1">
          {isStreaming && lastShellEvent.type === "tool_call_started" ? (
            <LiveTerminal
              command={shellCommand}
              autoRun={true}
              onComplete={(_code) => { /* exit code handled by LiveTerminal internally */ }}
            />
          ) : (
            <ShellOutputView
              command={shellCommand}
              stdout=""
              status={shellStatus}
            />
          )}
        </div>
      )}

      {/* Active tool block — shown for non-shell tool events only */}
      {activeToolEvent && isStreaming && !isDone && !isShellEvent(activeToolEvent) && (
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
        <div className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm font-medium text-center flex items-center justify-center gap-2">
          <span>✅ เสร็จสิ้น</span>
          {(() => {
            const timingEvent = events.find((e) => e.type === "timing");
            if (!timingEvent?.totalMs) return null;
            const ms = timingEvent.totalMs;
            const label = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
            return (
              <span className="text-[10px] font-normal text-emerald-600/70 dark:text-emerald-400/70 tabular-nums">
                {label}
              </span>
            );
          })()}
        </div>
      )}

      {/* Empty state */}
      {steps.length === 0 && !isStreaming && (
        <p className="text-xs text-muted-foreground text-center py-2">รอคำสั่ง...</p>
      )}
    </div>
  );
}
