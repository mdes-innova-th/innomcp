<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T002 role=test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1253,"completion_tokens":3945,"total_tokens":5198,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2648,"image_tokens":0},"cache_creation_input_tokens":0} | 74s
 generated: 2026-06-13T10:51:43.263Z -->
```typescript
import { buildAnswerContract, RetrievalSource } from '../src/services/answerContract';

describe('answerContract', () => {
  const fixedDate = new Date('2024-01-01T12:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedDate);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createSource = (overrides: Partial<RetrievalSource>): RetrievalSource => ({
    id: 'src-1',
    type: 'document',
    name: 'Test Doc',
    freshness: 'stale',
    timestamp: fixedDate.toISOString(),
    confidence: 0.9,
    ...overrides,
  });

  test('builds basic contract with default freshness and degraded state', () => {
    const contract = buildAnswerContract({
      route: '/test',
      toolsUsed: [],
      sources: [],
      answerMode: 'llm-only',
      retrievalUsed: 'none',
      memoryUsed: false,
      confidence: 0.8,
      grounded: false,
    });

    expect(contract.timestamp).toBe(fixedDate.toISOString());
    expect(contract.freshness).toBe('stale');
    expect(contract.degraded).toBe(false);
    expect(contract.hotSources).toBeUndefined();
    expect(contract.coldSources).toBeUndefined();
  });

  test('sets freshness to live for deterministic mode with no sources', () => {
    const contract = buildAnswerContract({
      route: '/test',
      toolsUsed: [],
      sources: [],
      answerMode: 'deterministic',
      retrievalUsed: 'none',
      memoryUsed: false,
      confidence: 1.0,
      grounded: true,
    });

    expect(contract.freshness).toBe('live');
  });

  test('computes mixed freshness when sources have live and stale', () => {
    const sources = [
      createSource({ id: '1', freshness: 'live' }),
      createSource({ id: '2', freshness: 'stale' }),
    ];

    const contract = buildAnswerContract({
      route: '/test',
      toolsUsed: [],
      sources,
      answerMode: 'hybrid',
      retrievalUsed: 'both',
      memoryUsed: false,
      confidence: 0.9,
      grounded: true,
    });

    expect(contract.freshness).toBe('mixed');
  });

  test('computes live freshness when all sources are live', () => {
    const sources = [createSource({ id: '1', freshness: 'live' })];

    const contract = buildAnswerContract({
      route: '/test',
      toolsUsed: [],
      sources,
      answerMode: 'hybrid',
      retrievalUsed: 'hot',
      memoryUsed: false,
      confidence: 0.9,
      grounded: true,
    });

    expect(contract.freshness).toBe('live');
  });

  test('computes recent freshness when sources are recent and stale', () => {
    const sources = [
      createSource({ id: '1', freshness: 'recent' }),
      createSource({ id: '2', freshness: 'stale' }),
    ];

    const contract = buildAnswerContract({
      route: '/test',
      toolsUsed: [],
      sources,
      answerMode: 'hybrid',
      retrievalUsed: 'both',
      memoryUsed: false,
      confidence: 0.9,
      grounded: true,
    });

    expect(contract.freshness).toBe('recent');
  });

  test('correctly categorizes hot and cold sources', () => {
    const sources = [
      createSource({ id: '1', type: 'tool' }),
      createSource({ id: '2', type: 'api' }),
      createSource({ id: '3', type: 'database' }),
      createSource({ id: '4', type: 'document' }),
    ];

    const contract = buildAnswerContract({
      route: '/test',
      toolsUsed: ['tool1'],
      sources,
      answerMode: 'hybrid',
      retrievalUsed: 'both',
      memoryUsed: true,
      memoryEntities: ['entity1'],
      confidence: 0.95,
      grounded: true,
    });

    expect(contract.hotSources).toHaveLength(3);
    expect(contract.hotSources?.map(s => s.id)).toEqual(['1', '2', '3']);
    expect(contract.coldSources).toHaveLength(1);
    expect(contract.coldSources?.[0].id).toBe('4');
    expect(contract.memoryUsed).toBe(true);
    expect(contract.memoryEntities).toEqual(['entity1']);
  });

  test('handles degraded state and fallback reasons', () => {
    const contract = buildAnswerContract({
      route: '/test',
      toolsUsed: [],
      sources: [],
      answerMode: 'llm-only',
      retrievalUsed: 'none',
      memoryUsed: false,
      confidence: 0.5,
      grounded: false,
      fallbackReason: 'No tools available',
      degraded: true,
      degradedReasons: ['Tool timeout', 'DB unreachable'],
      latencyMs: 1500,
    });

    expect(contract.degraded).toBe(true);
    expect(contract.degradedReasons).toEqual(['Tool timeout', 'DB unreachable']);
    expect(contract.fallbackReason).toBe('No tools available');
    expect(contract.latencyMs).toBe(1500);
  });
});
```
