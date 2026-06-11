"use client";

import { useState, useMemo } from "react";

interface ChatSummary {
  id: string;
  title: string;
  messages: unknown[];
  createdAt?: number;
}

interface ChatHistoryPanelProps {
  summaries: ChatSummary[];
  activeSummaryId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
  className?: string;
}

/**
 * Group a timestamp into Thai labels:
 * วันนี้, เมื่อวาน, สัปดาห์นี้, เก่ากว่า
 */
function getGroupLabel(timestamp: number): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  // Week starts on Monday
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(today.getTime() - daysSinceMonday * 86400000);

  if (timestamp >= today.getTime()) return "วันนี้";
  if (timestamp >= yesterday.getTime()) return "เมื่อวาน";
  if (timestamp >= monday.getTime()) return "สัปดาห์นี้";
  return "เก่ากว่า";
}

/**
 * ChatHistoryPanel — แสดงประวัติแชทภายใน Sidebar
 *
 * - ช่องค้นหา
 * - ปุ่ม “แชทใหม่”
 * - แบ่งกลุ่มตามเวลา (วันนี้ / เมื่อวาน / สัปดาห์นี้ / เก่ากว่า)
 * - แต่ละรายการ: ชื่อ (ตัดข้อความ) + hover แสดงปุ่มเปลี่ยนชื่อ/ลบ
 * - active item: bg-primary/10 + border-l-primary
 * - ถ้าไม่มีข้อมูล: แสดง “ยังไม่มีประวัติ”
 */
export default function ChatHistoryPanel({
  summaries,
  activeSummaryId,
  onSelect,
  onRename,
  onDelete,
  onNewChat,
  className = "",
}: ChatHistoryPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Filter summaries by search term
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return summaries;
    const lower = searchTerm.toLowerCase();
    return summaries.filter((s) => s.title.toLowerCase().includes(lower));
  }, [summaries, searchTerm]);

  // Group filtered summaries
  const grouped = useMemo(() => {
    const groups: Record<string, ChatSummary[]> = {};
    for (const s of filtered) {
      const label = s.createdAt ? getGroupLabel(s.createdAt) : "เก่ากว่า";
      if (!groups[label]) groups[label] = [];
      groups[label].push(s);
    }
    const order = ["วันนี้", "เมื่อวาน", "สัปดาห์นี้", "เก่ากว่า"];
    return order
      .filter((key) => groups[key]?.length > 0)
      .map((key) => ({ label: key, items: groups[key] }));
  }, [filtered]);

  const handleRename = (id: string) => {
    const newTitle = window.prompt("เปลี่ยนชื่อแชท:", "");
    if (newTitle && newTitle.trim()) {
      onRename(id, newTitle.trim());
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("ต้องการลบแชทนี้ใช่หรือไม่?")) {
      onDelete(id);
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Search input */}
      <div className="px-3 pt-2">
        <input
          type="text"
          placeholder="ค้นหา..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* New chat button */}
      <div className="px-3 py-2">
        <button
          onClick={onNewChat}
          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          แชทใหม่
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2">
        {grouped.length === 0 ? (
          <div className="text-center text-sm text-gray-500 mt-8">
            ยังไม่มีประวัติ
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.label} className="mb-3">
              {/* Group header */}
              <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {group.label}
              </div>
              {/* Items */}
              {group.items.map((chat) => (
                <div
                  key={chat.id}
                  className={`group relative flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-sm ${
                    activeSummaryId === chat.id
                      ? "bg-primary/10 border-l-2 border-primary"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                  onClick={() => onSelect(chat.id)}
                >
                  <span className="truncate flex-1 pr-6">{chat.title}</span>
                  {/* Action buttons (show on hover) */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRename(chat.id);
                      }}
                      className="p-0.5 text-gray-500 hover:text-primary text-sm"
                      title="เปลี่ยนชื่อ"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(chat.id);
                      }}
                      className="p-0.5 text-gray-500 hover:text-red-500 text-sm"
                      title="ลบ"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}