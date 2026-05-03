"use client";

/**
 * ThinkingPanel — Phase C public-safe workstream UI
 *
 * Sits beside an assistant message and shows the multi-agent workstream
 * as a list of tasteful Thai status chips. Collapsed by default; the
 * trigger is a single line "ดูทีม AI กำลังคิด" so the chat doesn't feel
 * noisy.
 *
 * Hard rule: this component renders ONLY the public fields of each
 * AgentEvent. It never reads or displays unknown / forbidden field
 * names. The hook drops those before they reach this component, but
 * we double-check by whitelisting the renderable fields here too.
 */

import { useMemo, useState } from "react";
import type { AgentEvent } from "./useAgentEventStream";

const TYPE_LABEL_TH: Record<string, string> = {
  agent_run_started: "เริ่มงาน",
  route_selected: "เลือกเส้นทาง",
  agent_started: "เริ่มงานของตัวแทน",
  agent_delta: "ความคืบหน้า",
  tool_call_started: "เรียกใช้เครื่องมือ",
  tool_call_finished: "เครื่องมือเสร็จสิ้น",
  fact_found: "พบข้อมูล",
  draft_delta: "เรียบเรียงคำตอบ",
  critique: "ตรวจคำตอบ",
  fallback: "ปรับเส้นทาง",
  final_answer: "คำตอบสุดท้าย",
  feedback_saved: "บันทึกคำติชม",
  error: "ข้อผิดพลาด",
};

interface Props {
  events: AgentEvent[];
  status: "idle" | "streaming" | "done" | "error";
  warnings?: string[];
}

export default function ThinkingPanel({ events, status, warnings }: Props) {
  const [open, setOpen] = useState(false);

  const visibleEvents = useMemo(() => {
    // Filter out raw draft_delta events from the panel — they are
    // already rendered inline as the streaming answer; the panel shows
    // workstream milestones, not the answer text.
    return events.filter((e) => e.type !== "draft_delta");
  }, [events]);

  const eventCount = visibleEvents.length;

  if (status === "idle" && eventCount === 0) return null;

  return (
    <div
      data-testid="thinking-panel"
      className="mt-2 rounded-md border border-border/40 bg-card/30 px-3 py-2 text-xs text-muted-foreground transition-colors"
    >
      <button
        type="button"
        data-testid="thinking-panel-toggle"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left text-foreground/80 hover:text-foreground"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              status === "streaming"
                ? "animate-pulse bg-emerald-500"
                : status === "error"
                ? "bg-rose-500"
                : "bg-sky-500"
            }`}
            aria-hidden="true"
          />
          <span className="font-medium">ดูทีม AI กำลังคิด</span>
          <span className="text-muted-foreground" data-testid="thinking-panel-count">
            ({eventCount})
          </span>
        </span>
        <span className="text-muted-foreground" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <ul
          data-testid="thinking-panel-events"
          className="mt-2 flex flex-col gap-1.5 border-t border-border/30 pt-2"
        >
          {visibleEvents.map((ev, idx) => (
            <li
              key={`${ev.runId}-${idx}`}
              data-testid="thinking-panel-event"
              data-event-type={ev.type}
              className="flex items-start gap-2"
            >
              <span className="mt-0.5 inline-block min-w-[5.5rem] truncate rounded bg-muted/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {TYPE_LABEL_TH[ev.type] || ev.type}
              </span>
              <span className="flex-1 text-foreground/85">
                {ev.role ? <span className="font-medium">{ev.role}: </span> : null}
                {ev.publicSummary}
                {typeof ev.confidence === "number" && (
                  <span className="ml-1 text-muted-foreground">
                    (ความมั่นใจ {(ev.confidence * 100).toFixed(0)}%)
                  </span>
                )}
                {ev.toolName && (
                  <span className="ml-1 text-muted-foreground">[{ev.toolName}]</span>
                )}
              </span>
            </li>
          ))}
          {warnings && warnings.length > 0 && (
            <li className="mt-1 border-t border-border/30 pt-1 text-amber-600/80">
              {warnings.map((w, i) => (
                <div key={i}>⚠ {w}</div>
              ))}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
