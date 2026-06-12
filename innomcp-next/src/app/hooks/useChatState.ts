import { useState, useCallback } from 'react';

export default function useChatState() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const connect = useCallback(() => {
    setError(null);
    setIsConnecting(true);
    // Simulate connection delay (no actual WebSocket logic)
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);
    }, 1000);
  }, []);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setIsConnecting(false);
    setError(null);
    setRetryCount(0);
  }, []);

  return { isConnected, isConnecting, error, retryCount, connect, disconnect };
}