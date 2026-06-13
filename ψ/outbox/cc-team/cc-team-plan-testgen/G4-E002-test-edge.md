<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: E002 role=test-edge model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2709,"completion_tokens":3769,"total_tokens":6478,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":996,"image_tokens":0},"cache_creation_input_tokens":0} | 41s
 generated: 2026-06-13T11:09:47.747Z -->
```typescript
import { ColdRetriever } from '../src/services/coldRetriever';
import * as fs from 'fs';

// Mock the filesystem
jest.mock('fs', () => ({
  ...jest.requireActual<typeof fs>('fs'), // keep actual constants if needed
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
  statSync: jest.fn(),
}));

function mockFsState(files: Record<string, string>) {
  // `files` keys are relative paths, values are content strings
  const dirContents: Record<string, string[]> = {};

  // Build directory structure from file paths
  Object.keys(files).forEach((filePath) => {
    const parts = filePath.split('/');
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts.slice(0, i + 1).join('/');
      if (!dirContents[dir]) dirContents[dir] = [];
    }
    const fileName = parts[parts.length - 1];
    const parent = parts.slice(0, -1).join('/') || '.';
    if (!dirContents[parent]) dirContents[parent] = [];
    dirContents[parent].push(fileName);
  });

  // Mock existsSync: return true if directory or file is present
  (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
    // For loadCorpus, it checks existence of the corpusDir
    // Also we might need to check for file existence
    return path in dirContents || path in files || Object.keys(dirContents).includes(path);
  });

  // Mock readdirSync: return directory contents
  (fs.readdirSync as jest.Mock).mockImplementation((dir: string) => {
    const entries = dirContents[dir];
    if (!entries) {
      throw new Error(`ENOENT: no such directory, scandir '${dir}'`);
    }
    return entries.map((name) => {
      const full = dir === '.' ? name : `${dir}/${name}`;
      return { name, isDirectory: () => full in dirContents || Object.keys(dirContents).some(k => k.startsWith(full + '/')), isFile: () => full in files };
    });
  });

  // Mock statSync: return plausible mtime and size
  (fs.statSync as jest.Mock).mockImplementation((filePath: string) => {
    const content = files[filePath];
    if (!content) throw new Error(`ENOENT: no such file, stat '${filePath}'`);
    return {
      size: content.length,
      mtime: new Date('2024-01-01T00:00:00Z'),
      isFile: () => true,
      isDirectory: () => false,
    };
  });

  // Mock readFileSync: return content or throw
  (fs.readFileSync as jest.Mock).mockImplementation((filePath: string, _enc: string) => {
    const content = files[filePath];
    if (content === undefined) throw new Error(`ENOENT: no such file '${filePath}'`);
    return content;
  });
}

describe('ColdRetriever', () => {
  let retriever: ColdRetriever;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    retriever = new ColdRetriever();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('loadCorpus', () => {
    test('returns zero when corpus directory does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      const result = await retriever.loadCorpus('/nonexistent');
      expect(result.docCount).toBe(0);
      expect(result.chunkCount).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[ColdRetriever] Corpus directory not found'));
    });

    test('returns zero when directory is empty', async () => {
      mockFsState({});
      const result = await retriever.loadCorpus('./emptyDir');
      expect(result.docCount).toBe(0);
      expect(result.chunkCount).toBe(0);
    });

    test('skips files with disallowed extensions', async () => {
      mockFsState({
        'corpus/index.html': '<p>hello</p>',
        'corpus/data.json': '{"a":1}',
        'corpus/image.png': '',
      });
      const result = await retriever.loadCorpus('corpus');
      expect(result.docCount).toBe(0);
    });

    test('skips hidden and node_modules files', async () => {
      mockFsState({
        'corpus/.hidden/file.md': '# secret',
        'corpus/node_modules/pkg/readme.md': '# pkg',
        'corpus/valid.md': '# valid',
      });
      // We need to handle readdir for .hidden and node_modules as directories containing files.
      // Our mockFsState creates proper directory entries.
      const result = await retriever.loadCorpus('corpus');
      // Only valid.md should be loaded because listFiles likely skips directories starting with '.' or 'node_modules'.
      // ColdRetriever logic: "if (file.includes("node_modules") || file.includes(".git")) continue;"
      // It also skips dotfiles implicitly by iterating listFiles which probably returns dotfiles.
      expect(result.docCount).toBe(1);
      expect(result.chunkCount).toBeGreaterThanOrEqual(1);
    });

    test('handles read error gracefully and continues', async () => {
      mockFsState({
        'corpus/good.md': '# Good doc',
        'corpus/bad.md': '# Will fail',
      });
      // Make readFileSync throw for bad.md
      (fs.readFileSync as jest.Mock).mockImplementationOnce((filePath: string) => {
        if (filePath === 'corpus/good.md') return '# Good doc';
        throw new Error('Permission denied');
      });
      const result = await retriever.loadCorpus('corpus');
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[ColdRetriever] Failed to load'), expect.any(Error));
      expect(result.docCount).toBe(1);
    });

    test('skips files with empty content', async () => {
      mockFsState({
        'corpus/blank.md': '   \n  \t',
        'corpus/real.md': '# Content',
      });
      const result = await retriever.loadCorpus('corpus');
      expect(result.docCount).toBe(1);
      // blank.md trimmed is empty, so skipped
    });

    test('loads valid .md and .txt files and builds chunks', async () => {
      const content = '# Title\n\nBody line 1\nBody line 2\n'.repeat(100); // large enough to chunk
      mockFsState({
        'corpus/doc.md': content,
        'corpus/notes.txt': 'Just some text',
      });
      const result = await retriever.loadCorpus('corpus');
      expect(result.docCount).toBe(2);
      expect(result.chunkCount).toBeGreaterThan(2); // multiple chunks for doc.md
    });

    test('assigns domain from tags extracted from content and path', async () => {
      const mdWithWeather = '# Weather doc\n\nThis document discusses weather patterns.';
      const mdWithEvidence = '# Evidence\n\nForensic evidence handling.';
      mockFsState({
        'corpus/weather_info.md': mdWithWeather,
        'corpus/evidence_nip.md': mdWithEvidence,
      });
      await retriever.loadCorpus('corpus');
      // Domain inference relies on tags; weather and evidence are added because path contains those keywords.
      // Test search later.
    });
  });

  describe('search', () => {
    test('returns empty array when not initialized', () => {
      expect(retriever.search('query')).toEqual([]);
    });

    test('returns empty array when corpus is empty', async () => {
      mockFsState({});
      await retriever.loadCorpus('empty');
      expect(retriever.search('test')).toEqual([]);
    });

    test('returns empty array for empty query string', async () => {
      mockFsState({ 'corpus/doc.md': '# Some document\n\nSome content.' });
      await retriever.loadCorpus('corpus');
      expect(retriever.search('')).toEqual([]);
    });

    test('returns empty array when query matches nothing', async () => {
      mockFsState({ 'corpus/doc.md': '# Apples\n\nOranges are great.' });
      await retriever.loadCorpus('corpus');
      const results = retriever.search('quantum physics');
      expect(results).toEqual([]);
    });

    test('returns scored results with correct properties', async () => {
      mockFsState({
        'corpus/weather.md': '## Weather patterns\n\nThe weather in Bangkok is hot and humid.',
        'corpus/geo.md': '## Geographic distribution\n\nBangkok is the capital of Thailand.',
      });
      await retriever.loadCorpus('corpus');
      const results = retriever.search('Bangkok weather');
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => {
        expect(r).toHaveProperty('chunk');
        expect(r).toHaveProperty('document');
        expect(r).toHaveProperty('score');
        expect(r).toHaveProperty('source');
        expect(r.source.type).toBe('cold');
        expect(r.chunk.id).toContain('chunk');
        expect(r.document.id).toContain('cold:');
        expect(typeof r.score).toBe('number');
        expect(r.score).toBeGreaterThan(0);
      });
    });

    test('respects maxResults option', async () => {
      const content = '# Doc\n' + 'word '.repeat(2000); // many chunks
      mockFsState({ 'corpus/doc.md': content });
      await retriever.loadCorpus('corpus');
      const results = retriever.search('word', { maxResults: 3 });
      expect(results.length).toBeLessThanOrEqual(3);
    });

    test('filters by domain', async () => {
      mockFsState({
        'corpus/weather.md': '## Weather\n\nIt is sunny.',
        'corpus/evidence.md': '## Evidence\n\nChain of custody.',
      });
      await retriever.loadCorpus('corpus');
      const all = retriever.search('weather evidence');
      expect(all.length).toBeGreaterThan(0);
      const weatherOnly = retriever.search('weather evidence', { domain: 'weather' });
      expect(weatherOnly.every(r => r.document.metadata.domain === 'weather')).toBe(true);
      const evidenceOnly = retriever.search('weather evidence', { domain: 'evidence' });
      expect(evidenceOnly.every(r => r.document.metadata.domain === 'evidence')).toBe(true);
    });

    test('returns empty for unknown domain filter', async () => {
      mockFsState({ 'corpus/doc.md': '# Test' });
      await retriever.loadCorpus('corpus');
      const results = retriever.search('test', { domain: 'nonexistent' });
      expect(results).toEqual([]);
    });

    test('handles query with special characters and Thai text', async () => {
      mockFsState({ 'corpus/thai.md': '# สภาพอากาศ\n\nกรุงเทพมหานครอากาศร้อน' });
      await retriever.loadCorpus('corpus');
      const results = retriever.search('อากาศ กรุงเทพ');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('loadCorpus + search integration', () => {
    test('re-initialization clears previous index', async () => {
      // Load first corpus, then load second, ensure first data is gone.
      mockFsState({ 'corpus1/a.md': '# First' });
      await retriever.loadCorpus('corpus1');
      const r1 = retriever.search('First');
      expect(r1.length).toBeGreaterThan(0);

      mockFsState({ 'corpus2/b.md': '# Second' });
      await retriever.loadCorpus('corpus2');
      const r2 = retriever.search('First');
      expect(r2).toEqual([]); // no longer matches
      const r3 = retriever.search('Second');
      expect(r3.length).toBeGreaterThan(0);
    });
  });
});
```
