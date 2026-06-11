"use client";

import React, { useState, useEffect } from "react";

interface AgentState { agentId: string; model: string; status: "thinking" | "tool" | "done"; }

interface MDESStreamIndicatorProps {
  isStreaming: boolean;
  agentStates?: AgentState[];
  streamStatus?: string;
  elapsed?: number;
  className?: string;
}

function getModelInitial(model: string): string {
  if (model.includes("gemma"))    return "G";
  if (model.includes("qwen"))     return "Q";
  if (model.includes("deepseek")) return "D";
  if (model.includes("llama"))    return "L";
  if (model.includes("mistral"))  return "M";
  return model[0]?.toUpperCase() || "?";
}

const INITIAL_COLORS: Record<string, string> = {
  G: "bg-indigo-500", Q: "bg-sky-500", D: "bg-violet-500",
  L: "bg-amber-500",  M: "bg-rose-500",
};

const MDESStreamIndicator: React.FC<MDESStreamIndicatorProps> = ({
  isStreaming, agentStates = [], streamStatus = "idle", elapsed = 0, className = "",
}) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isStreaming) return;
    const id = setInterval(() => setTick(t => t + 1), 100);
    return () => clearInterval(id);
  }, [isStreaming]);

  if (!isStreaming && streamStatus === "idle") return null;

  const displayElapsed = elapsed > 0 ? elapsed : tick * 100;
  const sec = (displayElapsed / 1000).toFixed(1);
  const activeAgents = agentStates.filter(a => a.status !== "done");

  if (streamStatus === "streaming") return null;

  if (!isStreaming && streamStatus === "done") {
    return (
      <div className={`flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 ${className}`}>
        <span>✅</span><span>เสร็จสิ้น · {sec}s</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {activeAgents.length > 0 && (
        <div className="flex -space-x-1">
          {activeAgents.slice(0, 4).map((a) => {
            const initial = getModelInitial(a.model);
            const color = INITIAL_COLORS[initial] || "bg-gray-500";
            return (
              <span key={a.agentId}
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ring-1 ring-background ${color} ${a.status === "thinking" ? "animate-pulse" : ""}`}
                title={a.model}>{initial}</span>
            );
          })}
        </div>
      )}
      <span className="text-[11px] text-muted-foreground">
        {activeAgents.length > 0
          ? `MDES AI ${activeAgents.length} ตัวกำลังคิด · ${sec}s`
          : streamStatus === "starting" ? "MDES AI กำลังเริ่มต้น..."
          : `กำลังประมวลผล · ${sec}s`}
      </span>
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" aria-hidden="true" />
    </div>
  );
};

export default MDESStreamIndicator;
