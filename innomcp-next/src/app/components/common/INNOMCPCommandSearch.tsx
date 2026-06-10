"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";

interface CommandItem {
  id: string;
  icon: string;
  title: string;
  description?: string;
  keywords: string[];
  action: () => void;
  category: "chat" | "navigation" | "tool" | "provider" | "setting";
}

interface INNOMCPCommandSearchProps {
  open: boolean;
  onClose: () => void;
  onNewChat?: () => void;
  onOpenWorkspace?: () => void;
  onOpenProviders?: () => void;
  onOpenModelSettings?: () => void;
}

const ALL_COMMANDS: CommandItem[] = [
  {
    id: "new-chat",
    icon: "💬",
    title: "แชทใหม่",
    description: "เริ่มการสนทนาใหม่",
    keywords: ["ใหม่", "แชท", "เริ่ม", "chat", "new"],
    action: () => {},
    category: "chat",
  },
  {
    id: "open-workspace",
    icon: "📂",
    title: "เปิดพื้นที่ทำงาน",
    description: "จัดการไฟล์และโปรเจกต์",
    keywords: ["workspace", "พื้นที่ทำงาน", "ไฟล์", "โปรเจกต์"],
    action: () => {},
    category: "chat",
  },
  {
    id: "add-provider",
    icon: "➕",
    title: "เพิ่ม Provider",
    description: "เพิ่มผู้ให้บริการโมเดลใหม่",
    keywords: ["add", "provider", "เพิ่ม", "ผู้ให้บริการ"],
    action: () => {},
    category: "provider",
  },
  {
    id: "manage-providers",
    icon: "⚙️",
    title: "จัดการ Provider",
    description: "ดูและแก้ไขผู้ให้บริการ",
    keywords: ["manage", "providers", "จัดการ", "แก้ไข"],
    action: () => {},
    category: "provider",
  },
  {
    id: "mdes-ollama-setting",
    icon: "🦙",
    title: "ตั้งค่า MDES Ollama",
    description: "กำหนดค่าการเชื่อมต่อ Ollama สำหรับ MDES",
    keywords: ["ollama", "mdes", "ตั้งค่า", "model", "โมเดล"],
    action: () => {},
    category: "setting",
  },
  {
    id: "health-check",
    icon: "❤️",
    title: "ตรวจสุขภาพระบบ",
    description: "ทดสอบการเชื่อมต่อและสถานะระบบ",
    keywords: ["health", "check", "ตรวจสอบ", "สถานะ", "ระบบ"],
    action: () => {},
    category: "tool",
  },
  {
    id: "toggle-theme",
    icon: "🌓",
    title: "ธีมมืด/สว่าง",
    description: "สลับระหว่างโหมดมืดและสว่าง",
    keywords: ["theme", "dark", "light", "ธีม", "มืด", "สว่าง"],
    action: () => {},
    category: "setting",
  },
  {
    id: "clear-history",
    icon: "🗑️",
    title: "ล้างประวัติ",
    description: "ลบประวัติการสนทนาทั้งหมด",
    keywords: ["clear", "history", "ล้าง", "ประวัติ", "ลบ"],
    action: () => {},
    category: "tool",
  },
  {
    id: "shortcuts",
    icon: "⌨️",
    title: "ดูคีย์ลัด",
    description: "แสดงรายการปุ่มลัดทั้งหมด",
    keywords: ["shortcuts", "keyboard", "คีย์ลัด", "ปุ่มลัด", "ทางลัด"],
    action: () => {},
    category: "setting",
  },
  {
    id: "about",
    icon: "ℹ️",
    title: "เกี่ยวกับ INNOMCP",
    description: "ข้อมูลเวอร์ชันและทีมพัฒนา",
    keywords: ["about", "เกี่ยวกับ", "INNOMCP", "version", "เวอร์ชัน"],
    action: () => {},
    category: "setting",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  chat: "แชท",
  tool: "เครื่องมือ",
  provider: "ผู้ให้บริการ",
  setting: "การตั้งค่า",
  navigation: "นำทาง",
};

const CATEGORY_ORDER = ["chat", "tool", "provider", "setting"];

export default function INNOMCPCommandSearch({
  open,
  onClose,
  onNewChat,
  onOpenWorkspace,
  onOpenProviders,
  onOpenModelSettings,
}: INNOMCPCommandSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Bind external action callbacks to the static command definitions
  const commands = useMemo(() => {
    return ALL_COMMANDS.map((cmd) => {
      const bound = { ...cmd };
      switch (cmd.id) {
        case "new-chat":
          bound.action = () => onNewChat?.();
          break;
        case "open-workspace":
          bound.action = () => onOpenWorkspace?.();
          break;
        case "add-provider":
        case "manage-providers":
          bound.action = () => onOpenProviders?.();
          break;
        case "mdes-ollama-setting":
          bound.action = () => onOpenModelSettings?.();
          break;
        // keep others as no-op
      }
      return bound;
    });
  }, [onNewChat, onOpenWorkspace, onOpenProviders, onOpenModelSettings]);

  // Fuzzy matching: case-insensitive substring in title or any keyword
  const filterCommands = useCallback(
    (search: string) => {
      if (!search.trim()) return commands;
      const lower = search.toLowerCase();
      return commands.filter((cmd) => {
        if (cmd.title.toLowerCase().includes(lower)) return true;
        return cmd.keywords.some((kw) => kw.toLowerCase().includes(lower));
      });
    },
    [commands]
  );

  const filteredCommands = useMemo(() => filterCommands(query), [query, filterCommands]);

  // Group filtered commands by category
  const groupedCommands = useMemo(() => {
    const groups: { category: string; items: CommandItem[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const items = filteredCommands.filter((cmd) => cmd.category === cat);
      if (items.length > 0) {
        groups.push({ category: cat, items });
      }
    }
    return groups;
  }, [filteredCommands]);

  // Reset search state when modal opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      // Small delay to focus after animation
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Clamp selected index when filtered results change
  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(0);
    }
  }, [filteredCommands, selectedIndex]);

  // Scroll selected command into view
  useEffect(() => {
    if (listContainerRef.current && filteredCommands.length > 0) {
      const el = listContainerRef.current.querySelector(
        `[data-command-index="${selectedIndex}"]`
      ) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex, filteredCommands]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredCommands.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCommands.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filteredCommands[selectedIndex];
      if (cmd) {
        cmd.action();
        onClose();
      }
    }
  };

  const handleCommandClick = (idx: number) => {
    const cmd = filteredCommands[idx];
    if (cmd) {
      cmd.action();
      onClose();
    }
  };

  // Prevent clicks on the dialog from closing the modal
  const handleDialogClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
        onClick={handleDialogClick}
      >
        {/* Search input */}
        <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <svg
            className="w-5 h-5 text-gray-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="พิมพ์เพื่อค้นหาคำสั่ง..."
            className="flex-1 ml-3 bg-transparent border-none outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-block ml-2 text-xs text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>

        {/* Results list */}
        <div
          ref={listContainerRef}
          className="max-h-[50vh] overflow-y-auto p-2"
        >
          {filteredCommands.length === 0 && (
            <div className="px-3 py-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                ไม่พบคำสั่ง &apos;<span className="font-medium">{query}</span>&apos;
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                ลองพิมพ์: แชท, ตั้งค่า, Provider, ล้าง, เกี่ยวกับ
              </p>
            </div>
          )}

          {groupedCommands.map((group) => (
            <div key={group.category} className="mb-2">
              <div className="px-3 py-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {CATEGORY_LABELS[group.category] || group.category}
              </div>
              {group.items.map((cmd) => {
                const globalIdx = filteredCommands.indexOf(cmd);
                const isSelected = globalIdx === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    data-command-index={globalIdx}
                    onClick={() => handleCommandClick(globalIdx)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}
                  >
                    <span className="text-xl flex-shrink-0">{cmd.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{cmd.title}</div>
                      {cmd.description && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                          {cmd.description}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 flex justify-between">
          <span>
            <kbd className="border border-gray-200 dark:border-gray-600 rounded px-1">↑↓</kbd> เลือก
          </span>
          <span>
            <kbd className="border border-gray-200 dark:border-gray-600 rounded px-1">Enter</kbd> เปิด
          </span>
          <span>
            <kbd className="border border-gray-200 dark:border-gray-600 rounded px-1">Esc</kbd> ปิด
          </span>
        </div>
      </div>
    </div>
  );
}