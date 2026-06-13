<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: HOOK-2 role=dev model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":57,"completion_tokens":897,"total_tokens":954,"prompt_tokens_details":{"cached_tokens":56,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":792,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 12s
 generated: 2026-06-13T05:28:43.952Z -->
import { useState, useMemo } from 'react';

export function useFilter<T>(
  items: T[],
  filterFn: (item: T, query: string) => boolean
) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => items.filter((item) => filterFn(item, query)),
    [items, filterFn, query]
  );

  return { query, setQuery, filtered };
}
