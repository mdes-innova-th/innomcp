<!-- cc-team deliverable
 group: P3B (Phase 3.2 â€” WS reconnection banner in ChatPage)
 member: P3B-5 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":83,"completion_tokens":1678,"total_tokens":1761,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1270,"image_tokens":0},"cache_creation_input_tokens":0} | 20s
 generated: 2026-06-12T03:47:36.116Z -->
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
