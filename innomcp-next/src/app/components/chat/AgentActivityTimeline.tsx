"use client";
import React, { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentTimelineEvent {
  id: string;
  event_type: string;
  content: string;
  metadata_json?: string | Record<string, unknown> | null;
  created_at: string;
}

interface Props {
  events: AgentTimelineEvent[];
  /** compact = badges only, no text body */
  compact?: boolean;
  className?: string;
}

// ─── Event metadata ───────────────────────────────────────────────────────────

const EVENT_ICON: Record<string, string> = {
  "task.created":     "📋",
  "plan.created":     "🗺️",
  "phase.started":    "🚀",
  "agent.started":    "🤖",
  "tool.started":     "🔧",
  "tool.completed":   "✅",
  "artifact.created": "📦",
  "approval.required":"⏳",
  "qa.started":       "🔍",
  "task.completed":   "🎯",
};

const EVENT_BADGE_STYLE: Record<string, string> = {
  "task.created":     "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "plan.created":     "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "phase.started":    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  "agent.started":    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "tool.started":     "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "tool.completed":   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "artifact.created": "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  "approval.required":"bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  "qa.started":       "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "task.completed":   "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

const PHASE_HEADER_STYLE = "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-300/30 dark:border-indigo-700/40";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBadgeStyle(event_type: string): string {
  return EVENT_BADGE_STYLE[event_type] ?? "bg-muted/40 text-muted-foreground";
}

function getIcon(event_type: string): string {
  return EVENT_ICON[event_type] ?? "🔔";
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

function parseMetadata(raw: string | Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ─── Phase grouping ───────────────────────────────────────────────────────────

interface PhaseGroup {
  phaseId: string;
  phaseLabel: string;
  events: AgentTimelineEvent[];
}

function groupByPhase(events: AgentTimelineEvent[]): PhaseGroup[] {
  const groups: PhaseGroup[] = [];
  let currentGroup: PhaseGroup = {
    phaseId: "__pre__",
    phaseLabel: "Pre-task",
    events: [],
  };

  for (const ev of events) {
    if (ev.event_type === "phase.started") {
      if (currentGroup.events.length > 0) {
        groups.push(currentGroup);
      }
      const meta = parseMetadata(ev.metadata_json);
      const label =
        typeof meta.phase_name === "string"
          ? meta.phase_name
          : typeof meta.phase === "string"
          ? meta.phase
          : ev.content || `Phase`;
      currentGroup = {
        phaseId: ev.id,
        phaseLabel: label,
        events: [ev],
      };
    } else {
      currentGroup.events.push(ev);
    }
  }

  if (currentGroup.events.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EventBadge({ event_type }: { event_type: string }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none shrink-0 ${getBadgeStyle(event_type)}`}
      title={event_type}
    >
      <span>{getIcon(event_type)}</span>
      <span className="hidden sm:inline">{event_type}</span>
    </span>
  );
}

function EventRow({
  ev,
  isLast,
  compact,
}: {
  ev: AgentTimelineEvent;
  isLast: boolean;
  compact: boolean;
}) {
  const timeStr = formatTime(ev.created_at);

  if (compact) {
    return (
      <li className="flex items-center" title={ev.content}>
        <EventBadge event_type={ev.event_type} />
      </li>
    );
  }

  return (
    <li className="relative flex items-start gap-3 pb-3">
      {/* Timeline spine */}
      {!isLast && (
        <span
          aria-hidden="true"
          className="absolute left-[10px] top-[20px] w-px bg-border/40 bottom-0"
        />
      )}

      {/* Icon bubble */}
      <span className="shrink-0 w-[20px] h-[20px] rounded-full bg-muted/30 border border-border/40 flex items-center justify-center text-[10px] leading-none z-10">
        {getIcon(ev.event_type)}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-[1px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-flex rounded px-1.5 py-0.5 text-[9.5px] font-medium leading-none ${getBadgeStyle(ev.event_type)}`}
          >
            {ev.event_type}
          </span>
          {timeStr && (
            <span className="text-[9.5px] text-muted-foreground/60 tabular-nums">
              {timeStr}
            </span>
          )}
        </div>
        {ev.content && (
          <p className="text-[11.5px] text-foreground/80 mt-0.5 leading-snug line-clamp-2">
            {ev.content}
          </p>
        )}
      </div>
    </li>
  );
}

function PhaseSection({
  group,
  compact,
  defaultExpanded,
}: {
  group: PhaseGroup;
  compact: boolean;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isPreTask = group.phaseId === "__pre__";

  if (isPreTask && group.events.length === 0) return null;

  return (
    <div className="mb-1">
      {/* Phase header — clickable toggle */}
      {!isPreTask && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`w-full flex items-center gap-1.5 rounded px-2 py-1 text-left mb-1 transition-colors hover:opacity-80 ${PHASE_HEADER_STYLE}`}
        >
          <span className="text-[10px] leading-none select-none">
            {expanded ? "▾" : "▸"}
          </span>
          <span className="text-[10.5px] font-semibold leading-none truncate flex-1">
            {group.phaseLabel}
          </span>
          <span className="text-[9.5px] text-muted-foreground/60 shrink-0 tabular-nums">
            {group.events.length} events
          </span>
        </button>
      )}

      {expanded && (
        <ol
          className={`relative flex ${compact ? "flex-row flex-wrap gap-1 pl-1" : "flex-col pl-2"}`}
        >
          {group.events.map((ev, idx) => (
            <EventRow
              key={ev.id}
              ev={ev}
              isLast={idx === group.events.length - 1}
              compact={compact}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentActivityTimeline({
  events,
  compact = false,
  className = "",
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const groups = groupByPhase(events);

  // Auto-scroll to latest event
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div
        className={`rounded-xl border border-border/30 bg-muted/10 p-5 text-center text-[12px] text-muted-foreground ${className}`}
      >
        <span className="text-2xl block mb-1.5">🕐</span>
        No agent events yet
      </div>
    );
  }

  return (
    <div
      className={`overflow-y-auto flex flex-col pr-1 ${className}`}
      style={{ scrollbarWidth: "thin" }}
    >
      {groups.map((group, idx) => (
        <PhaseSection
          key={group.phaseId}
          group={group}
          compact={compact}
          /* last phase starts expanded, others start collapsed */
          defaultExpanded={idx === groups.length - 1}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
