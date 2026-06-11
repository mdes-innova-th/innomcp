"use client";

import React, { useState, useMemo, useCallback } from "react";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ChatHistorySummary {
  id: string;
  title: string;
  messageCount: number;
  relativeTime: string; // e.g. "2m ago", "whenever"
  timestamp: number;    // epoch ms, used for grouping
}

interface ChatSidebarEnhancedProps {
  summaries: ChatHistorySummary[];
  activeSummaryId: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectSummary: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onSearch?: () => void;
  theme: string; // kept for potential future theming, not used here
}

// -----------------------------------------------------------------------------
// Grouping helpers
// -----------------------------------------------------------------------------

const getGroupLabel = (timestamp: number): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  if (date >= today) return "วันนี้";
  if (date >= yesterday) return "เมื่อวาน";
  const oneWeekAgo = new Date(today.getTime() - 7 * 86400000);
  if (date >= oneWeekAgo) return "สัปดาห์นี้";
  return "ก่อนหน้านี้";
};

interface GroupedSummaries {
  label: string;
  items: ChatHistorySummary[];
}

// -----------------------------------------------------------------------------
// Minimal inline SVG icons (taken from Heroicons outline style)
// -----------------------------------------------------------------------------

const PlusIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="h-5 w-5"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const MagnifyingGlassIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="h-5 w-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
    />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="h-5 w-5"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="h-5 w-5"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
  </svg>
);

const PencilIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="h-4 w-4"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
    />
  </svg>
);

const TrashIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="h-4 w-4"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
    />
  </svg>
);

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const ChatSidebarEnhanced: React.FC<ChatSidebarEnhancedProps> = ({
  summaries,
  activeSummaryId,
  isCollapsed,
  onToggleCollapse,
  onSelectSummary,
  onNewChat,
  onRename,
  onDelete,
  onSearch,
  theme,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Group summaries
  const groups: GroupedSummaries[] = useMemo(() => {
    if (!summaries.length) return [];

    // Sort by timestamp descending
    const sorted = [...summaries].sort((a, b) => b.timestamp - a.timestamp);

    const map = new Map<string, ChatHistorySummary[]>();
    sorted.forEach((item) => {
      const label = getGroupLabel(item.timestamp);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(item);
    });

    // Preserve order: Today, Yesterday, This Week, Older
    const order = ["วันนี้", "เมื่อวาน", "สัปดาห์นี้", "ก่อนหน้านี้"];
    return order
      .filter((label) => map.has(label))
      .map((label) => ({ label, items: map.get(label)! }));
  }, [summaries]);

  const handleRenameClick = useCallback(
    (e: React.MouseEvent, id: string, currentTitle: string) => {
      e.stopPropagation();
      const newTitle = prompt("ตั้งชื่อใหม่", currentTitle);
      if (newTitle && newTitle.trim() && newTitle.trim() !== currentTitle) {
        onRename(id, newTitle.trim());
      }
    },
    [onRename],
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (window.confirm("ต้องการลบบทสนทนานี้?")) {
        onDelete(id);
      }
    },
    [onDelete],
  );

  return (
    <aside
      className={`flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ease-in-out overflow-hidden ${
        isCollapsed ? "w-16" : "w-72"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100 dark:border-gray-800">
        {!isCollapsed && (
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            <span className="text-indigo-600 dark:text-indigo-400">🇹🇭 MDES INNOMCP</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={onNewChat}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
            title="แชทใหม่"
          >
            <PlusIcon />
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
            title={isCollapsed ? "ขยาย" : "ย่อ"}
          >
            {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        </div>
      </div>

      {/* Search Bar (collapsed: icon only) */}
      {isCollapsed ? (
        <button
          onClick={onSearch}
          className="mx-auto mt-3 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
          title="ค้นหา"
        >
          <MagnifyingGlassIcon />
        </button>
      ) : (
        <div className="px-3 py-2">
          <button
            onClick={onSearch}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <MagnifyingGlassIcon />
            <span>ค้นหาบทสนทนา...</span>
          </button>
        </div>
      )}

      {/* Conversation list (hidden when collapsed) */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
          {groups.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400 dark:text-gray-500">
              ยังไม่มีประวัติการสนทนา
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 px-2 mb-1 uppercase tracking-wider">
                  {group.label}
                </h3>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = item.id === activeSummaryId;
                    const isHovered = hoveredId === item.id;

                    return (
                      <li
                        key={item.id}
                        onMouseEnter={() => setHoveredId(item.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        className={`group relative flex items-center rounded-lg px-2 py-2 cursor-pointer transition-colors ${
                          isActive
                            ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-200"
                            : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                        onClick={() => onSelectSummary(item.id)}
                      >
                        {/* Main content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate pr-1">{item.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {item.relativeTime}
                            </span>
                            {item.messageCount > 0 && (
                              <span className="inline-flex items-center text-xs font-medium text-white bg-indigo-500 dark:bg-indigo-600 rounded-full px-1.5 py-0.5 leading-none">
                                {item.messageCount}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Hover actions */}
                        {isHovered && (
                          <div className="flex items-center gap-0.5 ml-1">
                            <button
                              onClick={(e) => handleRenameClick(e, item.id, item.title)}
                              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                              title="เปลี่ยนชื่อ"
                            >
                              <PencilIcon />
                            </button>
                            <button
                              onClick={(e) => handleDeleteClick(e, item.id)}
                              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                              title="ลบ"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
};

export default ChatSidebarEnhanced;