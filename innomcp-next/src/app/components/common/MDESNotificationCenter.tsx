"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────
type NotificationType = "success" | "warning" | "error" | "info" | "mdes";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

interface MDESNotificationCenterProps {
  notifications: Notification[];
  onRead: (id: string) => void;
  onReadAll: () => void;
  onDismiss: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

// ─── Icons ────────────────────────────────────────────────────────────────
const typeIcon = (type: NotificationType): string => {
  switch (type) {
    case "success":
      return "✅";
    case "warning":
      return "⚠️";
    case "error":
      return "❌";
    case "info":
      return "ℹ️";
    case "mdes":
      return "🇹🇭";
    default:
      return "";
  }
};

// ─── Timestamp formatting ────────────────────────────────────────────────
const formatTimestamp = (ts: number): string =>
  new Date(ts).toLocaleString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// ─── Component ────────────────────────────────────────────────────────────
export function MDESNotificationCenter({
  notifications,
  onRead,
  onReadAll,
  onDismiss,
  isOpen,
  onClose,
}: MDESNotificationCenterProps) {
  const onReadAllRef = useRef(onReadAll);
  onReadAllRef.current = onReadAll;

  // Auto‑mark all as read when the panel opens
  useEffect(() => {
    if (isOpen) {
      onReadAllRef.current();
    }
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide‑in panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-80 sm:w-[420px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              การแจ้งเตือน
            </h2>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-red-600 rounded-full min-w-[1.25rem]">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={onReadAll}
            disabled={unreadCount === 0}
            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-default"
          >
            อ่านทั้งหมด
          </button>
        </div>

        {/* Notification list */}
        <ul className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <li className="flex items-center justify-center h-full p-8">
              <p className="text-gray-400 text-sm">ไม่มีการแจ้งเตือนใหม่</p>
            </li>
          ) : (
            notifications.map((n) => (
              <li
                key={n.id}
                className="relative border-b border-gray-100 hover:bg-gray-50"
              >
                <div className="flex items-start gap-3 p-4">
                  <span className="text-xl flex-shrink-0 mt-0.5">
                    {typeIcon(n.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900">
                      {n.title}
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {n.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatTimestamp(n.timestamp)}
                    </p>
                    {n.actionLabel && n.onAction && (
                      <button
                        onClick={n.onAction}
                        className="mt-1 text-xs text-blue-600 hover:underline focus:outline-none"
                      >
                        {n.actionLabel}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => onDismiss(n.id)}
                    className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
                    aria-label="ปิดการแจ้งเตือน"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const addNotification = useCallback(
    (input: Omit<Notification, "id" | "timestamp" | "read">) => {
      const newNotif: Notification = {
        ...input,
        id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        read: false,
      };
      setNotifications((prev) => [newNotif, ...prev]);
    },
    [],
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return {
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    dismiss,
    isOpen,
    open,
    close,
  };
}