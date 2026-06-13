<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: TEST-3 role=test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":197,"completion_tokens":265,"total_tokens":462,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 6s
 generated: 2026-06-13T05:28:58.742Z -->
import { test } from 'node:test';
import assert from 'node:assert';
import { EventQueue } from './EventQueue.ts';

test('EventQueue: enqueue and dequeue maintain FIFO order', () => {
  const queue = new EventQueue();
  queue.enqueue('first');
  queue.enqueue('second');
  queue.enqueue('third');

  assert.strictEqual(queue.dequeue(), 'first');
  assert.strictEqual(queue.dequeue(), 'second');
  assert.strictEqual(queue.dequeue(), 'third');
});

test('EventQueue: peek returns the first item without removing it', () => {
  const queue = new EventQueue();
  queue.enqueue('a');
  queue.enqueue('b');

  assert.strictEqual(queue.peek(), 'a');
  assert.strictEqual(queue.peek(), 'a');
  assert.strictEqual(queue.size(), 2);
  assert.strictEqual(queue.dequeue(), 'a');
  assert.strictEqual(queue.peek(), 'b');
});

test('EventQueue: isEmpty returns true when empty', () => {
  const queue = new EventQueue();
  assert.strictEqual(queue.isEmpty(), true);

  queue.enqueue('item');
  assert.strictEqual(queue.isEmpty(), false);

  queue.dequeue();
  assert.strictEqual(queue.isEmpty(), true);
});
