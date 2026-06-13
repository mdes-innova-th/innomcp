<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: UTIL-3 role=test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":34,"completion_tokens":1154,"total_tokens":1188,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":460,"image_tokens":0},"cache_creation_input_tokens":0} | 12s
 generated: 2026-06-13T05:28:09.990Z -->
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { writeJson, readJson, ensureDir } from './fileUtils.js';

let tmpDir;

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileUtils-test-'));
});

after(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('ensureDir', () => {
  it('should create a directory if it does not exist', async () => {
    const dir = path.join(tmpDir, 'new-dir');
    await ensureDir(dir);
    const stat = await fs.stat(dir);
    assert(stat.isDirectory());
  });

  it('should not throw if the directory already exists', async () => {
    const dir = path.join(tmpDir, 'existing-dir');
    await fs.mkdir(dir);
    await assert.doesNotReject(() => ensureDir(dir));
  });

  it('should create nested directories', async () => {
    const dir = path.join(tmpDir, 'a', 'b', 'c');
    await ensureDir(dir);
    const stat = await fs.stat(dir);
    assert(stat.isDirectory());
  });
});

describe('writeJson / readJson roundtrip', () => {
  it('should write and read back the same object', async () => {
    const filePath = path.join(tmpDir, 'test.json');
    const data = { hello: 'world', number: 42, nested: { key: true } };
    await writeJson(filePath, data);
    const result = await readJson(filePath);
    assert.deepStrictEqual(result, data);
  });

  it('should write and read back an array', async () => {
    const filePath = path.join(tmpDir, 'array.json');
    const data = [1, 'two', { three: 3 }];
    await writeJson(filePath, data);
    const result = await readJson(filePath);
    assert.deepStrictEqual(result, data);
  });

  it('should write and read back primitive types', async () => {
    const filePath = path.join(tmpDir, 'primitive.json');
    await writeJson(filePath, 'just a string');
    assert.strictEqual(await readJson(filePath), 'just a string');

    await writeJson(filePath, 12345);
    assert.strictEqual(await readJson(filePath), 12345);

    await writeJson(filePath, true);
    assert.strictEqual(await readJson(filePath), true);

    await writeJson(filePath, null);
    assert.strictEqual(await readJson(filePath), null);
  });

  it('should overwrite existing file', async () => {
    const filePath = path.join(tmpDir, 'overwrite.json');
    const initial = { original: true };
    const updated = { updated: true };
    await writeJson(filePath, initial);
    await writeJson(filePath, updated);
    const result = await readJson(filePath);
    assert.deepStrictEqual(result, updated);
  });
});
