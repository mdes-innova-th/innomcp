<!-- cc-team deliverable
 group: R (Rebuild 3 quarantined REST routes against real service APIs (Express Router, TypeScript))
 member: R4 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":160,"completion_tokens":1267,"total_tokens":1427,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":991,"image_tokens":0},"cache_creation_input_tokens":0} | 14s
 generated: 2026-06-11T19:27:04.792Z -->
```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');

const routes = [
  '../../dist/routes/api/analytics.js',
  '../../dist/routes/api/mdesModels.js',
  '../../dist/routes/api/thaiNLP.js',
  '../../dist/routes/api/workspace.js',
];

let passed = 0;
let failed = 0;

routes.forEach((routePath) => {
  test(`Route module: ${routePath}`, () => {
    try {
      const mod = require(routePath);
      const exported = mod.default || mod;
      const isFunction = typeof exported === 'function';
      const hasStack = exported && exported.stack;
      const hasUse = exported && typeof exported.use === 'function';
      assert.ok(
        isFunction || hasStack || hasUse,
        `Exported value is not a function and lacks .stack or .use properties`
      );
      passed++;
    } catch (err) {
      assert.fail(`Failed to load or validate module: ${err.message}`);
      failed++;
    }
  });
});

test('Summary', () => {
  console.log(
    `\nSmoke test summary: ${passed} passed, ${failed} failed out of ${routes.length} routes.`
  );
});
```
