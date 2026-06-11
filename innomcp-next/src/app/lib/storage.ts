// storage.ts — robust localStorage wrapper for INNOMCP
// Handles SSR, quota exceeded, JSON parse errors, and TypeScript generics.

interface StorageEntry<T> {
  value: T;
  expiry?: number; // timestamp in milliseconds, if any
}

const DEFAULT_TOTAL_QUOTA = 5 * 1024 * 1024; // 5 MB typical localStorage limit

export class INNOMCPStorage {
  private memoryStore: Map<string, string>;
  private isServer: boolean;

  constructor() {
    this.isServer = typeof window === 'undefined';
    this.memoryStore = new Map();
  }

  /**
   * Retrieve a value from storage.
   * @returns The parsed value, or defaultValue if key is missing, invalid, or expired.
   */
  get<T>(key: string, defaultValue: T): T {
    try {
      const raw = this.readRaw(key);
      if (raw === null) return defaultValue;

      const entry: StorageEntry<T> = JSON.parse(raw);
      if (typeof entry !== 'object' || entry === null || !('value' in entry)) {
        // invalid format, treat as missing
        return defaultValue;
      }

      // Check expiry
      if (entry.expiry && Date.now() > entry.expiry) {
        this.remove(key); // clean up expired
        return defaultValue;
      }

      return entry.value as T;
    } catch {
      // JSON parse error or other failure
      return defaultValue;
    }
  }

  /**
   * Store a value. Optionally set a TTL in milliseconds.
   * @returns true if stored successfully, false if failed (e.g., quota exceeded).
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    const entry: StorageEntry<T> = {
      value,
      expiry: ttl ? Date.now() + ttl : undefined,
    };

    const serialized = JSON.stringify(entry);
    return this.writeRaw(key, serialized);
  }

  /**
   * Remove a key.
   */
  remove(key: string): void {
    try {
      if (this.isServer) {
        this.memoryStore.delete(key);
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
  }

  /**
   * Clear all keys, or only those with a given prefix.
   */
  clear(prefix?: string): void {
    try {
      if (this.isServer) {
        if (prefix) {
          for (const key of this.memoryStore.keys()) {
            if (key.startsWith(prefix)) {
              this.memoryStore.delete(key);
            }
          }
        } else {
          this.memoryStore.clear();
        }
      } else {
        if (prefix) {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
        } else {
          localStorage.clear();
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: string): boolean {
    try {
      const raw = this.readRaw(key);
      if (raw === null) return false;

      const entry: StorageEntry<unknown> = JSON.parse(raw);
      if (typeof entry !== 'object' || entry === null || !('value' in entry)) {
        return false;
      }
      if (entry.expiry && Date.now() > entry.expiry) {
        this.remove(key);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all keys currently in storage (optionally filtered by prefix).
   * Note: Expired keys are not automatically filtered out here because that would
   * require parsing every entry. Use has() to check individual keys.
   */
  keys(prefix?: string): string[] {
    try {
      if (this.isServer) {
        const all = Array.from(this.memoryStore.keys());
        return prefix ? all.filter((k) => k.startsWith(prefix)) : all;
      }

      const result: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (!prefix || key.startsWith(prefix))) {
          result.push(key);
        }
      }
      return result;
    } catch {
      return [];
    }
  }

  /**
   * Approximate bytes used by all entries (keys + values).
   */
  size(): number {
    try {
      if (this.isServer) {
        let total = 0;
        this.memoryStore.forEach((value, key) => {
          total += key.length + value.length;
        });
        return total; // bytes approximation
      }

      let totalSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = key ? localStorage.getItem(key) : null;
        if (key && value !== null) {
          totalSize += key.length + value.length;
        }
      }
      return totalSize;
    } catch {
      return 0;
    }
  }

  /**
   * Quota information. Uses navigator.storage.estimate() if available,
   * otherwise falls back to a typical limit of 5 MB.
   */
  async quota(): Promise<{ used: number; total: number; percentage: number }> {
    if (this.isServer) {
      // Server-side: no quota, just report memory map size
      const used = this.size();
      return { used, total: Infinity, percentage: 0 };
    }

    try {
      // Modern browsers support the StorageManager API
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage ?? 0;
        const total = estimate.quota ?? DEFAULT_TOTAL_QUOTA;
        const percentage = total > 0 ? (used / total) * 100 : 0;
        return { used, total, percentage };
      }
    } catch {
      // Fallback to size estimate
    }

    const used = this.size();
    const total = DEFAULT_TOTAL_QUOTA;
    const percentage = total > 0 ? (used / total) * 100 : 0;
    return { used, total, percentage };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private readRaw(key: string): string | null {
    if (this.isServer) {
      return this.memoryStore.get(key) ?? null;
    }
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeRaw(key: string, value: string): boolean {
    if (this.isServer) {
      this.memoryStore.set(key, value);
      return true;
    }

    try {
      localStorage.setItem(key, value);
      return true;
    } catch (err) {
      // Quota exceeded or other security error
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        // Attempt to clear some space (optional emergency cleanup)
        // For simplicity, just fail.
        return false;
      }
      return false;
    }
  }
}

// Singleton instance
export const storage = new INNOMCPStorage();

// Typed storage keys used across the app
export const STORAGE_KEYS = {
  CHAT_MESSAGES: 'innomcp.chat.messages',
  CHAT_SUMMARIES: 'innomcp.chat.summaries',
  PREFERENCES: 'innomcp.user.preferences',
  PROVIDER_CONFIG: 'innomcp.provider.config',
  TOUR_DONE: 'innomcp.tour.done',
  DRAFT: 'innomcp.chat.draft',
  THEME: 'theme',
  SIDEBAR_STATE: 'innomcp-sidebar-state',
} as const;