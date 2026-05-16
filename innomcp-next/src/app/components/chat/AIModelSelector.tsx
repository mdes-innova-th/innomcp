"use client";

import React, { useEffect, useRef, useState } from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBolt,
  faBrain,
  faCheck,
  faChevronDown,
  faLayerGroup,
} from "@fortawesome/free-solid-svg-icons";

export type AIMode = "local" | "remote" | "hybrid";

interface AIModelSelectorProps {
  theme: string;
  onModeChange?: (mode: AIMode) => void;
}

interface ModeMeta {
  id: AIMode;
  short: string;
  label: string;
  helper: string;
  icon: IconDefinition;
  tone: string;
  selectedTone: string;
}

const MODES: ModeMeta[] = [
  {
    id: "local",
    short: "ในเครื่อง",
    label: "ประมวลผลในเครื่อง",
    helper: "ตอบไว ควบคุมข้อมูลเอง เหมาะกับงานตรงไปตรงมา",
    icon: faBolt,
    tone: "text-sky-700 dark:text-sky-300",
    selectedTone: "bg-sky-500/10 text-sky-800 ring-sky-500/25 dark:text-sky-200",
  },
  {
    id: "remote",
    short: "คลาวด์",
    label: "ประมวลผลบนคลาวด์",
    helper: "ใช้โมเดลภายนอกเพิ่มความสามารถเมื่องานซับซ้อน",
    icon: faBrain,
    tone: "text-slate-700 dark:text-slate-200",
    selectedTone: "bg-slate-500/10 text-slate-900 ring-slate-500/25 dark:text-slate-100",
  },
  {
    id: "hybrid",
    short: "ผสม",
    label: "ผสมหลายระบบ",
    helper: "บาลานซ์ความเร็ว ความสามารถ และเครื่องมือประกอบ",
    icon: faLayerGroup,
    tone: "text-emerald-700 dark:text-emerald-300",
    selectedTone: "bg-emerald-500/10 text-emerald-900 ring-emerald-500/25 dark:text-emerald-100",
  },
];

const AIModelSelector: React.FC<AIModelSelectorProps> = ({ theme: _theme, onModeChange }) => {
  const [currentMode, setCurrentMode] = useState<AIMode>("local");
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    void fetchCurrentMode();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // Global shortcut: Ctrl+M (or Cmd+M on Mac) toggles the AI mode menu.
  // Skip when an input is focused so users typing "m" don't trigger it.
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      const isTogglerCombo = (e.ctrlKey || e.metaKey) && (e.key === "m" || e.key === "M");
      if (!isTogglerCombo) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || (t && t.isContentEditable)) return;
      e.preventDefault();
      setIsOpen((v) => !v);
      buttonRef.current?.focus();
    };
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, []);

  const fetchCurrentMode = async () => {
    try {
      const backendHost = process.env.NEXT_PUBLIC_NODE_HOST || "http://localhost:3011";
      const response = await fetch(`${backendHost}/api/ai-mode`);
      if (response.ok) {
        const data = await response.json();
        if (data.mode === "local" || data.mode === "remote" || data.mode === "hybrid") {
          setCurrentMode(data.mode);
          onModeChange?.(data.mode);
        }
      }
    } catch (error) {
      console.error("Failed to fetch AI mode:", error);
    }
  };

  const handleModeChange = async (mode: AIMode) => {
    try {
      const backendHost = process.env.NEXT_PUBLIC_NODE_HOST || "http://localhost:3011";
      const response = await fetch(`${backendHost}/api/ai-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (response.ok) {
        await response.json();
        setCurrentMode(mode);
        setIsOpen(false);
        onModeChange?.(mode);
        buttonRef.current?.focus();
      } else {
        console.error("Failed to change AI mode");
      }
    } catch (error) {
      console.error("Error changing AI mode:", error);
    }
  };

  const current = MODES.find((m) => m.id === currentMode) ?? MODES[0];

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        data-testid="ai-mode-button"
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 aria-expanded:border-emerald-500/35 aria-expanded:bg-emerald-500/10"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={`เส้นทาง AI: ${current.label} — ${current.helper} (Ctrl+M)`}
      >
        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ring-1 ring-inset ${current.selectedTone}`}>
          <FontAwesomeIcon icon={current.icon} className="text-[10px]" aria-hidden="true" />
        </span>
        <span className="sm:hidden">AI</span>
        <span className="hidden truncate sm:inline">{current.short}</span>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`text-[10px] text-muted-foreground transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="ปิดเมนูโหมด AI"
            className="fixed inset-0 z-[100] cursor-default bg-transparent"
            onClick={() => setIsOpen(false)}
          />

          <div
            role="listbox"
            aria-label="เลือกเส้นทางประมวลผล AI"
            className="absolute bottom-full right-0 z-[101] mb-2 w-[min(19rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-border/70 bg-card shadow-lg"
          >
            <div className="flex items-start justify-between gap-2 border-b border-border/60 px-3 py-2">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-foreground/85">
                  เส้นทางประมวลผล AI
                </div>
                <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground/85">
                  เลือกแหล่งประมวลผลให้เหมาะกับโจทย์
                </div>
              </div>
              <kbd className="shrink-0 rounded border border-border/60 bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                Ctrl+M
              </kbd>
            </div>

            <ul className="space-y-0.5 p-1.5">
              {MODES.map((mode) => {
                const isSelected = currentMode === mode.id;
                return (
                  <li key={mode.id}>
                    <button
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleModeChange(mode.id)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors ${
                        isSelected
                          ? `${mode.selectedTone} ring-1 ring-inset`
                          : "text-foreground hover:bg-muted/60"
                      }`}
                    >
                      <FontAwesomeIcon
                        icon={mode.icon}
                        className={isSelected ? mode.tone : "text-muted-foreground"}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium leading-tight">
                          {mode.label}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] leading-snug text-muted-foreground">
                          {mode.helper}
                        </span>
                      </span>
                      {isSelected && (
                        <FontAwesomeIcon icon={faCheck} className={`h-4 w-4 shrink-0 ${mode.tone}`} aria-hidden="true" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default AIModelSelector;
