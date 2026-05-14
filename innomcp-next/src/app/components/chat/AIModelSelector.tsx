"use client";

import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faRobot } from "@fortawesome/free-solid-svg-icons";

type AIMode = "local" | "remote" | "hybrid";

interface AIModelSelectorProps {
  theme: string;
  onModeChange?: (mode: AIMode) => void;
}

interface ModeMeta {
  id: AIMode;
  short: string;
  label: string;
  helper: string;
}

const MODES: ModeMeta[] = [
  {
    id: "local",
    short: "ในเครื่อง",
    label: "ประมวลผลในเครื่อง",
    helper: "เร็วและควบคุมข้อมูลได้เอง",
  },
  {
    id: "remote",
    short: "คลาวด์",
    label: "ประมวลผลบนคลาวด์",
    helper: "ใช้พลังโมเดลภายนอกเพิ่มความสามารถ",
  },
  {
    id: "hybrid",
    short: "ผสมผสาน",
    label: "ผสมผสาน",
    helper: "บาลานซ์ความเร็วและความสามารถ",
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
        setCurrentMode(data.mode);
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
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/8 aria-expanded:border-primary/40 aria-expanded:bg-primary/8"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={`โหมด AI: ${current.label} — ${current.helper} (Ctrl+M)`}
      >
        <FontAwesomeIcon icon={faRobot} className="text-muted-foreground" aria-hidden="true" />
        {/* Mobile: a single-letter pill so users still see which mode is active. */}
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-primary/10 px-1 text-[10px] font-semibold uppercase tracking-wider text-primary sm:hidden">
          {current.short.charAt(0)}
        </span>
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
            aria-label="เลือกโหมดประมวลผล AI"
            className="absolute bottom-full right-0 z-[101] mb-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-border/70 bg-card shadow-lg"
          >
            <div className="flex items-start justify-between gap-2 border-b border-border/60 px-3 py-2">
              <div className="min-w-0">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  โหมดประมวลผล AI
                </div>
                <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground/85">
                  เลือกแนวทางให้เหมาะกับงาน
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
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted/60"
                      }`}
                    >
                      <FontAwesomeIcon
                        icon={faRobot}
                        className={isSelected ? "text-primary" : "text-muted-foreground"}
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
                        <svg
                          className="h-4 w-4 shrink-0 text-primary"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M5 12l5 5L20 7" />
                        </svg>
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
