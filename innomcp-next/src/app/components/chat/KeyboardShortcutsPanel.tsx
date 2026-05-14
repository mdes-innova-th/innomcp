"use client";

import React, { useEffect, useState } from "react";

interface Shortcut {
  keys: string[];
  description: string;
  context?: string;
}

const SHORTCUTS: { group: string; items: Shortcut[] }[] = [
  {
    group: "ทั่วไป",
    items: [
      { keys: ["?"], description: "เปิด/ปิดแผงคีย์ลัด" },
      { keys: ["Esc"], description: "ปิดหน้าต่างที่กำลังเปิดอยู่" },
    ],
  },
  {
    group: "การสนทนา",
    items: [
      { keys: ["Enter"], description: "ส่งข้อความ", context: "ในช่องพิมพ์" },
      { keys: ["Shift", "Enter"], description: "ขึ้นบรรทัดใหม่", context: "ในช่องพิมพ์" },
      { keys: ["Ctrl", "K"], description: "เริ่มการสนทนาใหม่" },
      { keys: ["Ctrl", "/"], description: "โฟกัสที่ช่องพิมพ์" },
    ],
  },
  {
    group: "AI Mode + เครื่องมือ",
    items: [
      { keys: ["Ctrl", "M"], description: "เปิดเมนูเลือกโหมด AI" },
      { keys: ["Ctrl", "O"], description: "ดู/ซ่อน เบื้องหลังการคิด (multi-agent)" },
    ],
  },
];

function isMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

function fmtKey(key: string) {
  if (key === "Ctrl") return isMac() ? "⌘" : "Ctrl";
  return key;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsPanel({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div
      data-testid="keyboard-shortcuts-panel"
      role="dialog"
      aria-modal="true"
      aria-label="คีย์ลัด"
      className="fixed inset-0 z-[150] flex items-start justify-center bg-black/40 px-4 pt-20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">คีย์ลัด</h2>
            <p className="text-[12px] text-muted-foreground">เร่งความเร็วในการใช้งาน INNOMCP</p>
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
          {SHORTCUTS.map((group) => (
            <div key={group.group} className="mb-4 last:mb-0">
              <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {group.group}
              </h3>
              <ul className="space-y-1">
                {group.items.map((sc, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-[13px] hover:bg-muted/40">
                    <span className="min-w-0 flex-1 text-foreground">
                      {sc.description}
                      {sc.context && (
                        <span className="ml-1.5 text-[11px] text-muted-foreground">({sc.context})</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {sc.keys.map((key, j) => (
                        <React.Fragment key={j}>
                          <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-border/60 bg-background px-1.5 font-mono text-[11px] font-medium text-foreground shadow-[0_1px_0_var(--border)]">
                            {fmtKey(key)}
                          </kbd>
                          {j < sc.keys.length - 1 && (
                            <span className="text-[11px] text-muted-foreground/70">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border/60 bg-muted/30 px-4 py-2 text-center text-[11px] text-muted-foreground">
          กด <kbd className="rounded border border-border/60 bg-background px-1 py-0.5 font-mono text-[10px]">?</kbd> หรือ <kbd className="rounded border border-border/60 bg-background px-1 py-0.5 font-mono text-[10px]">Esc</kbd> เพื่อปิด
        </div>
      </div>
    </div>
  );
}

/**
 * Wire global "?" hotkey from any parent — returns [isOpen, setOpen].
 * Ignores when the user is typing in an input/textarea.
 */
export function useKeyboardShortcutsPanel(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        return;
      }
      if (e.key !== "?" || e.shiftKey === false) {
        // "?" requires Shift+/ on most layouts; allow either way.
      }
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || (t && t.isContentEditable)) return;
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return [open, setOpen];
}
