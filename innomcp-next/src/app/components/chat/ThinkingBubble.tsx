"use client";

import React from "react";

interface ThinkingBubbleProps {
  state: "thinking" | "tool_use" | "analyzing" | "searching";
  toolName?: string;
  model?: string;
  elapsed?: number;
  className?: string;
}

const LABEL_MAP: Record<ThinkingBubbleProps["state"], string> = {
  thinking: "กำลังคิด...",
  tool_use: "ใช้เครื่องมือ",
  analyzing: "กำลังวิเคราะห์...",
  searching: "กำลังค้นหา...",
};

const ThinkingBubble: React.FC<ThinkingBubbleProps> = ({
  state, toolName, model, elapsed, className = "",
}) => {
  const label = state === "tool_use" && toolName
    ? `ใช้เครื่องมือ: ${toolName}`
    : LABEL_MAP[state];

  const elapsedSec = elapsed ? `${(elapsed / 1000).toFixed(1)}s` : null;

  return (
    <div className={`flex items-start gap-2 ${className}`}>
      {/* Avatar placeholder */}
      <div className="h-7 w-7 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
        AI
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-muted/50 border border-border/40 px-3 py-2 flex items-center gap-2 max-w-xs">
        {/* Bouncing dots */}
        <span className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
              aria-hidden="true"
            />
          ))}
        </span>
        <span className="text-[12px] text-muted-foreground">{label}</span>
        {model && (
          <span className="text-[10px] font-mono text-muted-foreground/60">{model}</span>
        )}
        {elapsedSec && (
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">{elapsedSec}</span>
        )}
      </div>
    </div>
  );
};

export default ThinkingBubble;
