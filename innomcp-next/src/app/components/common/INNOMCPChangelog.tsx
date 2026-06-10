"use client";

import React, { useEffect, useState } from "react";

interface ChangeEntry {
  version: string;
  date: string;
  changes: string[];
  type: "feature" | "fix" | "improvement";
}

const changelogData: ChangeEntry[] = [
  {
    version: "v10.17",
    date: "2026-06-11",
    changes: [
      "ออกแบบใหม่สไตล์ Manus.ai — เค้าโครง 3 คอลัมน์",
      "เพิ่ม ManusWorkspacePanel (งาน/เว็บ/Terminal/ไฟล์)",
      "เพิ่ม MDESBrandHeader พร้อมจัดการ Provider (⚙️)",
      "เพิ่ม CollapsibleAgentWrapper + StatusRibbon",
    ],
    type: "feature",
  },
  {
    version: "v10.16",
    date: "2026-05-14",
    changes: ["MDES multi-agent parallel dispatch พร้อมการยกระดับโมเดล"],
    type: "improvement",
  },
  {
    version: "v10.14",
    date: "2026-05-11",
    changes: ["Playwright 214/214 PASS, ครอบคลุม E2E เต็มรูปแบบ"],
    type: "fix",
  },
];

const typeLabel: Record<ChangeEntry["type"], string> = {
  feature: "ฟีเจอร์ใหม่",
  fix: "แก้ไขบั๊ก",
  improvement: "ปรับปรุง",
};

const typeBadgeColors: Record<ChangeEntry["type"], string> = {
  feature: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  fix: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  improvement: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

interface Props { onClose: () => void; }

export default function INNOMCPChangelog({ onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 ${mounted ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="อัปเดตล่าสุด"
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-background shadow-2xl transition-transform duration-300 ${mounted ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">อัปเดตล่าสุด</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              aria-label="ปิด"
            >✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {changelogData.map((entry) => (
              <div key={entry.version} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-foreground">{entry.version}</span>
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadgeColors[entry.type]}`}>
                    {typeLabel[entry.type]}
                  </span>
                </div>
                <ul className="space-y-1 pl-3">
                  {entry.changes.map((c, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden="true" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
