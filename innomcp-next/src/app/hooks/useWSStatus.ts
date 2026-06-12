import { useState, useEffect, useRef } from 'react';

interface UseWSStatusProps {
  socket: WebSocket | null;
}

interface UseWSStatusReturn {
  status: 'connected' | 'connecting' | 'disconnected';
  retryCount: number;
}

function getWSStatus(readyState: number): 'connected' | 'connecting' | 'disconnected' {
  switch (readyState) {
    case WebSocket.CONNECTING:
      return 'connecting';
    case WebSocket.OPEN:
      return 'connected';
    case WebSocket.CLOSING:
    case WebSocket.CLOSED:
    default:
      return 'disconnected';
  }
}

export default function useWSStatus({ socket }: UseWSStatusProps): UseWSStatusReturn {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>(
    socket ? getWSStatus(socket.readyState) : 'disconnected'
  );
  const [retryCount, setRetryCount] = useState<number>(0);
  const prevStatusRef = useRef<string>(
    socket ? getWSStatus(socket.readyState) : 'disconnected'
  );

  useEffect(() => {
    const interval = setInterval(() => {
      if (!socket) {
        setStatus('disconnected');
        prevStatusRef.current = 'disconnected';
        return;
      }

      const currentStatus = getWSStatus(socket.readyState);
      setStatus(currentStatus);

      if (prevStatusRef.current === 'disconnected' && currentStatus === 'connecting') {
        setRetryCount((prev) => prev + 1);
      } else if (currentStatus === 'connected') {
        setRetryCount(0);
      }

      prevStatusRef.current = currentStatus;
    }, 1000);

    return () => clearInterval(interval);
  }, [socket]);

  return { status, retryCount };
}
