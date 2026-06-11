"use client";

import React from "react";
function cn(...c: (string|undefined|null|false)[]) { return c.filter(Boolean).join(' '); }

interface ModelChipProps {
  /** Name of the model that generated the response */
  model: string;
  /** Optional latency in milliseconds to display */
  latencyMs?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ModelChip — compact model name chip for AI messages in INNOMCP.
 * Shows which model generated the response with optional latency.
 */
export function ModelChip({ model, latencyMs, className }: ModelChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5",
        "bg-muted/50 text-[10px] font-mono leading-tight text-muted-foreground",
        className
      )}
    >
      <span className="truncate max-w-[8rem]">{model}</span>
      {latencyMs !== undefined && latencyMs >= 0 && (
        <span className="opacity-70 text-[9px]">· {latencyMs}ms</span>
      )}
    </span>
  );
}