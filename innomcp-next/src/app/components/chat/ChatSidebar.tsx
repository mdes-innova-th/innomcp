"use client";

import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faColumns, faPlus } from "@fortawesome/free-solid-svg-icons";

export interface ChatMessage {
  sender: "user" | "ai";
  text: string;
  fullText?: string;
  isAnimating?: boolean;
}

export interface ChatSummary {
  id: string;
  title: string;
  time: number;
  messages: ChatMessage[];
}

type Props = {
  summaries: ChatSummary[];
  activeId: string | null;
  isCollapsed: boolean;
  onToggle: () => void;
  onLoad: (s: ChatSummary) => void;
  onNewChat: () => void;
  theme: string;
};

const ChatSidebar: React.FC<Props> = ({
  summaries,
  activeId,
  isCollapsed,
  onToggle,
  onLoad,
  onNewChat,
  theme,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use default light theme during SSR to prevent hydration mismatches
  const safeTheme = mounted ? theme : "light";

  return (
    <aside
      className="fixed left-0 top-20 z-40 flex flex-col transition-all duration-300"
      style={{ width: isCollapsed ? 56 : 288, height: "calc(100vh - 5rem)" }}
      data-testid="chat-sidebar"
    >
      {/* Toggle Button - Always visible at top */}
      <div className="p-2 flex items-center justify-between">
        <button
          title={isCollapsed ? "ขยาย Sidebar" : "ย่อ Sidebar"}
          onClick={onToggle}
          className={`p-2 rounded-lg transition-all duration-200 ${
            safeTheme === "light"
              ? "bg-indigo-100 hover:bg-indigo-200 text-indigo-700"
              : "bg-indigo-900/50 hover:bg-indigo-800/70 text-indigo-300"
          } ${isCollapsed ? 'mx-auto' : ''}`}
          data-testid="toggle-sidebar-btn"
        >
          <FontAwesomeIcon 
            icon={faColumns} 
            className={`text-lg transition-transform duration-300 ${
              isCollapsed ? 'rotate-0' : 'rotate-180'
            }`} 
          />
        </button>
      </div>

      {/* Content: hidden when collapsed */}
      {!isCollapsed && (
        <div
          className={`flex-1 flex flex-col overflow-hidden ${
            safeTheme === "light" ? "bg-gray-50" : "bg-gray-900/70"
          } rounded-br-lg`}
        >
          {/* New Chat Button - Prominent at top like ChatGPT */}
          <div className={`p-3 border-b ${
            safeTheme === "light" ? "border-gray-200" : "border-gray-700"
          }`}>
            <button
              onClick={onNewChat}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                safeTheme === "light"
                  ? "bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white shadow-md hover:shadow-lg"
                  : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md hover:shadow-lg"
              }`}
              title="เริ่มการสนทนาใหม่"
              data-testid="new-chat-btn"
            >
              <FontAwesomeIcon icon={faPlus} className="text-lg" />
              <span>แชทใหม่</span>
            </button>
          </div>

          {/* Chat History Header */}
          <div className="px-3 pt-3 pb-2">
            <h3 className={`text-xs font-semibold uppercase tracking-wide ${
              safeTheme === "light" ? "text-gray-500" : "text-gray-400"
            }`}>
              ประวัติการสนทนา
            </h3>
          </div>

          {/* Chat History List */}
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {summaries.length === 0 ? (
              <div className={`text-xs text-center py-8 ${
                safeTheme === "light" ? "text-gray-400" : "text-gray-500"
              }`}>
                ยังไม่มีประวัติการสนทนา
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {summaries.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onLoad(s)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                      s.id === activeId
                        ? safeTheme === "light"
                          ? "bg-indigo-100 border-l-4 border-indigo-500"
                          : "bg-indigo-900/40 border-l-4 border-indigo-400"
                        : safeTheme === "light"
                        ? "hover:bg-gray-100"
                        : "hover:bg-gray-800/50"
                    }`}
                    title={s.title}
                    data-testid="chat-history-item"
                  >
                    <div className="flex-1">
                      <div className={`text-sm font-medium truncate ${
                        s.id === activeId
                          ? safeTheme === "light" ? "text-indigo-700" : "text-indigo-300"
                          : safeTheme === "light" ? "text-gray-800" : "text-gray-200"
                      }`}>
                        {s.title}
                      </div>
                      <div className={`text-xs mt-1 ${
                        safeTheme === "light" ? "text-gray-500" : "text-gray-400"
                      }`}>
                        {(() => {
                          const date = new Date(s.time);
                          return date.toLocaleString("th-TH", {
                            timeZone: "Asia/Bangkok",
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          });
                        })()}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

export default ChatSidebar;
