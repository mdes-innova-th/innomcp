```typescript
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Type for the setter function returned by useLocalStorageState.
 * Can accept a new value directly or a function that receives the previous state.
 */
export type SetLocalStorageState<T> = (value: T | ((prev: T) => T)) => void;

/**
 * Custom hook that persists state to localStorage.
 *
 * @template T - The type of the state to be stored.
 * @param key - The localStorage key.
 * @param initialValue - The default value if no value is stored.
 * @returns A tuple of [value, setValue, removeValue].
 */
export function useLocalStorageState<T>(
  key: string,
  initialValue: T
): [T, SetLocalStorageState<T>, () => void] {
  // Helper to safely read from localStorage
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      if (item === null) {
        return initialValue;
      }
      return JSON.parse(item) as T;
    } catch (error) {
      // If JSON is invalid or any other error, fall back to initialValue
      console.warn(
        `Error reading localStorage key "${key}":`,
        error
      );
      return initialValue;
    }
  }, [key, initialValue]);

  // State to store the value
  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Ref to track if we are updating from a key change to avoid infinite loops
  const isKeyChangeRef = useRef(false);

  // Effect: When key changes, re-read from localStorage
  useEffect(() => {
    isKeyChangeRef.current = true;
    setStoredValue(readValue());
  }, [key, readValue]);

  // Effect: Sync state to localStorage whenever storedValue or key changes
  useEffect(() => {
    // Skip writing during key change to avoid overwriting with stale value
    if (isKeyChangeRef.current) {
      isKeyChangeRef.current = false;
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.warn(
        `Error writing to localStorage key "${key}":`,
        error
      );
    }
  }, [key, storedValue]);

  // Custom setter that writes to localStorage immediately
  const setValue: SetLocalStorageState<T> = useCallback(
    (value) => {
      setStoredValue((prev) => {
        const newValue =
          typeof value === 'function'
            ? (value as (prev: T) => T)(prev)
            : value;
        // Directly write to localStorage
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(key, JSON.stringify(newValue));
          } catch (error) {
            console.warn(
              `Error writing to localStorage key "${key}":`,
              error
            );
          }
        }
        return newValue;
      });
    },
    [key]
  );

  // Remove the key from localStorage and reset to initialValue
  const removeValue = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        console.warn(
          `Error removing localStorage key "${key}":`,
          error
        );
      }
    }
    setStoredValue(initialValue);
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}
```