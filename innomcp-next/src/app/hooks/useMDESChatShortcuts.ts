"use client";

import { useEffect, useRef } from "react";

export interface ChatShortcutCallbacks {
  onNewChat: () => void;
  onToggleWorkspace: () => void;
  onToggleSidebar: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onStopStream: () => void;
  onFocusInput: () => void;
  /** แสดงแป้นพิมพ์ลัด (Keyboard Help) */
  onOpenHelp?: () => void;
}

export function useMDESChatShortcuts(callbacks: ChatShortcutCallbacks): void {
  const callbacksRef = useRef<ChatShortcutCallbacks>(callbacks);

  // Keep the ref in sync so the handler always receives current callbacks
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      // Ignore shortcuts when user is typing in an input, textarea or contenteditable
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return;
      }

      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Ctrl+N
      if (ctrlOrMeta && key === "n") {
        e.preventDefault();
        callbacksRef.current.onNewChat();
        return;
      }

      // Ctrl+B
      if (ctrlOrMeta && key === "b") {
        e.preventDefault();
        callbacksRef.current.onToggleSidebar();
        return;
      }

      // Ctrl+W
      if (ctrlOrMeta && key === "w") {
        e.preventDefault();
        callbacksRef.current.onToggleWorkspace();
        return;
      }

      // Ctrl+E
      if (ctrlOrMeta && key === "e") {
        e.preventDefault();
        callbacksRef.current.onExport();
        return;
      }

      // Ctrl+,
      if (ctrlOrMeta && key === ",") {
        e.preventDefault();
        callbacksRef.current.onOpenSettings();
        return;
      }

      // Ctrl+F
      if (ctrlOrMeta && key === "f") {
        e.preventDefault();
        callbacksRef.current.onOpenSearch();
        return;
      }

      // Escape (only when not in input, which is ensured by the early return above)
      if (key === "escape") {
        e.preventDefault();
        callbacksRef.current.onStopStream();
        return;
      }

      // Ctrl+/ → คีย์ลัดช่วยเหลือ
      if (ctrlOrMeta && key === "/") {
        e.preventDefault();
        callbacksRef.current.onOpenHelp?.();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []); // Only mount/unmount
}