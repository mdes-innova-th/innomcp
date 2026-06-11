'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage } from '@/types/chat';

export interface UseOfflineSyncReturn {
  isOnline: boolean;
  isReconnecting: boolean;
  pendingMessages: ChatMessage[];
  syncPendingMessages: () => Promise<void>;
  queueMessage: (msg: ChatMessage) => void;
  clearQueue: () => void;
}

const PENDING_QUEUE_KEY = 'innomcp-pending-messages';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s

/**
 * Custom hook for offline detection and message queue sync.
 *
 * @param sendMessage - async function to actually send a message to the server
 */
export function useOfflineSync(
  sendMessage: (msg: ChatMessage) => Promise<void>
): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true; // SSR fallback
  });

  const [isReconnecting, setIsReconnecting] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<ChatMessage[]>([]);
  const savingRef = useRef(false); // prevent concurrent sync loops

  // Load initial queue from localStorage (client-side)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PENDING_QUEUE_KEY);
      if (stored) {
        const parsed: ChatMessage[] = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setPendingMessages(parsed);
        } else {
          localStorage.removeItem(PENDING_QUEUE_KEY);
        }
      }
    } catch (error) {
      console.warn('Failed to load pending messages:', error);
      localStorage.removeItem(PENDING_QUEUE_KEY);
    }
  }, []);

  // Persist pendingMessages to localStorage whenever it changes
  useEffect(() => {
    try {
      if (pendingMessages.length > 0) {
        localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(pendingMessages));
      } else {
        localStorage.removeItem(PENDING_QUEUE_KEY);
      }
    } catch (error) {
      console.warn('Failed to save pending messages:', error);
    }
  }, [pendingMessages]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when connection is restored
      if (pendingMessages.length > 0) {
        performSync();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsReconnecting(false); // not reconnecting if offline
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessages.length]); // re-attach when pendingMessages changes to trigger auto-sync on re-connection

  /**
   * Attempts to send a single message with exponential backoff retry.
   * Returns true if successful, false if all retries exhausted.
   */
  const sendWithRetry = useCallback(
    async (msg: ChatMessage): Promise<boolean> => {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          await sendMessage(msg);
          return true;
        } catch (error) {
          console.warn(`Retry ${attempt + 1}/${MAX_RETRIES} failed for message ${msg.id}:`, error);
          if (attempt < MAX_RETRIES - 1) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]));
          }
        }
      }
      return false;
    },
    [sendMessage]
  );

  /**
   * Main sync function: processes all pending messages, removing those successfully sent.
   * Prevents overlapping syncs using a ref.
   */
  const performSync = useCallback(async () => {
    if (savingRef.current) return; // already syncing
    savingRef.current = true;
    setIsReconnecting(true);

    try {
      // Work on a copy to avoid state mutation issues during async operations
      let currentQueue = [...pendingMessages];
      const toRemove: Set<string> = new Set();

      for (const msg of currentQueue) {
        const success = await sendWithRetry(msg);
        if (success) {
          if (msg.id) toRemove.add(msg.id);
        } else {
          console.warn(`Message ${msg.id} could not be sent, keeping in queue.`);
        }
      }

      if (toRemove.size > 0) {
        setPendingMessages((prev) => prev.filter((msg) => !toRemove.has(msg.id ?? '')));
      }
    } catch (error) {
      console.error('Sync process encountered an error:', error);
    } finally {
      setIsReconnecting(false);
      savingRef.current = false;
    }
  }, [pendingMessages, sendWithRetry]);

  /**
   * Public method to trigger sync manually (e.g., via a button).
   */
  const syncPendingMessages = useCallback(async () => {
    if (!isOnline) return; // no point if offline
    await performSync();
  }, [isOnline, performSync]);

  /**
   * Queue a new message for later sending.
   */
  const queueMessage = useCallback((msg: ChatMessage) => {
    setPendingMessages((prev) => {
      // Avoid duplicates (simple check by id)
      const exists = prev.some((m) => m.id === msg.id);
      if (exists) return prev;
      return [...prev, msg];
    });
  }, []);

  /**
   * Clear all pending messages (useful for logout or manual reset).
   */
  const clearQueue = useCallback(() => {
    setPendingMessages([]);
    localStorage.removeItem(PENDING_QUEUE_KEY);
  }, []);

  return {
    isOnline,
    isReconnecting,
    pendingMessages,
    syncPendingMessages,
    queueMessage,
    clearQueue,
  };
}