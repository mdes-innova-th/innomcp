<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: UTIL-6 role=test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":37,"completion_tokens":2026,"total_tokens":2063,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1242,"image_tokens":0},"cache_creation_input_tokens":0} | 26s
 generated: 2026-06-13T05:28:24.620Z -->
import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal LRU Cache implementation for demonstration/testing.
// In a real project you would import the actual LRUCache from your module.
class LRUCache {
    constructor(capacity) {
        this.capacity = capacity;
        this.map = new Map(); // keys in insertion order (most recently used at end)
    }

    get(key) {
        if (!this.map.has(key)) return -1;
        const value = this.map.get(key);
        // Move key to the end (most recently used)
        this.map.delete(key);
        this.map.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.map.has(key)) {
            this.map.delete(key); // remove existing to update position
        } else if (this.map.size >= this.capacity) {
            // Evict the least recently used (first key in Map)
            const oldest = this.map.keys().next().value;
            this.map.delete(oldest);
        }
        this.map.set(key, value);
    }

    size() {
        return this.map.size;
    }
}

test('LRUCache', async (t) => {
    await t.test('set and get should work', async () => {
        const cache = new LRUCache(3);
        cache.set('a', 1);
        cache.set('b', 2);
        assert.strictEqual(cache.get('a'), 1);
        assert.strictEqual(cache.get('b'), 2);
        assert.strictEqual(cache.get('c'), -1); // missing key
    });

    await t.test('should update value for an existing key and keep it recent', async () => {
        const cache = new LRUCache(2);
        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('a', 10); // update a, making b the least recently used
        assert.strictEqual(cache.get('a'), 10);
        assert.strictEqual(cache.get('b'), 2);
    });

    await t.test('should evict oldest when full', async () => {
        const cache = new LRUCache(2);
        cache.set(1, 'one');
        cache.set(2, 'two');
        // Access key 1, so 2 becomes the least recently used
        assert.strictEqual(cache.get(1), 'one');
        
        cache.set(3, 'three'); // should evict key 2
        assert.strictEqual(cache.get(2), -1, 'key 2 should be evicted');
        assert.strictEqual(cache.get(1), 'one', 'key 1 should still be present');
        assert.strictEqual(cache.get(3), 'three', 'key 3 should be present');
    });

    await t.test('size() should reflect current number of items', async () => {
        const cache = new LRUCache(3);
        assert.strictEqual(cache.size(), 0, 'initial size 0');
        
        cache.set('x', 1);
        assert.strictEqual(cache.size(), 1);
        
        cache.set('y', 2);
        cache.set('z', 3);
        assert.strictEqual(cache.size(), 3);
        
        // Update existing key, size unchanged
        cache.set('x', 10);
        assert.strictEqual(cache.size(), 3);
        
        // Add new key when at capacity, size stays at capacity after eviction
        cache.set('w', 4);
        assert.strictEqual(cache.size(), 3);
    });
});
