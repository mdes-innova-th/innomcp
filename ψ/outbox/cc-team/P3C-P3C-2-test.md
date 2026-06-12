<!-- cc-team deliverable
 group: P3C (Phase 3.3 â€” /health endpoint must expose provider + build status)
 member: P3C-2 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":105,"completion_tokens":1397,"total_tokens":1502,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":895,"image_tokens":0},"cache_creation_input_tokens":0} | 16s
 generated: 2026-06-12T03:42:35.627Z -->
```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('Health providers endpoint', () => {
  let healthModule;
  
  it('should export a Router (function)', () => {
    healthModule = require('../../dist/routes/api/health');
    assert.strictEqual(typeof healthModule, 'function', 'health module should export a function (Express Router)');
  });

  it('should respond with status, providers, and build fields on GET /health', () => {
    // Re-require to get fresh module if needed (already loaded above)
    const router = require('../../dist/routes/api/health');
    
    // Create mock request and response
    const req = {
      method: 'GET',
      url: '/health',
      headers: {}
    };
    
    let capturedJson = null;
    let capturedStatus = null;
    
    const res = {
      json: (data) => {
        capturedJson = data;
        return this; // for chaining
      },
      status: (code) => {
        capturedStatus = code;
        return res;
      },
      end: () => {},
      send: () => {}
    };
    
    const next = (err) => {
      // not expected to be called
      assert.fail('next should not be called');
    };
    
    // Invoke the router as middleware
    router(req, res, next);
    
    // Assert that json was called with an object containing the required fields
    assert.ok(capturedJson !== null, 'res.json should have been called');
    assert.ok(typeof capturedJson === 'object', 'response should be an object');
    assert.ok('status' in capturedJson, 'response should have status field');
    assert.ok('providers' in capturedJson, 'response should have providers field');
    assert.ok('build' in capturedJson, 'response should have build field');
    
    // Optional: type checks for each field
    assert.strictEqual(typeof capturedJson.status, 'string', 'status should be a string');
    assert.ok(Array.isArray(capturedJson.providers) || typeof capturedJson.providers === 'object', 'providers should be an array or object');
    assert.strictEqual(typeof capturedJson.build, 'object', 'build should be an object');
  });
});
```
