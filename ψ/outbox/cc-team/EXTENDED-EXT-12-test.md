<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-12 role=test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":40,"completion_tokens":1026,"total_tokens":1066,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":727,"image_tokens":0},"cache_creation_input_tokens":0} | 13s
 generated: 2026-06-13T05:25:50.147Z -->
import { test } from 'node:test';
import { withTimeout } from 'node:test';
import { rejects, ok } from 'node:assert';

const delay = (ms, value) => new Promise(resolve => setTimeout(() => resolve(value), ms));

test('fast promise resolves within timeout', async () => {
  const fastPromise = delay(10, 'success');
  const timeoutMs = 100;
  const start = Date.now();
  const result = await withTimeout(fastPromise, timeoutMs);
  const elapsed = Date.now() - start;

  ok(result === 'success');
  ok(elapsed < timeoutMs, `Expected elapsed ${elapsed} to be less than timeout ${timeoutMs}`);
  ok(elapsed >= 5, `Expected elapsed at least ~5ms, got ${elapsed}`);
});

test('slow promise rejects due to timeout', async () => {
  const slowPromise = delay(200, 'never');
  const timeoutMs = 50;
  const message = 'custom timeout hit';
  const start = Date.now();
  await rejects(
    () => withTimeout(slowPromise, timeoutMs, message),
    (err) => {
      const elapsed = Date.now() - start;
      return err.message === message &&
             elapsed >= timeoutMs - 5 &&
             elapsed < 200;
    },
    'Expected timeout error with custom message and timing around 50ms'
  );
});
