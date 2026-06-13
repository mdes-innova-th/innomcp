'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { BACKEND } from '../app/lib/backendUrl';
import { parseSSELine } from '../lib/agentEvents';

/** Lightweight event shape – adjust if a richer type is exported from agentEvents */
type AgentEvent = {
  type: string;
  [key: string]: unknown;
};

export function useAgentStream() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [artifacts, setArtifacts] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount – abort any in‑flight request and prevent state updates
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const start = useCallback(
    async (task: string) => {
      // Abort previous stream if any
      stop();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (isMountedRef.current) {
        setRunning(true);
        setEvents([]);
        setArtifacts([]);
      }

      try {
        const response = await fetch(`${BACKEND}/api/agent/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        if (!response.body) {
          throw new Error('ReadableStream not supported');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // Keep the last (possibly incomplete) line in the buffer
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const event = parseSSELine(trimmed);
            if (event && isMountedRef.current) {
              setEvents((prev) => [...prev, event]);
              if (event.type === 'artifact') {
                setArtifacts((prev) => [...prev, event]);
              }
            }
          }
        }

        // Process any trailing data after stream ends
        if (buffer.trim() && isMountedRef.current) {
          const event = parseSSELine(buffer.trim());
          if (event) {
            setEvents((prev) => [...prev, event]);
            if (event.type === 'artifact') {
              setArtifacts((prev) => [...prev, event]);
            }
          }
        }
      } catch (err: unknown) {
        // Ignore AbortError – it happens on manual stop or unmount
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Stream error:', err);
        }
      } finally {
        if (isMountedRef.current) {
          setRunning(false);
        }
        // Clear the controller if it’s still the same one
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [stop],
  );

  return { events, running, start, stop, artifacts };
}

export default useAgentStream;
