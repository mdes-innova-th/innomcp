<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T011 role=test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2207,"completion_tokens":7276,"total_tokens":9483,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4444,"image_tokens":0},"cache_creation_input_tokens":0} | 67s
 generated: 2026-06-13T10:53:00.765Z -->
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
  const FIXED_DATE_ISO = '2025-03-17T12:00:00.000Z';

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(FIXED_DATE_ISO));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --------------------------------------------------
  // normalizeWeatherFacts
  // --------------------------------------------------
  describe('normalizeWeatherFacts', () => {
    test('returns empty array for undefined/null/falsy input', () => {
      expect(normalizeWeatherFacts(null, 'some query')).toEqual([]);
      expect(normalizeWeatherFacts(undefined, 'some query')).toEqual([]);
      expect(normalizeWeatherFacts(0, 'some query')).toEqual([]);
      expect(normalizeWeatherFacts('', 'some query')).toEqual([]);
    });

    test('handles array results with full items', () => {
      const toolResult = {
        result: [
          { province: 'กรุงเทพ', temperature: 35 },
          { province: 'เชียงใหม่', temperature: 28 },
        ],
      };
      const facts = normalizeWeatherFacts(toolResult, 'อากาศกรุงเทพและเชียงใหม่');
      expect(facts).toHaveLength(2);
      expect(facts[0].domain).toBe('weather');
      expect(facts[0].source.name).toBe('weatherPipeline');
      expect(facts[0].source.id).toContain('กรุงเทพ');
      expect(facts[0].entities).toEqual(['กรุงเทพ']);
      expect(facts[0].content).toBe(JSON.stringify({ province: 'กรุงเทพ', temperature: 35 }));
      expect(facts[0].timestamp).toBe(FIXED_DATE_ISO);
      expect(facts[0].confidence).toBeCloseTo(0.9);
      expect(facts[1].entities).toEqual(['เชียงใหม่']);
    });

    test('handles array results where items use "location" field', () => {
      const toolResult = {
        data: [{ location: 'ภูเก็ต', temp: 30 }],
      };
      const facts = normalizeWeatherFacts(toolResult, 'weather in phuket');
      expect(facts[0].entities).toEqual(['ภูเก็ต']);
      expect(facts[0].source.id).toContain('ภูเก็ต');
    });

    test('handles string items in array', () => {
      const toolResult = { result: ['rain', 'cloudy'] };
      const facts = normalizeWeatherFacts(toolResult, 'weather');
      expect(facts).toHaveLength(2);
      expect(facts[0].content).toBe('rain');
      expect(facts[1].content).toBe('cloudy');
      expect(facts[0].entities).toEqual(['unknown']);
    });

    test('handles object (non-array) result', () => {
      const toolResult = { result: { summary: 'hot', province: 'bangkok' } };
      const facts = normalizeWeatherFacts(toolResult, 'กรุงเทพ');
      expect(facts).toHaveLength(1);
      const fact = facts[0];
      expect(fact.content).toBe(JSON.stringify({ summary: 'hot', province: 'bangkok' }));
      expect(fact.source.id).toBe('tool:weatherPipeline');
      expect(fact.entities).toEqual(['กรุงเทพ']);
    });

    test('direct string toolResult yields no facts', () => {
      // direct string is not an object, so else-if fails → empty
      const facts = normalizeWeatherFacts('sunny', 'weather');
      expect(facts).toEqual([]);
    });

    test('extracts weather entities from query', () => {
      const toolResult = { result: { temp: 20 } };
      const facts = normalizeWeatherFacts(toolResult, 'ภาคเหนือและกรุงเทพ');
      expect(facts[0].entities).toEqual(['กรุงเทพ', 'ภาคเหนือ']);
    });

    test('uses fallback "unknown" for array items without province/location', () => {
      const toolResult = { result: [{ city: 'london' }] };
      const facts = normalizeWeatherFacts(toolResult, 'anything');
      expect(facts[0].entities).toEqual(['unknown']);
      expect(facts[0].source.id).toBe('tool:weatherPipeline:unknown');
    });
  });

  // --------------------------------------------------
  // normalizeEvidenceFacts
  // --------------------------------------------------
  describe('normalizeEvidenceFacts', () => {
    test('returns empty array for null/undefined toolResult', () => {
      expect(normalizeEvidenceFacts(null, 'query')).toEqual([]);
      expect(normalizeEvidenceFacts(undefined, 'query')).toEqual([]);
    });

    test('handles toolResult with result field', () => {
      const toolResult = { result: { outage: true, isp: 'ais' } };
      const facts = normalizeEvidenceFacts(toolResult, 'ais down');
      expect(facts).toHaveLength(1);
      const fact = facts[0];
      expect(fact.domain).toBe('evidence');
      expect(fact.source.name).toBe('evidenceTool');
      expect(fact.source.id).toBe('tool:evidenceTool:AIS');
      expect(fact.entities).toEqual(['AIS']);
      expect(fact.content).toBe(JSON.stringify({ outage: true, isp: 'ais' }));
      expect(fact.confidence).toBeCloseTo(0.95);
      expect(fact.timestamp).toBe(FIXED_DATE_ISO);
    });

    test('handles toolResult with data field', () => {
      const toolResult = { data: 'outage confirmed' };
      const facts = normalizeEvidenceFacts(toolResult, 'true outage');
      expect(facts[0].entities).toEqual(['TRUE']);
      expect(facts[0].source.id).toBe('tool:evidenceTool:TRUE');
      expect(facts[0].content).toBe('outage confirmed');
    });

    test('handles direct string result', () => {
      const facts = normalizeEvidenceFacts('no outage', 'dtac status');
      expect(facts[0].entities).toEqual(['DTAC']);
      expect(facts[0].content).toBe('no outage');
    });

    test('extracts ISP with case-insensitivity', () => {
      const facts = normalizeEvidenceFacts('result', 'TrueOnline test');
      expect(facts[0].entities).toEqual(['TRUEONLINE']);
    });

    test('falls back to "all" if no ISP found', () => {
      const facts = normalizeEvidenceFacts('data', 'nothing');
      expect(facts[0].entities).toEqual(['all']);
      expect(facts[0].source.id).toBe('tool:evidenceTool:all');
    });

    test('handles Thai ISP names', () => {
      const facts = normalizeEvidenceFacts('data', 'ดีแทคล่ม');
      expect(facts[0].entities).toEqual([expect.stringMatching(/ดีแทค/i) || 'ดีแทค'.toUpperCase()]);
    });
  });

  // --------------------------------------------------
  // normalizeDeterministicFact
  // --------------------------------------------------
  describe('normalizeDeterministicFact', () => {
    test('returns a single RetrievalFact with given params', () => {
      const fact = normalizeDeterministicFact('calculator', 'calcTool', 42, '2+2');
      expect(fact.domain).toBe('calculator');
      expect(fact.source.name).toBe('calcTool');
      expect(fact.source.type).toBe('tool');
      expect(fact.confidence).toBe(1.0);
      expect(fact.content).toBe('42');
      expect(fact.raw).toBe(42);
      expect(fact.timestamp).toBe(FIXED_DATE_ISO);
      expect(fact.entities).toEqual([]);
      expect(fact.id).toMatch(/^hot:calculator:\d+$/);
    });

    test('converts non-string result to string for content', () => {
      const date = new Date(2025, 0, 1);
      const fact = normalizeDeterministicFact('datetime', 'dateTool', date, 'today');
      expect(fact.content).toEqual(expect.any(String));
      expect(fact.raw).toBe(date);
    });

    test('uses string result directly', () => {
      const fact = normalizeDeterministicFact('search', 'searchTool', 'no results', 'xyz');
      expect(fact.content).toBe('no results');
    });
  });

  // --------------------------------------------------
  // mergeRetrievalFacts
  // --------------------------------------------------
  describe('mergeRetrievalFacts', () => {
    const makeFact = (id: string, content: string): RetrievalFact => ({
      id,
      source: {
        id: `s_${id}`,
        type: 'api',
        name: `src_${id}`,
        freshness: 'live',
        timestamp: '',
        confidence: 1,
      },
      domain: 'w',
      content,
      entities: [],
      timestamp: '',
      confidence: 1,
    });

    test('merges multiple arrays, preserving order and deduplicating by id', () => {
      const f1 = makeFact('1', 'a');
      const f2 = makeFact('2', 'b');
      const f3 = makeFact('1', 'duplicate'); // same id
      const merged = mergeRetrievalFacts([[f1, f2], [f3]]);
      expect(merged).toHaveLength(2);
      expect(merged[0].id).toBe('1');
      expect(merged[0].content).toBe('a'); // first seen wins
      expect(merged[1].id).toBe('2');
    });

    test('returns empty array for empty input', () => {
      expect(mergeRetrievalFacts([])).toEqual([]);
      expect(mergeRetrievalFacts([[], []])).toEqual([]);
    });

    test('handles single array', () => {
      const facts = [makeFact('hot:test:1', 'x')];
      expect(mergeRetrievalFacts([facts])).toEqual(facts);
    });
  });

  // --------------------------------------------------
  // composeFactSummary
  // --------------------------------------------------
  describe('composeFactSummary', () => {
    test('returns empty string for empty facts', () => {
      expect(composeFactSummary([])).toBe('');
    });

    test('formats facts with source label and content', () => {
      const facts: RetrievalFact[] = [
        {
          id: '1', source: { id: 's1', type: 'api', name: 'weather', freshness: 'live', timestamp: '', confidence: 0.9 },
          domain: 'w', content: 'sunny', entities: [], timestamp: '', confidence: 0.9,
        },
        {
          id: '2', source: { id: 's2', type: 'database', name: 'evidence', freshness: 'live', timestamp: '', confidence: 0.95 },
          domain: 'e', content: 'outage', entities: [], timestamp: '', confidence: 0.95,
        },
      ];
      const summary = composeFactSummary(facts);
      expect(summary).toContain('[weather] sunny');
      expect(summary).toContain('[evidence] outage');
      expect(summary).toBe('[weather] sunny\n\n[evidence] outage');
    });

    test('truncates long content', () => {
      const longContent = 'a'.repeat(600);
      const fact: RetrievalFact = {
        id: 'long',
        source: { id: 's', type: 'tool', name: 'tool', freshness: 'live', timestamp: '', confidence: 1 },
        domain: 'd',
        content: longContent,
        entities: [],
        timestamp: '',
        confidence: 1,
      };
      const summary = composeFactSummary([fact]);
      expect(summary).toContain('a'.repeat(500) + '...');
      expect(summary.length).toBeLessThan(longContent.length + 20);
    });

    test('does not truncate content of exactly 500 characters', () => {
      const exactContent = 'b'.repeat(500);
      const fact: RetrievalFact = {
        id: 'exact',
        source: { id: 's', type: 'tool', name: 't', freshness: 'live', timestamp: '', confidence: 1 },
        domain: 'd',
        content: exactContent,
        entities: [],
        timestamp: '',
        confidence: 1,
      };
      const summary = composeFactSummary([fact]);
      expect(summary).toContain(exactContent);
      expect(summary.endsWith('...')).toBe(false);
    });
  });
});
```
