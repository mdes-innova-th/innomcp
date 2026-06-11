"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";

// ============================================================
// Types
// ============================================================

interface TerminalLine {
  type: "input" | "output" | "error" | "info" | "success";
  content: string;
  timestamp: number;
  duration?: number;
}

interface AgentEvent {
  type: string;
  toolName: string;
  input?: string;
  output?: string;
  error?: string;
  timestamp: number;
  duration?: number;
  status?: "success" | "error" | "running";
}

interface WorkspaceTerminalPanelProps {
  events: AgentEvent[];
  isStreaming: boolean;
  className?: string;
}

// ============================================================
// Helpers
// ============================================================

/** Convert Unix-ms timestamp to HH:mm:ss string in Thai locale */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("th-TH", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Format duration (ms) to human-readable */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

/** Return true if a toolName refers to a shell execution */
function isShellTool(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes("shell") || lower.includes("exec") || lower.includes("bash");
}

// ============================================================
// Component
// ============================================================

const WorkspaceTerminalPanel: React.FC<WorkspaceTerminalPanelProps> = ({
  events,
  isStreaming,
  className = "",
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto‑scroll to bottom whenever lines change
  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, isStreaming]);

  // Build terminal lines from shell events
  const lines = useMemo<TerminalLine[]>(() => {
    const shellEvents = events.filter(
      (e) => e.toolName && isShellTool(e.toolName)
    );

    const resultLines: TerminalLine[] = [];

    for (const evt of shellEvents) {
      // 1) Input line – green prompt
      if (evt.input !== undefined && evt.input !== null) {
        resultLines.push({
          type: "input",
          content: evt.input,
          timestamp: evt.timestamp,
        });
      }

      // 2) Output lines – white, split by newline (if any)
      if (evt.output) {
        const outLines = evt.output.split("\n");
        for (const line of outLines) {
          resultLines.push({
            type: "output",
            content: line,
            timestamp: evt.timestamp,
            duration: evt.duration,
          });
        }
      }

      // 3) Error lines – red, split by newline
      if (evt.error) {
        const errLines = evt.error.split("\n");
        for (const line of errLines) {
          resultLines.push({
            type: "error",
            content: line,
            timestamp: evt.timestamp,
            duration: evt.duration,
          });
        }
      }

      // (Optional) we could insert a success/info line after a completed command,
      // but the spec only asks for output/error lines – skipping for now.
    }

    return resultLines;
  }, [events]);

  const isEmpty = lines.length === 0;

  return (
    <div
      className={`flex flex-col bg-slate-950 p-4 overflow-auto font-mono text-[13px] leading-6 ${className}`}
    >
      {/* Terminal content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 pr-1">
        {isEmpty ? (
          /* Empty state */
          <div className="flex items-center text-slate-500 select-none">
            <span className="mr-1">ยังไม่มีคำสั่งที่รัน</span>
            <span className="opacity-40 animate-pulse">▍</span>
          </div>
        ) : (
          /* Render each terminal line */
          <div className="space-y-0.5">
            {lines.map((line, idx) => {
              const timeStr = formatTime(line.timestamp);
              const durStr =
                line.duration !== undefined
                  ? ` (${formatDuration(line.duration)})`
                  : "";

              // Line type colours & prefix
              let lineColor = "text-white/90";
              let prefix = "";

              switch (line.type) {
                case "input":
                  lineColor = "text-green-400";
                  prefix = "$ ";
                  break;
                case "error":
                  lineColor = "text-red-400";
                  break;
                case "info":
                  lineColor = "text-cyan-400";
                  break;
                case "success":
                  lineColor = "text-green-300";
                  break;
                case "output":
                default:
                  lineColor = "text-white/90";
              }

              return (
                <div
                  key={`${idx}-${line.timestamp}`}
                  className="flex justify-between items-start group"
                >
                  {/* Left side: prompt + content */}
                  <span className={`${lineColor} break-all whitespace-pre-wrap`}>
                    {prefix}
                    {line.content}
                  </span>

                  {/* Right side: timestamp & duration */}
                  <span className="flex-shrink-0 ml-4 text-xs text-slate-500 text-right tabular-nums">
                    {timeStr}
                    {durStr}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceTerminalPanel;
export type { WorkspaceTerminalPanelProps, TerminalLine, AgentEvent };