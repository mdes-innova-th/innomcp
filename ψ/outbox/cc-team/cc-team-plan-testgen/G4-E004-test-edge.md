<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: E004 role=test-edge model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2236,"completion_tokens":4586,"total_tokens":6822,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1720,"image_tokens":0},"cache_creation_input_tokens":0} | 50s
 generated: 2026-06-13T11:10:57.386Z -->
```typescript
import {
  normalizeWeatherFacts,
  normalizeEvidenceFacts,
  normalizeDeterministicFact,
  mergeRetrievalFacts,
  composeFactSummary,
  RetrievalFact,
} from '../src/services/hotRetriever';

describe('hotRetriever', () => {
  const FIXED_ISO = '2025-01-20T00:00:00.000Z';

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(FIXED_ISO));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------- normalizeWeatherFacts --------------------
  describe('normalizeWeatherFacts', () => {
    test('returns empty array for falsy toolResult: null / undefined', () => {
      expect(normalizeWeatherFacts(null, 'query')).toEqual([]);
      expect(normalizeWeatherFacts(undefined, 'query')).toEqual([]);
      expect(normalizeWeatherFacts(0, 'query')).toEqual([]);
    });

    test('returns empty array when toolResult has no usable data structure', () => {
      expect(normalizeWeatherFacts({ result: 'justAString' }, 'query')).toEqual([]);
      expect(normalizeWeatherFacts({ result: 42 }, 'query')).toEqual([]);
      expect(normalizeWeatherFacts({ result: null }, 'query')).toEqual([]);
      expect(normalizeWeatherFacts({ result: false }, 'query')).toEqual([]);
    });

    test('handles empty array in result', () => {
      const result = normalizeWeatherFacts({ result: [] }, 'rain in กรุงเทพ');
      expect(result).toEqual([]);
    });

    test('normalises array of items with province/location and uses "unknown" fallback', () => {
      const items = [
        { province: 'กรุงเทพ', temp: 35 },
        { location: 'เชียงใหม่', humidity: 70 },
        { other: 'noLoc' }, // missing province and location
      ];
      const facts = normalizeWeatherFacts({ result: items }, 'weather in ภาคเหนือ');

      expect(facts).toHaveLength(3);

      expect(facts[0].id).toMatch(/^hot:weather:\d+$/);
      expect(facts[0].domain).toBe('weather');
      expect(facts[0].source.name).toBe('weatherPipeline');
      expect(facts[0].source.freshness).toBe('live');
      expect(facts[0].timestamp).toBe(FIXED_ISO);
      expect(facts[0].confidence).toBe(0.9);
      expect(facts[0].entities).toContain('กรุงเทพ');
      expect(facts[0].raw).toEqual(items[0]);

      expect(facts[1].entities).toContain('เชียงใหม่');
      expect(facts[1].raw).toEqual(items[1]);

      // missing location -> "unknown"
      expect(facts[2].entities).toContain('unknown');
      expect(facts[2].raw).toEqual(items[2]);
    });

    test('normalises a single object result (not array)', () => {
      const single = { province: 'ภูเก็ต', condition: 'sunny' };
      const facts = normalizeWeatherFacts({ result: single }, 'weather ภูเก็ต');

      expect(facts).toHaveLength(1);
      expect(facts[0].entities).toContain('ภูเก็ต');
      expect(facts[0].content).toBe(JSON.stringify(single));
      expect(facts[0].raw).toBe(single);
    });

    test('extracts entities only from query, not from data', () => {
      // Use query with multiple provinces and a region
      const facts = normalizeWeatherFacts(
        { data: [{ province: 'เชียงราย' }] },
        'weather เชียงใหม่ ภาคใต้'
      );
      // data has province "เชียงราย" but entities come from query by extractWeatherEntities
      expect(facts[0].entities).toEqual(expect.arrayContaining(['เชียงใหม่', 'ภาคใต้']));
      // province in data is not extracted extra – only from query
    });

    test('content truncation is NOT applied (left to consumer)', () => {
      // The function itself does not truncate; composeFactSummary does.
      const longItem = { province: 'ขอนแก่น', desc: 'x'.repeat(1000) };
      const facts = normalizeWeatherFacts({ result: [longItem] }, 'ขอนแก่น');
      expect(facts[0].content.length).toBeGreaterThan(1000);
    });

    test('works with toolResult the whole payload when no .result/.data', () => {
      const rawArray = [{ province: 'น่าน', value: 22 }];
      const facts = normalizeWeatherFacts(rawArray, 'น่าน');
      expect(facts).toHaveLength(1);
      expect(facts[0].entities).toContain('น่าน');
    });
  });

  // -------------------- normalizeEvidenceFacts --------------------
  describe('normalizeEvidenceFacts', () => {
    test('returns empty array for falsy toolResult', () => {
      expect(normalizeEvidenceFacts(null, 'outage ais')).toEqual([]);
      expect(normalizeEvidenceFacts(undefined, 'dtac problem')).toEqual([]);
    });

    test('extracts ISP from query (case-insensitive) and falls back to "all"', () => {
      const result = { data: 'outage report' };
      const factWithISP = normalizeEvidenceFacts(result, 'AIS down');
      expect(factWithISP).toHaveLength(1);
      expect(factWithISP[0].entities).toContain('AIS');
      expect(factWithISP[0].source.id).toContain('evidenceTool:AIS');

      const factNoISP = normalizeEvidenceFacts(result, 'internet slow');
      expect(factNoISP[0].entities).toContain('all');
      expect(factNoISP[0].source.id).toContain('evidenceTool:all');
    });

    test('handles multiple ISP references by taking the first match', () => {
      const facts = normalizeEvidenceFacts({ result: 'info' }, 'true and dtac coverage');
      expect(facts[0].entities).toContain('TRUE');
      expect(facts[0].source.id).toContain('evidenceTool:TRUE');
    });

    test('normalises when data is a string', () => {
      const facts = normalizeEvidenceFacts({ result: 'raw text' }, '3bb status');
      expect(facts).toHaveLength(1);
      expect(facts[0].content).toBe('raw text');
      expect(facts[0].raw).toBe('raw text');
    });

    test('uses whole toolResult when no .result/.data property', () => {
      const facts = normalizeEvidenceFacts({ key: 'value' }, 'tot');
      expect(facts).toHaveLength(1);
      expect(facts[0].content).toBe(JSON.stringify({ key: 'value' }));
    });

    test('confidence is always 0.95', () => {
      const facts = normalizeEvidenceFacts({ result: 'x' }, 'ais');
      expect(facts[0].confidence).toBe(0.95);
    });
  });

  // -------------------- normalizeDeterministicFact --------------------
  describe('normalizeDeterministicFact', () => {
    test('creates a fact with confidence 1.0 and proper string casting', () => {
      const fact = normalizeDeterministicFact('calculator', 'calcTool', 42, '2+2');
      expect(fact.domain).toBe('calculator');
      expect(fact.source.name).toBe('calcTool');
      expect(fact.source.type).toBe('tool');
      expect(fact.source.confidence).toBe(1.0);
      expect(fact.confidence).toBe(1.0);
      expect(fact.content).toBe('42');
      expect(fact.raw).toBe(42);
      expect(fact.timestamp).toBe(FIXED_ISO);
    });

    test('handles null and undefined result', () => {
      const factNull = normalizeDeterministicFact('time', 'clock', null, 'now');
      expect(factNull.content).toBe('null');

      const factUndef = normalizeDeterministicFact('time', 'clock', undefined, 'now');
      expect(factUndef.content).toBe('undefined');
    });

    test('handles object result', () => {
      const fact = normalizeDeterministicFact('db', 'queryTool', { rows: 5 }, 'select');
      expect(fact.content).toBe('[object Object]');
    });

    test('returns empty entities', () => {
      const fact = normalizeDeterministicFact('calc', 'math', 10, '1+1');
      expect(fact.entities).toEqual([]);
    });

    test('id format follows hot:domain:counter', () => {
      const fact = normalizeDeterministicFact('calc', 'math', 1, 'q');
      expect(fact.id).toMatch(/^hot:calc:\d+$/);
    });
  });

  // -------------------- mergeRetrievalFacts --------------------
  describe('mergeRetrievalFacts', () => {
    const makeFact = (id: string): RetrievalFact =>
      ({
        id,
        source: { id: 's', type: 'tool', name: 'n', freshness: 'live', timestamp: FIXED_ISO, confidence: 1 },
        domain: 'd',
        content: '',
        entities: [],
        timestamp: FIXED_ISO,
        confidence: 1,
      } as RetrievalFact);

    test('returns empty array for empty input', () => {
      expect(mergeRetrievalFacts([])).toEqual([]);
      expect(mergeRetrievalFacts([[], []])).toEqual([]);
    });

    test('preserves identity and deduplicates by id', () => {
      const fA = makeFact('id1');
      const fB = makeFact('id2');
      const fDup = makeFact('id1'); // duplicate
      const merged = mergeRetrievalFacts([[fA, fB], [fDup]]);
      expect(merged).toHaveLength(2);
      expect(merged.map(f => f.id).sort()).toEqual(['id1', 'id2']);
    });

    test('handles single array', () => {
      const f = makeFact('single');
      expect(mergeRetrievalFacts([[f]])).toEqual([f]);
    });

    test('maintains insertion order of first occurrence', () => {
      const f1 = makeFact('a');
      const f2 = makeFact('b');
      const f3 = makeFact('a');
      const merged = mergeRetrievalFacts([[f1, f3], [f2]]);
      expect(merged.map(f => f.id)).toEqual(['a', 'b']);
    });
  });

  // -------------------- composeFactSummary --------------------
  describe('composeFactSummary', () => {
    const makeFact = (overrides: Partial<RetrievalFact> = {}): RetrievalFact =>
      ({
        id: 'id1',
        source: { id: 's1', type: 'api', name: 'TestTool', freshness: 'live', timestamp: FIXED_ISO, confidence: 1 },
        domain: 'test',
        content: 'Hello',
        entities: [],
        timestamp: FIXED_ISO,
        confidence: 1,
        ...overrides,
      } as RetrievalFact);

    test('returns empty string for empty array', () => {
      expect(composeFactSummary([])).toBe('');
    });

    test('formats a single fact with source label', () => {
      const summary = composeFactSummary([makeFact()]);
      expect(summary).toBe('[TestTool] Hello');
    });

    test('joins multiple facts with double newline', () => {
      const f1 = makeFact({ content: 'A', source: { name: 'Tool1' } } as any);
      const f2 = makeFact({ content: 'B', source: { name: 'Tool2' } } as any);
      const summary = composeFactSummary([f1, f2]);
      expect(summary).toBe('[Tool1] A\n\n[Tool2] B');
    });

    test('truncates content longer than 500 characters', () => {
      const longContent = 'x'.repeat(600);
      const fact = makeFact({ content: longContent });
      const summary = composeFactSummary([fact]);
      const expectedContent = longContent.slice(0, 500) + '...';
      expect(summary).toBe(`[TestTool] ${expectedContent}`);
    });

    test('does not truncate content of exactly 500 characters', () => {
      const content500 = 'y'.repeat(500);
      const fact = makeFact({ content: content500 });
      const summary = composeFactSummary([fact]);
      expect(summary).toBe(`[TestTool] ${content500}`);
    });
  });
});
```
