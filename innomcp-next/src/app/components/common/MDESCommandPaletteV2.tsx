"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  KeyboardEvent,
  ReactNode,
} from "react";

// ─── Types ───────────────────────────────────────────────

interface Command {
  id: string;
  label: string;
  group: string;
  icon?: string; // emoji
  keywords?: string[];
  action: () => void;
}

interface GroupMeta {
  name: string;
  icon: string;
}

interface RenderItem {
  type: "header" | "command";
  group?: string;
  icon?: string;
  command?: Command;
  isRecent?: boolean;
}

interface MDESCommandPaletteV2Props {
  isOpen: boolean;
  onClose: () => void;
  onNewChat?: () => void;
  onOpenWorkspace?: () => void;
  onOpenProviders?: () => void;
  onOpenModelSettings?: () => void;
  onCommand?: (commandId: string) => void;
}

// ─── Constants ───────────────────────────────────────────

const GROUP_ORDER: GroupMeta[] = [
  { name: "บทสนทนา", icon: "💬" },
  { name: "AI Model", icon: "🤖" },
  { name: "เครื่องมือ", icon: "🛠️" },
  { name: "ตั้งค่า", icon: "⚙️" },
  { name: "ช่วยเหลือ", icon: "📚" },
];

const RECENT_GROUP_NAME = "ล่าสุด";
const RECENT_GROUP_ICON = "🕒";
const MAX_RECENT = 5;
const STORAGE_KEY = "mdes_command_palette_recent";

// ─── Fuzzy Search ───────────────────────────────────────

function fuzzyMatch(query: string, text: string): boolean {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lowerText.length && qi < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[qi]) {
      qi++;
    }
  }
  return qi === lowerQuery.length;
}

// ─── Component ──────────────────────────────────────────

