"use client";

import { useState } from "react";
import type { Toast } from "@/app/components/common/ToastNotification";

export type { Toast };

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (
    message: string,
    type: Toast["type"] = "info",
    duration = 4000
  ) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  };

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return { toasts, addToast, dismiss };
}
