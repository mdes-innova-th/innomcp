"use client";

import React from "react";
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
  return (
    <aside
      className="fixed left-0 top-20 z-40 flex flex-col transition-all"
      style={{ width: isCollapsed ? 56 : 288, height: "calc(100vh - 5rem)" }}
    >
      {/* Header / Toggle */}
      <div
        className={`p-2 flex items-center justify-between ${
          theme === "light"
            ? isCollapsed
              ? ""
              : "bg-neutral-400/20"
            : isCollapsed
            ? ""
            : "bg-neutral-500/10"
        } rounded-tr-2xl`}
      >
        {!isCollapsed && (
          <h3 className="text-sm font-semibold">ประวัติการแชท</h3>
        )}
        <button
          title="ย่อ/ขยาย"
          onClick={onToggle}
          className={`p-2 rounded-md ${
            theme === "light" ? "hover:bg-gray-200" : "dark:hover:bg-gray-900"
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
            theme === "light" ? "bg-gray-200" : "bg-gray-900/70"
          } flex-1  rounded-br-2xl`}
        >
          {summaries.length === 0 && (
            <div className="text-xs text-gray-400">ยังไม่มีประวัติการแชท</div>
          )}
          <div className="flex flex-col gap-2">
            {summaries.map((s) => (
              <button
                key={s.id}
                onClick={() => onLoad(s)}
                className={`w-full text-left p-2 rounded-md transition-colors flex items-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900 ${
                  activeId === s.id ? "bg-indigo-100 dark:bg-indigo-900" : ""
                }`}
                title={s.title}
              >
                <div className="w-8 shrink-0 text-center text-sm text-indigo-600">
                  •
                </div>
                <div className="flex-1">
                  <div className="text-sm truncate">{s.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {new Date(s.time).toLocaleString()}
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
