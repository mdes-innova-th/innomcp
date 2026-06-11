// @ts-nocheck
"use client";

import React, { useState, useEffect, useRef } from "react";
import { AgentStepsView } from "./AgentStepsView";
import { WorkspaceTerminalPanel } from "./WorkspaceTerminalPanel";
import { WorkspaceTabBar } from "./WorkspaceTabBar";
import type { AgentEvent } from "./useAgentEventStream";
import type { Artifact } from "./ArtifactPanel";
import { X, Download } from "lucide-react";

interface WorkspaceManagerProps {
  events: AgentEvent[];
  artifacts: Artifact[];
  isStreaming: boolean;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const TABS = [
  { id: "agent", label: "🤖 งาน" },
  { id: "web", label: "🌐 เว็บ" },
  { id: "terminal", label: "💻 Terminal" },
  { id: "files", label: "📁 ไฟล์" },
] as const;

export const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({
  events,
  artifacts,
  isStreaming,
  isOpen,
  onClose,
  className = "",
}) => {
  const [activeTab, setActiveTab] = useState<string>("agent");
  const prevStreamingRef = useRef<boolean>(isStreaming);

  // Auto-switch to agent tab when streaming starts
  useEffect(() => {
    if (isStreaming && !prevStreamingRef.current) {
      setActiveTab("agent");
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Compute model count from events (unique models)
  const modelCount = new Set(
    events
      .map((e) => e.model)
      .filter((m): m is string => typeof m === "string" && m.length > 0)
  ).size;

  const renderTabContent = () => {
    switch (activeTab) {
      case "agent":
        return <AgentStepsView events={events} isStreaming={isStreaming} />;
      case "web": {
        const webEvents = events.filter(
          (e) => e.toolName === "web_search"
        );
        return (
          <div className="p-4 space-y-3 overflow-y-auto h-full">
            {webEvents.length === 0 ? (
              <p className="text-gray-400 text-sm text-center mt-8">
                ไม่มีการค้นหาเว็บ
              </p>
            ) : (
              webEvents.map((e, idx) => (
                <div
                  key={e.id ?? idx}
                  className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm"
                >
                  <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">
                    {e.publicSummary ?? "ไม่มีรายละเอียด"}
                  </p>
                </div>
              ))
            )}
          </div>
        );
      }
      case "terminal":
        return <WorkspaceTerminalPanel events={events} />;
      case "files":
        return (
          <div className="p-4 space-y-3 overflow-y-auto h-full">
            {artifacts.length === 0 ? (
              <p className="text-gray-400 text-sm text-center mt-8">
                ยังไม่มีไฟล์ผลลัพธ์
              </p>
            ) : (
              artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="flex items-center justify-between bg-white border border-gray-100 rounded-lg p-3 shadow-sm"
                >
                  <span className="text-sm font-medium text-gray-700 truncate mr-2">
                    {artifact.name}
                  </span>
                  <a
                    href={artifact.downloadUrl ?? "#"}
                    download={artifact.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-md px-2 py-1 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    ดาวน์โหลด
                  </a>
                </div>
              ))
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`fixed inset-y-0 right-0 w-[26rem] max-w-[90vw] bg-gray-50 border-l border-gray-200 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-x-0" : "translate-x-full"
      } flex flex-col ${className}`}
      role="dialog"
      aria-modal="false"
      aria-label="MDES Workspace"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-800">MDES Workspace</h2>
          {modelCount > 0 && (
            <span className="text-xs font-medium bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
              {modelCount} models
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="ปิด Workspace"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tab Bar */}
      <WorkspaceTabBar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId)}
      />

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">{renderTabContent()}</div>
    </div>
  );
};

export default WorkspaceManager;