"use client";

import { useState } from "react";

interface OnboardingStep {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

const STEPS: OnboardingStep[] = [
  {
    icon: "🤖",
    title: "ยินดีต้อนรับสู่ INNOMCP",
    description:
      "ระบบ AI Agent Workspace ส่วนตัวที่ทำงานร่วมกับ AI มากกว่า 10 agents",
  },
  {
    icon: "💬",
    title: "เริ่มต้นด้วยการพิมพ์คำสั่ง",
    description:
      "พิมพ์งานที่ต้องการในช่องแชท เช่น 'วิเคราะห์ไฟล์ CSV นี้' หรือ 'เขียนโค้ด Python'",
  },
  {
    icon: "⌨️",
    title: "Shortcuts ที่ควรรู้",
    description:
      "Ctrl+K → Command Palette | Ctrl+D → Dashboard | Ctrl+H → Task History",
  },
  {
    icon: "🚀",
    title: "พร้อมแล้ว!",
    description:
      "ตั้งค่า AI Provider ในหน้า Settings เพื่อเพิ่มความสามารถ",
    action: { label: "เริ่มใช้งาน" },
  },
];

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  onStartTour?: () => void;
}

export default function OnboardingModal({ open, onClose, onStartTour }: OnboardingModalProps) {
  const [step, setStep] = useState(0);

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="คู่มือเริ่มต้นใช้งาน"
    >
      <div className="bg-background border border-border/60 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-5">
        {/* Step dots */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`inline-block h-2 rounded-full transition-all duration-300 ${
                i === step
                  ? "w-6 bg-primary"
                  : i < step
                  ? "w-2 bg-primary/50"
                  : "w-2 bg-border"
              }`}
              aria-hidden="true"
            />
          ))}
        </div>

        {/* Step content */}
        <div className="flex flex-col items-center gap-3 text-center py-2">
          <span
            className="text-5xl leading-none select-none"
            aria-hidden="true"
          >
            {current.icon}
          </span>
          <h2 className="font-display text-xl font-semibold text-foreground">
            {current.title}
          </h2>
          <p className="text-[14px] leading-relaxed text-muted-foreground max-w-sm">
            {current.description}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            onClick={handleSkip}
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
            aria-label="ข้ามคู่มือ"
          >
            ข้าม
          </button>

          <div className="flex items-center gap-2">
            {isLast && onStartTour && (
              <button
                onClick={() => { onStartTour(); onClose(); }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-4 py-2 text-[13px] font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                🗺️ เริ่ม Guided Tour
              </button>
            )}
            <button
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-[14px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {isLast ? (current.action?.label ?? "เสร็จแล้ว") : "ถัดไป"}
              {!isLast && (
                <span aria-hidden="true" className="text-[13px]">
                  →
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div
          className="h-1 w-full rounded-full bg-border/60 overflow-hidden"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-label={`ขั้นตอนที่ ${step + 1} จาก ${STEPS.length}`}
        >
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
