import { useEffect, useRef, useState, useCallback } from "react";

type ConnectionState = "off" | "connecting" | "connected" | "disconnected";

export default function useConnectWebsocket(initialEnabled = false) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("off");
  const [isEnabled, setIsEnabled] = useState<boolean>(initialEnabled);

  // reconnection management
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const maxRetryAttempts = 5;
  const baseDelayMs = 1000; // Start with 1 second

  // clear any pending reconnection attempts
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // schedule reconnection with exponential backoff
  const scheduleReconnect = useCallback(() => {
    if (!isEnabled || retryCountRef.current >= maxRetryAttempts) {
      return;
    }

    clearReconnectTimeout();

    const delay = Math.min(
      baseDelayMs * Math.pow(2, retryCountRef.current),
      30000
    ); // Cap at 30 seconds
    console.log(
      `[dashboard-ws] Scheduling reconnect attempt ${
        retryCountRef.current + 1
      }/${maxRetryAttempts} in ${delay}ms`
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      if (isEnabled && connectionState === "disconnected") {
        retryCountRef.current++;
        setIsEnabled(false);
        // This will trigger the useEffect to reconnect
        setTimeout(() => setIsEnabled(true), 100);
      }
    }, delay);
  }, [
    isEnabled,
    connectionState,
    clearReconnectTimeout,
    baseDelayMs,
    maxRetryAttempts,
  ]);

  // open/close websocket when isEnabled changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isEnabled) {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
      setConnectionState("off");
      clearReconnectTimeout();
      retryCountRef.current = 0;
      return;
    }

    // Use NEXT_PUBLIC_NODE_WS_HOST environment variable (if provided).
    // Accept either a full URL (ws:// or wss://) or a host[:port] string.
    // If not set, fallback to ws://localhost:3010
    const envWs = process.env.NEXT_PUBLIC_NODE_WS_HOST;
    const fallbackHost = "ws://localhost:3010";

    let wsUrl: string;
    const rawHost = envWs || fallbackHost;
    try {
      // If rawHost is a full URL (ws:// or wss://), use it and preserve existing path
      const parsed = new URL(rawHost);
      // If the URL already has a specific path, use it as is
      // Otherwise, append the default path
      if (parsed.pathname && parsed.pathname !== "/") {
        wsUrl = rawHost;
      } else {
        wsUrl = `${parsed.protocol}//${parsed.host}/api/wsurlstats`;
      }
    } catch {
      console.log(
        `[dashboard-ws] NEXT_PUBLIC_NODE_WS_HOST is not a full URL, assuming host:port format: ${rawHost}`
      );
      return;
    }

    let mounted = true;
    try {
      setConnectionState("connecting");
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        if (!mounted) return;
        setConnectionState("connected");

        // Reset retry count on successful connection
        retryCountRef.current = 0;
        clearReconnectTimeout();

        // เชื่อมต่อสำเร็จแล้ว ไม่ส่งคำขอข้อมูลอัตโนมัติ
      });

      ws.addEventListener("message", (ev) => {
        try {
          const payload = JSON.parse(ev.data as string);
          let eventName = "dashboardUpdate";
          let data = payload;
          if (payload && payload.event) {
            eventName = payload.event;
            data = payload.data;
          }
          try {
            window.dispatchEvent(
              new CustomEvent("webddsb:dashboard", {
                detail: { event: eventName, data },
              })
            );
          } catch {}
        } catch (error) {
          // swallow parse errors but log
          console.error("Error parsing dashboard websocket message:", error);
        }
      });

      ws.addEventListener("close", () => {
        if (!mounted) return;
        wsRef.current = null;
        setConnectionState((s) => (s === "off" ? "off" : "disconnected"));
      });

      ws.addEventListener("error", (err) => {
        console.error("Dashboard monitor websocket error:", err);
        setConnectionState("disconnected");
      });
    } catch (error) {
      console.error("Failed to open dashboard websocket:", error);
      setConnectionState("disconnected");
    }

    return () => {
      mounted = false;
      clearReconnectTimeout();
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
    };
  }, [isEnabled, clearReconnectTimeout]);

  // handle auto-reconnect when connection is lost
  useEffect(() => {
    if (isEnabled && connectionState === "disconnected") {
      scheduleReconnect();
    }
  }, [isEnabled, connectionState, scheduleReconnect]);

  // send function
  const send = useCallback((msg: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(msg));
        return true;
      } catch {}
    }
    return false;
  }, []);

  // close function (manual)
  const close = useCallback(() => {
    clearReconnectTimeout();
    retryCountRef.current = 0;
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    setConnectionState("off");
    setIsEnabled(false);
  }, [clearReconnectTimeout]);

  const enable = useCallback(() => setIsEnabled(true), []);
  const disable = useCallback(() => setIsEnabled(false), []);
  const toggle = useCallback(() => setIsEnabled((s) => !s), []);

  // manual reconnect function
  const reconnect = useCallback(() => {
    if (connectionState === "disconnected" || connectionState === "off") {
      retryCountRef.current = 0;
      clearReconnectTimeout();
      setIsEnabled(false);
      setTimeout(() => setIsEnabled(true), 100);
    }
  }, [connectionState, clearReconnectTimeout]);

  return {
    isEnabled,
    connectionState,
    send,
    close,
    reconnect,
    retryCount: retryCountRef.current,
    enable,
    disable,
    toggle,
  } as const;
}
