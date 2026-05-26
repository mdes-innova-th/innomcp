"use client";
import React, { useEffect } from "react";
import Link from "next/link";

const SHORTCUTS = [
  {
    category: "Navigation",
    items: [
      { keys: ["Ctrl", "D"], action: "ไปหน้า Dashboard" },
      { keys: ["Ctrl", "P"], action: "ไปหน้า Projects" },
      { keys: ["Ctrl", "H"], action: "Task History" },
      { keys: ["Ctrl", "K"], action: "Command Palette" },
      { keys: ["Ctrl", "/"], action: "Keyboard Shortcuts" },
    ],
  },
  {
    category: "Theme & Display",
    items: [
      { keys: ["Ctrl", "Shift", "T"], action: "Toggle Dark/Light Mode" },
    ],
  },
  {
    category: "Chat",
    items: [
      { keys: ["Enter"], action: "ส่งข้อความ" },
      { keys: ["Shift", "Enter"], action: "ขึ้นบรรทัดใหม่" },
      { keys: ["Esc"], action: "ปิด Command Palette / Modal" },
      { keys: ["🎙️"], action: "กดปุ่มไมค์เพื่อพูด (Thai STT)" },
    ],
  },
  {
    category: "Task Detail",
    items: [
      { keys: ["▶ Replay"], action: "เล่นซ้ำ events ของ task" },
      { keys: ["📦 Export ZIP"], action: "ดาวน์โหลด artifacts" },
      { keys: ["⬇ Events JSON"], action: "Export event log" },
    ],
  },
];

export default function ShortcutsPage() {
  useEffect(() => {
    document.title = "Shortcuts — INNOMCP";
  }, []);

  return (
    <>
      <style>{`
        @media print {
          .print-hidden { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-full { max-width: 100% !important; padding: 0 !important; }
          .print-card {
            border: 1px solid #d1d5db !important;
            box-shadow: none !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-kbd {
            border: 1px solid #9ca3af !important;
            background: #f3f4f6 !important;
            color: black !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-4 py-8 print-full">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between print-hidden">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </Link>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-3 py-1.5 text-sm text-foreground hover:bg-muted/70 transition-colors print-hidden"
            >
              🖨️ Print
            </button>
          </div>

          {/* Title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              ⌨️ Keyboard Shortcuts
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Quick reference for INNOMCP keyboard shortcuts and actions
            </p>
          </div>

          {/* Shortcut Cards */}
          <div className="space-y-6">
            {SHORTCUTS.map((section) => (
              <div
                key={section.category}
                className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm print-card"
              >
                {/* Category Header */}
                <div className="border-b border-border/50 bg-muted/30 px-4 py-2.5">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {section.category}
                  </h2>
                </div>

                {/* Table */}
                <table className="w-full">
                  <tbody>
                    {section.items.map((item, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                      >
                        {/* Keys column */}
                        <td className="w-48 px-4 py-2.5">
                          <span className="flex flex-wrap items-center gap-1">
                            {item.keys.map((key, j) => (
                              <React.Fragment key={j}>
                                <kbd className="inline-flex items-center justify-center rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-foreground print-kbd">
                                  {key}
                                </kbd>
                                {j < item.keys.length - 1 && (
                                  <span className="text-[11px] text-muted-foreground/70">+</span>
                                )}
                              </React.Fragment>
                            ))}
                          </span>
                        </td>

                        {/* Action column */}
                        <td className="px-4 py-2.5 text-sm text-foreground">
                          {item.action}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-[11px] text-muted-foreground print-hidden">
            INNOMCP Phase 6 — Keyboard Shortcuts Reference
          </div>
        </div>
      </div>
    </>
  );
}
