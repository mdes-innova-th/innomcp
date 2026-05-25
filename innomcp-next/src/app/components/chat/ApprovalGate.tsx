"use client";
import React, { useEffect } from "react";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ApprovalRequest {
  id: string;
  action: string;          // e.g. "delete file: report.md"
  tool: string;            // e.g. "file-delete", "shell-exec"
  riskLevel: RiskLevel;
  details?: string;        // what will happen
  command?: string;        // the actual command/path shown to user
  requestedAt: number;
}

interface Props {
  request: ApprovalRequest | null;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}

const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string; border: string; icon: string; label: string }> = {
  low:      { color: "text-sky-700 dark:text-sky-400",    bg: "bg-sky-500/8",    border: "border-sky-500/20",    icon: "ℹ️",  label: "Low Risk"      },
  medium:   { color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/8",  border: "border-amber-500/20",  icon: "⚠️",  label: "Medium Risk"   },
  high:     { color: "text-rose-700 dark:text-rose-400",   bg: "bg-rose-500/8",   border: "border-rose-500/20",   icon: "🚨",  label: "High Risk"     },
  critical: { color: "text-red-700 dark:text-red-400",     bg: "bg-red-500/12",   border: "border-red-500/30",    icon: "☠️",  label: "Critical Risk" },
};

export default function ApprovalGate({ request, onApprove, onDeny }: Props) {
  // Close on Escape
  useEffect(() => {
    if (!request) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onDeny(request.id); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [request, onDeny]);

  if (!request) return null;
  const cfg = RISK_CONFIG[request.riskLevel];

  // URL detection — search command, then action, then details
  const urlMatch = (request.command || request.action || request.details || "")
    .match(/https?:\/\/[^\s)]+/);
  const detectedUrl = urlMatch ? urlMatch[0] : null;

  // Tool type badge detection
  const toolType = (() => {
    const t = request.tool.toLowerCase();
    if (t.includes("shell") || t.includes("exec"))
      return { icon: "🖥️", label: "Shell Command", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" };
    if (t.includes("fetch") || t.includes("http") || t.includes("url"))
      return { icon: "🌐", label: "Web Fetch", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-400" };
    if (t.includes("file") || t.includes("write") || t.includes("read"))
      return { icon: "📄", label: "File Operation", cls: "bg-gray-500/10 text-gray-700 dark:text-gray-400" };
    return { icon: "⚡", label: "Agent Action", cls: "bg-muted/40 text-muted-foreground" };
  })();

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px]"
        onClick={() => onDeny(request.id)} />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-[90] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/60 bg-background p-5 shadow-xl">
        {/* Risk badge */}
        <div className={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cfg.color} ${cfg.bg} ${cfg.border}`}>
          <span>{cfg.icon}</span>
          <span>{cfg.label}</span>
        </div>

        {/* Title */}
        <p className="text-[14px] font-semibold text-foreground mb-1">
          ต้องการการยืนยัน
        </p>
        <p className="text-[12.5px] text-muted-foreground mb-3">
          Agent ต้องการดำเนินการ:
        </p>

        {/* Action details */}
        <div className={`rounded-lg border p-3 mb-4 ${cfg.bg} ${cfg.border}`}>
          <p className={`text-[12px] font-medium ${cfg.color}`}>{request.action}</p>
          {request.command && (
            <code className="mt-1.5 block rounded bg-muted/60 px-2 py-1 text-[11px] font-mono text-foreground/80 break-all">
              {request.command}
            </code>
          )}
          {request.details && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">{request.details}</p>
          )}
        </div>

        {/* Tool info */}
        <p className="text-[10.5px] text-muted-foreground mb-4">
          Tool: <span className="font-mono text-foreground/70">{request.tool}</span>
        </p>

        {/* Buttons */}
        <div className="flex gap-2">
          <button onClick={() => onDeny(request.id)}
            className="flex-1 rounded-lg border border-border/60 py-2 text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
            ❌ ปฏิเสธ
          </button>
          <button onClick={() => onApprove(request.id)}
            className={`flex-1 rounded-lg py-2 text-[12.5px] font-medium text-white transition-colors ${
              request.riskLevel === "critical" ? "bg-red-600 hover:bg-red-700" :
              request.riskLevel === "high" ? "bg-rose-600 hover:bg-rose-700" :
              "bg-primary hover:bg-primary/90"
            }`}>
            ✅ อนุมัติ
          </button>
        </div>

        <p className="mt-2.5 text-center text-[10px] text-muted-foreground/50">
          กด Escape เพื่อปฏิเสธ
        </p>
      </div>
    </>
  );
}
