<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: HOOK-1 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":62,"completion_tokens":2651,"total_tokens":2713,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2057,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 21s
 generated: 2026-06-13T05:28:52.557Z -->
import { useState, useMemo, useCallback, useEffect } from "react";

interface UsePaginationReturn {
  page: number;
  totalPages: number;
  next: () => void;
  prev: () => void;
  goTo: (page: number) => void;
  pageItems: <T>(items: T[]) => T[];
}

export function usePagination(total: number, pageSize: number): UsePaginationReturn {
  const totalPages = useMemo(() => {
    const size = Math.max(1, pageSize);
    return Math.max(1, Math.ceil(total / size));
  }, [total, pageSize]);

  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage((current) => Math.max(1, Math.min(current, totalPages)));
  }, [totalPages]);

  const next = useCallback(() => {
    setPage((current) => Math.min(current + 1, totalPages));
  }, [totalPages]);

  const prev = useCallback(() => {
    setPage((current) => Math.max(current - 1, 1));
  }, []);

  const goTo = useCallback(
    (target: number) => {
      setPage(Math.max(1, Math.min(target, totalPages)));
    },
    [totalPages]
  );

  const pageItems = useCallback(
    <T>(items: T[]): T[] => {
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      return items.slice(start, end);
    },
    [page, pageSize]
  );

  return {
    page,
    totalPages,
    next,
    prev,
    goTo,
    pageItems,
  };
}
