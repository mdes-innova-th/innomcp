interface LinkedNode<T = unknown> {
  key: string;
  value: T;
  expiry: number;
  prev: LinkedNode<T> | null;
  next: LinkedNode<T> | null;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

const DEFAULT_MAX_SIZE = 1_000;
const DEFAULT_TTL_MS = 5 * 60 * 1_000;
const CLEANUP_INTERVAL_MS = 60 * 1_000;

export class CacheManager {
  private static instance: CacheManager;
  private readonly entries = new Map<string, LinkedNode>();
  private maxSize = DEFAULT_MAX_SIZE;
  private head: LinkedNode | null = null;
  private tail: LinkedNode | null = null;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  private constructor() {
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref?.();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  get<T>(key: string): T | null {
    const node = this.entries.get(key) as LinkedNode<T> | undefined;
    if (!node) {
      this.misses += 1;
      return null;
    }

    if (this.isExpired(node)) {
      this.delete(key);
      this.misses += 1;
      return null;
    }

    this.hits += 1;
    this.moveToHead(node);
    return node.value;
  }

  set<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
    const existing = this.entries.get(key) as LinkedNode<T> | undefined;
    const expiry = Date.now() + ttlMs;

    if (existing) {
      existing.value = value;
      existing.expiry = expiry;
      this.moveToHead(existing);
      return;
    }

    const node: LinkedNode<T> = {
      key,
      value,
      expiry,
      prev: null,
      next: null,
    };

    this.entries.set(key, node);
    this.addToHead(node);

    while (this.entries.size > this.maxSize && this.tail) {
      this.delete(this.tail.key);
      this.evictions += 1;
    }
  }

  delete(key: string): void {
    const node = this.entries.get(key);
    if (!node) {
      return;
    }

    this.removeNode(node);
    this.entries.delete(key);
  }

  has(key: string): boolean {
    const node = this.entries.get(key);
    if (!node) {
      return false;
    }

    if (this.isExpired(node)) {
      this.delete(key);
      return false;
    }

    return true;
  }

  clear(): void {
    this.entries.clear();
    this.head = null;
    this.tail = null;
  }

  size(): number {
    this.cleanupExpired();
    return this.entries.size;
  }

  stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.size(),
      hitRate: total === 0 ? 0 : this.hits / total,
    };
  }

  configure(maxSize: number): void {
    this.maxSize = Math.max(1, Math.floor(maxSize));
    while (this.entries.size > this.maxSize && this.tail) {
      this.delete(this.tail.key);
      this.evictions += 1;
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, node] of this.entries) {
      if (node.expiry <= now) {
        this.delete(key);
      }
    }
  }

  private isExpired(node: LinkedNode): boolean {
    return node.expiry <= Date.now();
  }

  private addToHead(node: LinkedNode): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
  }

  private moveToHead(node: LinkedNode): void {
    if (node === this.head) {
      return;
    }

    this.removeNode(node);
    this.addToHead(node);
  }

  private removeNode(node: LinkedNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    node.prev = null;
    node.next = null;
  }
}

export default CacheManager;
