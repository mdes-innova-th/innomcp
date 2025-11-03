import { useEffect, useRef, useState, useCallback } from 'react';

export interface DashboardData {
  // กำหนดโครงสร้างข้อมูล dashboard ตามที่ใช้ในระบบ
  [key: string]: unknown;
}

export interface WebSocketMessage {
  event: 'dashboardUpdate' | 'databaseUpdate' | 'error';
  type?: 'INSERT' | 'UPDATE' | 'DELETE';
  table?: string;
  timestamp?: string;
  data?: DashboardData;
}

export interface UseWebSocketOptions {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (data: DashboardData) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket({
  url,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
  onMessage,
  onError,
  onConnect,
  onDisconnect,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      console.log('Connecting to WebSocket:', url);
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        setReconnectAttempt(0);
        onConnect?.();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message received:', message);

          if (message.event === 'dashboardUpdate' || message.event === 'databaseUpdate') {
            if (message.data) {
              setLastMessage(message.data);
              onMessage?.(message.data);
            }
          } else if (message.event === 'error') {
            console.error('WebSocket server error:', message.data);
            const errorMessage = (message.data as { message?: string })?.message || 'Server error';
            setError(errorMessage);
          }
        } catch (parseError) {
          console.error('Error parsing WebSocket message:', parseError);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        onDisconnect?.();

        // Auto-reconnect logic
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          setReconnectAttempt(reconnectAttemptsRef.current);
          
          console.log(`Attempting to reconnect... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else {
          setError(`Failed to reconnect after ${maxReconnectAttempts} attempts`);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error occurred');
        onError?.(error);
      };

    } catch (connectionError) {
      console.error('Error creating WebSocket connection:', connectionError);
      setError('Failed to create connection');
    }
  }, [url, reconnectInterval, maxReconnectAttempts, onMessage, onError, onConnect, onDisconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect
  }, [maxReconnectAttempts]);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    } else {
      console.warn('WebSocket is not connected');
      return false;
    }
  }, []);

  const requestUpdate = useCallback(() => {
    return sendMessage({ type: 'requestUpdate' });
  }, [sendMessage]);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    error,
    reconnectAttempt,
    sendMessage,
    requestUpdate,
    connect,
    disconnect,
  };
}