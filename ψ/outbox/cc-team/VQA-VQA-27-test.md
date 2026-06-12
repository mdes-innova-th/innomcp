<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-27 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":84,"completion_tokens":3160,"total_tokens":3244,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2720,"image_tokens":0},"cache_creation_input_tokens":0} | 60s
 generated: 2026-06-12T04:22:52.939Z -->
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatState } from './useChatState';

describe('useChatState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct initial state (not connected, no error)', () => {
    const { result } = renderHook(() => useChatState());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should set isConnecting to true when connect() is called', () => {
    // Mock a pending promise to keep the hook in the connecting state
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    
    const { result } = renderHook(() => useChatState());

    act(() => {
      result.current.connect();
    });

    expect(result.current.isConnecting).toBe(true);
  });

  it('should set isConnected to false when disconnect() is called', async () => {
    const { result } = renderHook(() => useChatState());

    await act(async () => {
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
  });

  it('should set error field when an error occurs during connection', async () => {
    const mockError = new Error('Connection failed');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(mockError));

    const { result } = renderHook(() => useChatState());

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error).toBe(mockError.message);
    expect(result.current.isConnecting).toBe(false);
  });
});
