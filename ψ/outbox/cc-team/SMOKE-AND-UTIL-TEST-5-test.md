<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: TEST-5 role=test model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":56,"completion_tokens":3000,"total_tokens":3056,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2768,"image_tokens":0},"cache_creation_input_tokens":0} | 72s
 generated: 2026-06-13T05:30:09.362Z -->
const assert = require('node:assert');
const { test } = require('node:test');
const usePagination = require('./usePagination.js');

test('pageItems slices correctly', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const pagination = usePagination(items, 3);

  assert.deepStrictEqual(pagination.pageItems, [1, 2, 3]);
});

test('totalPages is ceil(total / pageSize)', () => {
  const items10 = new Array(10).fill(0);
  const pagination10 = usePagination(items10, 3);
  assert.strictEqual(pagination10.totalPages, 4);

  const items9 = new Array(9).fill(0);
  const pagination9 = usePagination(items9, 3);
  assert.strictEqual(pagination9.totalPages, 3);

  const singleItem = [42];
  const paginationSingle = usePagination(singleItem,
