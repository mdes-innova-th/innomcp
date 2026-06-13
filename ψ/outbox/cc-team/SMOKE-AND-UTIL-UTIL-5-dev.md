<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: UTIL-5 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":65,"completion_tokens":2142,"total_tokens":2207,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1905,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 18s
 generated: 2026-06-13T05:28:16.597Z -->
export class LRUCache<K, V> {
  private readonly cache: Map<K, V>;

  constructor(private readonly maxSize: number) {
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    if (this.cache.size > this.maxSize) {
      const lruKey = this.cache.keys().next().value;
      this.cache.delete(lruKey);
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
