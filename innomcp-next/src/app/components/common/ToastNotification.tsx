"use client";

import { useEffect } from "react";

export interface Toast {
  id: string;
  type: "success" | "info" | "error";
  message: string;
  duration?: number; // ms, default 4000
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const duration = toast.duration ?? 4000;

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  const styles: Record<Toast["type"], { container: string; icon: string }> = {
    success: {
      container:
        "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
      icon: "✅",
    },
    error: {
      container:
        "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300",
      icon: "❌",
    },
    info: {
      container:
        "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300",
      icon: "ℹ️",
    },
  };

  const { container, icon } = styles[toast.type];

  return (
    <div
      role="status"
      className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-[12.5px] shadow-lg animate-in slide-in-from-bottom-4 duration-300 ${container}`}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="ปิดการแจ้งเตือน"
        className="rounded p-0.5 text-current/60 transition-colors hover:bg-current/10 hover:text-current"
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function ToastNotification({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      data-testid="toast-notification-container"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
