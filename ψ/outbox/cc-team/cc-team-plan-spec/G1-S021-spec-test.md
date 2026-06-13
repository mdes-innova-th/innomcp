<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S021 role=spec-test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":270,"completion_tokens":3265,"total_tokens":3535,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1526,"image_tokens":0},"cache_creation_input_tokens":0} | 35s
 generated: 2026-06-13T11:25:21.281Z -->
```typescript
import {
  RetrievalDecision,
  RetrievalPlan,
  RetrievalResult,
  planRetrieval,
  executeColdRetrieval,
  buildRetrievalResult,
} from '../src/services/retrievalOrchestrator';

// ---------------------------------------------------------------------------
// Mock external dependencies that the module under test relies on.
// These are assumed based on the typical roles of the functions.
// ---------------------------------------------------------------------------

jest.mock('../src/services/cacheService', () => ({
  checkHotCache: jest.fn(),
  checkColdCache: jest.fn(),
}));

jest.mock('../src/services/dataService', () => ({
  queryColdSource: jest.fn(),
}));

import { checkHotCache, checkColdCache } from '../src/services/cacheService';
import { queryColdSource } from '../src/services/dataService';

// ---------------------------------------------------------------------------
// Helper types (the module exports these, but we repeat them here for clarity)
// ---------------------------------------------------------------------------
type CacheStatus = { hotAvailable: boolean; coldAvailable: boolean };
type ColdRetrievalResult = { id: string; data: unknown };

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe('retrievalOrchestrator contract', () => {
  // -----------------------------------------------------------------------
  // planRetrieval
  // -----------------------------------------------------------------------
  describe('planRetrieval', () => {
    it('returns "hot" when only hot cache is available', () => {
      (checkHotCache as jest.Mock).mockReturnValueOnce(true);
      (checkColdCache as jest.Mock).mockReturnValueOnce(false);

      const decision = planRetrieval('some query', { hotAvailable: true, coldAvailable: false });

      expect(decision).toBe('hot');
    });

    it('returns "cold" when only cold cache is available', () => {
      (checkHotCache as jest.Mock).mockReturnValueOnce(false);
      (checkColdCache as jest.Mock).mockReturnValueOnce(true);

      const decision = planRetrieval('some query', { hotAvailable: false, coldAvailable: true });

      expect(decision).toBe('cold');
    });

    it('returns "hot+cold" when both caches are available', () => {
      (checkHotCache as jest.Mock).mockReturnValueOnce(true);
      (checkColdCache as jest.Mock).mockReturnValueOnce(true);

      const decision = planRetrieval('some query', { hotAvailable: true, coldAvailable: true });

      expect(decision).toBe('hot+cold');
    });

    it('returns "none" when no cache is available', () => {
      (checkHotCache as jest.Mock).mockReturnValueOnce(false);
      (checkColdCache as jest.Mock).mockReturnValueOnce(false);

      const decision = planRetrieval('some query', { hotAvailable: false, coldAvailable: false });

      expect(decision).toBe('none');
    });

    it('throws for an empty query string', () => {
      (checkHotCache as jest.Mock).mockReturnValueOnce(false);
      (checkColdCache as jest.Mock).mockReturnValueOnce(false);

      expect(() => planRetrieval('', { hotAvailable: false, coldAvailable: false })).toThrow(
        /query must not be empty/i
      );
    });

    it('throws for an invalid cacheStatus (missing fields)', () => {
      expect(() => planRetrieval('valid query', {})).toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // executeColdRetrieval
  // -----------------------------------------------------------------------
  describe('executeColdRetrieval', () => {
    it('returns an array of ColdRetrievalResult for a valid plan', () => {
      const mockColdData: ColdRetrievalResult[] = [
        { id: '1', data: { value: 42 } },
        { id: '2', data: { value: 99 } },
      ];
      (queryColdSource as jest.Mock).mockResolvedValueOnce(mockColdData);

      const plan: RetrievalPlan = { query: 'test', source: 'externalApi', timeout: 5000 };
      // Assuming executeColdRetrieval returns a Promise or sync? We'll treat as sync for mock.
      // For simplicity, we assume it's synchronous with a mocked async function that we make sync.
      // In real test we'd use async/await, but here we use mockReturnValue to avoid promises.
      (queryColdSource as jest.Mock).mockReturnValueOnce(mockColdData);

      const results = executeColdRetrieval(plan);

      expect(Array.isArray(results)).toBe(true);
      expect(results).toEqual(mockColdData);
      expect(queryColdSource).toHaveBeenCalledWith(plan);
    });

    it('throws when plan is missing required fields', () => {
      // Missing 'source' field
      const invalidPlan = { query: 'test' } as RetrievalPlan;
      expect(() => executeColdRetrieval(invalidPlan)).toThrow(/plan must contain a source/i);
    });

    it('throws when plan.source is empty', () => {
      const invalidPlan: RetrievalPlan = { query: 'test', source: '' };
      expect(() => executeColdRetrieval(invalidPlan)).toThrow(/source cannot be empty/i);
    });

    it('throws when queryColdSource returns an error (e.g., network failure)', () => {
      (queryColdSource as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Network timeout');
      });

      const plan: RetrievalPlan = { query: 'test', source: 'externalApi' };
      expect(() => executeColdRetrieval(plan)).toThrow('Network timeout');
    });
  });

  // -----------------------------------------------------------------------
  // buildRetrievalResult
  // -----------------------------------------------------------------------
  describe('buildRetrievalResult', () => {
    it('merges plan and cold results into a RetrievalResult', () => {
      const plan: RetrievalPlan = { query: 'test', source: 'db' };
      const coldResults: ColdRetrievalResult[] = [
        { id: 'a', data: 'resultA' },
        { id: 'b', data: 'resultB' },
      ];

      const result: RetrievalResult = buildRetrievalResult(plan, coldResults);

      expect(result).toHaveProperty('query', 'test');
      expect(result).toHaveProperty('results');
      expect(result.results).toEqual(coldResults);
      // metadata might include additional info like timestamp, count, etc.
      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toMatchObject({
        count: 2,
        source: 'db',
      });
    });

    it('returns an empty results array when coldResults is empty', () => {
      const plan: RetrievalPlan = { query: 'empty', source: 'cache' };
      const coldResults: ColdRetrievalResult[] = [];

      const result = buildRetrievalResult(plan, coldResults);

      expect(result.results).toEqual([]);
      expect(result.metadata.count).toBe(0);
    });

    it('propagates metadata from plan when provided', () => {
      const plan: RetrievalPlan = { query: 'test', source: 'api', timeout: 30 };
      const coldResults: ColdRetrievalResult[] = [{ id: '1', data: 'x' }];
      const result = buildRetrievalResult(plan, coldResults);

      expect(result.metadata).toHaveProperty('timeout', 30);
    });

    it('throws if plan is null', () => {
      expect(() => buildRetrievalResult(null as unknown as RetrievalPlan, [])).toThrow();
    });

    it('throws if coldResults is not an array', () => {
      const plan: RetrievalPlan = { query: 'test', source: 'api' };
      expect(() => buildRetrievalResult(plan, 'notArray' as unknown as ColdRetrievalResult[])).toThrow();
    });
  });
});
```
