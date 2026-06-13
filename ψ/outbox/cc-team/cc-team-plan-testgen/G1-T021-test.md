<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T021 role=test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2740,"completion_tokens":4897,"total_tokens":7637,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2048,"image_tokens":0},"cache_creation_input_tokens":0} | 47s
 generated: 2026-06-13T10:55:01.251Z -->
```typescript
import {
  planRetrieval,
  executeColdRetrieval,
  buildRetrievalResult,
} from '../src/services/retrievalOrchestrator';
import { coldRetriever } from '../src/services/coldRetriever';
import { composeFactSummary } from '../src/services/hotRetriever';
import { buildAnswerContract } from '../src/services/answerContract';
import { RetrievalFact } from '../src/services/hotRetriever';
import { ColdRetrievalResult } from '../src/services/coldRetriever';
import { AnswerContract } from '../src/services/answerContract';
import { RetrievalSource } from '../src/services/answerContract';
import { RetrievalPlan, RetrievalResult } from '../src/services/retrievalOrchestrator';

jest.mock('../src/services/coldRetriever', () => {
  const actual = jest.requireActual('../src/services/coldRetriever');
  return {
    ...actual,
    coldRetriever: {
      isReady: jest.fn(),
      search: jest.fn(),
    },
  };
});

jest.mock('../src/services/hotRetriever', () => {
  const actual = jest.requireActual('../src/services/hotRetriever');
  return {
    ...actual,
    composeFactSummary: jest.fn(),
  };
});

jest.mock('../src/services/answerContract', () => {
  const actual = jest.requireActual('../src/services/answerContract');
  return {
    ...actual,
    buildAnswerContract: jest.fn(),
  };
});

const mockedColdRetriever = coldRetriever as {
  isReady: jest.MockedFunction<() => boolean>;
  search: jest.MockedFunction<(query: string, opts: { maxResults: number }) => ColdRetrievalResult[]>;
};

const mockedComposeFactSummary = composeFactSummary as jest.MockedFunction<
  (facts: RetrievalFact[]) => string
>;

const mockedBuildAnswerContract = buildAnswerContract as jest.MockedFunction<
  (params: Record<string, unknown>) => AnswerContract
>;

function mockColdResult(
  title: string,
  content: string,
  source: RetrievalSource = 'cold_docs' as RetrievalSource
): ColdRetrievalResult {
  return {
    source,
    document: { title },
    chunk: { content },
  } as ColdRetrievalResult;
}

function mockHotFact(source: RetrievalSource = 'weather' as RetrievalSource): RetrievalFact {
  return {
    source,
    domain: 'weather',
    summary: 'mock fact',
    timestamp: Date.now(),
    entities: [],
    confidence: 1,
  } as RetrievalFact;
}

describe('planRetrieval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns none for calculator route', () => {
    const plan = planRetrieval('2+2', 'calculator');
    expect(plan.decision).toBe('none');
    expect(plan.hotDomains).toEqual([]);
    expect(plan.reason).toBe('deterministic_route');
  });

  test('returns none for datetime route', () => {
    const plan = planRetrieval('what time is it', 'datetime');
    expect(plan.decision).toBe('none');
    expect(plan.reason).toBe('deterministic_route');
  });

  test('returns hot+cold for mixed pattern query', () => {
    const plan = planRetrieval('เปรียบเทียบอากาศวันนี้กับอธิบายนโยบาย');
    expect(plan.decision).toBe('hot+cold');
    expect(plan.hotDomains.length).toBeGreaterThan(0);
    expect(plan.coldQuery).toBeDefined();
    expect(plan.reason).toBe('mixed_hot_cold_query');
  });

  test('returns hot+cold when both hot and cold patterns present', () => {
    const plan = planRetrieval('อุณหภูมิตอนนี้คืออะไร');
    expect(plan.decision).toBe('hot+cold');
    expect(plan.reason).toBe('both_patterns_detected');
  });

  test('returns cold when only cold pattern and cold retriever ready', () => {
    mockedColdRetriever.isReady.mockReturnValue(true);
    const plan = planRetrieval('นโยบายเกี่ยวกับอะไร');
    expect(plan.decision).toBe('cold');
    expect(plan.coldQuery).toBe('นโยบายเกี่ยวกับอะไร');
    expect(plan.reason).toBe('documentation_policy_query');
  });

  test('returns none when only cold pattern but cold retriever not ready', () => {
    mockedColdRetriever.isReady.mockReturnValue(false);
    const plan = planRetrieval('นโยบายคืออะไร');
    expect(plan.decision).toBe('none');
    expect(plan.reason).toBe('no_retrieval_pattern');
  });

  test('returns hot for operational hot pattern', () => {
    const plan = planRetrieval('อากาศวันนี้เป็นอย่างไร');
    expect(plan.decision).toBe('hot');
    expect(plan.hotDomains).toContain('weather');
    expect(plan.reason).toBe('operational_live_query');
  });

  test('returns hot for route based operational domain', () => {
    const plan = planRetrieval('something', 'weather');
    expect(plan.decision).toBe('hot');
    expect(plan.hotDomains).toContain('weather');
    expect(plan.reason).toBe('operational_live_query');
  });

  test('returns hot based on memory domain continuation', () => {
    const memory = { activeDomain: 'evidence' as RetrievalSource }; // rough cast
    const plan = planRetrieval('something else', undefined, memory as any);
    expect(plan.decision).toBe('hot');
    expect(plan.hotDomains).toEqual(['evidence']);
    expect(plan.reason).toBe('memory_domain_continuation');
  });

  test('defaults to none for unrecognized query', () => {
    mockedColdRetriever.isReady.mockReturnValue(false);
    const plan = planRetrieval('hello world');
    expect(plan.decision).toBe('none');
    expect(plan.hotDomains).toEqual([]);
    expect(plan.reason).toBe('no_retrieval_pattern');
  });

  test('infers hot domains from query keywords', () => {
    const plan = planRetrieval('อากาศวันนี้และ url ผิดกฎหมาย');
    expect(plan.decision).toBe('hot');
    expect(plan.hotDomains).toEqual(
      expect.arrayContaining(['weather', 'evidence'])
    );
  });
});

describe('executeColdRetrieval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns empty when plan decision is hot', () => {
    const plan: RetrievalPlan = {
      decision: 'hot',
      hotDomains: ['weather'],
      reason: 'test',
    };
    expect(executeColdRetrieval(plan)).toEqual([]);
    expect(mockedColdRetriever.search).not.toHaveBeenCalled();
  });

  test('returns empty when plan has coldQuery but cold retriever not ready', () => {
    mockedColdRetriever.isReady.mockReturnValue(false);
    const plan: RetrievalPlan = {
      decision: 'cold',
      hotDomains: [],
      coldQuery: 'test query',
      reason: 'test',
    };
    expect(executeColdRetrieval(plan)).toEqual([]);
    expect(mockedColdRetriever.search).not.toHaveBeenCalled();
  });

  test('calls cold retriever search when cold decision and ready', () => {
    mockedColdRetriever.isReady.mockReturnValue(true);
    const results = [mockColdResult('Doc1', 'content')];
    mockedColdRetriever.search.mockReturnValue(results);
    const plan: RetrievalPlan = {
      decision: 'cold',
      hotDomains: [],
      coldQuery: 'explain policy',
      reason: 'test',
    };
    const output = executeColdRetrieval(plan);
    expect(mockedColdRetriever.search).toHaveBeenCalledWith('explain policy', {
      maxResults: 3,
    });
    expect(output).toEqual(results);
  });

  test('calls cold retriever for hot+cold decision', () => {
    mockedColdRetriever.isReady.mockReturnValue(true);
    const results = [mockColdResult('A', 'b')];
    mockedColdRetriever.search.mockReturnValue(results);
    const plan: RetrievalPlan = {
      decision: 'hot+cold',
      hotDomains: ['weather'],
      coldQuery: 'explain policy',
      reason: 'mixed',
    };
    const output = executeColdRetrieval(plan);
    expect(output).toEqual(results);
  });

  test('returns empty when no coldQuery', () => {
    mockedColdRetriever.isReady.mockReturnValue(true);
    const plan: RetrievalPlan = {
      decision: 'cold',
      hotDomains: [],
      reason: 'no query',
    };
    expect(executeColdRetrieval(plan)).toEqual([]);
  });
});

describe('buildRetrievalResult', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedComposeFactSummary.mockReturnValue('hot summary');
    mockedBuildAnswerContract.mockReturnValue({
      contractId: 'test',
      route: 'weather',
      toolsUsed: [],
      sources: [],
      answerMode: 'direct',
      retrievalUsed: 'none',
      memoryUsed: false,
      confidence: 1,
      grounded: true,
    } as unknown as AnswerContract);
  });

  const meta = {
    route: 'weather',
    toolsUsed: [],
    answerMode: 'direct' as any,
    memoryUsed: false,
    grounded: true,
    confidence: 1,
  };

  test('combines hot and cold summaries correctly', () => {
    const hotFacts = [mockHotFact()];
    const coldResults = [
      mockColdResult('Doc A', 'content a'),
      mockColdResult('Doc B', 'content b'),
    ];
    const plan: RetrievalPlan = {
      decision: 'hot+cold',
      hotDomains: ['weather'],
      coldQuery: 'query',
      reason: 'test',
    };

    const result = buildRetrievalResult(plan, hotFacts, coldResults, meta);

    expect(mockedComposeFactSummary).toHaveBeenCalledWith(hotFacts);
    expect(result.factSummary).toBe(
      'hot summary\n\n---\n\n[doc:Doc A] content a\n\n[doc:Doc B] content b'
    );
    expect(result.hotFacts).toEqual(hotFacts);
    expect(result.coldResults).toEqual(coldResults);
    expect(result.sources).toEqual([
      'weather' as RetrievalSource,
      'cold_docs' as RetrievalSource,
      'cold_docs' as RetrievalSource,
    ]);
    expect(result.contract).toBeDefined();
    expect(mockedBuildAnswerContract).toHaveBeenCalledWith(
      expect.objectContaining({
        retrievalUsed: 'both',
      })
    );
  });

  test('handles only hot facts', () => {
    const hotFacts = [mockHotFact()];
    const plan: RetrievalPlan = {
      decision: 'hot',
      hotDomains: ['weather'],
      reason: 'test',
    };

    const result = buildRetrievalResult(plan, hotFacts, [], meta);

    expect(result.factSummary).toBe('hot summary');
    expect(result.sources).toEqual(['weather' as RetrievalSource]);
    expect(mockedBuildAnswerContract).toHaveBeenCalledWith(
      expect.objectContaining({ retrievalUsed: 'hot' })
    );
  });

  test('handles only cold results', () => {
    const coldResults = [mockColdResult('Doc X', 'cold content')];
    const plan: RetrievalPlan = {
      decision: 'cold',
      hotDomains: [],
      reason: 'test',
    };

    const result = buildRetrievalResult(plan, [], coldResults, meta);

    expect(result.factSummary).toBe('[doc:Doc X] cold content');
    expect(result.sources).toEqual(['cold_docs' as RetrievalSource]);
    expect(mockedBuildAnswerContract).toHaveBeenCalledWith(
      expect.objectContaining({ retrievalUsed: 'cold' })
    );
  });

  test('passes down degraded and latency meta', () => {
    const degradedMeta = {
      ...meta,
      degraded: true,
      degradedReasons: ['fallback'],
      latencyMs: 150,
    };
    const plan: RetrievalPlan = { decision: 'none', hotDomains: [], reason: '' };
    const result = buildRetrievalResult(plan, [], [], degradedMeta);
    expect(mockedBuildAnswerContract).toHaveBeenCalledWith(
      expect.objectContaining({
        degraded: true,
        degradedReasons: ['fallback'],
        latencyMs: 150,
      })
    );
  });
});
```
