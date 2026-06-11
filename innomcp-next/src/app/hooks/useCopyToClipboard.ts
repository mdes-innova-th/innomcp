'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export type CopyToClipboardReturn = {
  copy: (text: string) => Promise<void>;
  copied: boolean;
  error: Error | null;
};

/**
 * A hook to copy text to clipboard with success feedback.
 * @param resetDelay - Time in milliseconds before resetting the `copied` state after a successful copy (default: 2000)
 * @returns An object with a `copy` function, a `copied` boolean, and an `error` field.
 */
export function useCopyToClipboard(resetDelay: number = 2000): CopyToClipboardReturn {
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      clearPendingTimeout();
    };
  }, [clearPendingTimeout]);

  const copy = useCallback(
    async (text: string): Promise<void> => {
      // Reset previous error and clearing pending reset timeout
      setError(null);
      clearPendingTimeout();

      // Try using the modern Clipboard API first
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          timeoutRef.current = setTimeout(() => {
            setCopied(false);
            timeoutRef.current = null;
          }, resetDelay);
          return;
        } catch (err) {
          // Fallback to execCommand if Clipboard API fails (e.g., insecure context)
          // Continue to fallback below
        }
      }

      // Fallback to document.execCommand('copy') for older browsers
      // This must be done in a synchronous manner and only works in a user gesture
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, text.length); // For mobile
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (successful) {
          setCopied(true);
          timeoutRef.current = setTimeout(() => {
            setCopied(false);
            timeoutRef.current = null;
          }, resetDelay);
        } else {
          throw new Error('execCommand copy failed');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err : new Error('Failed to copy text to clipboard');
        setError(errorMessage);
        setCopied(false);
      }
    },
    [resetDelay, clearPendingTimeout]
  );

  return { copy, copied, error };
}
