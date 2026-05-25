"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const BACKEND =
  typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:3011"
    : "";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: string;
  action: () => void;
  category: "navigation" | "task" | "action";
}

interface TaskResult {
  id: string;
  title: string;
  [key: string]: unknown;
}

export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [taskResults, setTaskResults] = useState<TaskResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when palette opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTaskResults([]);
    }
  }, [open]);

  // Auto-focus input when open
  useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [open]);

  // Fetch tasks when query changes (debounced 300ms)
  useEffect(() => {
    if (!query.trim()) {
      setTaskResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${BACKEND}/api/tasks?limit=10`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        const tasks: TaskResult[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.tasks)
          ? data.tasks
          : [];
        const q = query.toLowerCase();
        setTaskResults(tasks.filter((t) => t.title?.toLowerCase().includes(q)));
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("[CommandPalette] fetch error:", err);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Build static commands
  const staticCommands: CommandItem[] = [
    {
      id: "nav-dashboard",
      label: "Dashboard",
      icon: "📊",
      category: "navigation",
      action: () => { router.push("/dashboard"); onClose(); },
    },
    {
      id: "nav-projects",
      label: "Projects",
      icon: "📁",
      category: "navigation",
      action: () => { router.push("/projects"); onClose(); },
    },
    {
      id: "nav-task-history",
      label: "Task History",
      icon: "📋",
      category: "navigation",
      action: () => { router.push("/task-history"); onClose(); },
    },
    {
      id: "action-new-task",
      label: "New Task",
      description: "เริ่มงานใหม่",
      icon: "➕",
      category: "action",
      action: () => { router.push("/"); onClose(); },
    },
  ];

  // Build task commands from search results
  const taskCommands: CommandItem[] = taskResults.map((t) => ({
    id: `task-${t.id}`,
    label: t.title,
    icon: "📌",
    category: "task" as const,
    action: () => { router.push(`/task-history`); onClose(); },
  }));

  // All items flat list for keyboard nav
  const showStatic = !query.trim();
  const allItems: CommandItem[] = showStatic
    ? staticCommands
    : taskCommands.length > 0
    ? taskCommands
    : staticCommands;

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (allItems[selectedIndex]) {
            allItems[selectedIndex].action();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [allItems, selectedIndex, onClose]
  );

  // Reset selected index when allItems changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  // Group static commands by category
  const navItems = staticCommands.filter((c) => c.category === "navigation");
  const actionItems = staticCommands.filter((c) => c.category === "action");

  // Build rendered sections
  const renderItems = () => {
    if (!showStatic) {
      // Search mode: show task results or fallback to static
      if (taskCommands.length > 0) {
        return (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-4 py-1.5">
              Tasks
            </div>
            {taskCommands.map((item, idx) => (
              <ItemRow
                key={item.id}
                item={item}
                isSelected={idx === selectedIndex}
                onClick={item.action}
              />
            ))}
          </div>
        );
      }
      // No task results — fall through to show static with filter
      const filtered = staticCommands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          (c.description?.toLowerCase().includes(query.toLowerCase()) ?? false)
      );
      if (filtered.length === 0) {
        return (
          <div className="px-4 py-6 text-center text-[13px] text-muted-foreground/60">
            ไม่พบผลลัพธ์
          </div>
        );
      }
      return (
        <div>
          {filtered.map((item, idx) => (
            <ItemRow
              key={item.id}
              item={item}
              isSelected={idx === selectedIndex}
              onClick={item.action}
            />
          ))}
        </div>
      );
    }

    // Static mode: show by category
    let runningIdx = 0;
    return (
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-4 py-1.5">
          Navigation
        </div>
        {navItems.map((item) => {
          const idx = runningIdx++;
          return (
            <ItemRow
              key={item.id}
              item={item}
              isSelected={idx === selectedIndex}
              onClick={item.action}
            />
          );
        })}
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-4 py-1.5 mt-1">
          Actions
        </div>
        {actionItems.map((item) => {
          const idx = runningIdx++;
          return (
            <ItemRow
              key={item.id}
              item={item}
              isSelected={idx === selectedIndex}
              onClick={item.action}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[20vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border/60 bg-background shadow-2xl overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="พิมพ์คำสั่งหรือค้นหา..."
          className="text-[14px] px-4 py-3 w-full bg-transparent border-b border-border/40 focus:outline-none placeholder:text-muted-foreground/50"
        />

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1.5">
          {renderItems()}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border/40 px-4 py-2 flex items-center gap-3 text-[11px] text-muted-foreground/50">
          <span><kbd className="font-mono">↑↓</kbd> เลือก</span>
          <span><kbd className="font-mono">↵</kbd> เปิด</span>
          <span><kbd className="font-mono">Esc</kbd> ปิด</span>
        </div>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  isSelected,
  onClick,
}: {
  item: CommandItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-[13px] w-full text-left transition-colors ${
        isSelected ? "bg-muted/50" : "hover:bg-muted/30"
      }`}
    >
      <span className="text-base leading-none shrink-0">{item.icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block truncate text-foreground">{item.label}</span>
        {item.description && (
          <span className="block truncate text-[11.5px] text-muted-foreground/70 mt-0.5">
            {item.description}
          </span>
        )}
      </span>
      <span className="shrink-0 text-[10.5px] font-mono text-muted-foreground/40 uppercase tracking-wider">
        {item.category}
      </span>
    </button>
  );
}
