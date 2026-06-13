<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-09 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":72,"completion_tokens":1623,"total_tokens":1695,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1453,"image_tokens":0},"cache_creation_input_tokens":0} | 19s
 generated: 2026-06-13T05:25:52.070Z -->
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number
): {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize) || 0;

  // Ensure page is at least 1, but allow requests beyond the last page (returns empty data)
  const safePage = page < 1 ? 1 : page;
  const start = (safePage - 1) * pageSize;

  const data = items.slice(start, start + pageSize);

  return {
    data,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}
