"use client";
import React, { useState } from "react";

interface EvolutionStep {
  id: string;
  phase: string;
  title: string;
  desc: string;
  filesChanged: string[];
  status: "completed" | "in_progress" | "pending";
}

export default function EvolutionPanel() {
  const [activeStepId, setActiveStepId] = useState("step-1");

  const steps: EvolutionStep[] = [
    {
      id: "step-1",
      phase: "Phase 1",
      title: "เตรียมสภาพแวดล้อมและ build เครื่องมือ",
      desc: "จัดการโคลนและคอมไพล์ opencode-archived บนระบบปฏิบัติการ Windows x64",
      filesChanged: ["packages/opencode/package.json", "script/build.ts"],
      status: "completed"
    },
    {
      id: "step-2",
      phase: "Phase 2",
      title: "ติดตั้ง Global Skills Extension",
      desc: "เชื่อมโยง command path และติดตั้งทักษะ 47 ชุดของ arra-oracle-skills-cli",
      filesChanged: ["~/.config/opencode/command/", "skills-lock.json"],
      status: "completed"
    },
    {
      id: "step-3",
      phase: "Phase 3",
      title: "เพิ่ม Dashboard Views ให้ครบถ้วน",
      desc: "จำลองและขยายขีดความสามารถการแสดงผล 24 หน้าของ Oracle Studio ใน innomcp-next",
      filesChanged: ["src/app/components/chat/ChatSidebar.tsx", "src/app/components/chat/ChatPage.tsx"],
      status: "in_progress"
    },
    {
      id: "step-4",
      phase: "Phase 4",
      title: "ทดสอบการเชื่อมต่อ E2E",
      desc: "เรียกใช้ระบบประสานงาน multi-agents และรันสคริปต์ตรวจความถูกต้อง layout หน้าจอ",
      filesChanged: ["automation_scripts/verify_all_views.js"],
      status: "pending"
    }
  ];

  const currentStep = steps.find((s) => s.id === activeStepId);

  return (
    <div className="flex flex-col h-full text-foreground p-1 overflow-y-auto">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-primary">State Evolution</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">ลบล้างหรือตรวจสอบความคืบหน้าของแต่ละเฟสในโครงสร้างโครงการ</p>
      </div>

      <div className="space-y-4">
        {/* Timeline Slider */}
        <div className="flex items-center justify-between border border-border/40 rounded-xl bg-background/50 p-2.5 shadow-inner">
          {steps.map((step) => (
            <button
              key={step.id}
              onClick={() => setActiveStepId(step.id)}
              className={`flex flex-col items-center gap-1.5 p-1 rounded-lg transition-all ${
                activeStepId === step.id
                  ? "bg-primary/10 scale-105"
                  : "hover:bg-muted/30"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                  step.status === "completed"
                    ? "bg-emerald-500/25 border-emerald-500 text-emerald-400"
                    : step.status === "in_progress"
                    ? "bg-blue-500/25 border-blue-500 text-blue-400"
                    : "bg-muted border-border text-muted-foreground"
                }`}
              >
                {step.phase.split(" ")[1]}
              </div>
              <span className="text-[9px] font-medium text-muted-foreground">{step.phase}</span>
            </button>
          ))}
        </div>

        {/* Selected Step Details */}
        {currentStep && (
          <div className="border border-border/30 rounded-lg p-3.5 bg-background/50 space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9.5px] uppercase font-bold text-primary">{currentStep.phase}</span>
                <span
                  className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                    currentStep.status === "completed"
                      ? "bg-emerald-500/15 text-emerald-500"
                      : currentStep.status === "in_progress"
                      ? "bg-blue-500/15 text-blue-500"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {currentStep.status}
                </span>
              </div>
              <h4 className="text-xs font-semibold text-foreground leading-normal">{currentStep.title}</h4>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{currentStep.desc}</p>
            </div>

            {/* Changed Files */}
            <div>
              <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                ไฟล์ที่เปลี่ยนแปลง / ตรวจสอบ
              </h5>
              <div className="space-y-1">
                {currentStep.filesChanged.map((file) => (
                  <div key={file} className="font-mono text-[10px] text-primary/85 bg-muted/20 px-2 py-1 rounded">
                    {file}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
