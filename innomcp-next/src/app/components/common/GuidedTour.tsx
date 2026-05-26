"use client";
import React, { useState, useEffect } from "react";

interface TourStep {
  target: string;       // CSS selector for the target element
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  { target: "[data-testid='chat-input']", title: "💬 ช่องแชท", description: "พิมพ์คำสั่งที่นี่ หรือลากไฟล์มาวาง", position: "top" },
  { target: "[data-testid='sidebar-nav-agent']", title: "🤖 Agent Leaderboard", description: "ดู AI agents ทั้งหมดที่ทำงานอยู่", position: "right" },
  { target: "[data-testid='sidebar-nav-dashboard']", title: "📊 Dashboard", description: "ดูสรุปงานและสถิติ", position: "right" },
  { target: "[data-testid='sidebar-nav-library']", title: "📋 Templates", description: "ใช้ prompt สำเร็จรูปเพื่อเริ่มงานเร็วขึ้น", position: "right" },
];

interface GuidedTourProps {
  active: boolean;
  onComplete: () => void;
}

export default function GuidedTour({ active, onComplete }: GuidedTourProps) {
  const [step, setStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });

  useEffect(() => {
    if (!active) return;
    const target = document.querySelector(TOUR_STEPS[step]?.target);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    setPosition({ top: rect.top + window.scrollY, left: rect.left + window.scrollX, width: rect.width, height: rect.height });
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [step, active]);

  if (!active || step >= TOUR_STEPS.length) return null;

  const current = TOUR_STEPS[step];

  // Calculate tooltip position
  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 9999,
    top: current.position === "bottom" ? position.top + position.height + 12 :
         current.position === "top" ? position.top - 120 : position.top,
    left: current.position === "right" ? position.left + position.width + 12 :
          current.position === "left" ? position.left - 260 : position.left,
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9998] bg-black/20 pointer-events-none" />
      {/* Highlight ring */}
      <div className="fixed z-[9999] pointer-events-none rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background transition-all duration-300"
        style={{ top: position.top - 4, left: position.left - 4, width: position.width + 8, height: position.height + 8 }} />
      {/* Tooltip */}
      <div style={tooltipStyle} className="w-56 rounded-xl border border-border/60 bg-background shadow-2xl p-4">
        <p className="text-[13px] font-semibold text-foreground mb-1">{current.title}</p>
        <p className="text-[11.5px] text-muted-foreground mb-3">{current.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{step + 1} / {TOUR_STEPS.length}</span>
          <div className="flex gap-2">
            <button onClick={onComplete} className="text-[10.5px] text-muted-foreground hover:text-foreground">ข้าม</button>
            <button onClick={() => step + 1 >= TOUR_STEPS.length ? onComplete() : setStep(s => s + 1)}
              className="rounded-lg bg-primary text-primary-foreground px-2.5 py-1 text-[11px] font-medium hover:opacity-90">
              {step + 1 >= TOUR_STEPS.length ? "เสร็จ" : "ถัดไป →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
