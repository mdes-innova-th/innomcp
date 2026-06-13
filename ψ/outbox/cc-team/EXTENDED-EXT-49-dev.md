<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-49 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":58,"completion_tokens":784,"total_tokens":842,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":578,"image_tokens":0},"cache_creation_input_tokens":0} | 8s
 generated: 2026-06-13T05:27:16.998Z -->
import { useState, useCallback, useRef, useEffect } from 'react';

export function useCopyToClipboard(): { copied: boolean; copy: (text: string) => void } {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const copy = useCallback((text: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    }).catch(() => {
      // Silently handle clipboard errors
    });
  }, []);

  return { copied, copy };
}
