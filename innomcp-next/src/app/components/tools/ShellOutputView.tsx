"use client";
import React, { useMemo } from "react";

export interface ShellOutputViewProps {
  command: string;
  stdout: string;
  stderr?: string;
  exitCode?: number;
  durationMs?: number;
  status: "running" | "completed" | "failed";
}

/** Strip ANSI escape sequences (colors, cursor movement, etc.) */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

export default function ShellOutputView({
  command,
  stdout,
  stderr,
  exitCode,
  durationMs,
  status,
}: ShellOutputViewProps) {
  const cleanStdout = useMemo(() => stripAnsi(stdout), [stdout]);
  const cleanStderr = useMemo(() => (stderr ? stripAnsi(stderr) : ""), [stderr]);

  const exitCodeBadge =
    exitCode !== undefined ? (
      <span
        className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold ${
          exitCode === 0
            ? "bg-green-900/60 text-green-400"
            : "bg-red-900/60 text-red-400"
        }`}
      >
        code {exitCode}
      </span>
    ) : null;

  return (
    <div className="rounded-lg border border-border/40 overflow-hidden font-mono text-[12px]">
      {/* Command bar */}
      <div className="flex items-center gap-2 bg-[#111111] px-3 py-2 border-b border-white/10">
        {status === "running" && (
          <span className="animate-pulse text-yellow-400 text-[10px]">●</span>
        )}
        {status === "completed" && (
          <span className="text-green-400 text-[10px]">●</span>
        )}
        {status === "failed" && (
          <span className="text-red-400 text-[10px]">●</span>
        )}
        <span className="text-[#6b7280] select-none">$</span>
        <span className="text-[#9ca3af] flex-1 truncate">{command}</span>
        <div className="flex items-center gap-2 shrink-0">
          {durationMs !== undefined && (
            <span className="text-[10px] text-[#4b5563]">{durationMs}ms</span>
          )}
          {exitCodeBadge}
        </div>
      </div>

      {/* Output area */}
      <div className="bg-[#1a1a1a] max-h-64 overflow-y-auto">
        {cleanStdout ? (
          <pre className="px-3 py-2 text-[#d4d4d4] whitespace-pre-wrap break-words leading-relaxed">
            {cleanStdout}
          </pre>
        ) : status === "running" ? (
          <div className="px-3 py-2 text-[#4b5563] italic">รอผลลัพธ์…</div>
        ) : null}

        {cleanStderr && (
          <pre className="px-3 py-2 text-[#f87171] whitespace-pre-wrap break-words leading-relaxed border-t border-white/5">
            {cleanStderr}
          </pre>
        )}
      </div>
    </div>
  );
}
