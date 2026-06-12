<!-- cc-team deliverable
 group: P4C (Phase 4.3 â€” Wire AgentStepsView to real dispatch events)
 member: P4C-6 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":44,"completion_tokens":2126,"total_tokens":2170,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1383,"image_tokens":0},"cache_creation_input_tokens":0} | 20s
 generated: 2026-06-12T03:44:44.610Z -->
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useAgentSteps from '../hooks/useAgentSteps';

let mockWebSocketInstance: any = null;

beforeEach(() => {
  mockWebSocketInstance = null;
  vi.spyOn(globalThis, 'WebSocket').mockImplementation((url: string) => {
    const ws = {
      url,
      readyState: 0,
      onopen: null as (() => void) | null,
      onmessage: null as ((event: MessageEvent) => void) | null,
      onclose: null as (() => void) | null,
      onerror: null as ((event: Event) => void) | null,
      send: vi.fn(),
      close: vi.fn(function (this: any) {
        this.readyState = 3;
        if (this.onclose) this.onclose();
      }),
      // Helper to simulate incoming messages
      triggerMessage(data: string) {
        if (this.onmessage) {
          this.onmessage(new MessageEvent('message', { data }));
        }
      },
      triggerOpen() {
        this.readyState = 1;
        if (this.onopen) this.onopen();
      },
    };
    mockWebSocketInstance = ws;
    return ws;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAgentSteps', () => {
  const testUrl = 'ws://localhost:8080';

  it('should initialize with empty steps and isActive false', () => {
    const { result } = renderHook(() => useAgentSteps(testUrl));
    expect(result.current.steps).toEqual([]);
    expect(result.current.isActive).toBe(false);
  });

  it('should add a step when a WebSocket message is received', async () => {
    const { result } = renderHook(() => useAgentSteps(testUrl));

    // Simulate connection open
    act(() => {
      mockWebSocketInstance.triggerOpen();
    });

    // Simulate receiving a message
    const messageData = JSON.stringify({ content: 'Step 1' });
    act(() => {
      mockWebSocketInstance.triggerMessage(messageData);
    });

    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0]).toEqual({ content: 'Step 1' });
    expect(result.current.isActive).toBe(true);
  });

  it('should clear steps when clearSteps is called', async () => {
    const { result } = renderHook(() => useAgentSteps(testUrl));

    act(() => {
      mockWebSocketInstance.triggerOpen();
    });

    act(() => {
      mockWebSocketInstance.triggerMessage(JSON.stringify({ content: 'Step 1' }));
    });

    expect(result.current.steps).toHaveLength(1);

    act(() => {
      result.current.clearSteps();
    });

    expect(result.current.steps).toEqual([]);
  });

  it('should set isActive to true when connection is open and false on close', () => {
    const { result } = renderHook(() => useAgentSteps(testUrl));

    expect(result.current.isActive).toBe(false);

    act(() => {
      mockWebSocketInstance.triggerOpen();
    });

    expect(result.current.isActive).toBe(true);

    act(() => {
      mockWebSocketInstance.close();
    });

    expect(result.current.isActive).toBe(false);
  });
});
