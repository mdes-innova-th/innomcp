"use client";
import React, { useState, useEffect } from "react";
import type { ApprovalRequest } from "./ApprovalGate";

interface MemoryLog {
  id: string;
  topic: string;
  summary: string;
  timestamp: string;
  tags: string[];
}

const MOCK_MEMORIES: MemoryLog[] = [
  { id: "mem-1", topic: "Sync Protocol Resolution", summary: "แก้ปัญหา sync-cross-machine descriptor leak โดยใช้ state.fp.close() ก่อน clear", timestamp: "10 นาทีที่แล้ว", tags: ["sync", "fix", "tui"] },
  { id: "mem-2", topic: "Agent Leaderboard Defect", summary: "ซ่อม syntax errors และใส่ return statement ใน JSX ของ AgentLeaderboard.tsx เพื่อให้ประกอบผลได้สำเร็จ", timestamp: "30 นาทีที่แล้ว", tags: ["nextjs", "build-fix"] },
  { id: "mem-3", topic: "Environment Setup Verification", summary: "ทดสอบการรัน Node test-results และ smoke tests ด้วย pnpm-workspace", timestamp: "2 ชั่วโมงที่แล้ว", tags: ["verify", "ci"] }
];

export default function OraclePatternPanel() {
  const [activeTab, setActiveTab] = useState<"hitl" | "memory" | "guardrails">("hitl");
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([
    {
      id: "req-1",
      action: "เขียนไฟล์และอัปเดต API Routes",
      tool: "write_file",
      riskLevel: "medium",
      details: "ระบบต้องการสร้างไฟล์และ directory C:/Users/USER-NT/DEV/innomcp/innomcp-next/src/app/api/tmux/logs/route.ts",
      requestedAt: Date.now() - 60000
    },
    {
      id: "req-2",
      action: "รันสคริปต์ tmux-multiagent.sh",
      tool: "shell-exec",
      riskLevel: "high",
      command: "bash C:/Users/USER-NT/Jit/scripts/tmux-multiagent.sh start",
      details: "สปอว์น 7 คอนเคอร์เรนต์เอเจนต์ เพื่อเริ่มทำงานเบื้องหลัง",
      requestedAt: Date.now() - 30000
    }
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [memories, setMemories] = useState<MemoryLog[]>(MOCK_MEMORIES);
  const [guardrails, setGuardrails] = useState({
    hitlGateActive: true,
    preventDestructive: true,
    sandboxOnly: false,
    verboseTrace: true
  });

  const handleApprove = (id: string) => {
    setPendingApprovals((prev) => prev.filter((req) => req.id !== id));
    alert("อนุมัติคำร้องขอเรียบร้อยแล้ว (INNOVA_AUTHORIZED_EXECUTION)");
  };

  const handleDeny = (id: string) => {
    setPendingApprovals((prev) => prev.filter((req) => req.id !== id));
    alert("ปฏิเสธคำร้องขอแล้ว");
  };

  const filteredMemories = memories.filter(
    (m) =>
      m.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="bg-background border border-border/60 rounded-xl p-4 shadow-sm space-y-4">
      {/* Title & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/20 pb-3 gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <span>👁️‍🗨️</span> The Oracle Pattern
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">ระบบควบคุมสิทธิ์ร่วม (HITL) และสืบค้นความรู้เพื่อความปลอดภัยของ AI</p>
        </div>
        
        {/* Navigation tabs */}
        <div className="flex bg-muted/30 p-0.5 rounded-lg border border-border/40 text-[11px] font-medium font-sans">
          <button
            onClick={() => setActiveTab("hitl")}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === "hitl" ? "bg-background shadow-sm text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Approval Gates ({pendingApprovals.length})
          </button>
          <button
            onClick={() => setActiveTab("memory")}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === "memory" ? "bg-background shadow-sm text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Oracle Memory
          </button>
          <button
            onClick={() => setActiveTab("guardrails")}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === "guardrails" ? "bg-background shadow-sm text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Guardrails
          </button>
        </div>
      </div>

      {/* Tab contents */}
      <div className="min-h-[220px]">
        {/* 1. Approval Gates */}
        {activeTab === "hitl" && (
          <div className="space-y-3">
            {pendingApprovals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-1.5">
                <span className="text-2xl">🛡️</span>
                <p className="text-xs font-semibold text-foreground">ไม่มีคำร้องค้างคาในกล่อง</p>
                <p className="text-[10.5px] text-muted-foreground">เอเจนต์รันภายใต้ข้อกำหนดจำกัดสิทธิ์ความปลอดภัยที่ถูกต้อง</p>
              </div>
            ) : (
              pendingApprovals.map((req) => (
                <div
                  key={req.id}
                  className={`p-3 rounded-lg border flex flex-col md:flex-row justify-between gap-3 text-xs ${
                    req.riskLevel === "high"
                      ? "border-rose-500/30 bg-rose-500/5"
                      : "border-amber-500/30 bg-amber-500/5"
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider ${
                        req.riskLevel === "high"
                          ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                          : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                      }`}>
                        {req.riskLevel} risk
                      </span>
                      <span className="font-mono text-muted-foreground/75">[{req.tool}]</span>
                    </div>
                    <p className="font-bold text-foreground">{req.action}</p>
                    {req.command && (
                      <code className="block rounded bg-black/60 text-white/90 p-2 font-mono text-[10.5px] break-all leading-normal">
                        {req.command}
                      </code>
                    )}
                    {req.details && <p className="text-[11px] text-muted-foreground">{req.details}</p>}
                  </div>

                  <div className="flex md:flex-col justify-end gap-2 shrink-0 md:min-w-[100px]">
                    <button
                      onClick={() => handleApprove(req.id)}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all text-center flex-1 md:flex-none"
                    >
                      ✅ อนุมัติ
                    </button>
                    <button
                      onClick={() => handleDeny(req.id)}
                      className="px-3 py-1.5 rounded bg-muted hover:bg-muted/75 text-muted-foreground font-semibold border border-border transition-all text-center flex-1 md:flex-none"
                    >
                      ❌ ปฏิเสธ
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 2. Oracle Memory */}
        {activeTab === "memory" && (
          <div className="space-y-3">
            {/* Search */}
            <div className="flex items-center gap-2 bg-muted/20 border border-border/40 rounded-lg px-3 py-1.5">
              <span className="text-muted-foreground text-xs">🔍</span>
              <input
                type="text"
                placeholder="สืบค้นความรู้ประเด็นแก้ไขปัญหา (Memory logs)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground/60 flex-1"
              />
            </div>

            {/* List */}
            <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
              {filteredMemories.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">ไม่พบล็อกบันทึกความรู้ที่เกี่ยวข้อง</p>
              ) : (
                filteredMemories.map((m) => (
                  <div key={m.id} className="p-3 rounded-lg border border-border/40 bg-muted/10 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-foreground">{m.topic}</p>
                      <span className="text-[10px] text-muted-foreground">{m.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{m.summary}</p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {m.tags.map((t) => (
                        <span key={t} className="px-1.5 py-0.5 rounded bg-primary/5 text-primary text-[9.5px] border border-primary/10">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 3. Guardrails Monitor */}
        {activeTab === "guardrails" && (
          <div className="space-y-3.5 max-w-md">
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 bg-muted/10 text-xs">
              <div>
                <p className="font-bold text-foreground">HITL Gate Verification</p>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">บังคับตรวจสอบและขออนุมัติคำสั่งอันตราย (shell/file) ก่อนรัน</p>
              </div>
              <button
                onClick={() => setGuardrails((prev) => ({ ...prev, hitlGateActive: !prev.hitlGateActive }))}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${guardrails.hitlGateActive ? "bg-emerald-500" : "bg-muted"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${guardrails.hitlGateActive ? "translate-x-4" : ""}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 bg-muted/10 text-xs">
              <div>
                <p className="font-bold text-foreground">Prevent Destructive Actions</p>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">บล็อกการใช้คำสั่งลบไฟล์/ระบบนอกเป้าหมายโดยอัตโนมัติ</p>
              </div>
              <button
                onClick={() => setGuardrails((prev) => ({ ...prev, preventDestructive: !prev.preventDestructive }))}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${guardrails.preventDestructive ? "bg-emerald-500" : "bg-muted"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${guardrails.preventDestructive ? "translate-x-4" : ""}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 bg-muted/10 text-xs">
              <div>
                <p className="font-bold text-foreground">Sandbox-Only Execution</p>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">จำกัดคำสั่ง shell ให้รันได้เฉพาะใน container/sandbox เท่านั้น</p>
              </div>
              <button
                onClick={() => setGuardrails((prev) => ({ ...prev, sandboxOnly: !prev.sandboxOnly }))}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${guardrails.sandboxOnly ? "bg-emerald-500" : "bg-muted"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${guardrails.sandboxOnly ? "translate-x-4" : ""}`} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
