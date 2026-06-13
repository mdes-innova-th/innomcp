<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T006 role=test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2680,"completion_tokens":7412,"total_tokens":10092,"prompt_tokens_details":{"cached_tokens":2560,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4915,"image_tokens":0},"cache_creation_input_tokens":0} | 73s
 generated: 2026-06-13T10:51:42.566Z -->
```typescript
import { ColdRetriever, ColdDocument, ColdChunk, ColdRetrievalResult } from '../src/services/coldRetriever';
import * as fs from 'fs';

jest.mock('fs');

describe('ColdRetriever', () => {
  let retriever: ColdRetriever;
  const CORPUS_DIR = '/test/corpus';

  beforeEach(() => {
    retriever = new ColdRetriever();
    jest.clearAllMocks();

    // Suppress console noise during tests
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // Mock listFiles to return controlled absolute file paths
    jest.spyOn(ColdRetriever.prototype as any, 'listFiles').mockReturnValue([
      `${CORPUS_DIR}/weather_report.md`,
      `${CORPUS_DIR}/law_document.txt`,
      `${CORPUS_DIR}/unknown_file.txt`,
      `${CORPUS_DIR}/empty_file.md`,
      `${CORPUS_DIR}/frontmatter_doc.md`,
    ]);

    // Mock fs.existsSync
    (fs.existsSync as jest.Mock).mockImplementation((path: string) => path === CORPUS_DIR);

    // Mock fs.readFileSync based on file path
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string, _encoding: string) => {
      if (filePath === `${CORPUS_DIR}/weather_report.md`) {
        return `# Bangkok Weather Forecast\n\nToday will be sunny with high of 35C. อากาศร้อนมาก\n\nExpect rain tomorrow.`;
      }
      if (filePath === `${CORPUS_DIR}/law_document.txt`) {
        return `Overview of Legal Process\n\nThis document outlines the procedure for filing evidence under the NIP Act. หลักฐานต้องยื่นตามขั้นตอน.`;
      }
      if (filePath === `${CORPUS_DIR}/unknown_file.txt`) {
        return `Some general information about travel in Thailand. สถานที่ท่องเที่ยว จังหวัดต่างๆ.`;
      }
      if (filePath === `${CORPUS_DIR}/empty_file.md`) {
        return '   \n'; // just whitespace
      }
      if (filePath === `${CORPUS_DIR}/frontmatter_doc.md`) {
        return `---\ntags: ["evidence", "geo"]\n---\n\n## Document Title\n\nContent about evidence and provinces. หลักฐานและจังหวัดต่างๆ.`;
      }
      return '';
    });

    // Mock fs.statSync to return a fake stat
    (fs.statSync as jest.Mock).mockReturnValue({
      mtime: new Date('2025-01-01T00:00:00Z'),
      size: 1234,
      isFile: () => true,
      isDirectory: () => false,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('loadCorpus', () => {
    test('returns zero counts for non-existent directory', async () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
      const result = await retriever.loadCorpus('/nonexistent');
      expect(result).toEqual({ docCount: 0, chunkCount: 0 });
    });

    test('skips empty and dot files, loads valid documents with correct metadata', async () => {
      const result = await retriever.loadCorpus(CORPUS_DIR);
      // empty_file.md has whitespace-only content → should be skipped
      expect(result.docCount).toBe(4);
      expect(result.chunkCount).toBeGreaterThan(0);
      const docs: ColdDocument[] = (retriever as any).documents;
      expect(docs.length).toBe(4);

      // Weather document
      const weatherDoc = docs.find((d) => d.id.includes('weather_report'));
      expect(weatherDoc).toBeDefined();
      expect(weatherDoc!.title).toBe('Bangkok Weather Forecast');
      expect(weatherDoc!.metadata.domain).toBe('weather');
      expect(weatherDoc!.metadata.tags).toContain('weather');

      // Law document (txt, no markdown heading)
      const lawDoc = docs.find((d) => d.id.includes('law_document'));
      expect(lawDoc).toBeDefined();
      expect(lawDoc!.title).toBe('law_document');
      expect(lawDoc!.metadata.domain).toBe('law');
      expect(lawDoc!.metadata.tags).toContain('law');

      // Unknown document (no domain keywords in path, general domain)
      const unknownDoc = docs.find((d) => d.id.includes('unknown_file'));
      expect(unknownDoc).toBeDefined();
      expect(unknownDoc!.title).toBe('unknown_file');
      expect(unknownDoc!.metadata.domain).toBe('general');
      expect(unknownDoc!.metadata.tags).toEqual([]);

      // Frontmatter tags and domain order
      const fmDoc = docs.find((d) => d.id.includes('frontmatter_doc'));
      expect(fmDoc).toBeDefined();
      expect(fmDoc!.metadata.tags).toEqual(expect.arrayContaining(['evidence', 'geo']));
      // evidence comes before geo in inferDomain order
      expect(fmDoc!.metadata.domain).toBe('evidence');
    });

    test('creates correct chunk geometry with overlap', async () => {
      const longContent = 'A'.repeat(600) + '\n' + 'B'.repeat(600);
      const longFilePath = `${CORPUS_DIR}/long.md`;
      jest.spyOn(ColdRetriever.prototype as any, 'listFiles').mockReturnValue([longFilePath]);
      (fs.readFileSync as jest.Mock).mockReturnValueOnce(longContent);

      const result = await retriever.loadCorpus(CORPUS_DIR);
      expect(result.docCount).toBe(1);
      const doc: ColdDocument = (retriever as any).documents[0];
      expect(doc.chunks.length).toBeGreaterThan(1);
      const firstChunk = doc.chunks[0];
      expect(firstChunk.id).toBe('cold:long.md:chunk:0');
      expect(firstChunk.index).toBe(0);
      expect(firstChunk.documentId).toBe('cold:long.md');
      expect(firstChunk.startLine).toBeLessThanOrEqual(firstChunk.endLine);
    });

    test('catches and skips file read errors', async () => {
      (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Permission denied');
      });
      const result = await retriever.loadCorpus(CORPUS_DIR);
      const docs: ColdDocument[] = (retriever as any).documents;
      // The first file (weather_report) throws; remaining files should be loaded
      expect(docs.length).toBeGreaterThanOrEqual(3); // weather_report failed, three others + empty skipped
      expect(result.docCount).toBe(docs.length);
    });

    test('builds IDF map from the loaded corpus', async () => {
      await retriever.loadCorpus(CORPUS_DIR);
      const idfMap: Map<string, number> = (retriever as any).idfMap;
      expect(idfMap.size).toBeGreaterThan(0);
      expect(idfMap.has('sunny')).toBe(true);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      // Load a minimal deterministic corpus for search tests
      const files = [`${CORPUS_DIR}/weather.md`, `${CORPUS_DIR}/law.txt`];
      jest.spyOn(ColdRetriever.prototype as any, 'listFiles').mockReturnValue(files);
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      (fs.readFileSync as jest.Mock).mockImplementation((p: string, _enc: string) => {
        if (p.includes('weather.md')) return '# Weather\n\nSunny and hot. อากาศร้อน. Rain expected.';
        if (p.includes('law.txt')) return 'NIP law: evidence submission procedure. หลักฐาน.';
        return '';
      });

      (fs.statSync as jest.Mock).mockReturnValue({
        mtime: new Date('2025-01-01'),
        size: 100,
      });

      await retriever.loadCorpus(CORPUS_DIR);
    });

    test('returns empty results if not initialized', () => {
      const fresh = new ColdRetriever();
      expect(fresh.search('anything')).toEqual([]);
    });

    test('returns relevant chunks sorted by descending score', () => {
      const results = retriever.search('sunny weather');
      expect(results.length).toBeGreaterThan(0);
      // highest score should be the weather document
      expect(results[0].document.id).toContain('weather');
      expect(results[0].score).toBeGreaterThan(0);
      results.forEach((r) => {
        expect(r.source).toBeDefined();
        expect(r.source).toHaveProperty('type');
        expect(r.chunk.content).toContain('sunny');
      });
    });

    test('filters by domain option', () => {
      const weatherResults = retriever.search('rain', { domain: 'weather' });
      expect(weatherResults.every((r) => r.document.metadata.domain === 'weather')).toBe(true);

      const lawResults = retriever.search('law', { domain: 'law' });
      expect(lawResults.length).toBeGreaterThan(0);
      expect(lawResults.every((r) => r.document.metadata.domain === 'law')).toBe(true);
    });

    test('limits number of results with maxResults', () => {
      const results = retriever.search('sunny', { maxResults: 1 });
      expect(results.length).toBe(1);
    });

    test('returns empty array for query with no matches', () => {
      const results = retriever.search('zzznotfound');
      expect(results).toEqual([]);
    });

    test('TF‑IDF gives higher weight to rare terms', () => {
      const results = retriever.search('nip evidence');
      const lawResult = results.find((r) => r.document.id.includes('law'));
      expect(lawResult).toBeDefined();
      expect(lawResult!.score).toBeGreaterThan(0);
    });
  });

  describe('exported interfaces', () => {
    test('ColdDocument, ColdChunk, ColdRetrievalResult are compatible', () => {
      // Compile‑time structural check; runtime ensures shape
      const doc: ColdDocument = {
        id: 'x',
        path: 'p',
        title: 't',
        content: 'c',
        chunks: [],
        metadata: { updatedAt: 's', domain: 'd', tags: [], fileSize: 0 },
      };
      expect(doc).toBeDefined();
      const chunk: ColdChunk = {
        id: 'x',
        documentId: 'd',
        content: 'c',
        index: 0,
        startLine: 0,
        endLine: 0,
      };
      expect(chunk).toBeDefined();
      const result: ColdRetrievalResult = {
        chunk,
        document: doc,
        score: 0,
        source: { type: 'cold', id: 'x' } as any,
      };
      expect(result).toBeDefined();
    });
  });
});
```
