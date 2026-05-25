"use client";
import React, { useState, useEffect } from "react";

interface TaskStep {
  id: number;
  task_id: string;
  event_type: string;
  public_summary: string;
  agent_id: string | null;
  tool_name: string | null;
  ts: string;
}

interface TaskDetail {
  id: string;
  title: string;
  intent: string;
  status: string;
  elapsed_ms: number | null;
  final_answer: string | null;
  created_at: string;
  completed_at: string | null;
}

const BACKEND =
  typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:3011"
    : "";

const EVENT_ICON: Record<string, string> = {
  route_selected:       "🔀",
  agent_started:        "🤖",
  agent_finished:       "✓",
  tool_call_started:    "🔧",
  tool_call_finished:   "✅",
  fact_found:           "💡",
  final_answer:         "🎯",
  error:                "❌",
  fallback:             "⚠️",
};

const STATUS_COLOR: Record<string, string> = {
  completed: "text-emerald-600 dark:text-emerald-400",
  running:   "text-blue-600 dark:text-blue-400",
  failed:    "text-rose-600 dark:text-rose-400",
};

function stepTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function TaskDetailPanel({
  taskId,
  onClose,
}: {
  taskId: string;
  onClose?: () => void;
}) {
  const [task, setTask]       = useState<TaskDetail | null>(null);
  const [steps, setSteps]     = useState<TaskStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    fetch(`${BACKEND}/api/tasks/${taskId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setTask(d.task);
        setSteps(d.steps ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading)
    return (
      <div className="flex items-center justify-center p-8 text-[12px] text-muted-foreground">
        <span className="animate-pulse">กำลังโหลด...</span>
      </div>
    );
  if (!task)
    return (
      <div className="p-4 text-[12px] text-muted-foreground">ไม่พบงานนี้</div>
    );

  const elapsed = task.elapsed_ms
    ? `${(task.elapsed_ms / 1000).toFixed(1)}s`
    : null;

  return (
    <div className="flex flex-col gap-3 p-1 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground truncate">
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={`text-[11px] font-medium ${
                STATUS_COLOR[task.status] ?? "text-muted-foreground"
              }`}
            >
              {task.status}
            </span>
            <span className="text-[10px] text-muted-foreground/50">•</span>
            <span className="text-[10px] text-muted-foreground/60">
              {task.intent}
            </span>
            {elapsed && (
              <>
                <span className="text-[10px] text-muted-foreground/50">•</span>
                <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                  ⏱ {elapsed}
                </span>
              </>
            )}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground/60 hover:text-foreground shrink-0"
            aria-label="Close task detail"
          >
            ✕
          </button>
        )}
      </div>

      {/* Progress bar for running tasks */}
      {task.status === "running" && (
        <div className="h-1 w-full rounded-full bg-muted/40 overflow-hidden">
          <div className="h-full bg-blue-500 animate-pulse rounded-full w-1/2" />
        </div>
      )}

      {/* Steps timeline */}
      {steps.length > 0 && (
        <div>
          <p className="text-[10.5px] font-medium text-muted-foreground mb-2">
            Timeline ({steps.length} events)
          </p>
          <div className="flex flex-col">
            {steps.map((step, i) => (
              <div key={step.id ?? i} className="relative pl-6 pb-2">
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div className="absolute left-[9px] top-4 bottom-0 w-px bg-border/40" />
                )}
                {/* Event dot */}
                <div
                  className={`absolute left-0 top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px]
                    ${
                      step.event_type === "final_answer"
                        ? "bg-emerald-500/20 border-2 border-emerald-500"
                        : step.event_type === "error"
                        ? "bg-rose-500/20 border-2 border-rose-500"
                        : step.event_type.includes("started")
                        ? "bg-blue-500/20 border-2 border-blue-500 animate-pulse"
                        : "bg-muted/40 border border-border/60"
                    }`}
                >
                  {EVENT_ICON[step.event_type] ?? "·"}
                </div>

                <div className="rounded-lg border border-border/20 bg-background/40 px-2.5 py-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-foreground">
                        {step.public_summary || step.event_type}
                      </p>
                      {(step.agent_id || step.tool_name) && (
                        <p className="text-[9.5px] text-muted-foreground/60 mt-0.5 font-mono">
                          {step.agent_id && `🤖 ${step.agent_id}`}
                          {step.agent_id && step.tool_name && " · "}
                          {step.tool_name && `🔧 ${step.tool_name}`}
                        </p>
                      )}
                    </div>
                    <span className="text-[9.5px] text-muted-foreground/40 shrink-0 tabular-nums">
                      {stepTime(step.ts)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final answer accordion */}
      {task.final_answer && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5">
          <button
            onClick={() => setShowAnswer((a) => !a)}
            className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
          >
            <span>✅ Final Answer</span>
            <span>{showAnswer ? "▲" : "▼"}</span>
          </button>
          {showAnswer && (
            <div className="border-t border-emerald-500/20 px-3 py-2 text-[11.5px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {task.final_answer.slice(0, 2000)}
              {task.final_answer.length > 2000 ? "..." : ""}
            </div>
          )}
        </div>
      )}

      {/* Meta footer */}
      <div className="text-[9.5px] text-muted-foreground/40 flex gap-3">
        <span>สร้าง: {new Date(task.created_at).toLocaleString("th-TH")}</span>
        {task.completed_at && (
          <span>
            เสร็จ: {new Date(task.completed_at).toLocaleString("th-TH")}
          </span>
        )}
      </div>
    </div>
  );
}
