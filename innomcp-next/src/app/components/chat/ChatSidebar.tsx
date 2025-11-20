"use client";

import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faColumns } from "@fortawesome/free-solid-svg-icons";

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
  theme: string;
};

const ChatSidebar: React.FC<Props> = ({
  summaries,
  activeId,
  isCollapsed,
  onToggle,
  onLoad,
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
      className="fixed left-0 top-20 z-40 flex flex-col transition-all"
      style={{ width: isCollapsed ? 56 : 288, height: "calc(100vh - 5rem)" }}
    >
      {/* Header / Toggle */}
      <div
        className={`p-2 flex items-center justify-between ${
          safeTheme === "light"
            ? isCollapsed
              ? ""
              : "bg-neutral-400/20"
            : isCollapsed
            ? ""
            : "bg-neutral-500/10"
        } rounded-tr-lg`}
      >
        {!isCollapsed && (
          <h3 className="text-sm font-semibold">ประวัติการแชท</h3>
        )}
        <button
          title="ย่อ/ขยาย"
          onClick={onToggle}
          className={`p-2 rounded-md ${
            safeTheme === "light"
              ? "hover:bg-gray-200"
              : "dark:hover:bg-gray-900"
          } cursor-pointer`}
        >
          {" "}
          <FontAwesomeIcon icon={faColumns} className="text-2xl" />
        </button>
      </div>

      {/* Content: hidden when collapsed */}
      {!isCollapsed && (
        <div
          className={`p-3 overflow-y-auto ${
            safeTheme === "light" ? "bg-gray-200" : "bg-gray-900/70"
          } flex-1  rounded-br-lg`}
        >
          {summaries.length === 0 && (
            <div className="text-xs text-gray-400">ยังไม่มีประวัติการแชท</div>
          )}
          <div className="flex flex-col gap-2">
            {summaries.map((s) => (
              <button
                key={s.id}
                onClick={() => onLoad(s)}
                className={`w-full text-left p-2 transition-colors flex items-center gap-2 cursor-pointer hover:border-l-5 ${
                  s.id === activeId
                    ? `border-l-5 ${
                        safeTheme === "light"
                          ? "border-indigo-500 bg-indigo-100"
                          : "border-indigo-400 bg-indigo-900/30"
                      }`
                    : ""
                }`}
                title={s.title}
              >
                <div className="flex-1">
                  <div className="text-sm truncate">{s.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
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
        </div>
      )}
    </aside>
  );
};

export default ChatSidebar;
