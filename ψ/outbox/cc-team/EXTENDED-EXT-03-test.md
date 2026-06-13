<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-03 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":66,"completion_tokens":4208,"total_tokens":4274,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3824,"image_tokens":0},"cache_creation_input_tokens":0} | 78s
 generated: 2026-06-13T05:26:36.854Z -->
const { test, mock, beforeEach } = require('node:test');
const assert = require('node:assert');

const mockDbCheck = mock.fn(async () => true);
const mockRedisCheck = mock.fn(async () => true);

mock.module('../../src/services/database', {
  namedExports: { checkDatabaseHealth: mockDbCheck }
});

mock.module('../../src/services/redis', {
  namedExports: { checkRedisHealth: mockRedisCheck }
});

const { systemHealthCheck } = require('../../src/systemHealthCheck');

test('systemHealthCheck', async (t) => {
  beforeEach(() => {
    mockDbCheck.mock.resetCalls();
    mockRedisCheck.mock.resetCalls();
  });

  await t.test('overall is healthy when db and redis are true', async () => {
    mockDbCheck.mock.mockImplementation(async () => true);
    mockRedisCheck.mock.mockImplementation(async () => true);

    const result = await systemHealthCheck();

    assert.strictEqual(result.status, 'healthy');
    assert.strictEqual(result.db, true);
    assert.strictEqual(result.redis, true);
  });

  await t.test('degraded when one is false', async () => {
    mockDbCheck.mock.mockImplementation(async () => true);
    mockRedisCheck.mock.mockImplementation(async () => false);

    const result = await systemHealthCheck();

    assert.strictEqual(result.status, 'degraded');
  });

  await t.test('unhealthy when both are false', async () => {
    mockDbCheck.mock.mockImplementation(async () => false);
    mockRedisCheck.mock.mockImplementation(async () => false);

    const result = await systemHealthCheck();

    assert.strictEqual(result.status, 'unhealthy');
  });
});
