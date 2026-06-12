<!-- cc-team deliverable
 group: P3B (Phase 3.2 â€” WS reconnection banner in ChatPage)
 member: P3B-6 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":54,"completion_tokens":1000,"total_tokens":1054,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":480,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-12T03:42:26.038Z -->
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useWSStatus from './useWSStatus'; // adjust import path as needed

// Mock WebSocket
class MockWebSocket {
  readyState: number = WebSocket.CONNECTING;
  private listeners: Record<string, Set<EventListener>> = {};

  addEventListener(event: string, listener: EventListener) {
    if (!this.listeners[event]) this.listeners[event] = new Set();
    this.listeners[event].add(listener);
  }

  removeEventListener(event: string, listener: EventListener) {
    this.listeners[event]?.delete(listener);
  }

  dispatchEvent(event: Event) {
    const listeners = this.listeners[event.type];
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
    return !event.defaultPrevented;
  }

  // Simulate opening the connection
  open() {
    this.readyState = WebSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  // Simulate closing the connection
  close() {
    this.readyState = WebSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }
}

describe('useWSStatus', () => {
  it('should start with connecting (readyState=0)', () => {
    const mockSocket = new MockWebSocket();
    const { result } = renderHook(() => useWSStatus(mockSocket));
    expect(result.current).toBe(0); // CONNECTING
  });

  it('should transition to connected (readyState=1) when socket opens', () => {
    const mockSocket = new MockWebSocket();
    const { result, rerender } = renderHook(() => useWSStatus(mockSocket));

    // Simulate the open event
    mockSocket.open();
    rerender();

    expect(result.current).toBe(1); // OPEN
  });

  it('should transition to disconnected (readyState=3) when socket closes', () => {
    const mockSocket = new MockWebSocket();
    const { result, rerender } = renderHook(() => useWSStatus(mockSocket));

    // First open the socket
    mockSocket.open();
    rerender();

    // Then close it
    mockSocket.close();
    rerender();

    expect(result.current).toBe(3); // CLOSED
  });
});
