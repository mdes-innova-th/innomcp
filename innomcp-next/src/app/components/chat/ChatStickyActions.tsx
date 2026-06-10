'use client'

import React, { useMemo } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatStickyActionsProps {
  hasMessages: boolean
  isStreaming: boolean
  onNewChat: () => void
  onExport?: () => void
  onSearch?: () => void
  onClear?: () => void
  unreadCount?: number
}

// ---------------------------------------------------------------------------
// Icons (inline SVGs – no dependencies)
// ---------------------------------------------------------------------------

const SearchIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
  </svg>
)

const ExportIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
  </svg>
)

const ClearIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ChatStickyActions: React.FC<ChatStickyActionsProps> = ({
  hasMessages,
  isStreaming,
  onNewChat,
  onExport,
  onSearch,
  onClear,
  unreadCount,
}) => {
  // Show bar only when there are messages AND not streaming
  const visible = hasMessages && !isStreaming

  // Determine if unread count should be shown (optional)
  const showUnread = unreadCount !== undefined && unreadCount > 0

  return (
    <div
      className={`
        h-8 flex items-center justify-between px-4 
        bg-white dark:bg-gray-800 
        border-t border-gray-200 dark:border-gray-700
        transition-opacity duration-300 ease-in-out
        ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      `}
      aria-hidden={!visible}
      role="toolbar"
      aria-label="ตัวเลือกการสนทนา"
    >
      {/* ---------- Left: "แชทใหม่" button ---------- */}
      <button
        type="button"
        onClick={onNewChat}
        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
        aria-label="เริ่มแชทใหม่"
      >
        แชทใหม่
      </button>

      {/* ---------- Center: search icon ---------- */}
      {onSearch && (
        <button
          type="button"
          onClick={onSearch}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="ค้นหาประวัติการสนทนา"
        >
          <SearchIcon />
        </button>
      )}

      {/* ---------- Right: export + clear ---------- */}
      <div className="flex items-center space-x-3">
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="ส่งออกการสนทนา"
          >
            <ExportIcon />
          </button>
        )}

        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="ล้างประวัติการสนทนา"
          >
            <ClearIcon />
          </button>
        )}
      </div>

      {/* Optional unread badge (hidden when zero) */}
      {showUnread && (
        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 min-w-[1rem] px-1 text-xs font-bold text-white bg-red-500 rounded-full">
          {unreadCount! > 99 ? '99+' : unreadCount}
        </span>
      )}
    </div>
  )
}

export default ChatStickyActions