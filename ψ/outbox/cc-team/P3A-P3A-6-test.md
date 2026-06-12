<!-- cc-team deliverable
 group: P3A (Phase 3.1 â€” Fix fastPathHandler: greetings must pass to LLM, not get 'à¸«à¹‰à¸²à¸¡à¹€à¸”à¸²à¹‚à¸§à¹‰à¸¢')
 member: P3A-6 role=test model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":90,"completion_tokens":3852,"total_tokens":3942,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2812,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 44s
 generated: 2026-06-12T03:42:21.651Z -->
const { test } = require('node:test');
const assert = require('node:assert');
const { greetingFastPath } = require('./greeting');

test('hello fast path does not return ห้ามเดาโว้ย', () => {
  assert.notStrictEqual(greetingFastPath('hello'), 'ห้ามเดาโว้ย');
});

test('hi fast path does not return ห้ามเดาโว้ย', () => {
  assert.notStrictEqual(greetingFastPath('hi'), 'ห้ามเดาโว้ย');
});

test('hey fast path does not return ห้ามเดาโว้ย', () => {
  assert.notStrictEqual(greetingFastPath('hey'), 'ห้ามเดาโว้ย');
});

test('ping fast path does not return ห้ามเดาโว้ย', () => {
  assert.notStrictEqual(greetingFastPath('ping'), 'ห้ามเดาโว้ย');
});

test('test fast path does not return ห้ามเดาโว้ย', () => {
  assert.notStrictEqual(greetingFastPath('test'), 'ห้ามเดาโว้ย');
});

test('สวัสดี fast path does not return ห้ามเดาโว้ย', () => {
  assert.notStrictEqual(greetingFastPath('สวัสดี'), 'ห้ามเดาโว้ย');
});

test('ดี fast path does not return ห้ามเดาโว้ย', () => {
  assert.notStrictEqual(greetingFastPath('ดี'), 'ห้ามเดาโว้ย');
});

test('เฮ้ fast path does not return ห้ามเดาโว้ย', () => {
  assert.notStrictEqual(greetingFastPath('เฮ้'), 'ห้ามเดาโว้ย');
});

test('หวัดดี fast path does not return ห้ามเดาโว้ย', () => {
  assert.notStrictEqual(greetingFastPath('หวัดดี'), '���้ามเดาโว้ย');
});

test('yo fast path does not return ห้ามเดาโว้ย', () => {
  assert.notStrictEqual(greetingFastPath('yo'), 'ห้ามเดาโว้ย');
});
