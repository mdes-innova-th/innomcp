"use client";

import { BrainCircuit, Gauge } from "lucide-react";

export type ReasoningMode = "normal" | "thinking";

interface ThinkingModeToggleProps {
  mode: ReasoningMode;
  onModeChange: (mode: ReasoningMode) => void;
  disabled?: boolean;
}

export default function ThinkingModeToggle({
  mode,
  onModeChange,
  disabled = false,
}: ThinkingModeToggleProps) {
  const isThinking = mode === "thinking";

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={isThinking}
      data-testid="thinking-mode-toggle"
      onClick={() => onModeChange(isThinking ? "normal" : "thinking")}
      title={
        isThinking
          ? "กำลังใช้โหมดคิดลึก: ใช้ multi-agent เต็มรูปแบบ ใช้เวลานานขึ้น"
          : "เปิดโหมดคิดลึกเมื่อโจทย์ต้องวิเคราะห์หลายขั้น"
      }
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        isThinking
          ? "border-emerald-500/45 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/15 dark:text-emerald-200"
          : "border-border/70 bg-background text-foreground hover:border-emerald-500/30 hover:bg-emerald-500/10"
      }`}
    >
      {isThinking ? (
        <BrainCircuit className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Gauge className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{isThinking ? "กำลังคิดลึก" : "คิดลึก"}</span>
    </button>
  );
}
