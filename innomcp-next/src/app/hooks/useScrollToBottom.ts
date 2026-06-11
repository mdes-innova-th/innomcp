"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ScrollToBottomReturn<T extends HTMLElement = HTMLDivElement> = {
  ref: React.RefObject<T | null>;
  scrollToBottom: () => void;
  isAtBottom: boolean;
};

const SCROLL_THRESHOLD = 50;

/**
 * A React hook that manages auto-scrolling behavior for a scrollable container.
 *
 * @param deps - Dependencies that trigger auto-scroll when changed. Defaults to [].
 * @returns An object containing a ref to the container, a scrollToBottom function, and isAtBottom state.
 */
export function useScrollToBottom<T extends HTMLElement = HTMLDivElement>(
  deps: React.DependencyList = []
): ScrollToBottomReturn<T> {
  const ref = useRef<T>(null);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(true);
  const isAtBottomRef = useRef<boolean>(true);

  // Store the latest isAtBottom value in a ref to avoid stale closures.
  const updateIsAtBottom = useCallback(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const { scrollHeight, scrollTop, clientHeight } = element;
    const atBottom = scrollHeight - scrollTop - clientHeight <= SCROLL_THRESHOLD;
    if (isAtBottomRef.current !== atBottom) {
      isAtBottomRef.current = atBottom;
      setIsAtBottom(atBottom);
    }
  }, []);

  // Scroll to bottom smoothly and then update state.
  const scrollToBottom = useCallback(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    element.scrollTo({
      top: element.scrollHeight,
      behavior: "smooth",
    });
    // After scrolling, the user is at the bottom.
    if (!isAtBottomRef.current) {
      isAtBottomRef.current = true;
      setIsAtBottom(true);
    }
  }, []);

  // Attach scroll event listener to detect user scrolling.
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    element.addEventListener("scroll", updateIsAtBottom, { passive: true });
    return () => {
      element.removeEventListener("scroll", updateIsAtBottom);
    };
  }, [updateIsAtBottom]);

  // Auto-scroll to bottom when dependencies change, provided user is at bottom.
  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom();
    }
    // We intentionally only re-run when dependencies change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ref, scrollToBottom, isAtBottom };
}
