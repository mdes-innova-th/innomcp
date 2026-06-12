<!-- cc-team deliverable
 group: P3C (Phase 3.3 â€” /health endpoint must expose provider + build status)
 member: P3C-5 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":53,"completion_tokens":2554,"total_tokens":2607,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2116,"image_tokens":0},"cache_creation_input_tokens":0} | 28s
 generated: 2026-06-12T03:42:53.605Z -->
```javascript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { getProviderStatus } from '../src/providers.js';

describe('getProviderStatus', () => {
  let originalEnv;

  beforeEach(() => {
    // Save current environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
  });

  it('returns all false when no provider environment variables are set', () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    // delete any other provider env vars as needed

    const status = getProviderStatus();
    assert.equal(status.openai, false);
    assert.equal(status.anthropic, false);
    // add assertions for other providers based on your implementation
  });

  it('returns openai true when OPENAI_API_KEY is set', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const status = getProviderStatus();
    assert.equal(status.openai, true);
    // other providers should remain false
    assert.equal(status.anthropic, false);
  });

  it('primary is always a string', () => {
    // No env vars set
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    let status = getProviderStatus();
    assert.equal(typeof status.primary, 'string');

    // Only OPENAI_API_KEY set
    process.env.OPENAI_API_KEY = 'key';
    status = getProviderStatus();
    assert.equal(typeof status.primary, 'string');

    // Only ANTHROPIC_API_KEY set
    delete process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'key';
    status = getProviderStatus();
    assert.equal(typeof status.primary, 'string');
  });
});
```
