"use client";

import React, { useState } from "react";

interface ChatConversationHeaderProps {
  title?: string;
  messageCount?: number;
  isStreaming?: boolean;
  agentCount?: number;
  onExport?: () => void;
  onSearch?: () => void;
  onClear?: () => void;
  className?: string;
}

export default function ChatConversationHeader({
  title,
  messageCount,
  isStreaming = false,
  onExport,
  onSearch,
  onClear,
  className,
}: ChatConversationHeaderProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClearClick = () => {
    if (isStreaming) return;
    setShowClearConfirm(true);
  };

  const handleConfirmClear = () => {
    setShowClearConfirm(false);
    onClear?.();
  };

  const handleCancelClear = () => {
    setShowClearConfirm(false);
  };

  const displayTitle = title || "แชท";
  const showBadge = typeof messageCount === "number" && messageCount > 0;

  return (
    <div
      className={`flex items-center justify-between h-8 px-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 group transition-colors ${className ?? ""}`}
    >
      {/* Left side: title + badge */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate min-w-0">
          {displayTitle}
        </p>
        {showBadge && (
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 shrink-0">
            {messageCount}
          </span>
        )}
      </div>

      {/* Right side: action icons (visible on hover) */}
      <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
        {/* Search */}
        <button
          onClick={onSearch}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          title="ค้นหา"
          aria-label="ค้นหาข้อความ"
        >
          <SearchIcon />
        </button>

        {/* Export */}
        <button
          onClick={onExport}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          title="ส่งออก"
          aria-label="ส่งออกแชท"
        >
          <ExportIcon />
        </button>

        {/* Clear */}
        {showClearConfirm ? (
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <span>ยืนยัน?</span>
            <button
              onClick={handleConfirmClear}
              className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900"
            >
              ใช่
            </button>
            <button
              onClick={handleCancelClear}
              className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              ยกเลิก
            </button>
          </div>
        ) : (
          <button
            onClick={handleClearClick}
            disabled={isStreaming}
            className={`p-1 rounded ${
              isStreaming
                ? "opacity-40 cursor-not-allowed text-gray-400 dark:text-gray-600"
                : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            }`}
            title={isStreaming ? "ไม่สามารถลบขณะกำลังพิมพ์" : "ล้างประวัติ"}
            aria-label="ล้างประวัติแชท"
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
}

/* Simple inline SVG icons (no external dependencies) */
function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-4 h-4"
    >
      <path
        fillRule="evenodd"
        d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-4 h-4"
    >
      <path
        fillRule="evenodd"
        d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-4 h-4"
    >
      <path
        fillRule="evenodd"
        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}