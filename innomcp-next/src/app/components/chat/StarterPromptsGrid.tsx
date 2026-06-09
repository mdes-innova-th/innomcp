"use client";

import React from "react";

export const STARTER_PROMPTS = [
  {
    icon: "🧭",
    title: "วิเคราะห์ข้อมูลภัยพิบัติ",
    description: "สรุปข้อมูลประกาศเตือนภัยพิบัติ ล่าสุดจากกรมอุตุนิยมวิทยา",
    query: "วิเคราะห์ข้อมูลภัยพิบัติล่าสุดจากประกาศกรมอุตุนิยมวิทยาให้หน่อย",
    accent: "from-sky-500/16 via-sky-500/8 to-transparent",
  },
  {
    icon: "📊",
    title: "วิเคราะห์ตารางสถิติและข้อมูลทั่วไป",
    description: "ส่งไฟล์ตารางหรือ CSV และให้วิเคราะห์ความสอดคล้องหรือคำนวณเบื้องต้น",
    query: "วิเคราะห์ไฟล์ตารางสถิติที่แนบนี้เพื่อหาข้อมูลเชิงลึกเด่นๆ 3 จุดให้หน่อย [แนบไฟล์ก่อนรัน]",
    accent: "from-emerald-500/16 via-emerald-500/8 to-transparent",
  },
  {
    icon: "🎨",
    title: "สร้างและปรับแต่งรูปภาพด้วย AI",
    description: "ช่วยร่าง concept, style, หรือคำสั่งปรับปรุงรูปภาพสำหรับ DALL-E/Midjourney",
    query: "ขอไอเดียเขียน prompt วาดภาพแนวไซไฟย้อนยุคไทยสไตล์ หน่อย ขอเป็นแบบ cinematic สวยงาม",
    accent: "from-pink-500/16 via-pink-500/8 to-transparent",
  },
  {
    icon: "🗺️",
    title: "วางแผนจัดการเส้นทางพื้นที่",
    description: "ค้นหาพิกัดและคำนวณขอบเขตหรือเส้นทางขนส่งด้วย Thai Geo Tool",
    query: "ช่วยวางแผนจัดการพื้นที่เขตเกษตรในจังหวัดเชียงใหม่และค้นหาแหล่งน้ำที่ใกล้ที่สุดให้ที",
    accent: "from-amber-500/16 via-amber-500/8 to-transparent",
  },
] as const;

interface StarterPromptsGridProps {
  onSelect: (query: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  reduced?: boolean;
}

const StarterPromptsGrid: React.FC<StarterPromptsGridProps> = ({
  onSelect,
  textareaRef,
  reduced = false,
}) => {
  const focusComposer = (query: string) => {
    onSelect(query);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      try {
        el.setSelectionRange(query.length, query.length);
      } catch {}
      if (!reduced) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  };

  if (reduced) {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
        <span className="text-[11px] text-muted-foreground/60 shrink-0">ตัวอย่าง:</span>
        {STARTER_PROMPTS.slice(0, 3).map((prompt) => (
          <button
            key={prompt.query}
            onClick={() => focusComposer(prompt.query)}
            data-testid="starter-prompt"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-2.5 py-1 text-[12px] font-medium text-foreground transition-all hover:border-primary/40 hover:bg-primary/5"
          >
            <span aria-hidden="true">{prompt.icon}</span>
            <span>{prompt.title}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-1">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          ตัวอย่างคำถาม
        </h2>
        <span className="text-[11.5px] text-muted-foreground/85">คลิกเพื่อเริ่มต้น</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt.query}
            onClick={() => focusComposer(prompt.query)}
            data-testid="starter-prompt"
            className="group relative flex min-w-0 items-start gap-3 overflow-hidden rounded-lg border border-border/70 bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b ${prompt.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
            />
            <span
              className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-lg leading-none ring-1 ring-border/60 transition-colors group-hover:bg-primary/8 group-hover:ring-primary/30"
              aria-hidden="true"
            >
              {prompt.icon}
            </span>
            <span className="relative min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="block truncate text-[13.5px] font-semibold text-foreground transition-colors group-hover:text-primary">
                  {prompt.title}
                </span>
                <span
                  aria-hidden="true"
                  className="opacity-0 transition-opacity text-primary text-[12px] group-hover:opacity-100"
                >
                  →
                </span>
              </span>
              <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-5 text-muted-foreground">
                {prompt.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default StarterPromptsGrid;
