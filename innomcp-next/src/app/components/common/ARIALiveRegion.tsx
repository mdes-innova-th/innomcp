'use client';

import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useState,
  type ReactNode,
} from 'react';

// ─── Types ───────────────────────────────────────────────────────────────
type AnnouncePriority = 'polite' | 'assertive';

interface AnnounceContextValue {
  announce: (message: string, priority?: AnnouncePriority) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────
const AnnounceContext = createContext<AnnounceContextValue | null>(null);

// ─── Constants ───────────────────────────────────────────────────────────
const DEBOUNCE_MS = 50; // milliseconds to wait before updating the live region

// ─── Provider ────────────────────────────────────────────────────────────
interface ARIALiveRegionProviderProps {
  children: ReactNode;
}

/**
 * Provider for accessible live announcements.
 * Renders a visually hidden live region and exposes `announce()` via context.
 */
function ARIALiveRegionProvider({ children }: ARIALiveRegionProviderProps) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  const politeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assertiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback(
    (message: string, priority: AnnouncePriority = 'polite') => {
      // Clear any pending timer for the given priority
      if (priority === 'polite' && politeTimerRef.current) {
        clearTimeout(politeTimerRef.current);
      }
      if (priority === 'assertive' && assertiveTimerRef.current) {
        clearTimeout(assertiveTimerRef.current);
      }

      const timerRef =
        priority === 'polite' ? politeTimerRef : assertiveTimerRef;
      const setMessage =
        priority === 'polite' ? setPoliteMessage : setAssertiveMessage;

      // Debounce: set message after a small delay
      timerRef.current = setTimeout(() => {
        setMessage(message);
        // Clear the message after a short time to avoid repeated announcements
        setTimeout(() => {
          setMessage('');
        }, 5000); // Clear after 5 seconds (adjust as needed)
      }, DEBOUNCE_MS);
    },
    []
  );

  return (
    <AnnounceContext.Provider value={{ announce }}>
      {children}
      {/* Polite live region */}
      <div
        aria-live="polite"
        aria-atomic="true"
        aria-relevant="additions text"
        className="sr-only"
        role="status"
      >
        {politeMessage}
      </div>
      {/* Assertive live region */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        aria-relevant="additions text"
        className="sr-only"
        role="alert"
      >
        {assertiveMessage}
      </div>
    </AnnounceContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────
/**
 * useAnnounce – returns an `announce()` function to send screen reader messages.
 *
 * @example
 * const { announce } = useAnnounce();
 * announce("MDES AI ตอบแล้ว — คลิกเพื่ออ่าน");
 * announce("ข้อผิดพลาด: ไม่สามารถเชื่อมต่อได้", "assertive");
 */
function useAnnounce(): AnnounceContextValue {
  const context = useContext(AnnounceContext);
  if (!context) {
    throw new Error(
      'useAnnounce must be used within an ARIALiveRegionProvider. ' +
        'Please wrap your application (or a section) with <ARIALiveRegionProvider>.'
    );
  }
  return context;
}

// ─── Component ───────────────────────────────────────────────────────────
/**
 * ARIALiveRegion – a convenience wrapper that includes the provider.
 * Prefer using `<ARIALiveRegionProvider>` at the app root and `useAnnounce` in children.
 *
 * This component is provided for simplicity; it renders its children with the provider.
 */
interface ARIALiveRegionProps {
  children: ReactNode;
}

function ARIALiveRegion({ children }: ARIALiveRegionProps) {
  return <ARIALiveRegionProvider>{children}</ARIALiveRegionProvider>;
}

// ─── Exports ─────────────────────────────────────────────────────────────
export default ARIALiveRegion;
export { ARIALiveRegionProvider, useAnnounce };