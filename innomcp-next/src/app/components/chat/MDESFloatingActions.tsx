"use client";

import React, { useEffect, useState } from "react";

interface MDESFloatingActionsProps {
  showScrollToBottom: boolean;
  unreadCount?: number;
  onScrollToBottom: () => void;
  onNewChat: () => void;
  showNewChat?: boolean;
}

const MDESFloatingActions: React.FC<MDESFloatingActionsProps> = ({
  showScrollToBottom,
  unreadCount = 0,
  onScrollToBottom,
  onNewChat,
  showNewChat = false,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className={`fixed bottom-20 right-4 z-50 flex flex-col gap-2 transition-all duration-300 ease-out transform ${
        mounted ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
      }`}
    >
      {/* Scroll to bottom button */}
      {showScrollToBottom && (
        <button
          type="button"
          onClick={onScrollToBottom}
          aria-label="ลงล่าง"
          className="relative flex items-center justify-center w-12 h-12 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-lg hover:bg-background/90 transition-colors"
        >
          {/* Down arrow icon (SVG) */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 text-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>

          {/* Unread badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs font-bold leading-none text-white bg-indigo-600 rounded-full">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* New chat button */}
      {showNewChat && (
        <button
          type="button"
          onClick={onNewChat}
          aria-label="แชทใหม่"
          className="flex items-center justify-center w-12 h-12 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-lg hover:bg-background/90 transition-colors"
        >
          {/* Plus icon (SVG) */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 text-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default MDESFloatingActions;