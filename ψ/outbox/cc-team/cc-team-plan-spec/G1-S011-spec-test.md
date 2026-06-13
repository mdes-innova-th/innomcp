<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S011 role=spec-test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":260,"completion_tokens":3461,"total_tokens":3721,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2019,"image_tokens":0},"cache_creation_input_tokens":0} | 37s
 generated: 2026-06-13T11:22:28.340Z -->
```typescript
import {
  RetrievalFact,
  normalizeWeatherFacts,
  normalizeEvidenceFacts,
  normalizeDeterministicFact,
  mergeRetrievalFacts,
  composeFactSummary,
} from '../src/services/hotRetriever';

// Mock external dependencies (e.g., network or file system) to keep tests deterministic and offline.
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

// Re-declare the interface in test scope for clarity (should match the actual export)
interface RetrievalFact {
  id: string;
  content: string;
  confidence: number;
  source: string;
}

// Helper to create a minimal valid RetrievalFact for testing
const makeFact = (overrides: Partial<RetrievalFact> = {}): RetrievalFact => ({
  id: 'fact-1',
  content: 'Some fact',
  confidence: 0.9,
  source: 'test',
  ...overrides,
});

describe('hotRetriever contract tests', () => {
  describe('normalizeWeatherFacts', () => {
    it('should return an array of RetrievalFact for valid input', () => {
      // Assume the function accepts an array of raw weather objects
      const rawWeatherData = [
        { location: 'NYC', temperature: 72, unit: 'F' },
        { location: 'LA', temperature: 85, unit: 'F' },
      ];
      const result = normalizeWeatherFacts(rawWeatherData);
      expect(Array.isArray(result)).toBe(true);
      result.forEach((fact) => {
        expect(fact).toHaveProperty('id');
        expect(fact).toHaveProperty('content');
        expect(fact).toHaveProperty('confidence');
        expect(fact).toHaveProperty('source');
      });
    });

    it('should throw when input is invalid (e.g., null or undefined)', () => {
      expect(() => normalizeWeatherFacts(null)).toThrow();
      expect(() => normalizeWeatherFacts(undefined)).toThrow();
    });
  });

  describe('normalizeEvidenceFacts', () => {
    it('should return an array of RetrievalFact for valid input', () => {
      const rawEvidence = [
        { claim: 'Rain likely', probability: 0.7 },
      ];
      const result = normalizeEvidenceFacts(rawEvidence);
      expect(Array.isArray(result)).toBe(true);
      result.forEach((fact) => {
        expect(fact).toHaveProperty('id');
        expect(fact).toHaveProperty('content');
        expect(fact).toHaveProperty('confidence');
        expect(fact).toHaveProperty('source');
      });
    });

    it('should throw on invalid input (empty data with missing fields)', () => {
      // Invalid because required fields missing
      expect(() => normalizeEvidenceFacts([{}])).toThrow();
    });
  });

  describe('normalizeDeterministicFact', () => {
    it('should return a single RetrievalFact for valid input', () => {
      const rawDeterministic = { rule: 'Sunrise at 6:32am', certainty: 1.0 };
      const result = normalizeDeterministicFact(rawDeterministic);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('source');
    });

    it('should throw on invalid input (e.g., missing certainty)', () => {
      expect(() => normalizeDeterministicFact({ rule: 'Sunset at 8pm' })).toThrow();
    });
  });

  describe('mergeRetrievalFacts', () => {
    it('should return an empty array when given an empty array of sets', () => {
      expect(mergeRetrievalFacts([])).toEqual([]);
    });

    it('should return a single set unchanged when given one set', () => {
      const facts = [makeFact({ id: 'a' }), makeFact({ id: 'b' })];
      expect(mergeRetrievalFacts([facts])).toEqual(facts);
    });

    it('should merge multiple sets, deduplicating by id (keeping the highest confidence)', () => {
      const set1 = [makeFact({ id: '1', confidence: 0.8 })];
      const set2 = [makeFact({ id: '1', confidence: 0.9 }), makeFact({ id: '2', confidence: 0.7 })];
      const result = mergeRetrievalFacts([set1, set2]);
      expect(result).toHaveLength(2);
      const fact1 = result.find((f) => f.id === '1');
      expect(fact1?.confidence).toBe(0.9); // highest confidence kept
      expect(result.find((f) => f.id === '2')).toBeDefined();
    });

    it('should handle empty sets inside the array', () => {
      const set1 = [makeFact({ id: 'x' })];
      const set2: RetrievalFact[] = [];
      expect(mergeRetrievalFacts([set1, set2])).toEqual(set1);
    });

    it('should throw if any element is not an array', () => {
      expect(() => mergeRetrievalFacts([null as unknown as RetrievalFact[]])).toThrow();
    });
  });

  describe('composeFactSummary', () => {
    it('should return an empty string when given an empty array', () => {
      expect(composeFactSummary([])).toBe('');
    });

    it('should return a non-empty string when given facts', () => {
      const facts = [makeFact({ content: 'First fact' })];
      const summary = composeFactSummary(facts);
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
    });

    it('should produce a summary that includes fact contents', () => {
      const facts = [
        makeFact({ id: '1', content: 'Alpha' }),
        makeFact({ id: '2', content: 'Beta' }),
      ];
      const summary = composeFactSummary(facts);
      expect(summary).toContain('Alpha');
      expect(summary).toContain('Beta');
    });

    it('should throw if any fact is invalid (missing required fields)', () => {
      const invalidFacts = [{ id: 'bad' }]; // missing content, confidence, source
      expect(() => composeFactSummary(invalidFacts as RetrievalFact[])).toThrow();
    });
  });
});
```
