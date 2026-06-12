<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-7 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":65,"completion_tokens":1390,"total_tokens":1455,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1112,"image_tokens":0},"cache_creation_input_tokens":0} | 15s
 generated: 2026-06-12T03:48:42.560Z -->
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import SimpleCache from '../dist/SimpleCache.js';

describe('SimpleCache', () => {
  let cache;

  before(() => {
    cache = new SimpleCache();
  });

  it('set and get returns value', () => {
    cache.set('key1', 'value1');
    assert.strictEqual(cache.get('key1'), 'value1');
  });

  it('entry with 10ms TTL returns undefined after 15ms sleep', async () => {
    cache.set('key2', 'value2', 10);
    await new Promise(resolve => setTimeout(resolve, 15));
    assert.strictEqual(cache.get('key2'), undefined);
  });

  it('invalidate removes entry', () => {
    cache.set('key3', 'value3');
    cache.invalidate('key3');
    assert.strictEqual(cache.get('key3'), undefined);
  });

  it('size() is accurate', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    assert.strictEqual(cache.size(), 2);
    cache.invalidate('a');
    assert.strictEqual(cache.size(), 1);
  });
});
