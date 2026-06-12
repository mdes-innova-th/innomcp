<!-- cc-team deliverable
 group: P4B (Phase 4.2 â€” Error boundaries for ManusWorkspacePanel and MultiAgentPanel)
 member: P4B-8 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":60,"completion_tokens":1730,"total_tokens":1790,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1542,"image_tokens":0},"cache_creation_input_tokens":0} | 34s
 generated: 2026-06-12T03:44:24.229Z -->
import { useState, useCallback } from 'react';

export function usePanelError() {
  const [error, setError] = useState<Error | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const wrapAsync = useCallback(<Args extends any[], R>(
    fn: (...args: Args) => Promise<R>
  ) => {
    return async (...args: Args): Promise<R | undefined> => {
      try {
        return await fn(...args);
      } catch (err) {
        if (err instanceof Error) {
          setError(err);
        } else {
          setError(new Error(String(err)));
        }
        return undefined;
      }
    };
  }, []);

  return { error, clearError, wrapAsync };
}
