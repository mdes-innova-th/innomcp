<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: E008 role=test-edge model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":2769,"completion_tokens":8000,"total_tokens":10769,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5655,"image_tokens":0},"cache_creation_input_tokens":0} | 88s
 generated: 2026-06-13T11:13:03.582Z -->
ONE fenced typescript code block.```typescript
jest.mock('../src/services/coldRetriever');
jest.mock('../src/services/hotRetriever', () => ({
  composeFactSummary: jest.fn(),
}));
jest.mock('../src/services/answerContract', () => ({
  buildAnswerContract: jest.fn(),
}));

import { planRetrieval, executeColdRetrieval, buildRetrievalResult } from '../src/services/retrievalOrchestrator';
import type { RetrievalPlan, RetrievalResult } from '../src/services/retrievalOrchestrator';
import { coldRetriever } from '../src/services/coldRetriever';
import { composeFactSummary } from '../src/services/hotRetriever';
import { buildAnswerContract } from '../src/services/answerContract';
import type { ColdRetrievalResult } from '../src/services/coldRetriever';
import type { RetrievalFact } from '../src/services/hotRetriever';
import type { RetrievalSource, AnswerContract, AnswerMode } from '../src/services/answerContract';
import type { SessionMemorySnapshot } from '../src/services/sessionMemory';

// Helper to create minimal RetrievalFact
function makeFact(overrides: Partial<RetrievalFact> = {}): RetrievalFact {
  return {
    source: { type: 'hot', id: 'test' } as RetrievalSource,
    ...overrides,
  } as RetrievalFact;
}

// Helper to create minimal ColdRetrievalResult
function makeColdResult(overrides: Partial<ColdRetrievalResult> = {}): ColdRetrievalResult {
  return {
    source: { type: 'cold', id: 'doc1' } as RetrievalSource,
    document: { title: 'Test Doc' },
    chunk: { content: 'This is a cold chunk' },
    ...overrides,
  } as ColdRetrievalResult;
}

// Minimal AnswerContract for reference
const dummyContract: AnswerContract = {
  route: 'test',
  toolsUsed: [],
  sources: [],
  answerMode: 'text' as AnswerMode,
  retrievalUsed: 'none',
  memoryUsed: false,
  confidence: 0.5,
  grounded: false,
};

describe('planRetrieval', () => {
  const mockIsReady = coldRetriever.isReady as jest.Mock;
  const mockSearch = coldRetriever.search as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsReady.mockReturnValue(true); // default ready
    mockSearch.mockReturnValue([]);
  });

  test('deterministic route "calculator" forces none', () => {
    const plan = planRetrieval('2+2', 'calculator');
    expect(plan.decision).toBe('none');
    expect(plan.hotDomains).toEqual([]);
    expect(plan.reason).toBe('deterministic_route');
  });

  test('deterministic route "datetime" forces none', () => {
    const plan = planRetrieval('What time is it?', 'datetime');
    expect(plan.decision).toBe('none');
    expect(plan.reason).toBe('deterministic_route');
  });

  test('empty query with no route returns none', () => {
    const plan = planRetrieval('   ');
    expect(plan.decision).toBe('none');
    expect(plan.hotDomains).toEqual([]);
    expect(plan.reason).toBe('no_retrieval_pattern');
  });

  test('explicit hot-only pattern yields hot decision', () => {
    // "ตอนนี้" matches hot patterns (contains "ตอนนี้")
    const plan = planRetrieval('ตอนนี้');
    expect(plan.decision).toBe('hot');
    expect(plan.hotDomains).toContain('general');
    expect(plan.reason).toBe('operational_live_query');
  });

  test('cold-only pattern with retriever ready yields cold decision', () => {
    mockIsReady.mockReturnValue(true);
    const plan = planRetrieval('คืออะไร');
    expect(plan.decision).toBe('cold');
    expect(plan.hotDomains).toEqual([]);
    expect(plan.coldQuery).toBe('คืออะไร');
    expect(plan.reason).toBe('documentation_policy_query');
  });

  test('cold-only pattern but retriever not ready falls back to none', () => {
    mockIsReady.mockReturnValue(false);
    const plan = planRetrieval('คืออะไร');
    // No hot patterns, no memory, decision should be none
    expect(plan.decision).toBe('none');
    expect(plan.reason).toBe('no_retrieval_pattern');
  });

  test('both cold and hot patterns present in one query yields hot+cold', () => {
    // "อากาศคืออะไร" contains "อากาศ" (hot) and "คืออะไร" (cold)
    mockIsReady.mockReturnValue(true);
    const plan = planRetrieval('อากาศคืออะไร');
    expect(plan.decision).toBe('hot+cold');
    expect(plan.coldQuery).toBeDefined();
    expect(plan.hotDomains).toContain('weather'); // inferred
    expect(plan.reason).toBe('both_patterns_detected');
  });

  test('mixed pattern (hot+cold) yields hot+cold decision', () => {
    // "สถานการณ์อธิบาย" matches MIXED_PATTERNS
    mockIsReady.mockReturnValue(true);
    const plan = planRetrieval('สถานการณ์อธิบาย');
    expect(plan.decision).toBe('hot+cold');
    expect(plan.coldQuery).toBeDefined();
    expect(plan.hotDomains).toContain('general'); // default, no explicit domain
    expect(plan.reason).toBe('mixed_hot_cold_query');
  });

  test('memory active domain "weather" triggers hot even without hot patterns', () => {
    const mem: SessionMemorySnapshot = {
      activeDomain: 'weather',
      recentEntities: [],
    } as any;
    const plan = planRetrieval('hello', undefined, mem);
    expect(plan.decision).toBe('hot');
    expect(plan.hotDomains).toEqual(['weather']);
    expect(plan.reason).toBe('memory_domain_continuation');
  });

  test('memory active domain not in hot list falls through to none', () => {
    const mem: SessionMemorySnapshot = {
      activeDomain: 'chatbot',
      recentEntities: [],
    } as any;
    const plan = planRetrieval('hello', undefined, mem);
    expect(plan.decision).toBe('none');
    expect(plan.reason).toBe('no_retrieval_pattern');
  });

  test('route that maps to hot domain triggers hot retrieval', () => {
    const plan = planRetrieval('', 'weather');
    expect(plan.decision).toBe('hot');
    expect(plan.hotDomains).toEqual(['weather']);
    expect(plan.reason).toBe('operational_live_query');
  });
});

describe('executeColdRetrieval', () => {
  const mockIsReady = coldRetriever.isReady as jest.Mock;
  const mockSearch = coldRetriever.search as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsReady.mockReturnValue(true);
    mockSearch.mockReturnValue([]);
  });

  test('returns empty array for plan with decision "none"', () => {
    const plan: RetrievalPlan = { decision: 'none', hotDomains: [], reason: 'test' };
    expect(executeColdRetrieval(plan)).toEqual([]);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  test('returns empty array for plan with decision "hot"', () => {
    const plan: RetrievalPlan = { decision: 'hot', hotDomains: [], reason: 'test' };
    expect(executeColdRetrieval(plan)).toEqual([]);
  });

  test('returns empty array when coldQuery is missing', () => {
    const plan: RetrievalPlan = { decision: 'cold', hotDomains: [], reason: 'test' };
    expect(executeColdRetrieval(plan)).toEqual([]);
  });

  test('returns empty array when retriever is not ready', () => {
    mockIsReady.mockReturnValue(false);
    const plan: RetrievalPlan = { decision: 'cold', hotDomains: [], coldQuery: 'test', reason: 'test' };
    expect(executeColdRetrieval(plan)).toEqual([]);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  test('calls search with coldQuery and maxResults when ready and decision is "cold"', () => {
    const results = [makeColdResult()];
    mockSearch.mockReturnValue(results);
    const plan: RetrievalPlan = { decision: 'cold', hotDomains: [], coldQuery: 'explain', reason: 'test' };
    expect(executeColdRetrieval(plan)).toBe(results);
    expect(mockSearch).toHaveBeenCalledWith('explain', { maxResults: 3 });
  });

  test('handles "hot+cold" decision with coldQuery', () => {
    const results = [makeColdResult()];
    mockSearch.mockReturnValue(results);
    const plan: RetrievalPlan = { decision: 'hot+cold', hotDomains: [], coldQuery: 'compare', reason: 'test' };
    expect(executeColdRetrieval(plan)).toBe(results);
    expect(mockSearch).toHaveBeenCalledWith('compare', { maxResults: 3 });
  });
});

describe('buildRetrievalResult', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (composeFactSummary as jest.Mock).mockReturnValue('mock hot summary');
    (buildAnswerContract as jest.Mock).mockReturnValue(dummyContract);
  });

  const meta = {
    route: 'test',
    toolsUsed: [],
    answerMode: 'text' as AnswerMode,
    memoryUsed: false,
    grounded: false,
    confidence: 0.5,
  };

  test('empty hot and cold facts produce none retrieval and summary with only hot summary', () => {
    const plan: RetrievalPlan = { decision: 'none', hotDomains: [], reason: 'no' };
    const result = buildRetrievalResult(plan, [], [], meta);
    expect(result.sources).toEqual([]);
    expect(result.contract.retrievalUsed).toBe('none');
    expect(result.factSummary).toBe('mock hot summary');
    expect(composeFactSummary).toHaveBeenCalledWith([]);
    expect(buildAnswerContract).toHaveBeenCalled();
  });

  test('only hot facts produce "hot" retrieval and include
