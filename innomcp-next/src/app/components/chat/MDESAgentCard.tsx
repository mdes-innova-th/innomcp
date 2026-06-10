"use client";

import { useEffect, useState } from "react";

interface MDESAgentCardProps {
  agentId: string;
  model: string;
  status: "thinking" | "using-tool" | "done" | "error";
  publicSummary?: string;
  toolName?: string;
  latencyMs?: number;
  className?: string;
}

const statusConfig = {
  thinking: {
    icon: "🤔",
    label: "กำลังคิด",
    borderColor: "border-indigo-500",
    ringColor: "border-indigo-500 text-indigo-600",
    bg: "bg-indigo-50/30",
  },
  "using-tool": {
    icon: "🔧",
    label: "ใช้เครื่องมือ",
    borderColor: "border-amber-500",
    ringColor: "border-amber-500 text-amber-600",
    bg: "bg-amber-50/30",
  },
  done: {
    icon: "✅",
    label: "เสร็จสิ้น",
    borderColor: "border-green-500",
    ringColor: "border-green-500 text-green-600",
    bg: "bg-green-50/30",
  },
  error: {
    icon: "❌",
    label: "ข้อผิดพลาด",
    borderColor: "border-red-500",
    ringColor: "border-red-500 text-red-600",
    bg: "bg-red-50/30",
  },
};

export default function MDESAgentCard({
  agentId,
  model,
  status,
  publicSummary,
  toolName,
  latencyMs,
  className = "",
}: MDESAgentCardProps) {
  const [mounted, setMounted] = useState(false);
  const config = statusConfig[status];

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <style>
        {`
          @keyframes pulse-border-indigo {
            0%, 100% { border-color: #6366f1; } /* indigo-500 */
            50% { border-color: #a5b4fc; } /* indigo-300 */
          }
          .pulse-indigo {
            animation: pulse-border-indigo 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
        `}
      </style>
      <div
        className={`
          flex items-center gap-3 rounded-lg border-2 p-3 
          ${config.borderColor} ${config.bg} 
          ${status === "thinking" ? "pulse-indigo" : ""} 
          transition-all duration-300 ease-out
          ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}
          ${className}
        `}
        role="status"
        aria-label={`Agent ${agentId}: ${config.label}`}
      >
        {/* Status icon with colored ring */}
        <div
          className={`
            flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm
            ${config.ringColor}
          `}
          aria-hidden="true"
        >
          <span className="leading-none">{config.icon}</span>
        </div>

        {/* Center: agent info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-sm font-medium text-gray-900">
              {agentId}
            </span>
            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
              {model}
            </span>
            {status === "using-tool" && toolName && (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                🔧 {toolName}
              </span>
            )}
          </div>
          {publicSummary && (
            <p className="truncate text-xs text-gray-500 mt-0.5">
              {publicSummary}
            </p>
          )}
        </div>

        {/* Right: latency (only when done) */}
        {status === "done" && latencyMs != null && (
          <div className="shrink-0 text-xs text-gray-500">
            {latencyMs}ms
          </div>
        )}
      </div>
    </>
  );
}