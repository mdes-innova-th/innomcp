<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S006 role=spec-test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":261,"completion_tokens":4746,"total_tokens":5007,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3158,"image_tokens":0},"cache_creation_input_tokens":0} | 53s
 generated: 2026-06-13T11:21:10.019Z -->
```typescript
import { ColdRetriever, coldRetriever } from '../src/services/coldRetriever';

// Mock fs and path modules deterministically
jest.mock('fs', () => {
  const mockFiles: Record<string, string> = {};
  const mockStats: Record<string, { isFile: () => boolean }> = {};

  return {
    promises: {
      readdir: jest.fn().mockImplementation((dirPath: string) => {
        const files = Object.keys(mockFiles).filter(f => f.startsWith(dirPath) && !f.slice(dirPath.length + 1).includes('/'));
        if (files.length === 0 && !mockFiles[dirPath]) {
          return Promise.reject(new Error(`ENOENT: no such directory, open '${dirPath}'`));
        }
        return Promise.resolve(files.map(f => f.split('/').pop()!));
      }),
      readFile: jest.fn().mockImplementation((filePath: string) => {
        if (!mockFiles[filePath]) {
          return Promise.reject(new Error(`ENOENT: no such file, open '${filePath}'`));
        }
        return Promise.resolve(mockFiles[filePath]);
      }),
      stat: jest.fn().mockImplementation((path: string) => {
        if (mockStats[path] !== undefined) {
          return Promise.resolve(mockStats[path]);
        }
        return Promise.reject(new Error(`ENOENT: no such file or directory, stat '${path}'`));
      }),
    },
    __setMockFiles: (files: Record<string, string>) => {
      Object.keys(mockFiles).forEach(k => delete mockFiles[k]);
      Object.keys(mockStats).forEach(k => delete mockStats[k]);
      Object.entries(files).forEach(([filePath, content]) => {
        const normalizedPath = filePath.replace(/\\/g, '/');
        mockFiles[normalizedPath] = content;
        mockStats[normalizedPath] = { isFile: () => true };
        // Ensure parent directories exist as stats (optional, for simplicity treat as directories)
        const parts = normalizedPath.split('/');
        for (let i = 1; i < parts.length - 1; i++) {
          const dirPath = parts.slice(0, i + 1).join('/');
          if (!mockStats[dirPath]) {
            mockStats[dirPath] = { isFile: () => false };
          }
        }
        // Root directory
        const root = parts[0];
        if (!mockStats[root]) {
          mockStats[root] = { isFile: () => false };
        }
      });
    },
  };
});

jest.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
  resolve: (...args: string[]) => args.join('/'),
  sep: '/',
}));

const fs = require('fs') as typeof import('fs') & { __setMockFiles: (files: Record<string, string>) => void };

describe('ColdRetriever', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.__setMockFiles({});
  });

  describe('loadCorpus', () => {
    it('should return correct docCount and chunkCount for a valid directory with files', async () => {
      // Simulate a directory with two markdown files, each split by double newline into chunks
      fs.__setMockFiles({
        '/corpus/doc1.md': '# Doc1\n\nContent of first chunk\n\n# Second chunk\n\nEnd of doc1.',
        '/corpus/doc2.md': '# Doc2\n\nOnly one chunk here.',
      });

      const result = await coldRetriever.loadCorpus('/corpus');

      // Assuming implementation splits on double newlines:
      // doc1.md => 3 chunks, doc2.md => 1 chunk => total 4 chunks, 2 docs
      expect(result).toEqual({
        docCount: 2,
        chunkCount: 4,
      });
    });

    it('should return zero counts for an empty directory', async () => {
      fs.__setMockFiles({});
      // Even if the directory exists, no files inside
      // To make it exist, we need to set up a directory stat entry
      // The mock's readdir will return empty array if no files start with '/corpus/'
      // But we also need the directory to exist. We'll add a dummy file to create the directory entry
      fs.__setMockFiles({
        '/corpus/.keep': '', // dummy file to make directory exist, but we'll exclude hidden files? Usually readdir returns all. We'll assume it's ignored.
      });

      // However, the function might filter out dotfiles. Let's test with actual empty:
      // Reset and set only the directory entry
      fs.__setMockFiles({});
      // Since we need the directory to exist, we set a stat entry manually (not ideal)
      // Alternative: mock readdir to return [] and stat to succeed for the directory
      const fsPromises = require('fs').promises;
      fsPromises.readdir.mockResolvedValueOnce([]);
      fsPromises.stat.mockResolvedValueOnce({ isFile: () => false });

      const result = await coldRetriever.loadCorpus('/corpus');
      expect(result).toEqual({
        docCount: 0,
        chunkCount: 0,
      });
    });

    it('should reject with an error when the directory does not exist', async () => {
      // Do not set any mock files; readdir will reject
      await expect(coldRetriever.loadCorpus('/nonexistent')).rejects.toThrow();
    });

    it('should reject with an error when the path is not a directory (e.g., a file)', async () => {
      // Set up a file at the path
      fs.__setMockFiles({
        '/not-a-dir': 'file content',
      });
      // The implementation may call stat first and check isFile
      await expect(coldRetriever.loadCorpus('/not-a-dir')).rejects.toThrow();
    });

    it('should handle a directory with a large number of files without error', async () => {
      const files: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        files[`/corpus/doc${i}.txt`] = `Document ${i}\n\nChunk A\n\nChunk B`;
      }
      fs.__setMockFiles(files);
      const result = await coldRetriever.loadCorpus('/corpus');
      expect(result.docCount).toBe(100);
      // Each file has 2 double newlines => 3 chunks per file => 300
      expect(result.chunkCount).toBe(300);
    });

    it('should return docCount and chunkCount as numbers (even when zero)', async () => {
      fs.__setMockFiles({});
      // Mock directory existence
      const fsPromises = require('fs').promises;
      fsPromises.readdir.mockResolvedValueOnce([]);
      fsPromises.stat.mockResolvedValueOnce({ isFile: () => false });

      const result = await coldRetriever.loadCorpus('/empty');
      expect(typeof result.docCount).toBe('number');
      expect(typeof result.chunkCount).toBe('number');
    });
  });
});
```
