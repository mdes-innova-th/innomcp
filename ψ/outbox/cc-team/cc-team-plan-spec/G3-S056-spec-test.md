<!-- cc-team deliverable
 group: G3 (Spec/contract-based tests)
 member: S056 role=spec-test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":290,"completion_tokens":2249,"total_tokens":2539,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":457,"image_tokens":0},"cache_creation_input_tokens":0} | 21s
 generated: 2026-06-13T11:36:39.087Z -->
```typescript
import { WORKSPACE_ROOT, safePath, readPinnedStore, writePinnedStore, listDirectoryEntries, collectPinnedArtifacts } from '../src/routes/api/files';

// Mock external dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('express');

import fs from 'fs';
import path from 'path';

// Helper to set up WORKSPACE_ROOT environment variable
const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetAllMocks();
  process.env = { ...ORIGINAL_ENV };
  process.env.WORKSPACE_ROOT = '/tmp/workspace';
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('safePath', () => {
  it('returns a normalized path when userPath is a descendant of WORKSPACE_ROOT', () => {
    (path.resolve as jest.Mock).mockReturnValue('/tmp/workspace/sub/dir/file.txt');
    (path.relative as jest.Mock).mockReturnValue('sub/dir/file.txt');
    (path.normalize as jest.Mock).mockReturnValue('/tmp/workspace/sub/dir/file.txt');

    const result = safePath('sub/dir/file.txt');
    expect(result).toBe('/tmp/workspace/sub/dir/file.txt');
  });

  it('returns null when userPath tries to escape WORKSPACE_ROOT via "../../"', () => {
    (path.resolve as jest.Mock).mockReturnValue('/etc/passwd');
    (path.relative as jest.Mock).mockReturnValue('../../../../etc/passwd');

    const result = safePath('../../../../etc/passwd');
    expect(result).toBeNull();
  });

  it('returns null when userPath is absolute and outside WORKSPACE_ROOT', () => {
    (path.resolve as jest.Mock).mockReturnValue('/var/log');
    (path.relative as jest.Mock).mockReturnValue('../../../var/log');

    const result = safePath('/var/log');
    expect(result).toBeNull();
  });

  it('returns null when userPath is empty or whitespace', () => {
    const result = safePath('');
    expect(result).toBeNull();

    const result2 = safePath('   ');
    expect(result2).toBeNull();
  });

  it('returns the workspace root itself when userPath is "."', () => {
    (path.resolve as jest.Mock).mockReturnValue('/tmp/workspace');
    (path.relative as jest.Mock).mockReturnValue('.');

    const result = safePath('.');
    expect(result).toBe('/tmp/workspace');
  });
});

describe('readPinnedStore', () => {
  it('returns an array of pinned artifact records from the store file', async () => {
    const storeData = JSON.stringify([
      { id: '1', name: 'artifact1', pinnedAt: '2023-01-01T00:00:00Z' },
    ]);
    (fs.promises.readFile as jest.Mock).mockResolvedValue(storeData);

    const records = await readPinnedStore();
    expect(records).toEqual([
      { id: '1', name: 'artifact1', pinnedAt: '2023-01-01T00:00:00Z' },
    ]);
    expect(fs.promises.readFile).toHaveBeenCalledTimes(1);
  });

  it('returns an empty array when the store file does not exist', async () => {
    (fs.promises.readFile as jest.Mock).mockRejectedValue({ code: 'ENOENT' });

    const records = await readPinnedStore();
    expect(records).toEqual([]);
  });

  it('throws when the store file contains invalid JSON', async () => {
    (fs.promises.readFile as jest.Mock).mockResolvedValue('invalid json');
    await expect(readPinnedStore()).rejects.toThrow(SyntaxError);
  });
});

describe('writePinnedStore', () => {
  it('writes the records array as JSON to the store file', async () => {
    (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);

    const records = [{ id: '1', name: 'a', pinnedAt: '2023-01-01T00:00:00Z' }];
    await writePinnedStore(records);

    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(records, null, 2)
    );
  });

  it('throws when writing fails', async () => {
    (fs.promises.writeFile as jest.Mock).mockRejectedValue(new Error('Disk full'));
    await expect(writePinnedStore([])).rejects.toThrow('Disk full');
  });
});

describe('listDirectoryEntries', () => {
  it('returns a list of directory entry names for a valid path inside workspace', async () => {
    (path.resolve as jest.Mock).mockReturnValue('/tmp/workspace/some/dir');
    (path.relative as jest.Mock).mockReturnValue('some/dir');
    (fs.promises.readdir as jest.Mock).mockResolvedValue(['file1.txt', 'file2.txt']);

    const entries = await listDirectoryEntries('some/dir');
    expect(entries).toEqual(['file1.txt', 'file2.txt']);
  });

  it('throws an error when the path is unsafe (null safePath)', async () => {
    (path.resolve as jest.Mock).mockReturnValue('/etc');
    (path.relative as jest.Mock).mockReturnValue('../../etc');

    await expect(listDirectoryEntries('../../etc')).rejects.toThrow('Invalid path');
  });

  it('throws when readdir fails', async () => {
    (path.resolve as jest.Mock).mockReturnValue('/tmp/workspace/sub');
    (path.relative as jest.Mock).mockReturnValue('sub');
    (fs.promises.readdir as jest.Mock).mockRejectedValue(new Error('ENOENT'));

    await expect(listDirectoryEntries('sub')).rejects.toThrow('ENOENT');
  });
});

describe('collectPinnedArtifacts', () => {
  it('returns all pinned artifacts when no limit is given', async () => {
    const storeData = JSON.stringify([
      { id: '1', name: 'a' },
      { id: '2', name: 'b' },
      { id: '3', name: 'c' },
    ]);
    (fs.promises.readFile as jest.Mock).mockResolvedValue(storeData);

    const result = await collectPinnedArtifacts();
    expect(result).toHaveLength(3);
    expect(result).toEqual([
      { id: '1', name: 'a' },
      { id: '2', name: 'b' },
      { id: '3', name: 'c' },
    ]);
  });

  it('returns up to the given limit of artifacts', async () => {
    const storeData = JSON.stringify([
      { id: '1', name: 'a' },
      { id: '2', name: 'b' },
      { id: '3', name: 'c' },
    ]);
    (fs.promises.readFile as jest.Mock).mockResolvedValue(storeData);

    const result = await collectPinnedArtifacts(2);
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { id: '1', name: 'a' },
      { id: '2', name: 'b' },
    ]);
  });

  it('returns empty array when limit is 0', async () => {
    const storeData = JSON.stringify([{ id: '1', name: 'a' }]);
    (fs.promises.readFile as jest.Mock).mockResolvedValue(storeData);

    const result = await collectPinnedArtifacts(0);
    expect(result).toEqual([]);
  });

  it('throws when readPinnedStore throws (e.g., file parse error)', async () => {
    (fs.promises.readFile as jest.Mock).mockResolvedValue('not json');
    await expect(collectPinnedArtifacts()).rejects.toThrow(SyntaxError);
  });
});
```
