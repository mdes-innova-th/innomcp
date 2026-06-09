"use client";

/**
 * ToolCallCard — collapsible card for a single MCP/agent tool call.
 *
 * Collapsed view : tool-name badge + status dot + optional duration
 * Expanded view  : prettified JSON of input and output, with secrets masked
 *
 * Risk level colour coding:
 *   low      → green
 *   medium   → yellow
 *   high     → orange
 *   critical → red
 */

import React, { useState } from "react";
import { maskSecrets } from "@/utils/maskSecrets";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolCallCardProps {
  toolName: string;
  input: unknown;
  output?: unknown;
  status: "running" | "completed" | "failed";
  durationMs?: number;
  riskLevel?: "low" | "medium" | "high" | "critical";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1_000)}s`;
}

const STATUS_DOT: Record<ToolCallCardProps["status"], string> = {
  running: "animate-pulse bg-amber-400 dark:bg-amber-300",
  completed: "bg-emerald-500 dark:bg-emerald-400",
  failed: "bg-rose-500 dark:bg-rose-400",
};

const STATUS_LABEL: Record<ToolCallCardProps["status"], string> = {
  running: "กำลังทำงาน",
  completed: "สำเร็จ",
  failed: "ล้มเหลว",
};

const RISK_BADGE: Record<
  NonNullable<ToolCallCardProps["riskLevel"]>,
  { bg: string; text: string; label: string }
> = {
  low: {
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    text: "text-emerald-700 dark:text-emerald-300",
    label: "low",
  },
  medium: {
    bg: "bg-yellow-100 dark:bg-yellow-900/40",
    text: "text-yellow-700 dark:text-yellow-300",
    label: "medium",
  },
  high: {
    bg: "bg-orange-100 dark:bg-orange-900/40",
    text: "text-orange-700 dark:text-orange-300",
    label: "high",
  },
  critical: {
    bg: "bg-rose-100 dark:bg-rose-900/40",
    text: "text-rose-700 dark:text-rose-300",
    label: "critical",
  },
};

const RISK_BORDER: Record<NonNullable<ToolCallCardProps["riskLevel"]>, string> = {
  low: "border-emerald-300 dark:border-emerald-700",
  medium: "border-yellow-300 dark:border-yellow-700",
  high: "border-orange-300 dark:border-orange-700",
  critical: "border-rose-400 dark:border-rose-600",
};

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const masked = maskSecrets(value);
  const text = JSON.stringify(masked, null, 2);

  return (
    <div className="mt-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <pre
        className={[
          "overflow-x-auto rounded border border-border/40",
          "bg-muted/40 dark:bg-muted/20",
          "px-3 py-2 text-[11px] leading-relaxed",
          "text-foreground/90 whitespace-pre-wrap break-all",
        ].join(" ")}
      >
        {text}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ToolCallCard({
  toolName,
  input,
  output,
  status,
  durationMs,
  riskLevel,
}: ToolCallCardProps) {
  const [open, setOpen] = useState(false);

  const borderClass = riskLevel ? RISK_BORDER[riskLevel] : "border-border/40";
  const risk = riskLevel ? RISK_BADGE[riskLevel] : null;

  return (
    <div
      data-testid="tool-call-card"
      className={[
        "rounded-md border transition-colors",
        "bg-card dark:bg-card/80",
        borderClass,
        "text-xs",
      ].join(" ")}
    >
      {/* ----------------------------------------------------------------- */}
      {/* Collapsed header / toggle                                          */}
      {/* ----------------------------------------------------------------- */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex w-full items-center gap-2 px-3 py-2 text-left",
          "hover:bg-muted/30 dark:hover:bg-muted/20 transition-colors",
          "rounded-md",
          open ? "rounded-b-none" : "",
        ].join(" ")}
      >
        {/* Status dot */}
        <span
          aria-label={STATUS_LABEL[status]}
          className={[
            "inline-block h-2 w-2 shrink-0 rounded-full",
            STATUS_DOT[status],
          ].join(" ")}
        />

        {/* Tool name badge */}
        <span className="inline-flex items-center rounded bg-muted/60 dark:bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground/90">
          {toolName}
        </span>

        {/* Risk badge */}
        {risk && (
          <span
            className={[
              "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold",
              risk.bg,
              risk.text,
            ].join(" ")}
          >
            {risk.label}
          </span>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Duration */}
        {durationMs !== undefined && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {formatDuration(durationMs)}
          </span>
        )}

        {/* Expand chevron */}
        <span className="text-muted-foreground" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>

      {/* ----------------------------------------------------------------- */}
      {/* Expanded body                                                       */}
      {/* ----------------------------------------------------------------- */}
      {open && (
        <div className="border-t border-border/30 px-3 pb-3 pt-2">
          <JsonBlock label="Input" value={input} />
          {output !== undefined && <JsonBlock label="Output" value={output} />}
        </div>
      )}
    </div>
  );
}
