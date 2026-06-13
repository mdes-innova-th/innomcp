<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S002 role=spec-test model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":263,"completion_tokens":3881,"total_tokens":4144,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2815,"image_tokens":0},"cache_creation_input_tokens":0} | 72s
 generated: 2026-06-13T11:20:16.957Z -->
```typescript
import {
  buildAnswerContract,
  AnswerMode,
  RetrievalMode,
  RetrievalSource,
  AnswerContract
} from '../src/services/answerContract';

describe('answerContract', () => {
  const mockSources: RetrievalSource[] = [
    { id: 'src-1', content: 'Paris is the capital of France.', score: 0.95 },
    { id: 'src-2', content: 'France is located in Western Europe.', score: 0.85 }
  ];

  const baseParams = {
    query: 'What is the capital of France?',
    mode: 'hybrid' as AnswerMode,
    retrievalMode: 'hot' as RetrievalMode,
    sources: mockSources
  };

  describe('buildAnswerContract', () => {
    it('should successfully build a contract with valid hybrid mode and hot retrieval', () => {
      const contract = buildAnswerContract(baseParams);

      expect(contract).toBeDefined();
      expect(contract.query).toBe(baseParams.query);
      expect(contract.mode).toBe('hybrid');
      expect(contract.retrievalMode).toBe('hot');
      expect(contract.sources).toEqual(mockSources);
    });

    it('should successfully build a contract with llm-only mode and none retrieval', () => {
      const params = {
        ...baseParams,
        mode: 'llm-only' as AnswerMode,
        retrievalMode: 'none' as RetrievalMode,
        sources: [] as RetrievalSource[]
      };

      const contract = buildAnswerContract(params);

      expect(contract.mode).toBe('llm-only');
      expect(contract.retrievalMode).toBe('none');
      expect(contract.sources).toHaveLength(0);
    });

    it('should throw an error if the query is empty or missing', () => {
      const invalidParams = { ...baseParams, query: '' };
      expect(() => buildAnswerContract(invalidParams)).toThrow(/query/i);
    });

    it('should throw an error if retrievalMode requires sources but none are provided', () => {
      const invalidParams = {
        ...baseParams,
        retrievalMode: 'hot' as RetrievalMode,
        sources: [] as RetrievalSource[]
      };

      expect(() => buildAnswerContract(invalidParams)).toThrow(/sources/i);
    });

    it('should throw an error if retrievalMode is "none" but sources are provided', () => {
      const invalidParams = {
        ...baseParams,
        retrievalMode: 'none' as RetrievalMode,
        sources: mockSources
      };

      expect(() => buildAnswerContract(invalidParams)).toThrow();
    });

    it('should throw an error if an invalid mode is provided at runtime', () => {
      const invalidParams = {
        ...baseParams,
        mode: 'invalid-mode' as any
      };

      expect(() => buildAnswerContract(invalidParams)).toThrow();
    });

    it('should throw an error if an invalid retrievalMode is provided at runtime', () => {
      const invalidParams = {
        ...baseParams,
        retrievalMode: 'warm' as any
      };

      expect(() => buildAnswerContract(invalidParams)).toThrow();
    });

    it('should preserve source ordering and exact state values', () => {
      const contract = buildAnswerContract(baseParams);

      expect(contract.sources[0].id).toBe('src-1');
      expect(contract.sources[0].score).toBe(0.95);
      expect(contract.sources[1].id).toBe('src-2');
      expect(contract.sources[1].content).toBe('France is located in Western Europe.');
    });

    it('should correctly map deterministic mode', () => {
      const params = { ...baseParams, mode: 'deterministic' as AnswerMode };
      const contract = buildAnswerContract(params);

      expect(contract.mode).toBe('deterministic');
    });

    it('should correctly map llm-rewrite mode', () => {
      const params = { ...baseParams, mode: 'llm-rewrite' as AnswerMode };
      const contract = buildAnswerContract(params);

      expect(contract.mode).toBe('llm-rewrite');
    });

    it('should correctly map "both" and "cold" retrieval modes', () => {
      const bothParams = { ...baseParams, retrievalMode: 'both' as RetrievalMode };
      const coldParams = { ...baseParams, retrievalMode: 'cold' as RetrievalMode };

      expect(buildAnswerContract(bothParams).retrievalMode).toBe('both');
      expect(buildAnswerContract(coldParams).retrievalMode).toBe('cold');
    });
  });
});
```
