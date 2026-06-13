<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-16 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":50,"completion_tokens":1512,"total_tokens":1562,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1266,"image_tokens":0},"cache_creation_input_tokens":0} | 29s
 generated: 2026-06-13T05:26:19.574Z -->
const test = require('node:test');
const assert = require('node:assert/strict');
const { truncate, slugify, isThaiText } = require('./stringUtils');

test('truncate cuts string at max length', () => {
  assert.equal(truncate('hello world', 5), 'hello');
  assert.equal(truncate('short', 10), 'short');
  assert.equal(truncate('exact', 5), 'exact');
});

test('slugify lowercases and replaces spaces with hyphens', () => {
  assert.equal(slugify('Hello World'), 'hello-world');
  assert.equal(slugify('Foo Bar Baz'), 'foo-bar-baz');
  assert.equal(slugify('ALREADY UPPER'), 'already-upper');
});

test('isThaiText returns true for Thai chars and false for ASCII', () => {
  assert.equal(isThaiText('สวัสดีครับ'), true);
  assert.equal(isThaiText('ภาษาไทย'), true);
  assert.equal(isThaiText('Hello'), false);
  assert.equal(isThaiText('12345'), false);
});
