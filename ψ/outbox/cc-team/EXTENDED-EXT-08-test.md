<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-08 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":52,"completion_tokens":645,"total_tokens":697,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":424,"image_tokens":0},"cache_creation_input_tokens":0} | 7s
 generated: 2026-06-13T05:25:15.321Z -->
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isString, isNonEmpty, hasProperty } from './typeGuards.js';

describe('isString', () => {
  it('should return true for "hello"', () => {
    assert.strictEqual(isString('hello'), true);
  });

  it('should return false for 42', () => {
    assert.strictEqual(isString(42), false);
  });
});

describe('isNonEmpty', () => {
  it('should return false for empty string', () => {
    assert.strictEqual(isNonEmpty(''), false);
  });

  it('should return false for null', () => {
    assert.strictEqual(isNonEmpty(null), false);
  });
});

describe('hasProperty', () => {
  it('should return true when key exists', () => {
    const obj = { a: 1, b: 2 };
    assert.strictEqual(hasProperty(obj, 'a'), true);
  });
});
