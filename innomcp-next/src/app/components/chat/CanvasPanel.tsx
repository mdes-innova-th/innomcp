"use client";
import React from "react";

export default function CanvasPanel() {
  const nodes = [
    { id: "1", label: "BigBoss Agent", role: "Orchestrator", color: "border-sky-500 bg-sky-500/10 text-sky-400" },
    { id: "2", label: "Builder Agent", role: "Features", color: "border-violet-500 bg-violet-500/10 text-violet-400" },
    { id: "3", label: "Reviewer Agent", role: "Auditing", color: "border-emerald-500 bg-emerald-500/10 text-emerald-400" },
    { id: "4", label: "Debugger Agent", role: "Time-Travel", color: "border-amber-500 bg-amber-500/10 text-amber-400" }
  ];

  const connections = [
    { from: "BigBoss", to: "Builder", action: "มอบหมายงาน" },
    { from: "Builder", to: "Reviewer", action: "ส่งโค้ดตรวจสอบ" },
    { from: "Reviewer", to: "Debugger", action: "ระบุข้อผิดพลาด" },
    { from: "Debugger", to: "BigBoss", action: "แจ้งสถานะแก้ไข" }
  ];

  return (
    <div className="flex flex-col h-full text-foreground p-1 overflow-y-auto">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-primary">Collaboration Canvas</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">แผนผังจำลองการเชื่อมต่อและการส่งผ่านงานของกลุ่มเอเจนต์ (Node Graph)</p>
      </div>

      <div className="flex-1 min-h-[350px] relative border border-border/40 rounded-xl bg-background/50 p-4 overflow-hidden flex flex-col justify-between shadow-inner">
        {/* Node Graph Area */}
        <div className="grid grid-cols-2 gap-4 flex-1 items-center justify-items-center py-6">
          {nodes.map((node) => (
            <div
              key={node.id}
              className={`w-32 p-3 rounded-xl border text-center shadow-lg transition-transform hover:scale-105 ${node.color}`}
            >
              <div className="text-[12px] font-bold">{node.label}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">{node.role}</div>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mx-auto mt-2 animate-ping" />
            </div>
          ))}
        </div>

        {/* Connections display */}
        <div className="border-t border-border/20 pt-3">
          <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">ลำดับการสื่อสารปัจจุบัน</h5>
          <div className="space-y-1.5">
            {connections.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-muted/20">
                <span className="font-semibold text-foreground/80">{c.from}</span>
                <span className="text-[10px] text-primary italic">↳ {c.action} ↳</span>
                <span className="font-semibold text-foreground/80">{c.to}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
