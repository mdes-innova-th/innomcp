<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: TEST-2 role=test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":38,"completion_tokens":746,"total_tokens":784,"prompt_tokens_details":{"cached_tokens":37,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":659,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-13T05:29:03.269Z -->
const { test, mock } = require('node:test');
const assert = require('node:assert');
const { throttle } = require('./throttle');

test('throttle: called once not twice within window, called again after window expires', () => {
  mock.timers.enable({ apis: ['setTimeout'] });

  const calls = [];
  const fn = () => calls.push(1);
  const throttled = throttle(fn, 100);

  throttled();
  throttled();

  assert.strictEqual(calls.length, 1, 'should be called only once within the throttle window');

  mock.timers.tick(100);

  throttled();

  assert.strictEqual(calls.length, 2, 'should be called again after the window expires');

  mock.timers.reset();
});