export default function MDESCommandPaletteV2({
  isOpen,
  onClose,
  onNewChat,
  onOpenWorkspace,
  onOpenProviders,
  onOpenModelSettings,
  onCommand,
}: MDESCommandPaletteV2Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Persist recent commands
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recentIds));
    } catch {
      // ignore
    }
  }, [recentIds]);

  // Save / restore focus
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setTimeout(() => inputRef.current?.focus(), 0);
      setSearchQuery("");
      setSelectedIndex(0);
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isOpen, onClose]);

  // ─── Commands generation (depends on props) ────────────

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      {
        id: "new_chat",
        label: "แชทใหม่",
        group: "บทสนทนา",
        icon: "💬",
        keywords: ["new", "chat", "สนทนา"],
        action: () => {
          onNewChat?.();
          onCommand?.("new_chat");
        },
      },
      {
        id: "clear_history",
        label: "ล้างประวัติ",
        group: "บทสนทนา",
        icon: "🧹",
        keywords: ["clear", "history", "ล้าง"],
        action: () => {
          onNewChat?.(); // maybe clear triggers new chat
          onCommand?.("clear_history");
        },
      },
      {
        id: "export",
        label: "ส่งออก",
        group: "บทสนทนา",
        icon: "📤",
        keywords: ["export", "save"],
        action: () => onCommand?.("export"),
      },
      {
        id: "search_chat",
        label: "ค้นหา",
        group: "บทสนทนา",
        icon: "🔍",
        keywords: ["search", "find"],
        action: () => onCommand?.("search_chat"),
      },
      {
        id: "change_model",
        label: "เปลี่ยน model",
        group: "AI Model",
        icon: "🤖",
        keywords: ["model", "switch", "เปลี่ยน"],
        action: () => {
          onOpenModelSettings?.();
          onCommand?.("change_model");
        },
      },
      {
        id: "view_mdes_models",
        label: "ดูโมเดล MDES",
        group: "AI Model",
        icon: "📋",
        keywords: ["models", "list", "ดู"],
        action: () => onCommand?.("view_mdes_models"),
      },
      {
        id: "test_connection",
        label: "ทดสอบการเชื่อมต่อ",
        group: "AI Model",
        icon: "🔌",
        keywords: ["test", "connection", "connect"],
        action: () => onCommand?.("test_connection"),
      },
      {
        id: "open_workspace",
        label: "เปิด Workspace",
        group: "เครื่องมือ",
        icon: "🛠️",
        keywords: ["workspace", "open"],
        action: () => {
          onOpenWorkspace?.();
          onCommand?.("open_workspace");
        },
      },
      {
        id: "provider_status",
        label: "สถานะ Provider",
        group: "เครื่องมือ",
        icon: "📊",
        keywords: ["status", "provider", "health"],
        action: () => onCommand?.("provider_status"),
      },
      {
        id: "health_check",
        label: "Health Check",
        group: "เครื่องมือ",
        icon: "❤️",
        keywords: ["health", "check", "status"],
        action: () => onCommand?.("health_check"),
      },
      {
        id: "theme",
        label: "ธีม",
        group: "ตั้งค่า",
        icon: "🎨",
        keywords: ["theme", "dark", "light"],
        action: () => onCommand?.("theme"),
      },
      {
        id: "provider_settings",
        label: "ตั้งค่า Provider",
        group: "ตั้งค่า",
        icon: "⚙️",
        keywords: ["settings", "provider", "config"],
        action: () => {
          onOpenProviders?.();
          onCommand?.("provider_settings");
        },
      },
      {
        id: "shortcuts",
        label: "Shortcuts",
        group: "ตั้งค่า",
        icon: "⌨️",
        keywords: ["shortcuts", "keys"],
        action: () => onCommand?.("shortcuts"),
      },
      {
        id: "quick_start",
        label: "Quick Start",
        group: "ช่วยเหลือ",
        icon: "🚀",
        keywords: ["quick", "start", "guide"],
        action: () => onCommand?.("quick_start"),
      },
      {
        id: "keyboard_shortcuts",
        label: "Keyboard Shortcuts",
        group: "ช่วยเหลือ",
        icon: "📖",
        keywords: ["keyboard", "shortcuts", "keys"],
        action: () => onCommand?.("keyboard_shortcuts"),
      },
      {
        id: "about",
        label: "About INNOMCP",
        group: "ช่วยเหลือ",
        icon: "ℹ️",
        keywords: ["about", "info", "version"],
        action: () => onCommand?.("about"),
      },
    ];
    return list;
  }, [onNewChat, onOpenWorkspace, onOpenProviders, onOpenModelSettings, onCommand]);

  // ─── Recent commands helper ───────────────────────────

  const addToRecent = useCallback(
    (commandId: string) => {
      setRecentIds((prev) => {
        const filtered = prev.filter((id) => id !== commandId);
        return [commandId, ...filtered].slice(0, MAX_RECENT);
      });
    },
    [],
  );

  // Execute a command and close
  const executeCommand = useCallback(
    (command: Command) => {
      command.action();
      addToRecent(command.id);
      onClose();
    },
    [addToRecent, onClose],
  );

  // ─── Items to display ────────────────────────────────

  const allItems = useMemo<RenderItem[]>(() => {
    const q = searchQuery.trim();
    if (!q) {
      // Show recent + all groups in order
      const items: RenderItem[] = [];

      // Recent group
      const recentCommands = recentIds
        .map((id) => commands.find((c) => c.id === id))
        .filter(Boolean) as Command[];
      if (recentCommands.length > 0) {
        items.push({
          type: "header",
          group: RECENT_GROUP_NAME,
          icon: RECENT_GROUP_ICON,
        });
        recentCommands.forEach((cmd) => {
          items.push({ type: "command", command: cmd, isRecent: true });
        });
      }

      // Grouped commands
      for (const group of GROUP_ORDER) {
        const groupCommands = commands.filter((c) => c.group === group.name);
        if (groupCommands.length === 0) continue;
        items.push({
          type: "header",
          group: group.name,
          icon: group.icon,
        });
        groupCommands.forEach((cmd) => {
          items.push({ type: "command", command: cmd });
        });
      }

      return items;
    }

    // Search mode: filter all commands and show grouped
    const matched = commands.filter((cmd) => {
      const labelMatch = fuzzyMatch(q, cmd.label);
      const keywordMatch = cmd.keywords?.some((k) => fuzzyMatch(q, k)) ?? false;
      return labelMatch || keywordMatch;
    });

    const grouped: Record<string, Command[]> = {};
    for (const cmd of matched) {
      if (!grouped[cmd.group]) grouped[cmd.group] = [];
      grouped[cmd.group].push(cmd);
    }

    const items: RenderItem[] = [];
    for (const group of GROUP_ORDER) {
      if (grouped[group.name]?.length) {
        items.push({
          type: "header",
          group: group.name,
          icon: group.icon,
        });
        grouped[group.name]!.forEach((cmd) => {
          items.push({ type: "command", command: cmd });
        });
      }
    }
    return items;
  }, [searchQuery, commands, recentIds]);

  // Flatten only command items for keyboard navigation
  const commandItems = useMemo(
    () => allItems.filter((item) => item.type === "command"),
    [allItems],
  );

  // Reset selected index when list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery, allItems]);

  const selectedCommand =
    selectedIndex >= 0 && selectedIndex < commandItems.length
      ? commandItems[selectedIndex].command
      : null;

  // ─── Keyboard handling ───────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            commandItems.length === 0
              ? 0
              : (prev + 1) % commandItems.length,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            commandItems.length === 0
              ? 0
              : (prev - 1 + commandItems.length) % commandItems.length,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (selectedCommand) {
            executeCommand(selectedCommand);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isOpen, commandItems, selectedCommand, executeCommand, onClose],
  );

  const handleItemClick = useCallback(
    (command: Command) => {
      executeCommand(command);
    },
    [executeCommand],
  );

  // ─── Scroll selected into view ───────────────────────

  const selectedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // ─── Render ──────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[20vh]"
      onClick={(e) => {
        // Close when clicking backdrop
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        className="w-full max-w-xl bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center border-b border-gray-700 p-4">
          <span className="text-gray-400 mr-3 text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="พิมพ์เพื่อค้นหาคำสั่ง..."
            className="w-full bg-transparent text-white placeholder-gray-400 text-lg outline-none"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Command list */}
        <div className="max-h-80 overflow-y-auto p-2">
          {allItems.length === 0 && searchQuery.trim() !== "" && (
            <div className="text-center py-8 text-gray-400">
              ไม่พบคำสั่งที่ตรงกับ &ldquo;{searchQuery}&rdquo;
            </div>
          )}

          {allItems.map((item, idx) => {
            if (item.type === "header") {
              return (
                <div
                  key={`header-${item.group}-${idx}`}
                  className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-2 mt-2 first:mt-0"
                >
                  {item.icon} {item.group}
                </div>
              );
            }

            // Command item
            const cmd = item.command!;
            const isSelected =
              commandItems.indexOf(item) === selectedIndex;
            return (
              <div
                key={`cmd-${cmd.id}-${idx}`}
                ref={isSelected ? selectedRef : null}
                className={`flex items-center px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                  isSelected
                    ? "bg-indigo-600 text-white"
                    : "text-gray-200 hover:bg-gray-700"
                }`}
                onClick={() => handleItemClick(cmd)}
                role="option"
                aria-selected={isSelected}
              >
                <span className="mr-3 text-base">{cmd.icon}</span>
                <span className="flex-1">{cmd.label}</span>
                {item.isRecent && (
                  <span className="ml-2 text-xs text-gray-500">ล่าสุด</span>
                )}
              </div>
            );
          })}

          {allItems.length === 0 && searchQuery.trim() === "" && (
            <div className="text-center py-8 text-gray-400">
              ไม่มีคำสั่ง
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 mr-1">↑↓</kbd>
            {" "}นำทาง
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 ml-2 mr-1">Enter</kbd>
            {" "}เลือก
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 mr-1">Esc</kbd>
            {" "}ปิด
          </span>
        </div>
      </div>
    </div>
  );
}