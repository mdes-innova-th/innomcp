<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-16 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":75,"completion_tokens":2915,"total_tokens":2990,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2643,"image_tokens":0},"cache_creation_input_tokens":0} | 54s
 generated: 2026-06-12T03:50:24.540Z -->
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { envValidator } from './envValidator.js';

test('calling with empty array does not throw', () => {
  const originalEnv = process.env;
  process.env = {};
  try {
    envValidator([]);
  } finally {
    process.env = originalEnv;
  }
});

test('calling with a name not in process.env throws an Error that includes that variable name in its message', () => {
  const originalEnv = process.env;
  process.env = {};
  try {
    assert.throws(
      () => envValidator(['MISSING_ENV_VAR']),
      (err) => err instanceof Error && err.message.includes('MISSING_ENV_VAR')
    );
  } finally {
    process.env = originalEnv;
  }
});

test('calling with an existing env var name does not throw', () => {
  const originalEnv = process.env;
  process.env = { EXISTING_ENV_VAR: 'some_value' };
  try {
    envValidator(['EXISTING_ENV_VAR']);
  } finally {
    process.env = originalEnv;
  }
});
