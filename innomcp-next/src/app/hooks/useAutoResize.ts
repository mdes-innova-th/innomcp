"use client";

import { useCallback, useEffect, useRef } from "react";

export interface AutoResizeOptions {
  minHeight?: number;
  maxHeight?: number;
  lineHeight?: number;
}

export type AutoResizeReturn<T extends HTMLTextAreaElement = HTMLTextAreaElement> = {
  ref: React.RefObject<T>;
  reset: () => void;
};

export function useAutoResize<T extends HTMLTextAreaElement = HTMLTextAreaElement>(
  options?: AutoResizeOptions
): AutoResizeReturn<T> {
  const {
    minHeight = 40,
    maxHeight = 200,
  } = options ?? {};

  const textareaRef = useRef<T>(null!);

  const handleResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Temporarily shrink to get the true scroll height
    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    const clamped = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${clamped}px`;
  }, [minHeight, maxHeight]);

  const reset = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Apply initial resize
    handleResize();

    // Attach listener for future input events
    textarea.addEventListener("input", handleResize);
    return () => {
      textarea.removeEventListener("input", handleResize);
    };
  }, [handleResize]);

  return {
    ref: textareaRef,
    reset,
  };
}
