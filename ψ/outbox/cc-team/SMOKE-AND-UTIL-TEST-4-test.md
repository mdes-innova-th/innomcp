<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: TEST-4 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":53,"completion_tokens":652,"total_tokens":705,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":318,"image_tokens":0},"cache_creation_input_tokens":0} | 7s
 generated: 2026-06-13T05:29:01.071Z -->
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { md5, sha256, uuid } from './hashUtils.js';

describe('hashUtils', () => {
  it('md5("hello") returns a 32-character hex string', () => {
    const result = md5('hello');
    assert.strictEqual(typeof result, 'string');
    assert.strictEqual(result.length, 32);
    assert.ok(/^[0-9a-f]{32}$/i.test(result));
  });

  it('sha256("hello") returns a 64-character hex string', () => {
    const result = sha256('hello');
    assert.strictEqual(typeof result, 'string');
    assert.strictEqual(result.length, 64);
    assert.ok(/^[0-9a-f]{64}$/i.test(result));
  });

  it('uuid() returns a valid UUID format', () => {
    const result = uuid();
    assert.strictEqual(typeof result, 'string');
    assert.strictEqual(result.length, 36);
    assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result));
  });

  it('uuid() produces different values on each call', () => {
    const id1 = uuid();
    const id2 = uuid();
    assert.notStrictEqual(id1, id2);
  });
});
