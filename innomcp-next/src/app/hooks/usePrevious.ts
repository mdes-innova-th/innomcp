```typescript
"use client";

import { useEffect, useRef } from "react";

/**
 * Tracks the previous value of a state or prop.
 * Returns undefined on first render, then the value from the previous render.
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

/**
 * Tracks the previous value only when it actually changes according to an optional equality function.
 * Default equality uses Object.is.
 * Returns undefined on first render.
 */
export function usePreviousDistinct<T>(
  value: T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T | undefined {
  const previousRef = useRef<T | undefined>(undefined);
  const currentRef = useRef<T>(value);

  // If the current value has changed (according to isEqual), update both refs
  if (!isEqual(currentRef.current, value)) {
    previousRef.current = currentRef.current;
    currentRef.current = value;
  }

  // On first render, previousRef.current is undefined because no change yet
  return previousRef.current;
}

/**
 * Returns an array of the previous N distinct values (newest last).
 * The array grows up to maxLength (default 10), then the oldest values are dropped.
 * On first render, returns an empty array.
 */
export function useValueHistory<T>(
  value: T,
  maxLength: number = 10,
): T[] {
  const historyRef = useRef<T[]>([]);
  const previousRef = useRef<T | undefined>(undefined);

  // We track if this is the initial render to avoid adding the initial undefined
  const initialRenderRef = useRef(true);

  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }

    // Push the previous value (which is now 'old') into history
    const newHistory = [...historyRef.current, value];
    if (newHistory.length > maxLength) {
      newHistory.splice(0, newHistory.length - maxLength);
    }
    historyRef.current = newHistory;
  }, [value, maxLength]);

  return historyRef.current;
}
```