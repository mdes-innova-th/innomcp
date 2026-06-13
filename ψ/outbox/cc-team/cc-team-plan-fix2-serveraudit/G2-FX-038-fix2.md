<!-- cc-team deliverable
 group: G2 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-038 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1713,"completion_tokens":2681,"total_tokens":4394,"prompt_tokens_details":{"cached_tokens":1664,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2254,"image_tokens":0},"cache_creation_input_tokens":0} | 29s
 generated: 2026-06-13T12:09:35.028Z -->
FILE: innomcp-server-node/src/utils/cache.ts
<<<<<<< SEARCH
export async function clearCachePattern(pattern: string): Promise<number> {
  let count = 0;

  // Clear in-memory matches
  for (const key of inMemoryCache.keys()) {
    if (key.includes(pattern.replace('*', ''))) {
      inMemoryCache.delete(key);
      count++;
    }
  }

  logBoth('INFO', `[Cache] Cleared pattern (in-memory): ${pattern}, count: ${count}`);

  return count;
}
=======
export async function clearCachePattern(pattern: string): Promise<number> {
  let count = 0;

  // Clear in-memory matches — convert glob * pattern to regex
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$');
  for (const key of inMemoryCache.keys()) {
    if (regex.test(key)) {
      inMemoryCache.delete(key);
      count++;
    }
  }

  logBoth('INFO', `[Cache] Cleared pattern (in-memory): ${pattern}, count: ${count}`);

  return count;
}
>>>>>>> REPLACE
FILE: innomcp-server-node/src/utils/cache.ts
<<<<<<< SEARCH
// Cleanup every 5 minutes
setInterval(cleanupExpiredCache, 300_000);
=======
let cleanupInterval: NodeJS.Timeout | undefined;

// Cleanup every 5 minutes
cleanupInterval = setInterval(cleanupExpiredCache, 300_000);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Stop the automatic cache cleanup interval.
 */
export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = undefined;
  }
}
>>>>>>> REPLACE
