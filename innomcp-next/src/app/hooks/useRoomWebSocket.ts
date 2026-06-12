"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TypingUser {
  userId: number;
  displayName: string;
}

interface RoomUser {
  userId: number;
  displayName: string;
}

interface UseRoomWebSocketOptions {
  projectId: number | null;
  token: string | null;
}

interface UseRoomWebSocketReturn {
  typingUsers: TypingUser[];
  sendTypingStart: () => void;
  sendTypingStop: () => void;
  connected: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 3_000;
/** Safety timeout: auto-clear a typing user if no typing_stop arrives within 4s */
const TYPING_CLEAR_MS = 4_000;

// ─── Room WebSocket URL builder ───────────────────────────────────────────────

function buildRoomWsUrl(projectId: number, token: string): string {
  if (typeof window === "undefined") return "";

  // In dev (port 3000) point directly at the backend; in prod use same host
  const wsHost =
    process.env.NEXT_PUBLIC_NODE_WS_HOST ||
    (window.location.port === "3000" ? "ws://localhost:3015" : `ws://${window.location.host}`);

  return `${wsHost}/room?projectId=${projectId}&token=${encodeURIComponent(token)}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRoomWebSocket({
  projectId,
  token,
}: UseRoomWebSocketOptions): UseRoomWebSocketReturn {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [connected, setConnected] = useState(false);

  // presence map — kept in a ref so message handlers always see current state
  // without causing extra renders
  const presenceRef = useRef<Map<number, RoomUser>>(new Map());

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Per-user typing safety-timeout handles
  const typingTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  // ── helpers ──────────────────────────────────────────────────────────────

  const removeTypingUser = useCallback((userId: number) => {
    // Clear any pending safety timer
    const existing = typingTimersRef.current.get(userId);
    if (existing) {
      clearTimeout(existing);
      typingTimersRef.current.delete(userId);
    }
    setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
  }, []);

  const addTypingUser = useCallback(
    (userId: number, displayName: string) => {
      // Reset safety timer
      const existing = typingTimersRef.current.get(userId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        typingTimersRef.current.delete(userId);
        setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
      }, TYPING_CLEAR_MS);
      typingTimersRef.current.set(userId, timer);

      setTypingUsers((prev) => {
        if (prev.some((u) => u.userId === userId)) return prev;
        return [...prev, { userId, displayName }];
      });
    },
    []
  );

  // ── WebSocket lifecycle ───────────────────────────────────────────────────

  useEffect(() => {
    if (projectId === null || !token) {
      // Clean up if props become null
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
      setTypingUsers([]);
      return;
    }

    let destroyed = false;

    const connect = () => {
      if (destroyed) return;

      const url = buildRoomWsUrl(projectId, token);
      if (!url) return;

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        if (destroyed) { ws.close(); return; }
        setConnected(true);
        reconnectCountRef.current = 0;
      };

      ws.onmessage = (event: MessageEvent) => {
        if (destroyed) return;
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(
            event.data instanceof Blob ? "" : (event.data as string)
          );
        } catch {
          return;
        }

        const { type } = msg;

        if (type === "typing_start") {
          const userId = msg.userId as number;
          const displayName = (msg.displayName as string) ?? `User ${userId}`;
          addTypingUser(userId, displayName);
        } else if (type === "typing_stop") {
          const userId = msg.userId as number;
          removeTypingUser(userId);
        } else if (type === "user_joined") {
          const userId = msg.userId as number;
          const displayName = (msg.displayName as string) ?? `User ${userId}`;
          presenceRef.current.set(userId, { userId, displayName });
        } else if (type === "user_left") {
          const userId = msg.userId as number;
          presenceRef.current.delete(userId);
          // Also stop typing if the user leaves mid-type
          removeTypingUser(userId);
        }
      };

      ws.onerror = () => {
        // onclose will fire after onerror and trigger reconnect
      };

      ws.onclose = () => {
        if (destroyed) return;
        setConnected(false);
        wsRef.current = null;
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (destroyed) return;
      if (reconnectCountRef.current >= MAX_RECONNECT_ATTEMPTS) return;
      reconnectCountRef.current += 1;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, RECONNECT_DELAY_MS);
    };

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      // Clear all typing safety timers
      typingTimersRef.current.forEach((t) => clearTimeout(t));
      typingTimersRef.current.clear();

      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
      setTypingUsers([]);
    };
  }, [projectId, token, addTypingUser, removeTypingUser]);

  // ── Public send helpers ───────────────────────────────────────────────────

  const sendTypingStart = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "typing_start" }));
  }, []);

  const sendTypingStop = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "typing_stop" }));
  }, []);

  return { typingUsers, sendTypingStart, sendTypingStop, connected };
}
