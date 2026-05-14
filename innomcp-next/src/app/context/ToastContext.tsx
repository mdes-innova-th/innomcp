"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ToastKind = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
  duration: number;
}

interface ToastContextValue {
  notify: (message: string, kind?: ToastKind, duration?: number) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((message: string, kind: ToastKind = "info", duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((cur) => [...cur, { id, message, kind, duration }]);
    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ notify, dismiss }}>
      {children}
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Soft fallback: if a component renders outside the provider, fall back to console.
    // Stops error boundaries from going off when toast is incidental.
    return {
      notify: (m, k = "info") => {
        if (typeof window !== "undefined") console.warn(`[toast:${k}]`, m);
        return -1;
      },
      dismiss: () => {},
    };
  }
  return ctx;
}

function ToastStack({ toasts, dismiss }: { toasts: ToastItem[]; dismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      data-testid="toast-stack"
      className="pointer-events-none fixed bottom-4 right-4 z-[200] flex max-w-sm flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <ToastView key={t.id} toast={t} onClose={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

const KIND_STYLE: Record<ToastKind, { ring: string; bg: string; text: string; icon: string }> = {
  success: {
    ring: "ring-emerald-500/30",
    bg: "bg-emerald-50/95 dark:bg-emerald-950/40",
    text: "text-emerald-900 dark:text-emerald-100",
    icon: "✓",
  },
  error: {
    ring: "ring-rose-500/30",
    bg: "bg-rose-50/95 dark:bg-rose-950/40",
    text: "text-rose-900 dark:text-rose-100",
    icon: "✕",
  },
  warning: {
    ring: "ring-amber-500/30",
    bg: "bg-amber-50/95 dark:bg-amber-950/40",
    text: "text-amber-900 dark:text-amber-100",
    icon: "!",
  },
  info: {
    ring: "ring-sky-500/30",
    bg: "bg-sky-50/95 dark:bg-sky-950/40",
    text: "text-sky-900 dark:text-sky-100",
    icon: "i",
  },
};

function ToastView({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const style = KIND_STYLE[toast.kind];
  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(onClose, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.duration, onClose]);

  return (
    <div
      role="status"
      data-testid={`toast-${toast.kind}`}
      className={`pointer-events-auto flex items-start gap-2 rounded-lg px-3 py-2 text-sm shadow-lg ring-1 backdrop-blur ${style.bg} ${style.text} ${style.ring}`}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current/10 text-[12px] font-semibold"
      >
        {style.icon}
      </span>
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={onClose}
        aria-label="ปิดการแจ้งเตือน"
        className="rounded p-0.5 text-current/60 transition-colors hover:bg-current/10 hover:text-current"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
