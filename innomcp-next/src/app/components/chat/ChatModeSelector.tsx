"use client";

import React from "react";
import { Zap, BrainCircuit } from "lucide-react";

/**
 * ChatModeSelector — Phase 10.68
 * Unified replacement for AIModelSelector + ThinkingModeToggle.
 *
 * ธรรมดา  = local provider + 1 small fast MDES model (≤2 agents, quick)
 * MultiAgent = full MDES fan-out + thinking mode (comprehensive, slower)
 */
export type ChatMode = "normal" | "multiagent";

interface ChatModeSelectorProps {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
  disabled?: boolean;
}

const META: Record<ChatMode, {
  label: string;
  shortLabel: string;
  desc: string;
  Icon: React.ElementType;
  cls: string;
}> = {
  normal: {
    label: "ธรรมดา",
    shortLabel: "ธรรมดา",
    desc: "เร็ว · ใช้ local + MDES โมเดลเล็ก 1 ตัว",
    Icon: Zap,
    cls: "border-sky-500/40 bg-sky-500/8 text-sky-800 dark:text-sky-200 hover:bg-sky-500/14",
  },
  multiagent: {
    label: "MultiAgent",
    shortLabel: "Multi",
    desc: "ลึก · MDES หลายตัวแทน + คิดแบบ full-pipeline",
    Icon: BrainCircuit,
    cls: "border-emerald-500/45 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/16",
  },
};

const INACTIVE =
  "border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground";

export default function ChatModeSelector({
  mode,
  onChange,
  disabled = false,
}: ChatModeSelectorProps) {
  return (
    <div
      role="group"
      aria-label="โหมด AI"
      className="inline-flex items-center rounded-full border border-border/60 bg-background/80 p-0.5 shadow-sm backdrop-blur-sm"
    >
      {(["normal", "multiagent"] as ChatMode[]).map((m) => {
        const { shortLabel, desc, Icon, cls } = META[m];
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            data-testid={`chat-mode-${m}`}
            title={desc}
            onClick={() => onChange(m)}
            className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              active ? cls : INACTIVE
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
