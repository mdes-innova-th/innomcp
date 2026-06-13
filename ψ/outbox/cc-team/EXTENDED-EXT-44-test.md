<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-44 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":38,"completion_tokens":2649,"total_tokens":2687,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1893,"image_tokens":0},"cache_creation_input_tokens":0} | 50s
 generated: 2026-06-13T05:27:49.148Z -->
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { chunk, unique, groupBy } = require('./arrayUtils.js');

describe('arrayUtils', () => {
  describe('chunk', () => {
    it('splits array into chunks of specified size', () => {
      assert.deepStrictEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    });

    it('handles chunk size larger than array length', () => {
      assert.deepStrictEqual(chunk([1, 2, 3], 5), [[1, 2, 3]]);
    });

    it('returns empty array when given an empty array', () => {
      assert.deepStrictEqual(chunk([], 3), []);
    });

    it('handles exact multiples correctly', () => {
      assert.deepStrictEqual(chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);
    });
  });

  describe('unique', () => {
    it('deduplicates an array of numbers', () => {
      assert.deepStrictEqual(unique([1, 2, 2, 3, 1, 4]), [1, 2, 3, 4]);
    });

    it('deduplicates an array of strings', () => {
      assert.deepStrictEqual(unique(['a', 'b', 'a', 'c', 'b']), ['a', 'b', 'c']);
    });

    it('returns an empty array when given an empty array', () => {
      assert.deepStrictEqual(unique([]), []);
    });

    it('preserves the original order of elements', () => {
      assert.deepStrictEqual(unique([3, 1, 2, 1, 3]), [3, 1, 2]);
    });
  });

  describe('groupBy', () => {
    it('groups objects by a specific property using a callback', () => {
      const input = [
        { category: 'fruit', name: 'apple' },
        { category: 'veggie', name: 'carrot' },
        { category: 'fruit', name: 'banana' }
      ];
      const expected = {
        fruit: [
          { category: 'fruit', name: 'apple' },
          { category: 'fruit', name: 'banana' }
        ],
        veggie: [
          { category: 'veggie', name: 'carrot' }
        ]
      };
      assert.deepStrictEqual(groupBy(input, item => item.category), expected);
    });

    it('groups primitive values using a condition callback', () => {
      const input = [1, 2, 3, 4, 5, 6];
      const expected = {
        even: [2, 4, 6],
        odd: [1, 3, 5]
      };
      assert.deepStrictEqual(groupBy(input, n => n % 2 === 0 ? 'even' : 'odd'), expected);
    });

    it('returns an empty object when given an empty array', () => {
      assert.deepStrictEqual(groupBy([], item => item.id), {});
    });
  });
});
