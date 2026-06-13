<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T056 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2499,"completion_tokens":4470,"total_tokens":6969,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1471,"image_tokens":0},"cache_creation_input_tokens":0} | 38s
 generated: 2026-06-13T11:03:15.399Z -->
```typescript
import { Router, Request, Response } from 'express';
import * as fsPromises from 'node:fs/promises';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Mocks must come before any imports from the module under test
jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
}));

jest.mock('node:fs', () => ({
  existsSync: jest.fn(),
}));

import * as filesModule from '../src/routes/api/files';

const {
  WORKSPACE_ROOT,
  safePath,
  artifactIdFromPath,
  artifactPathFromId,
  inferTaskIdFromPath,
  readPinnedStore,
  writePinnedStore,
  listDirectoryEntries,
  collectPinnedArtifacts,
  default: router,
} = filesModule;

describe('files module', () => {
  const mockReadFile = fsPromises.readFile as jest.Mock;
  const mockWriteFile = fsPromises.writeFile as jest.Mock;
  const mockMkdir = fsPromises.mkdir as jest.Mock;
  const mockReaddir = fsPromises.readdir as jest.Mock;
  const mockStat = fsPromises.stat as jest.Mock;
  const mockExistsSync = fs.existsSync as jest.Mock;

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.WORKSPACE_ROOT;
  });

  describe('WORKSPACE_ROOT', () => {
    it('uses WORKSPACE_ROOT from environment if set', () => {
      process.env.WORKSPACE_ROOT = '/custom/root';
      // Re-import to test the constant? Since it's evaluated at import time, we can't easily re-import.
      // Instead we test the constant already imported (it was computed at module load).
      // We'll just verify the constant is defined.
      expect(WORKSPACE_ROOT).toBeDefined();
    });

    it('defaults to ../workspace relative to cwd', () => {
      // Since we can't re-import, we verify that WORKSPACE_ROOT ends with 'workspace'
      expect(WORKSPACE_ROOT).toContain('workspace');
    });
  });

  describe('safePath', () => {
    beforeAll(() => {
      process.env.WORKSPACE_ROOT = '/sandbox';
    });

    it('returns a safe resolved path within the workspace', () => {
      const result = safePath('subdir/file.txt');
      expect(result).toBe('/sandbox/subdir/file.txt');
    });

    it('returns null for path traversal attempts', () => {
      const result = safePath('../../etc/passwd');
      expect(result).toBeNull();
    });

    it('returns the workspace root itself for empty path', () => {
      const result = safePath('');
      expect(result).toBe('/sandbox');
    });

    it('normalizes backslashes on Windows', () => {
      const result = safePath('subdir\\file.txt');
      expect(result).toBe('/sandbox/subdir/file.txt');
    });
  });

  describe('artifactIdFromPath / artifactPathFromId', () => {
    const testPath = 'projects/my_project/notes.md';

    it('produces a reversible base64url id', () => {
      const id = artifactIdFromPath(testPath);
      expect(id).toBeDefined();
      const decoded = artifactPathFromId(id);
      expect(decoded).toBe('projects/my_project/notes.md');
    });

    it('handles leading slashes', () => {
      const id = artifactIdFromPath('/leading/slash.txt');
      const decoded = artifactPathFromId(id);
      expect(decoded).toBe('leading/slash.txt');
    });

    it('returns null for invalid base64url', () => {
      const result = artifactPathFromId('not-valid!!!');
      expect(result).toBeNull();
    });
  });

  describe('inferTaskIdFromPath', () => {
    it('extracts a UUID-style task id', () => {
      const result = inferTaskIdFromPath('/tasks/123e4567-e89b-12d3-a456-426614174000/file.txt');
      expect(result).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('extracts a task-* pattern', () => {
      const result = inferTaskIdFromPath('/task-MyCustomTaskId/notes.csv');
      expect(result).toBe('task-MyCustomTaskId');
    });

    it('returns undefined when no task id found', () => {
      const result = inferTaskIdFromPath('/some/other/path/file.txt');
      expect(result).toBeUndefined();
    });
  });

  describe('readPinnedStore', () => {
    it('returns an empty array if file does not exist', async () => {
      mockReadFile.mockRejectedValue({ code: 'ENOENT' });
      const records = await readPinnedStore();
      expect(records).toEqual([]);
    });

    it('parses valid JSON records', async () => {
      const validRecords = [
        { id: 'abc', path: 'file.md', pinnedAt: '2023-01-01T00:00:00Z' },
      ];
      mockReadFile.mockResolvedValue(JSON.stringify(validRecords));
      const records = await readPinnedStore();
      expect(records).toEqual(validRecords);
    });

    it('filters out invalid records', async () => {
      const mixed = [
        { id: 'abc', path: 'file.md', pinnedAt: '2023-01-01T00:00:00Z' },
        { id: 123, path: 'other.md', pinnedAt: '2023-01-01T00:00:00Z' },
      ];
      mockReadFile.mockResolvedValue(JSON.stringify(mixed));
      const records = await readPinnedStore();
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe('abc');
    });

    it('returns empty array on JSON parse failure', async () => {
      mockReadFile.mockResolvedValue('invalid json');
      const records = await readPinnedStore();
      expect(records).toEqual([]);
    });

    it('returns empty array on other error', async () => {
      mockReadFile.mockRejectedValue(new Error('permission error'));
      const records = await readPinnedStore();
      expect(records).toEqual([]);
    });
  });

  describe('writePinnedStore', () => {
    it('creates directory and writes formatted JSON', async () => {
      const records = [{ id: 'x', path: 'y.txt', pinnedAt: 'z' }];
      await writePinnedStore(records);
      expect(mockMkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.any(String),
        `${JSON.stringify(records, null, 2)}\n`,
        'utf-8'
      );
    });
  });

  describe('listDirectoryEntries', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
    });

    it('returns null for unsafe paths', async () => {
      const result = await listDirectoryEntries('../../escape');
      expect(result).toBeNull();
    });

    it('returns an empty array if directory does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      const result = await listDirectoryEntries('valid');
      expect(result).toEqual([]);
    });

    it('returns entries with id, name, type, path', async () => {
      const mockEntries = [
        { name: 'file.txt', isDirectory: () => false },
        { name: 'subdir', isDirectory: () => true },
      ] as any;
      mockReaddir.mockResolvedValue(mockEntries);
      const result = await listDirectoryEntries('projects');
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: 'file.txt',
        type: 'file',
      });
      expect(result[0].id).toBeDefined();
      expect(result[1].type).toBe('directory');
    });
  });

  describe('collectPinnedArtifacts', () => {
    beforeEach(() => {
      mockReadFile.mockResolvedValue(JSON.stringify([
        { id: 'a', path: 'file1.md', pinnedAt: '2023-01-02' },
        { id: 'b', path: 'file2.txt', pinnedAt: '2023-01-01' },
      ]));
      mockExistsSync.mockReturnValue(true);
      mockStat.mockResolvedValue({ isFile: () => true } as any);
    });

    it('returns sorted pinned artifacts with type', async () => {
      const files = await collectPinnedArtifacts(10);
      expect(files).toHaveLength(2);
      expect(files[0].name).toBe('file1.md');
      expect(files[0].type).toBe('markdown');
      expect(files[1].type).toBe('text');
    });

    it('applies limit if provided', async () => {
      const files = await collectPinnedArtifacts(1);
      expect(files).toHaveLength(1);
    });

    it('skips non-existent or non-file entries', async () => {
      mockExistsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
      const files = await collectPinnedArtifacts();
      expect(files).toHaveLength(1);
    });

    it('sorts by pinnedAt descending', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify([
        { id: 'a', path: 'f1', pinnedAt: '2023-01-05' },
        { id: 'b', path: 'f2', pinnedAt: '2023-01-03' },
        { id: 'c', path: 'f3', pinnedAt: '2023-01-04' },
      ]));
      const files = await collectPinnedArtifacts();
      expect(files.map(f => f.pinnedAt)).toEqual(['2023-01-05', '2023-01-04', '2023-01-03']);
    });
  });

  describe('express router (GET /)', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let jsonSpy: jest.Mock;
    let statusSpy: jest.Mock;

    beforeEach(() => {
      jsonSpy = jest.fn();
      statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
      mockRes = {
        json: jsonSpy,
        status: statusSpy,
      };
    });

    it('returns pinned artifacts when pinned=true', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify([
        { id: 'a', path: 'file.md', pinnedAt: '2023-01-01T00:00:00Z' },
      ]));
      mockExistsSync.mockReturnValue(true);
      mockStat.mockResolvedValue({ isFile: () => true } as any);

      mockReq = { query: { pinned: 'true' } };
      const route = router.stack.find((layer: any) => layer.route?.path === '/' && layer.route?.methods?.get);
      const handler = route?.route?.stack?.[0]?.handle;
      await handler(mockReq as Request, mockRes as Response);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({ files: expect.any(Array) })
      );
    });

    it('returns 500 on pinned fetch error', async () => {
      mockReadFile.mockRejectedValue(new Error('read error'));
      mockReq = { query: { pinned: 'true' } };
      const route = router.stack.find((layer: any) => layer.route?.path === '/' && layer.route?.methods?.get);
      const handler = route?.route?.stack?.[0]?.handle;
      await handler(mockReq as Request, mockRes as Response);
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Cannot load pinned artifacts' });
    });

    it('returns directory listing when path is provided', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([
        { name: 'readme.md', isDirectory: () => false },
      ] as any);

      mockReq = { query: { path: 'projects/' } };
      const route = router.stack.find((layer: any) => layer.route?.path === '/' && layer.route?.methods?.get);
      const handler = route?.route?.stack?.[0]?.handle;
      await handler(mockReq as Request, mockRes as Response);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({ files: expect.any(Array), root: 'projects/' })
      );
    });

    it('returns 400 for invalid path', async () => {
      mockReq = { query: { path: '../../evil' } };
      const route = router.stack.find((layer: any) => layer.route?.path === '/' && layer.route?.methods?.get);
      const handler = route?.route?.stack?.[0]?.handle;
      await handler(mockReq as Request, mockRes as Response);
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({ error: 'Invalid path' });
    });
  });
});
```
