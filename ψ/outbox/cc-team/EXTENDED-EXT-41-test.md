<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-41 role=test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":36,"completion_tokens":2586,"total_tokens":2622,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1808,"image_tokens":0},"cache_creation_input_tokens":0} | 25s
 generated: 2026-06-13T05:27:12.929Z -->
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeString, sanitizeObject } from '../sanitize.ts';

describe('sanitizeString', () => {
  it('should remove HTML tags', () => {
    assert.strictEqual(sanitizeString('<p>Hello World</p>'), 'Hello World');
    assert.strictEqual(sanitizeString('<script>alert("xss")</script>'), 'alert("xss")');
    assert.strictEqual(sanitizeString('<br/>'), '');
  });

  it('should handle strings without tags', () => {
    assert.strictEqual(sanitizeString('plain text'), 'plain text');
  });

  it('should handle empty string', () => {
    assert.strictEqual(sanitizeString(''), '');
  });

  it('should handle nested tags', () => {
    assert.strictEqual(sanitizeString('<div><span>nested</span></div>'), 'nested');
  });

  it('should handle tags with attributes', () => {
    assert.strictEqual(sanitizeString('<a href="http://example.com">link</a>'), 'link');
  });
});

describe('sanitizeObject', () => {
  it('should sanitize string properties in an object', () => {
    const input = { name: '<b>John</b>', age: 30 };
    const expected = { name: 'John', age: 30 };
    const result = sanitizeObject(input);
    assert.deepStrictEqual(result, expected);
  });

  it('should recursively sanitize nested objects', () => {
    const input = {
      user: {
        bio: '<p>Hello</p>',
        details: {
          code: '<script>alert(1)</script>',
          verified: true,
          empty: ''
        }
      },
      count: 5
    };
    const expected = {
      user: {
        bio: 'Hello',
        details: {
          code: 'alert(1)',
          verified: true,
          empty: ''
        }
      },
      count: 5
    };
    assert.deepStrictEqual(sanitizeObject(input), expected);
  });

  it('should return non-object values as-is', () => {
    assert.strictEqual(sanitizeObject(null), null);
    assert.strictEqual(sanitizeObject(42), 42);
    assert.strictEqual(sanitizeObject('test'), 'test');
  });

  it('should not mutate the original object', () => {
    const input = { prop: '<i>italic</i>' };
    const copy = typeof structuredClone === 'function' ? structuredClone(input) : JSON.parse(JSON.stringify(input));
    sanitizeObject(input);
    assert.deepStrictEqual(input, copy);
  });

  it('should sanitize arrays of strings', () => {
    const input = { list: ['<b>a</b>', '<i>b</i>'] };
    const expected = { list: ['a', 'b'] };
    assert.deepStrictEqual(sanitizeObject(input), expected);
  });

  it('should recursively sanitize objects inside arrays', () => {
    const input = { items: [{ desc: '<h1>Title</h1>' }, { desc: '<span>info</span>' }] };
    const expected = { items: [{ desc: 'Title' }, { desc: 'info' }] };
    assert.deepStrictEqual(sanitizeObject(input), expected);
  });
});
