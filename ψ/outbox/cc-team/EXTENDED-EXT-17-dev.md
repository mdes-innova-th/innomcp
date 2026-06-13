<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-17 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":66,"completion_tokens":1155,"total_tokens":1221,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":918,"image_tokens":0},"cache_creation_input_tokens":0} | 14s
 generated: 2026-06-13T05:26:06.059Z -->
import { useState, useEffect } from 'react';

function useLocalStorage<T>(key: string, initial: T): [T, (val: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initial;
    }
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initial;
    } catch (error) {
      console.warn(`Error reading localStorage key “${key}”:`, error);
      return initial;
    }
  });

  const setValue = (value: T) => {
    setStoredValue(value);
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.warn(`Error setting localStorage key “${key}”:`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}

export default useLocalStorage;
