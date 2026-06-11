"use client";

import React, { useState, useEffect } from "react";
import type { AgentEvent } from "./useAgentEventStream";
import type { Artifact } from "./ArtifactPanel";
import AgentStepsView from "./AgentStepsView";
import WorkspaceTerminalPanel from "./WorkspaceTerminalPanel";

export interface ManusWorkspacePanelProps {
  events: AgentEvent[];
  artifacts: Artifact[];
  isStreaming: boolean;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

// ===== Thai labels and icons mapping =====
const typeLabels: Record<string, string> = {
  route_selected: "วิเคราะห์คำถาม",
  agent_started: "เริ่ม Agent",
  tool_call_started: "เรียกใช้เครื่องมือ",
  final_answer: "สรุปคำตอบ",
};

const typeIcons: Record<string, string> = {
  route_selected: "🧭",
  agent_started: "🤖",
  tool_call_started: "🔧",
  final_answer: "✅",
};

// Default icon for unknown types
const defaultIcon = "⚙️";

// Helper to get label+icon from event type
function getStepLabel(event: AgentEvent) {
  const label = typeLabels[event.type] || event.type;
  const icon = typeIcons[event.type] || defaultIcon;
  return { icon, label };
}

// ===== Tab definitions =====
const tabs = [
  { key: "agent", label: "🤖 งาน" },
  { key: "web", label: "🌐 เว็บ" },
  { key: "terminal", label: "💻 Terminal" },
  { key: "artifacts", label: "📁 ไฟล์ผลลัพธ์" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

// ===== Component =====
const ManusWorkspacePanel: React.FC<ManusWorkspacePanelProps> = ({
  events,
  artifacts,
  isStreaming,
  isOpen,
  onClose,
  className = "",
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>(
    isStreaming ? "agent" : "agent"
  );

  // Auto-switch to "งาน" tab when streaming begins
  useEffect(() => {
    if (isStreaming && activeTab !== "agent") {
      setActiveTab("agent");
    }
  }, [isStreaming, activeTab]);

  // Download artifact helper
  const downloadArtifact = (artifact: Artifact) => {
    const blob = new Blob([artifact.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = artifact.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Format timestamp
  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  };

  // === Filtered events for sub panels ===
  const webEvents = events.filter(
    (e) => e.toolName === "web_search" || e.toolName === "browser"
  );
  const terminalEvents = events.filter(
    (e) => ["shell", "exec", "bash"].some(k => e.toolName?.toLowerCase().includes(k))
  );

  // === Render functions per tab ===
  const renderAgentTab = () => (
    <AgentStepsView events={events} isStreaming={isStreaming} className="min-h-0" />
  );

  const _renderAgentTabLegacy = () => (
    <div className="space-y-3 p-4">
      {events.length === 0 && (
        <div className="text-center text-slate-400 dark:text-slate-500 py-8">
          ยังไม่มีขั้นตอนการทำงาน
        </div>
      )}
      {events.map((event, idx) => {
        const { icon, label } = getStepLabel(event);
        const isLast = idx === events.length - 1;
        const isActive = isStreaming && isLast;
        const duration = event.totalMs ? `${event.totalMs}ms` : event.latencyMs ? `${event.latencyMs}ms` : "";

        return (
          <div
            key={event.messageId}
            className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200"
          >
            {/* Status dot */}
            <div className="mt-1 flex-shrink-0">
              {isActive ? (
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              ) : (
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span>{icon}</span>
                <span className="font-medium truncate">{label}</span>
                {event.model && (
                  <>
                    <span className="text-slate-400 dark:text-slate-500">·</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {event.model}
                    </span>
                  </>
                )}
                {duration && (
                  <>
                    <span className="text-slate-400 dark:text-slate-500">·</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {duration}
                    </span>
                  </>
                )}
              </div>
              {event.publicSummary && (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 break-words">
                  {event.publicSummary}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderWebTab = () => (
    <div className="p-4 space-y-4">
      {webEvents.length === 0 ? (
        <div className="text-center text-slate-400 dark:text-slate-500 py-8">
          ยังไม่มีผลการค้นหาเว็บ
        </div>
      ) : (
        webEvents.map((event) => (
          <div
            key={event.messageId}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              🌐 {event.toolName || "เว็บ"}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
              {event.previewText ?? event.publicSummary ?? "—"}
            </div>
            {event.totalMs && (
              <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {event.totalMs}ms
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  const renderTerminalTab = () => (
    <WorkspaceTerminalPanel events={events} isStreaming={isStreaming} />
  );

  const renderArtifactsTab = () => (
    <div className="p-4 space-y-3">
      {artifacts.length === 0 ? (
        <div className="text-center text-slate-400 dark:text-slate-500 py-8">
          ยังไม่มีไฟล์ผลลัพธ์
        </div>
      ) : (
        artifacts.map((art) => {
          const typeIcon =
            (art.type as string) === "image"
              ? "🖼️"
              : (art.type as string) === "code" || (art.type as string) === "script"
              ? "📝"
              : (art.type as string) === "pdf"
              ? "📕"
              : "📄";
          return (
            <div
              key={art.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50"
            >
              <span className="text-xl flex-shrink-0 mt-0.5">{typeIcon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                  {art.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {formatTime(new Date(art.createdAt).toISOString())}
                </div>
              </div>
              <button
                onClick={() => downloadArtifact(art)}
                className="flex-shrink-0 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition"
                title="ดาวน์โหลดไฟล์"
              >
                ⬇️
              </button>
            </div>
          );
        })
      )}
    </div>
  );

  // ===== Main render =====
  if (!isOpen) return null;

  return (
    <aside
      className={`fixed right-0 top-0 h-full w-80 lg:w-96 bg-white/98 dark:bg-slate-900/95 backdrop-blur-sm border-l border-slate-200 dark:border-slate-700 shadow-2xl z-50 flex flex-col transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          MDES Workspace
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition"
          aria-label="ปิด Workspace"
        >
          ✕
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-2 py-2.5 text-xs font-medium transition-colors relative ${
              activeTab === tab.key
                ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-900/20"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400" />
            )}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "agent" && renderAgentTab()}
        {activeTab === "web" && renderWebTab()}
        {activeTab === "terminal" && renderTerminalTab()}
        {activeTab === "artifacts" && renderArtifactsTab()}
      </div>
    </aside>
  );
};

export default ManusWorkspacePanel;