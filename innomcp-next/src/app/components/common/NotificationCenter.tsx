"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: "task_complete" | "task_failed" | "approval_required" | "system";
  title: string;
  body: string;
  taskId?: string;
  timestamp: number;
  read: boolean;
}

// ─── Storage helpers (SSR-safe) ───────────────────────────────────────────────

const STORAGE_KEY = "innomcp-notifications";
const MAX_NOTIFICATIONS = 50;

export function getNotifications(): Notification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Notification[];
  } catch {
    return [];
  }
}

export function addNotification(
  n: Omit<Notification, "id" | "timestamp" | "read">
): void {
  if (typeof window === "undefined") return;
  const notifications = getNotifications();
  notifications.unshift({
    ...n,
    id: Date.now().toString(),
    timestamp: Date.now(),
    read: false,
  });
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS))
  );
}

export function getUnreadCount(): number {
  return getNotifications().filter((n) => !n.read).length;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const TYPE_ICON: Record<Notification["type"], string> = {
  task_complete: "✅",
  task_failed: "❌",
  approval_required: "⚠️",
  system: "ℹ️",
};

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "เมื่อกี้";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface NotificationCenterProps {
  onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose }) => {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Load from localStorage on mount (client-only)
  useEffect(() => {
    setNotifications(getNotifications());
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const persist = (updated: Notification[]) => {
    setNotifications(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updated.slice(0, MAX_NOTIFICATIONS))
      );
    }
  };

  const markAllRead = () => {
    persist(notifications.map((n) => ({ ...n, read: true })));
  };

  const handleItemClick = (n: Notification) => {
    // Mark as read
    const updated = notifications.map((item) =>
      item.id === n.id ? { ...item, read: true } : item
    );
    persist(updated);

    // Navigate if taskId present
    if (n.taskId) {
      router.push(`/tasks/${n.taskId}`);
      onClose();
    }
  };

  return (
    <div
      className="fixed right-4 top-16 z-40 w-80 rounded-2xl border border-border/60 bg-background shadow-2xl"
      data-testid="notification-center"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <span className="text-sm font-semibold text-foreground">
          🔔 Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
        </span>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-[11px] text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close notifications"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            ×
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[70vh] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            ไม่มีการแจ้งเตือน
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border/40">
            {notifications.map((n) => (
              <li
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40 ${
                  !n.read ? "bg-primary/[0.03]" : ""
                }`}
              >
                {/* Type icon */}
                <span className="mt-0.5 shrink-0 text-base leading-none">
                  {TYPE_ICON[n.type]}
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-foreground">
                      {n.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {relativeTime(n.timestamp)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground line-clamp-2">
                    {n.body}
                  </p>
                </div>

                {/* Unread dot */}
                {!n.read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;
