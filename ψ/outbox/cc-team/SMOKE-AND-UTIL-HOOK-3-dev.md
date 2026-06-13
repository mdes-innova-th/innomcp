<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: HOOK-3 role=dev model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":224,"completion_tokens":618,"total_tokens":842,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 9s
 generated: 2026-06-13T05:28:42.271Z -->
import { useState, useMemo, useCallback } from 'react';

export type SortDir = 'asc' | 'desc';

export interface UseSortResult<T> {
  sorted: T[];
  sortBy: (key: keyof T) => void;
  sortKey: keyof T | null;
  sortDir: SortDir;
}

export function useSort<T>(items: T[]): UseSortResult<T> {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sortBy = useCallback(
    (key: keyof T) => {
      if (sortKey === key) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey]
  );

  const sorted = useMemo(() => {
    if (!sortKey) {
      return items;
    }

    const copy = items.slice();
    copy.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === bVal) {
        return 0;
      }

      if (aVal === null || aVal === undefined) {
        return 1;
      }
      if (bVal === null || bVal === undefined) {
        return -1;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        const aNum = aVal ? 1 : 0;
        const bNum = bVal ? 1 : 0;
        return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
      }

      if (aVal instanceof Date && bVal instanceof Date) {
        return sortDir === 'asc'
          ? aVal.getTime() - bVal.getTime()
          : bVal.getTime() - aVal.getTime();
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });

    return copy;
  }, [items, sortKey, sortDir]);

  return { sorted, sortBy, sortKey, sortDir };
}

export default useSort;
