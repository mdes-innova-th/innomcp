<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-6 role=dev model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":61,"completion_tokens":1236,"total_tokens":1297,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1045,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 36s
 generated: 2026-06-12T03:49:03.720Z -->
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const expiresAt = ttlMs !== undefined ? Date.now() + ttlMs : Infinity;
    this.cache.set(key, { value, expiresAt });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  size(): number {
    return this.cache.size;
  }
}
