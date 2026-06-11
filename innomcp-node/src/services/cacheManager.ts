/**
 * Cache entry node for the doubly-linked list.
 */
interface LinkedNode<T = unknown> {
  key: string;
  value: T;
  expiry: number; // timestamp in ms
  prev: LinkedNode<T> | null;
  next: LinkedNode<T> | null;
}

/**
 * Statistics about the cache performance.
 */
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

/**
 * In-memory LRU cache with TTL support.
 *
 * Uses a doubly-linked list and a Map for O(1) get, set, and delete operations.
 * Entries are automatically evicted when the cache exceeds the maximum size,
 * and expired entries are cleaned up every 60 seconds.
 *
 * @example
 *