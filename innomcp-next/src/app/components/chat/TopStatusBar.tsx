"use client";
import React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

interface Props {
  modelName?: string;
  connectionStatus: ConnectionStatus;
  runningTasks: number;
  latencyMs?: number;
  tokenCount?: number;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CONNECTION_DOT: Record<ConnectionStatus, string> = {
  connected:    "bg-emerald-500",
  connecting:   "bg-amber-400 animate-pulse",
  disconnected: "bg-rose-500",
};

const CONNECTION_LABEL: Record<ConnectionStatus, string> = {
  connected:    "Connected",
  connecting:   "Connecting…",
  disconnected: "Offline",
};

function formatLatency(ms: number): string {
  if (ms >= 10_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms >= 1_000)  return `${(ms / 1000).toFixed(2)}s`;
  return `${ms}ms`;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M tok`;
  if (count >= 1_000)     return `${(count / 1_000).toFixed(1)}k tok`;
  return `${count} tok`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TopStatusBar({
  modelName,
  connectionStatus,
  runningTasks,
  latencyMs,
  tokenCount,
  className = "",
}: Props) {
  const dotClass = CONNECTION_DOT[connectionStatus];
  const dotTitle = CONNECTION_LABEL[connectionStatus];

  return (
    <div
      className={`flex items-center justify-between h-8 px-3 gap-2 border-b border-border/40 bg-background/80 backdrop-blur-sm text-[11px] text-muted-foreground ${className}`}
    >
      {/* Left: connection dot + model name */}
      <div className="flex items-center gap-1.5 min-w-0 shrink-0">
        <span
          className={`inline-flex w-2 h-2 rounded-full shrink-0 ${dotClass}`}
          title={dotTitle}
          aria-label={dotTitle}
        />
        {modelName ? (
          <span
            className="font-medium text-foreground/80 truncate max-w-[140px]"
            title={modelName}
          >
            {modelName}
          </span>
        ) : (
          <span className="text-muted-foreground/50 italic">{dotTitle}</span>
        )}
      </div>

      {/* Center: running tasks badge (hidden when 0) */}
      <div className="flex-1 flex justify-center">
        {runningTasks > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-[10px] font-semibold leading-none">
            <span
              className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0"
              aria-hidden
            />
            {runningTasks} running
          </span>
        )}
      </div>

      {/* Right: latency + token count */}
      <div className="flex items-center gap-2 shrink-0">
        {latencyMs !== undefined && latencyMs !== null && (
          <span
            className={`tabular-nums font-mono ${
              latencyMs > 5000
                ? "text-amber-500 dark:text-amber-400"
                : "text-muted-foreground/70"
            }`}
            title="Last response latency"
          >
            {formatLatency(latencyMs)}
          </span>
        )}
        {tokenCount !== undefined && tokenCount !== null && tokenCount > 0 && (
          <span
            className="tabular-nums font-mono text-muted-foreground/50"
            title="Token usage"
          >
            {formatTokens(tokenCount)}
          </span>
        )}
      </div>
    </div>
  );
}
