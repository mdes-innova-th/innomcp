<!-- cc-team deliverable
 group: P4B (Phase 4.2 â€” Error boundaries for ManusWorkspacePanel and MultiAgentPanel)
 member: P4B-9 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":38,"completion_tokens":607,"total_tokens":645,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":289,"image_tokens":0},"cache_creation_input_tokens":0} | 7s
 generated: 2026-06-12T03:43:58.016Z -->
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePanelError } from './usePanelError';

describe('usePanelError', () => {
  it('initial error is null', () => {
    const { result } = renderHook(() => usePanelError());
    expect(result.current.error).toBeNull();
  });

  it('wrapAsync catches error and sets error state', async () => {
    const { result } = renderHook(() => usePanelError());
    const asyncFnThatThrows = async () => {
      throw new Error('Test error');
    };

    let wrappedFn;
    await act(async () => {
      wrappedFn = result.current.wrapAsync(asyncFnThatThrows);
      await wrappedFn();
    });

    expect(result.current.error).toEqual(new Error('Test error'));
  });

  it('clearError resets error to null', async () => {
    const { result } = renderHook(() => usePanelError());

    // First trigger an error
    const asyncFnThatThrows = async () => {
      throw new Error('Some error');
    };

    await act(async () => {
      const wrappedFn = result.current.wrapAsync(asyncFnThatThrows);
      await wrappedFn();
    });

    expect(result.current.error).toEqual(new Error('Some error'));

    // Now clear it
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});
