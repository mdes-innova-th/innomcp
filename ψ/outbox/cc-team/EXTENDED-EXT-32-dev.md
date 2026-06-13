<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-32 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":74,"completion_tokens":554,"total_tokens":628,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":286,"image_tokens":0},"cache_creation_input_tokens":0} | 28s
 generated: 2026-06-13T05:26:55.839Z -->
import { useState, useRef, useCallback, useEffect } from 'react';

export default function useAsync<T>(fn: () => Promise<T>): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  run: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(() => {
    setLoading(true);
    setError(null);
    fn()
      .then((result) => {
        if (mountedRef.current) {
          setData(result);
        }
      })
      .catch((err: Error) => {
        if (mountedRef.current) {
          setError(err);
        }
      })
      .finally(() => {
        if (mountedRef.current) {
          setLoading(false);
        }
      });
  }, [fn]);

  return { data, loading, error, run };
}
