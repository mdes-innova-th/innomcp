"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type NotificationLevel = "success" | "warning" | "error" | "info" | "mdes";

interface Notification {
  id: string;
  level: NotificationLevel;
  title: string;
  message?: string;
  duration?: number; // ms, 0 = persistent
  action?: { label: string; onClick: () => void };
  timestamp: number;
}

// Simple unique ID generator (client-only)
let idCounter = 0;
const generateId = (): string => {
  idCounter += 1;
  return `${Date.now()}-${idCounter}-${Math.random().toString(36).substring(2, 9)}`;
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timerRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const timer = timerRefs.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timerRefs.current.delete(id);
    }
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
    // Clear all active timers
    timerRefs.current.forEach((timer) => clearTimeout(timer));
    timerRefs.current.clear();
  }, []);

  const add = useCallback(
    (n: Omit<Notification, "id" | "timestamp">): string => {
      const id = generateId();
      const notification: Notification = {
        ...n,
        id,
        timestamp: Date.now(),
      };

      setNotifications((prev) => {
        const newList = [...prev, notification];
        // Keep only the most recent 10 notifications
        return newList.length > 10 ? newList.slice(-10) : newList;
      });

      return id;
    },
    []
  );

  // Synchronize auto-dismiss timers with current notifications
  useEffect(() => {
    notifications.forEach((n) => {
      if (n.duration && n.duration > 0 && !timerRefs.current.has(n.id)) {
        const timer = setTimeout(() => {
          dismiss(n.id);
        }, n.duration);
        timerRefs.current.set(n.id, timer);
      }
    });

    // Clean timers for notifications no longer present (e.g., manually dismissed or overflow trimmed)
    const currentIds = new Set(notifications.map((n) => n.id));
    timerRefs.current.forEach((timer, id) => {
      if (!currentIds.has(id)) {
        clearTimeout(timer);
        timerRefs.current.delete(id);
      }
    });
  }, [notifications, dismiss]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timerRefs.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const unreadCount = notifications.length;

  // Convenience helpers with sensible defaults
  const notifySuccess = useCallback(
    (title: string, message?: string, duration?: number) =>
      add({ level: "success", title, message, duration: duration ?? 5000 }),
    [add]
  );

  const notifyError = useCallback(
    (title: string, message?: string, duration?: number) =>
      add({ level: "error", title, message, duration: duration ?? 0 }),
    [add]
  );

  const notifyMDES = useCallback(
    (title: string = "INNOMCP", message?: string, duration?: number) =>
      add({ level: "mdes", title, message, duration: duration ?? 0 }),
    [add]
  );

  return {
    notifications,
    add,
    dismiss,
    dismissAll,
    unreadCount,
    notifySuccess,
    notifyError,
    notifyMDES,
  };
}