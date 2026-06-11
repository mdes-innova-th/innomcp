"use client";

import { useState, useEffect, useMemo, useCallback, type FC } from "react";

// --- Types ---
export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: string;
  shortcut?: string;
  action: (insertText: (t: string) => void) => void;
}

interface SlashCommandMenuProps {
  visible: boolean;
  query: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  position?: { bottom: number; left: number };
}

// --- Built-in Commands ---
const ALL_COMMANDS: SlashCommand[] = [
  {
    id: "image",
    label: "/image",
    description: "สร้างรูปภาพ",
    icon: "🖼️",
    action: (insert) => insert("สร้างรูปภาพ: "),
  },
  {
    id: "weather",
    label: "/weather",
    description: "รายงานสภาพอากาศ",
    icon: "🌤️",
    action: (insert) => insert("รายงานสภาพอากาศ จังหวัด "),
  },
  {
    id: "law",
    label: "/law",
    description: "ค้นหากฎหมาย",
    icon: "⚖️",
    action: (insert) => insert("ค้นหากฎหมายเรื่อง "),
  },
  {
    id: "summarize",
    label: "/summarize",
    description: "สรุปเนื้อหา",
    icon: "📋",
    action: (insert) => insert("สรุปเนื้อหา: "),
  },
  {
    id: "translate",
    label: "/translate",
    description: "แปลภาษา",
    icon: "🌐",
    action: (insert) => insert("แปลเป็นภาษาไทย: "),
  },
  {
    id: "code",
    label: "/code",
    description: "เขียนโค้ด",
    icon: "💻",
    action: (insert) => insert("เขียนโค้ด "),
  },
  {
    id: "table",
    label: "/table",
    description: "สร้างตาราง",
    icon: "📊",
    action: (insert) => insert("สร้างตาราง "),
  },
  {
    id: "data",
    label: "/data",
    description: "วิเคราะห์ข้อมูล",
    icon: "📈",
    action: (insert) => insert("วิเคราะห์ข้อมูล "),
  },
  {
    id: "report",
    label: "/report",
    description: "สร้างรายงาน",
    icon: "📝",
    action: (insert) => insert("สร้างรายงาน "),
  },
];

// Special help command (appended after other commands)
const HELP_COMMAND: SlashCommand = {
  id: "help",
  label: "/help",
  description: "แสดงคำสั่งทั้งหมด",
  icon: "❓",
  action: (insert) => {
    const helpText = [
      "คำสั่งที่มีอยู่:",
      "/image - สร้างรูปภาพ",
      "/weather - รายงานสภาพอากาศ จังหวัด",
      "/law - ค้นหากฎหมายเรื่อง",
      "/summarize - สรุปเนื้อหา",
      "/translate - แปลเป็นภาษาไทย",
      "/code - เขียนโค้ด",
      "/table - สร้างตาราง",
      "/data - วิเคราะห์ข้อมูล",
      "/report - สร้างรายงาน",
      "/help - แสดงคำสั่งทั้งหมด",
    ].join("\n");
    insert(helpText);
  },
};

const ALL_COMMANDS_WITH_HELP: SlashCommand[] = [
  ...ALL_COMMANDS,
  HELP_COMMAND,
];

// --- Fuzzy matching ---
const fuzzyMatch = (query: string, label: string): boolean => {
  if (!query) return true; // show all when empty
  const q = query.toLowerCase();
  const l = label.toLowerCase();
  let qi = 0;
  for (let i = 0; i < l.length && qi < q.length; i++) {
    if (l[i] === q[qi]) {
      qi++;
    }
  }
  return qi === q.length;
};

// --- Component ---
const SlashCommandMenu: FC<SlashCommandMenuProps> = ({
  visible,
  query,
  onSelect,
  onClose,
  position,
}) => {
  // Filter commands based on current query
  const filteredCommands = useMemo(
    () =>
      visible
        ? ALL_COMMANDS_WITH_HELP.filter((cmd) => fuzzyMatch(query, cmd.label))
        : [],
    [visible, query],
  );

  // Highlight index
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset highlight when query changes or menu becomes visible again
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, visible]);

  // Clamp index when list changes (e.g. after filtering)
  useEffect(() => {
    if (filteredCommands.length > 0 && selectedIndex >= filteredCommands.length) {
      setSelectedIndex(0);
    }
  }, [filteredCommands, selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible) return;
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev <= 0 ? filteredCommands.length - 1 : prev - 1,
          );
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev >= filteredCommands.length - 1 ? 0 : prev + 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands.length > 0) {
            const cmd = filteredCommands[selectedIndex];
            if (cmd) {
              onSelect(cmd);
              onClose();
            }
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    },
    [visible, filteredCommands, selectedIndex, onSelect, onClose],
  );

  useEffect(() => {
    if (visible) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible, handleKeyDown]);

  if (!visible || filteredCommands.length === 0) return null;

  return (
    <div
      className="absolute z-50 w-72 max-h-64 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl"
      style={{
        bottom: position?.bottom ?? 0,
        left: position?.left ?? 0,
      }}
      role="listbox"
    >
      <div className="p-1">
        {filteredCommands.map((cmd, index) => (
          <div
            key={cmd.id}
            role="option"
            aria-selected={index === selectedIndex}
            className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
              index === selectedIndex
                ? "bg-indigo-600 text-white"
                : "text-gray-200 hover:bg-gray-800"
            }`}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => {
              onSelect(cmd);
              onClose();
            }}
          >
            <span className="flex-shrink-0 text-lg">{cmd.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{cmd.label}</div>
              <div className="text-xs opacity-70 truncate">{cmd.description}</div>
            </div>
            {cmd.shortcut && (
              <kbd className="flex-shrink-0 text-xs bg-gray-700 px-1.5 py-0.5 rounded">
                {cmd.shortcut}
              </kbd>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SlashCommandMenu;