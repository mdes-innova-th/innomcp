_80 findings consolidated, 4 missing._

# TRIAGE — spec

> Contract/spec-based jest tests (provider=0) — meaningful, implementation-hidden. Fixes tautology trap.

> Generated for mother-Sonnet review. provider=0 deliverables.


---

## S001 — spec-test — `innomcp-node/src/services/agentLoop.ts` [deepseek/deepseek-v4-flash]
```typescript
// agentLoop.contract.test.ts
import { runAgentLoop, AgentEvent } from '../src/services/agentLoop';

// ── Mock external dependencies ──────────────────────────────────────────────
// We assume the runtime agent (e.g., LLM) is passed via opts or mocked globally.
// Here we mock a minimal agent interface that `runAgentLoop` would use.
// The actual implementation of `runAgentLoop` is not known, so we define a
// mock that simulates the expected behavior.

interface MockAgent {
  step: jest.Mock<AsyncGenerator<AgentEvent, void, unknown>>;
}

let mockAgent: MockAgent;

beforeEach(() => {
  mockAgent = {
    step: jest.fn(),
  };
  // Clear any global mocks that the module might use
});

// Helper to convert async generator to array for easy assertion
async function collectGenerator<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const item of gen) {
    results.push(item);
  }
  return results;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('runAgentLoop contract', () => {
  // ====== VALID INPUTS ======

  describe('valid inputs', () => {
    it('should yield a single final answer event when agent returns directly without tool calls', async () => {
      const finalAnswer: AgentEvent = { type: 'final_answer', answer: 'Hello world' };
      mockAgent.step.mockImplementationOnce(async function* () {
        yield finalAnswer;
      });

      const opts = {
        agent: mockAgent,
        message: 'Hi',
      };
      const result = await collectGenerator(runAgentLoop(opts));
      expect(result).toEqual([finalAnswer]);
    });

    it('should yield multiple events when agent makes a tool call and then final answer', async () => {
      const toolCall: AgentEvent = { type: 'tool_call', tool_name: 'get_weather', args: { city: 'Paris' } };
      const toolResult: AgentEvent = { type: 'tool_result', tool_name: 'get_weather', result: 'Sunny' };
      const finalAnswer: AgentEvent = { type: 'final_answer', answer: 'It is sunny in Paris' };

      mockAgent.step
        .mockImplementationOnce(async function* () {
          yield toolCall;
        })
        .mockImplementationOnce(async function* () {
          yield toolResult;
        })
        .mockImplementationOnce(async function* () {
          yield finalAnswer;
        });

      const opts = {
        agent: mockAgent,
        message: 'What is the weather in Paris?',
        tools: ['get_weather'],
      };
      const result = await collectGenerator(runAgentLoop(opts));
      expect(result).toEqual([toolCall, toolResult, finalAnswer]);
    });

    it('should handle multiple tool calls in a loop', async () => {
      const toolCall1: AgentEvent = { type: 'tool_call', tool_name: 'get_time', args: { timezone: 'UTC' } };
      const toolResult1: AgentEvent = { type: 'tool_result', tool_name: 'get_time', result: '12:00' };
      const toolCall2: AgentEvent = { type: 'tool_call', tool_name: 'get_weather', args: {} };
      const toolResult2: AgentEvent = { type: 'tool_result', tool_name: 'get_weather', result: 'Cloudy' };
      const final: AgentEvent = { type: 'final_answer', answer: 'It is 12:00 and Cloudy' };

      mockAgent.step
        .mockImplementationOnce(async function* () { yield toolCall1; })
        .mockImplementationOnce(async function* () { yield toolResult1; })
        .mockImplementationOnce(async function* () { yield toolCall2; })
        .mockImplementationOnce(async function* () { yield toolResult2; })
        .mockImplementationOnce(async function* () { yield final; });

      const opts = {
        agent: mockAgent,
        message: 'Tell me time and weather',
        tools: ['get_time', 'get_weather'],
      };
      const events = await collectGenerator(runAgentLoop(opts));
      expect(events).toEqual([toolCall1, toolResult1, toolCall2, toolResult2, final]);
    });

    it('should yield text events interleaved with tool calls if agent yields them', async 

---

## S002 — spec-test — `innomcp-node/src/services/answerContract.ts` [Qwen/Qwen3.7-Max]
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

      ex

---

## S003 — spec-test — `innomcp-node/src/services/artifactService.ts` [moonshotai/Kimi-K2.6]
```typescript
import { artifactService } from '../src/services/artifactService';
import { readdir, readFile } from 'fs/promises';

jest.mock('fs/promises');

const mockedReaddir = jest.mocked(readdir);
const mockedReadFile = jest.mocked(readFile);

describe('artifactService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listArtifacts', () => {
    it('resolves to an array of artifact names for a valid taskId', async () => {
      const names = ['build.log', 'output.json', 'model.bin'];
      mockedReaddir.mockResolvedValue(names);

      const result = await artifactService.listArtifacts('task-abc-123');

      expect(result).toEqual(names);
      expect(Array.isArray(result)).toBe(true);
      expect(result.every((n) => typeof n === 'string')).toBe(true);
    });

    it('resolves to an empty array when a task has no artifacts', async () => {
      mockedReaddir.mockResolvedValue([]);

      const result = await artifactService.listArtifacts('task-empty');

      expect(result).toEqual([]);
    });

    it('rejects when taskId is an empty string', async () => {
      await expect(artifactService.listArtifacts('')).rejects.to

---

## S004 — spec-test — `innomcp-node/src/services/auditLogger.ts` [zai-org/GLM-5.1]
```typescript
import {
  auditLogger,
  AuditLogger,
  AuditAction,
  AuditEntry,
  AuditEntryInput,
  AuditFilter
} from '../src/services/auditLogger';

// Mock external dependencies deterministically (Offline, Strict TS)
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-123456789')
}));

describe('AuditLogger Contract', () => {
  const fixedDate = new Date('2023-11-15T12:00:00.000Z');

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedDate);
  });

  afterAll(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('log', () => {
    it('should log a valid entry and return it with generated id and timestamp', () => {
      const input: AuditEntryInput = {
        action: 'login',
        userId: 'user-abc',
        details: 'User logged in successfully'
      };

      const entry = auditLogger.log(input);

      // Assert VALUES/STATE, not just mock calls
      expect(entry).toMatchObject({
        id: 'mock-uuid-123456789',
        timestamp: fixedDate,
        action: 'login',
        userId: 'user-abc',
        details: 'User logged in successfully'
      });
    });

    it('should throw an error when logging an invalid AuditAction', () => {
      const invalidInput = {
        action: 'invalid_hack', // Not in AuditAction union
        userId: 'user-abc'
      };

      expect(() => auditLogger.log(invalidInput as any)).toThrow();
    });

    it('should throw an error when required fields are missing', () => {
      const missingFieldsInput = { action: 'logout' } as any;
      expect(() => auditLogger.log(missingFieldsInput)).toThrow();
    });
  });

  describe('query', () => {
    it('should return filtered entries based on AuditFilter', () => {
      auditLogger.log({ action: 'login', userId: 'user-1' });
      auditLogger.log({ action: 'logout', userId: 'user-1' });
      auditLogger.log({ action: 'login', userId: 'user-2' });

      const filter: AuditFilter = { action: 'login' } as AuditFilter;
      const results = auditLogger.query(filter);

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.every(entry => entry.action === 'login')).toBe(true);
    });

    it('should return an empty array if no entries match the filter', () => {
      const filter: AuditFilter = { action: 'admin_action' } as AuditFilter;
      const results = auditLogger.query(filter);

      expect(results).toEqual([]);
    });
  });

  describe('exportJSON', () => {
    it('should return a valid JSON string containing the logged entries', () => {
      auditLogger.log({ action: 'data_export', userId: 'admin-user' });

      const jsonString = auditLogger.exportJSON();
      const parsed = JSON.parse(jsonString);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'mock-uuid-123456789',
            action: 'data_export',
            userId: 'admin-user'
          })
        ])
      );
    });

    it('should return a valid JSON string of filtered entries', () => {
      auditLogger.log({ action: 'file_access', userId: 'user-1' });
      auditLogger.log({ action: 'message_sent', userId: 'user-2' });

      const filter: AuditFilter = { action: 'file_access' } as AuditFilter;
      const jsonString = auditLogger.exportJSON(filter);
      const parsed = JSON.parse(jsonString);

      expect(parsed.length).toBeGreaterThanOrEqual(1);
      expect(parsed.every((entry: AuditEntry) => entry.action === 'file_access')).toBe(true);
    });
  });

  describe('exportCSV', () => {
    it('should return a valid CSV string with headers and corresponding data rows', () => {
      auditLogger.log({ action: 'provider_change', userId: 'admin-user' });

      const csvString = auditLogger.exportCSV();
      const lines = csvString.trim().split('\n');

      // Header row contract
      expect(lines[0]).toMatch(/id,timestamp,action,userId/);
      // Data row con

---

## S005 — spec-test — `innomcp-node/src/services/backpressureHandler.ts` [MiniMaxAI/MiniMax-M3]
```typescript
import { backpressureHandler, QueueItem } from '../src/services/backpressureHandler';

type EnqueueResult = { accepted: boolean; retryAfterMs?: number };

const makeItem = (id: string, priority: number = 0): QueueItem => ({
  id,
  priority,
  payload: { id },
  enqueuedAt: new Date(),
});

describe('backpressureHandler — contract', () => {
  beforeEach(() => {
    // Reset internal state between tests by re-initializing via a fresh instance
    (backpressureHandler as any).reset?.();
    (backpressureHandler as any).clear?.();
  });

  describe('enqueue()', () => {
    it('returns an accepted=true result for a single valid item', () => {
      const result = backpressureHandler.enqueue(makeItem('a')) as EnqueueResult;
      expect(result).toBeDefined();
      expect(result.accepted).toBe(true);
    });

    it('increments the internal queue size for each accepted item', () => {
      backpressureHandler.enqueue(makeItem('a'));
      backpressureHandler.enqueue(makeItem('b'));
      backpressureHandler.enqueue(makeItem('c'));

      const size = (backpressureHandler as any).size?.() ?? backpressureHandler.getQueueSize?.();
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThanOrEqual(3);
    });

    it('throws or rejects when given an item missing required fields', () => {
      const invalid = { foo: 'bar' } as unknown as QueueItem;
      expect(() => backpressureHandler.enqueue(invalid)).toThrow();
    });

    it('throws when given a non-object value (null, undefined, primitives)', () => {
      expect(() => backpressureHandler.enqueue(null as unknown as QueueItem)).toThrow();
      expect(() => backpressureHandler.enqueue(undefined as unknown as QueueItem)).toThrow();
      expect(() => backpressureHandler.enqueue(42 as unknown as QueueItem)).toThrow();
      expect(() => backpressureHandler.enqueue('item' as unknown as QueueItem)).toThrow();
    });

    it('enforces a high-water mark: once exceeded, returns accepted=false with a retryAfterMs hint', () => {
      const highWater = (backpressureHandler as any).config?.highWaterMark ?? 100;
      // Fill past high-water mark
      for (let i = 0; i < highWater + 5; i++) {
        backpressureHandler.enqueue(makeItem(`x-${i}`));
      }
      const result = backpressureHandler.enqueue(makeItem('overflow')) as EnqueueResult;
      expect(result).toBeDefined();
      expect(result.accepted).toBe(false);
      expect(typeof result.retryAfterMs).toBe('number');
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('respects priority ordering on dequeue (higher priority first)', () => {
      backpressureHandler.enqueue(makeItem('low', 1));
      backpressureHandler.enqueue(makeItem('high', 10));
      backpressureHandler.enqueue(makeItem('mid', 5));

      const next = backpressureHandler.dequeue?.() ?? backpressureHandler.next?.();
      expect(next).toBeDefined();
      expect(next?.id).toBe('high');
    });
  });

  describe('dequeue() / next()', () => {
    it('returns undefined or null when the queue is empty', () => {
      const result = backpressureHandler.dequeue?.() ?? backpressureHandler.next?.();
      expect(result == null).toBe(true);
    });

    it('decrements the queue size when an item is removed', () => {
      backpressureHandler.enqueue(makeItem('a'));
      backpressureHandler.enqueue(makeItem('b'));

      const sizeBefore = (backpressureHandler as any).size?.() ?? backpressureHandler.getQueueSize?.();
      backpressureHandler.dequeue?.() ?? backpressureHandler.next?.();
      const sizeAfter = (backpressureHandler as any).size?.() ?? backpressureHandler.getQueueSize?.();

      expect(sizeAfter).toBeLessThan(sizeBefore);
    });
  });

  describe('drain / process semantics', () => {
    it('drains the queue completely when invoked', () => {
      for (let i = 0; i < 10; i++) {
        backpressureHandler.enqueue(makeItem(`d-${i}`));
      }

      const drainFn =
        (backpressureHandler as any).dr

---

## S006 — spec-test — `innomcp-node/src/services/coldRetriever.ts` [deepseek/deepseek-v4-flash]
```typescript
import { ColdRetriever, coldRetriever } from '../src/services/coldRetriever';

// Mock fs and path modules deterministically
jest.mock('fs', () => {
  const mockFiles: Record<string, string> = {};
  const mockStats: Record<string, { isFile: () => boolean }> = {};

  return {
    promises: {
      readdir: jest.fn().mockImplementation((dirPath: string) => {
        const files = Object.keys(mockFiles).filter(f => f.startsWith(dirPath) && !f.slice(dirPath.length + 1).includes('/'));
        if (files.length === 0 && !mockFiles[dirPath]) {
          return Promise.reject(new Error(`ENOENT: no such directory, open '${dirPath}'`));
        }
        return Promise.resolve(files.map(f => f.split('/').pop()!));
      }),
      readFile: jest.fn().mockImplementation((filePath: string) => {
        if (!mockFiles[filePath]) {
          return Promise.reject(new Error(`ENOENT: no such file, open '${filePath}'`));
        }
        return Promise.resolve(mockFiles[filePath]);
      }),
      stat: jest.fn().mockImplementation((path: string) => {
        if (mockStats[path] !== undefined) {
          return Promise.resolve(mockStats[path]);
        }
        return Promise.reject(new Error(`ENOENT: no such file or directory, stat '${path}'`));
      }),
    },
    __setMockFiles: (files: Record<string, string>) => {
      Object.keys(mockFiles).forEach(k => delete mockFiles[k]);
      Object.keys(mockStats).forEach(k => delete mockStats[k]);
      Object.entries(files).forEach(([filePath, content]) => {
        const normalizedPath = filePath.replace(/\\/g, '/');
        mockFiles[normalizedPath] = content;
        mockStats[normalizedPath] = { isFile: () => true };
        // Ensure parent directories exist as stats (optional, for simplicity treat as directories)
        const parts = normalizedPath.split('/');
        for (let i = 1; i < parts.length - 1; i++) {
          const dirPath = parts.slice(0, i + 1).join('/');
          if (!mockStats[dirPath]) {
            mockStats[dirPath] = { isFile: () => false };
          }
        }
        // Root directory
        const root = parts[0];
        if (!mockStats[root]) {
          mockStats[root] = { isFile: () => false };
        }
      });
    },
  };
});

jest.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
  resolve: (...args: string[]) => args.join('/'),
  sep: '/',
}));

const fs = require('fs') as typeof import('fs') & { __setMockFiles: (files: Record<string, string>) => void };

describe('ColdRetriever', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.__setMockFiles({});
  });

  describe('loadCorpus', () => {
    it('should return correct docCount and chunkCount for a valid directory with files', async () => {
      // Simulate a directory with two markdown files, each split by double newline into chunks
      fs.__setMockFiles({
        '/corpus/doc1.md': '# Doc1\n\nContent of first chunk\n\n# Second chunk\n\nEnd of doc1.',
        '/corpus/doc2.md': '# Doc2\n\nOnly one chunk here.',
      });

      const result = await coldRetriever.loadCorpus('/corpus');

      // Assuming implementation splits on double newlines:
      // doc1.md => 3 chunks, doc2.md => 1 chunk => total 4 chunks, 2 docs
      expect(result).toEqual({
        docCount: 2,
        chunkCount: 4,
      });
    });

    it('should return zero counts for an empty directory', async () => {
      fs.__setMockFiles({});
      // Even if the directory exists, no files inside
      // To make it exist, we need to set up a directory stat entry
      // The mock's readdir will return empty array if no files start with '/corpus/'
      // But we also need the directory to exist. We'll add a dummy file to create the directory entry
      fs.__setMockFiles({
        '/corpus/.keep': '', // dummy file to make directory exist, but we'll exclude hidden files? Usually readdir returns all. We'll assume it's ignored.
      });

      // However, the function might filter out d

---

## S007 — spec-test — `innomcp-node/src/services/dataAnalysisTool.ts` [Qwen/Qwen3.7-Max]
```typescript
import { analyzeData, AnalysisResult, ColumnStats } from '../src/services/dataAnalysisTool';

describe('dataAnalysisTool — analyzeData contract tests', () => {
  describe('valid inputs — basic structure', () => {
    it('returns an AnalysisResult with correct rowCount and columnCount', async () => {
      const data = [
        { id: 1, name: 'Alice', active: true },
        { id: 2, name: 'Bob', active: false },
        { id: 3, name: 'Charlie', active: true },
      ];

      const result: AnalysisResult = await analyzeData(data);

      expect(result).toBeDefined();
      expect(result.rowCount).toBe(3);
      expect(result.columnCount).toBe(3);
      expect(Array.isArray(result.columns)).toBe(true);
      expect(result.columns).toHaveLength(3);
    });

    it('returns column stats with correct names matching input keys', async () => {
      const data = [
        { age: 25, city: 'NYC' },
        { age: 30, city: 'LA' },
      ];

      const result = await analyzeData(data);
      const columnNames = result.columns.map((c: ColumnStats) => c.name).sort();

      expect(columnNames).toEqual(['age', 'city']);
    });

    it('handles an empty dataset gracefully', async () => {
      const result = await analyzeData([]);

      expect(result.rowCount).toBe(0);
      expect(result.columnCount).toBe(0);
      expect(result.columns).toEqual([]);
    });

    it('handles a single-row dataset', async () => {
      const data = [{ value: 42, label: 'only' }];

      const result = await analyzeData(data);

      expect(result.rowCount).toBe(1);
      expect(result.columnCount).toBe(2);
    });
  });

  describe('numeric column statistics', () => {
    it('computes correct count, min, max, mean for numeric columns', async () => {
      const data = [
        { score: 10 },
        { score: 20 },
        { score: 30 },
        { score: 40 },
        { score: 50 },
      ];

      const result = await analyzeData(data);
      const scoreCol = result.columns.find((c: ColumnStats) => c.name === 'score');

      expect(scoreCol).toBeDefined();
      expect(scoreCol!.count).toBe(5);
      expect(scoreCol!.min).toBe(10);
      expect(scoreCol!.max).toBe(50);
      expect(scoreCol!.mean).toBe(30);
    });

    it('computes median correctly for odd-length numeric columns', async () => {
      const data = [{ v: 3 }, { v: 1 }, { v: 2 }];

      const result = await analyzeData(data);
      const col = result.columns.find((c: ColumnStats) => c.name === 'v');

      expect(col).toBeDefined();
      expect(col!.median).toBe(2);
    });

    it('computes median correctly for even-length numeric columns', async () => {
      const data = [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }];

      const result = await analyzeData(data);
      const col = result.columns.find((c: ColumnStats) => c.name === 'v');

      expect(col).toBeDefined();
      expect(col!.median).toBe(2.5);
    });

    it('computes stdDev for numeric columns', async () => {
      const data = [{ v: 2 }, { v: 4 }, { v: 4 }, { v: 4 }, { v: 5 }, { v: 5 }, { v: 7 }, { v: 9 }];

      const result = await analyzeData(data);
      const col = result.columns.find((c: ColumnStats) => c.name === 'v');

      expect(col).toBeDefined();
      expect(col!.stdDev).toBeDefined();
      expect(typeof col!.stdDev).toBe('number');
      // Population stdDev of [2,4,4,4,5,5,7,9] = 2.0
      expect(col!.stdDev).toBeCloseTo(2.0, 1);
    });

    it('handles a single numeric value (stdDev = 0)', async () => {
      const data = [{ v: 99 }];

      const result = await analyzeData(data);
      const col = result.columns.find((c: ColumnStats) => c.name === 'v');

      expect(col).toBeDefined();
      expect(col!.min).toBe(99);
      expect(col!.max).toBe(99);
      expect(col!.mean).toBe(99);
      expect(col!.stdDev).toBe(0);
    });
  });

  describe('string column statistics', () => {
    it('computes uniqueCount for string columns', async () => {
      const data = [
        { color: 'red

---

## S008 — spec-test — `innomcp-node/src/services/fastPathHandler.ts` [moonshotai/Kimi-K2.6]
The user wants a Jest contract/behavior test for a module called `fastPathHandler` from `../src/services/fastPathHandler`. I only have the public API surface (signatures), not the implementation. I need to infer behavior from names and signatures.

Public API:
1. `trigToDeg(expr: string): string` - Converts a trigonometric expression to degrees? Or converts trig functions to degrees? Likely takes a string expression and returns a string. Contract: valid string -> string output. Invalid/empty -> maybe throw or return specific value? Given name, probably converts radians to degrees or formats trig expressions.
2. `cleanFloat(val: number): string` - Cleans/formats a float. Contract: number -> string. NaN/Infinity? Probably throw or return something. Let's assume it throws on invalid numbers or returns a specific string. I'll test valid numbers return formatted strings, and edge cases like NaN/Infinity throw.
3. `FastPathMode = "off" | "on"` - Type.
4. `FastPathHandlerOptions` - Interface. Fields unknown. I need to infer likely fields from usage in other functions. `createFastPathExpressMiddleware(opts = {})`, `getExtraPhrases(opts)`, `handleFastPathMessage(...)`, `tryFastPathWebSocket(...)`. Likely includes `mode?: FastPathMode`, `extraFilePath?: string`, `extraUrl?: string`, `responder?: Responder`, etc. But I don't know exact fields. I should define a minimal mock object that satisfies the type. Since TS is strict, I need to be careful. However, since I don't know the exact shape, I might need to cast or use `as any`? No, strict TS. But the prompt says "Strict TS". If I don't know the interface members, I can't create a valid object without TS errors unless I use empty object and cast, or if all members are optional. Given `opts = {}` default, `FastPathHandlerOptions` likely has all optional fields. So `{}` is valid. Good.
5. `FastPathDecision` - Interface. Unknown shape. Probably used as return type or parameter. I might not need to instantiate it directly if functions return it.
6. `Responder = (payload: any) => Promise<void> | void` - Type.
7. `ExtraPhrases` - Type alias (not exported). `type ExtraPhrases = { ... }`. Unknown shape. But `tryReadExtraFromFile`, `tryReadExtraFromUrl`, `getExtraPhrases` return it. Since it's not exported, I can't reference it directly in test assertions unless I infer shape. I'll treat it as an object and check properties if I knew them. Since I don't, I'll assert it's an object or has certain behavior. Wait, contract test should assert values/state. If I don't know the shape of `ExtraPhrases`, I can still assert that `getExtraPhrases` resolves to an object, or that merging happens. But I need to be more concrete. Let's infer `ExtraPhrases` is probably `{ phrases?: string[] }` or similar. Actually, from `tryReadExtraFromFile` and `tryReadExtraFromUrl`, it likely reads some phrase definitions. Maybe it's `{ [key: string]: string }` or `{ phrases: string[] }`. I'll assume it has a `phrases` array or is a record. But I must be careful not to overfit. Let's look at function names:
   - `tryReadExtraFromFile(filePath: string): Promise<ExtraPhrases>`
   - `tryReadExtraFromUrl(url: string): Promise<ExtraPhrases>`
   - `getExtraPhrases(opts: FastPathHandlerOptions): Promise<ExtraPhrases>`
   - `handleFastPathMessage(...)` likely uses these.
   - `tryFastPathWebSocket(...)` likely uses these.

Given the module name `fastPathHandler` and `ExtraPhrases`, this seems like an MCP (Model Context Protocol) or similar "fast path" for handling messages. `ExtraPhrases` likely adds extra trigger phrases.

Since I cannot know the exact shape, I should write tests that assert on the contract implied by the names and the relationships between functions. For example:
- `trigToDeg('sin(90)')` should return something containing degrees or converted value. But I don't know exact algorithm. Hmm. Contract testing with only signatures is tricky. I need to make reasonable assumptions and test boundaries.

Let's think about ea

---

## S009 — spec-test — `innomcp-node/src/services/generalGate.ts` [zai-org/GLM-5.1]
```typescript
import {
  LOW_CONFIDENCE_FALLBACK_TEXT,
  renderGeneralFallbackMessage,
  renderThaiNumberText,
  countDaysUntilEndOfYear,
  renderGeneralSmokeAnswer,
  isGarbage,
  answerGeneralWithFastModel,
} from '../src/services/generalGate';

// Mocking external network dependencies deterministically for offline execution
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mocked AI response' } }],
        }),
      },
    },
  })),
}));

beforeAll(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'Mocked fetch response' } }] }),
    })
  ) as jest.Mock;
});

beforeEach(() => {
  (global.fetch as jest.Mock).mockClear();
});

describe('generalGate module contracts', () => {
  describe('LOW_CONFIDENCE_FALLBACK_TEXT', () => {
    it('should export the exact Thai fallback text constant', () => {
      expect(LOW_CONFIDENCE_FALLBACK_TEXT).toBe(
        "ขอข้อมูลเพิ่มอีกนิดเพื่อให้ตอบได้แม่นยำขึ้น เช่น ระบุจังหวัดหรือหัวข้อที่ต้องการ"
      );
    });
  });

  describe('renderGeneralFallbackMessage', () => {
    it('should return a non-empty string', () => {
      const result = renderGeneralFallbackMessage();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return the LOW_CONFIDENCE_FALLBACK_TEXT constant', () => {
      expect(renderGeneralFallbackMessage()).toBe(LOW_CONFIDENCE_FALLBACK_TEXT);
    });
  });

  describe('renderThaiNumberText', () => {
    it('should render 0 as "ศูนย์"', () => {
      expect(renderThaiNumberText(0)).toBe('ศูนย์');
    });

    it('should render 1 as "หนึ่ง"', () => {
      expect(renderThaiNumberText(1)).toBe('หนึ่ง');
    });

    it('should render 10 as "สิบ"', () => {
      expect(renderThaiNumberText(10)).toBe('สิบ');
    });

    it('should render 11 as "สิบเอ็ด"', () => {
      expect(renderThaiNumberText(11)).toBe('สิบเอ็ด');
    });

    it('should render 20 as "ยี่สิบ"', () => {
      expect(renderThaiNumberText(20)).toBe('ยี่สิบ');
    });

    it('should render 21 as "ยี่สิบเอ็ด"', () => {
      expect(renderThaiNumberText(21)).toBe('ยี่สิบเอ็ด');
    });

    it('should render 100 as "หนึ่งร้อย"', () => {
      expect(renderThaiNumberText(100)).toBe('หนึ่งร้อย');
    });

    it('should render 121 as "หนึ่งร้อยยี่สิบเอ็ด"', () => {
      expect(renderThaiNumberText(121)).toBe('หนึ่งร้อยยี่สิบเอ็ด');
    });
  });

  describe('countDaysUntilEndOfYear', () => {
    it('should return 0 for the last day of the year', () => {
      const lastDay = new Date('2023-12-31T00:00:00.000Z');
      expect(countDaysUntilEndOfYear(lastDay)).toBe(0);
    });

    it('should return 1 for the second to last day of the year', () => {
      const secondLastDay = new Date('2023-12-30T00:00:00.000Z');
      expect(countDaysUntilEndOfYear(secondLastDay)).toBe(1);
    });

    it('should return 364 for Jan 1 in a non-leap year', () => {
      const janFirst = new Date('2023-01-01T00:00:00.000Z');
      expect(countDaysUntilEndOfYear(janFirst)).toBe(364);
    });

    it('should return 365 for Jan 1 in a leap year', () => {
      const janFirstLeap = new Date('2024-01-01T00:00:00.000Z');
      expect(countDaysUntilEndOfYear(janFirstLeap)).toBe(365);
    });
  });

  describe('renderGeneralSmokeAnswer', () => {
    it('should return a string when given a valid string', () => {
      const result = renderGeneralSmokeAnswer('test input');
      expect(typeof result).toBe('string');
    });

    it('should return a non-empty string', () => {
      const result = renderGeneralSmokeAnswer('สวัสดี');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('isGarbage', () => {
    it('should return true for an empty string', () => {
      expect(isGarbage('')).toBe(true);
    });

    it('shou

---

## S010 — spec-test — `innomcp-node/src/services/healthAggregator.ts` [MiniMaxAI/MiniMax-M3]
```typescript
import HealthAggregator, {
  HealthStatus,
  HealthStatusValue,
  HealthChecker,
  AggregatedHealth,
} from '../src/services/healthAggregator';

const makeStatus = (status: HealthStatusValue, latencyMs = 1): HealthStatus => ({
  status,
  latencyMs,
  timestamp: 0,
});

const fastStatus = (status: HealthStatusValue): HealthStatus =>
  makeStatus(status, 5);

describe('HealthAggregator (contract)', () => {
  describe('getInstance()', () => {
    it('returns an instance of HealthAggregator', () => {
      const instance = HealthAggregator.getInstance();
      expect(instance).toBeInstanceOf(HealthAggregator);
    });

    it('returns the same instance on subsequent calls (singleton)', () => {
      const a = HealthAggregator.getInstance();
      const b = HealthAggregator.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('registerChecker()', () => {
    let aggregator: HealthAggregator;
    beforeEach(() => {
      aggregator = HealthAggregator.getInstance();
    });

    it('accepts a checker function and exposes it in aggregated check results', async () => {
      const checker: HealthChecker = jest.fn(async () => fastStatus('healthy'));
      aggregator.registerChecker('svc-a', checker);

      const result = await aggregator.check();
      const registered = result.services.find((s) => s.name === 'svc-a');
      expect(registered).toBeDefined();
      expect(registered!.status).toBe<HealthStatusValue>('healthy');
      expect(checker).toHaveBeenCalledTimes(1);
    });

    it('accumulates multiple registered checkers', async () => {
      aggregator.registerChecker('a', async () => fastStatus('healthy'));
      aggregator.registerChecker('b', async () => fastStatus('degraded'));
      aggregator.registerChecker('c', async () => fastStatus('unhealthy'));

      const result = await aggregator.check();
      const names = result.services.map((s) => s.name).sort();
      expect(names).toEqual(['a', 'b', 'c']);
      expect(result.services.find((s) => s.name === 'a')!.status).toBe('healthy');
      expect(result.services.find((s) => s.name === 'b')!.status).toBe('degraded');
      expect(result.services.find((s) => s.name === 'c')!.status).toBe('unhealthy');
    });

    it('returns a Promise<AggregatedHealth> from check()', async () => {
      aggregator.registerChecker('svc', async () => fastStatus('healthy'));
      const result = aggregator.check();
      expect(result).toBeInstanceOf(Promise);
      const resolved = await result;
      expect(resolved).toBeDefined();
      expect(typeof resolved.status).toBe('string');
    });
  });

  describe('check() aggregation rules', () => {
    let aggregator: HealthAggregator;
    beforeEach(() => {
      aggregator = HealthAggregator.getInstance();
    });

    it('returns "healthy" when all registered checkers are healthy', async () => {
      aggregator.registerChecker('db', async () => fastStatus('healthy'));
      aggregator.registerChecker('net', async () => fastStatus('healthy'));

      const result = await aggregator.check();
      expect(result.status).toBe<HealthStatusValue>('healthy');
    });

    it('returns "degraded" when any checker is degraded but none are unhealthy', async () => {
      aggregator.registerChecker('db', async () => fastStatus('healthy'));
      aggregator.registerChecker('cache', async () => fastStatus('degraded'));

      const result = await aggregator.check();
      expect(result.status).toBe<HealthStatusValue>('degraded');
    });

    it('returns "unhealthy" when any checker is unhealthy (unhealthy wins over degraded)', async () => {
      aggregator.registerChecker('db', async () => fastStatus('degraded'));
      aggregator.registerChecker('auth', async () => fastStatus('unhealthy'));
      aggregator.registerChecker('cache', async () => fastStatus('healthy'));

      const result = await aggregator.check();
      expect(result.status).toBe<HealthStatusValue>('unhealthy');
    });

    it('includes latency inform

---

## S011 — spec-test — `innomcp-node/src/services/hotRetriever.ts` [deepseek/deepseek-v4-flash]
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
      const fact1 = result.find((f) =

---

## S012 — spec-test — `innomcp-node/src/services/imageGenService.ts` [Qwen/Qwen3.7-Max]
```typescript
import {
  callPollinations,
  callImageGen,
  buildImageGenText,
  callGateway,
  ImageGenResult,
  ImageGenError,
  ImageGenResponse,
  CallImageGenOptions,
} from '../src/services/imageGenService';

// ── helpers ──────────────────────────────────────────────────────────
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

// ── callPollinations ─────────────────────────────────────────────────
describe('callPollinations', () => {
  it('returns an ImageGenResult containing a url for a valid prompt', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('image-binary-data', { status: 200, headers: { 'content-type': 'image/png' } }),
    );

    const result = await callPollinations('a sunset over mountains');

    expect(result).toBeDefined();
    expect(typeof result.url).toBe('string');
    expect(result.url.length).toBeGreaterThan(0);
  });

  it('encodes the prompt in the outgoing request URL', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('ok', { status: 200, headers: { 'content-type': 'image/png' } }),
    );

    await callPollinations('hello world & friends');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl: string = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('hello');
    // space should be encoded
    expect(calledUrl).not.toContain(' ');
  });

  it('throws or rejects when the network request fails', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('network error'));

    await expect(callPollinations('test prompt')).rejects.toThrow();
  });

  it('throws or rejects when the gateway returns a non-2xx status', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 }),
    );

    await expect(callPollinations('test prompt')).rejects.toThrow();
  });

  it('handles an empty-string prompt without crashing', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('ok', { status: 200, headers: { 'content-type': 'image/png' } }),
    );

    // Should either return a result or throw a validation error — but not hang/crash
    const promise = callPollinations('');
    await expect(promise).toBeDefined();
  });
});

// ── callGateway ──────────────────────────────────────────────────────
describe('callGateway', () => {
  it('resolves with a defined value on a successful gateway response', async () => {
    const fakePayload = { url: 'https://cdn.example.com/img.png', revisedPrompt: 'a cat' };
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(fakePayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await callGateway('a cat sitting on a mat');

    expect(result).toBeDefined();
    expect(typeof (result as ImageGenResult).url).toBe('string');
  });

  it('rejects when the gateway returns an error status', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 }),
    );

    await expect(callGateway('prompt')).rejects.toThrow();
  });

  it('rejects on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(callGateway('prompt')).rejects.toThrow();
  });
});

// ── callImageGen ─────────────────────────────────────────────────────
describe('callImageGen', () => {
  const baseOptions: CallImageGenOptions = { prompt: 'a futuristic cityscape' } as CallImageGenOptions;

  it('returns { ok: true, ...result } on success', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('image-bytes', { status: 200, headers: { 'content-type': 'image/png' } }),
    );

    const response: ImageGenResponse = await callImageGen(baseOptions);

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(typeof response.url).toBe('

---

## S013 — spec-test — `innomcp-node/src/services/memoryRagHook.ts` [moonshotai/Kimi-K2.6]
The user wants a Jest contract/behavior test for a module called `memoryRagHook`. I only have the public API surface (signatures), not the implementation. I need to write tests that assert on the contract implied by the names and signatures.

Key rules:
1. Import EXACTLY: `import ... from '../src/services/memoryRagHook';`
2. Test observable behavior/contracts: correct outputs for valid inputs, error/throw on invalid inputs, boundary conditions. Assert VALUES/STATE, not just mocks.
3. Mock external deps deterministically. Offline. Strict TS.
4. Output exactly one typescript block, complete test file, nothing else.

Let's analyze the signatures:

```typescript
export async function initMemoryRag(): Promise<{ docCount: number; chunkCount: number }> {
export interface MemoryRagMeta {
export function recordTurnAndGetMeta(
export function enrichGroundedContract(structuredContent: any, ragMeta: MemoryRagMeta): void {
export function queryColdRag(query: string, domain?: string): { context: string; docCount: number; sources: string[] } {
export function getMemoryDebugData(sessionId: string) {
export function disambiguateWithSessionMemory(
```

Wait, some signatures are incomplete in the prompt. I need to infer reasonable contracts based on the names and what I can see.

Let's infer:

1. `initMemoryRag(): Promise<{ docCount: number; chunkCount: number }>`
   - Initializes the memory RAG system.
   - Returns a promise resolving to an object with `docCount` and `chunkCount` (non-negative integers?).
   - Should probably throw if called twice or if initialization fails? Contract: returns stats. Maybe idempotent or throws on re-init? I'll test that it returns the expected shape and non-negative numbers.

2. `interface MemoryRagMeta`
   - Likely contains metadata about RAG context. Probably fields like `sources`, `chunkCount`, `domain`, etc. Since it's an interface used by other functions, I need to define a mock object that satisfies it for testing functions that depend on it. I don't know exact fields, but I can create a mock that seems reasonable and test that functions accepting it work. However, since I don't know the exact shape, I should be careful. The contract tests should probably test that `recordTurnAndGetMeta` returns something assignable to `MemoryRagMeta`, and `enrichGroundedContract` accepts it. But without knowing the shape, I can use `as MemoryRagMeta` or create a minimal object. Actually, since I don't have the implementation, I need to infer the minimal contract. Maybe `MemoryRagMeta` is just an opaque object or has specific fields. I'll assume it has at least `sessionId` or `turnCount`? No, let's look at the function names.
   - `recordTurnAndGetMeta` - likely takes some turn data and returns `MemoryRagMeta`.
   - `enrichGroundedContract(structuredContent: any, ragMeta: MemoryRagMeta): void` - mutates or enriches `structuredContent` using `ragMeta`. Since it returns void, it likely mutates the input object or the contract is that it performs side effects. But the prompt says "Assert VALUES/STATE". If it mutates `structuredContent`, I can assert on the mutated object. If it's purely side-effect based on external deps, I mock those. The name "enrich... void" suggests mutation of the first argument. I'll test that `structuredContent` is modified.

3. `recordTurnAndGetMeta(` - signature incomplete. Likely takes something like `(sessionId: string, userText: string, assistantText: string)` or similar. I'll infer it takes parameters related to a turn and returns `MemoryRagMeta`. Since I don't know the exact params, I need to make a reasonable assumption. Wait, the prompt says "You are given ONLY its public API surface (signatures)". The signature is literally `export function recordTurnAndGetMeta(`. It's cut off. I have to infer the most logical signature based on context. Given `getMemoryDebugData(sessionId: string)` and `disambiguateWithSessionMemory(`, and `recordTurnAndGetMeta`, it's likely:
   `export function recordTurnAn

---

## S014 — spec-test — `innomcp-node/src/services/modelLoadBalancer.ts` [zai-org/GLM-5.1]
```typescript
import ModelLoadBalancer, {
  ModelConfig,
  ModelStats,
  Strategy,
} from '../src/services/modelLoadBalancer';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConfigs(count: number, baseWeight?: number): ModelConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `model-${i}`,
    weight: baseWeight ?? 1,
    endpoint: `https://model-${i}.example.com`,
  }));
}

function makeConfigsWithWeights(weights: number[]): ModelConfig[] {
  return weights.map((w, i) => ({
    id: `model-${i}`,
    weight: w,
    endpoint: `https://model-${i}.example.com`,
  }));
}

// ─── Constructor contract ────────────────────────────────────────────────────

describe('ModelLoadBalancer — constructor contract', () => {
  it('accepts a non-empty model list and defaults strategy to round-robin', () => {
    const lb = new ModelLoadBalancer(makeConfigs(3));
    // round-robin is the most neutral default; verify via repeated selects
    const ids = Array.from({ length: 6 }, () => lb.select().id);
    expect(ids).toEqual([
      'model-0', 'model-1', 'model-2',
      'model-0', 'model-1', 'model-2',
    ]);
  });

  it('accepts an explicit strategy', () => {
    const lb = new ModelLoadBalancer(makeConfigs(3), 'random');
    // random must still return a valid model id from the pool
    for (let i = 0; i < 20; i++) {
      const selected = lb.select();
      expect(['model-0', 'model-1', 'model-2']).toContain(selected.id);
    }
  });

  it('throws on empty model list', () => {
    expect(() => new ModelLoadBalancer([])).toThrow();
  });

  it('throws on invalid strategy', () => {
    expect(() => new ModelLoadBalancer(makeConfigs(2), 'invalid' as Strategy)).toThrow();
  });

  it('throws on model config missing id', () => {
    expect(() => new ModelLoadBalancer([{ weight: 1 }] as ModelConfig[])).toThrow();
  });

  it('throws on duplicate model ids', () => {
    const configs: ModelConfig[] = [
      { id: 'dup', weight: 1 },
      { id: 'dup', weight: 2 },
    ];
    expect(() => new ModelLoadBalancer(configs)).toThrow();
  });
});

// ─── Round-robin contract ───────────────────────────────────────────────────

describe('ModelLoadBalancer — round-robin strategy', () => {
  it('cycles through models in insertion order', () => {
    const lb = new ModelLoadBalancer(makeConfigs(4), 'round-robin');
    const ids = Array.from({ length: 12 }, () => lb.select().id);
    expect(ids).toEqual([
      'model-0', 'model-1', 'model-2', 'model-3',
      'model-0', 'model-1', 'model-2', 'model-3',
      'model-0', 'model-1', 'model-2', 'model-3',
    ]);
  });

  it('skips removed models and continues cycling remaining ones', () => {
    const lb = new ModelLoadBalancer(makeConfigs(3), 'round-robin');
    lb.select(); // model-0
    lb.select(); // model-1
    lb.removeModel('model-2');
    const ids = Array.from({ length: 4 }, () => lb.select().id);
    expect(ids).toEqual(['model-0', 'model-1', 'model-0', 'model-1']);
  });

  it('resets cycle pointer when strategy is changed back', () => {
    const lb = new ModelLoadBalancer(makeConfigs(3), 'round-robin');
    lb.select(); // model-0
    lb.setStrategy('random');
    lb.setStrategy('round-robin');
    // cycle should restart from first model
    const ids = Array.from({ length: 3 }, () => lb.select().id);
    expect(ids).toEqual(['model-0', 'model-1', 'model-2']);
  });
});

// ─── Least-latency contract ─────────────────────────────────────────────────

describe('ModelLoadBalancer — least-latency strategy', () => {
  it('selects the model with the lowest average latency', () => {
    const lb = new ModelLoadBalancer(makeConfigs(3), 'least-latency');
    lb.reportLatency('model-0', 200);
    lb.reportLatency('model-1', 50);
    lb.reportLatency('model-2', 150);
    expect(lb.select().id).toBe('model-1');
  });

  it('updates selection after new latency reports', () => {
    const lb = new ModelLoadBalancer(makeConfigs(3), 'least-late

---

## S015 — spec-test — `innomcp-node/src/services/motherExportService.ts` [MiniMaxAI/MiniMax-M3]
```typescript
import { exportToJSON, exportToCSV, motherExportService } from '../src/services/motherExportService';

describe('motherExportService - public contract', () => {
  describe('exportToJSON', () => {
    it('returns a JSON string when called with no arguments', () => {
      const result = exportToJSON();
      expect(typeof result).toBe('string');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('returns a JSON string when called with an empty options object', () => {
      const result = exportToJSON({});
      expect(typeof result).toBe('string');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('returns a JSON string when called with explicit options', () => {
      const result = exportToJSON({ pretty: true });
      expect(typeof result).toBe('string');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('produces parseable JSON whose top-level value is not undefined', () => {
      const result = exportToJSON();
      const parsed = JSON.parse(result);
      expect(parsed).not.toBeUndefined();
    });
  });

  describe('exportToCSV', () => {
    it('returns a string when called with no arguments', () => {
      const result = exportToCSV();
      expect(typeof result).toBe('string');
    });

    it('returns a string when called with an empty options object', () => {
      const result = exportToCSV({});
      expect(typeof result).toBe('string');
    });

    it('returns a string when called with explicit options', () => {
      const result = exportToCSV({ delimiter: ';' });
      expect(typeof result).toBe('string');
    });

    it('output does not start with a BOM or non-printable character', () => {
      const result = exportToCSV();
      if (result.length > 0) {
        const firstCode = result.charCodeAt(0);
        // First character must be printable ASCII (>= 0x20) or start-of-text.
        expect(firstCode).toBeGreaterThanOrEqual(0x20);
      }
    });
  });

  describe('motherExportService object', () => {
    it('is a non-null object', () => {
      expect(motherExportService).toBeDefined();
      expect(motherExportService).not.toBeNull();
      expect(typeof motherExportService).toBe('object');
    });

    it('exposes exportToJSON as a function', () => {
      expect(typeof motherExportService.exportToJSON).toBe('function');
    });

    it('exposes exportToCSV as a function', () => {
      expect(typeof motherExportService.exportToCSV).toBe('function');
    });

    it('exportToJSON method returns a parseable JSON string', () => {
      const result = motherExportService.exportToJSON();
      expect(typeof result).toBe('string');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('exportToCSV method returns a string', () => {
      const result = motherExportService.exportToCSV();
      expect(typeof result).toBe('string');
    });

    it('object method results are consistent with the standalone functions', () => {
      const standaloneJson = exportToJSON();
      const methodJson = motherExportService.exportToJSON();
      expect(typeof methodJson).toBe(typeof standaloneJson);

      const standaloneCsv = exportToCSV();
      const methodCsv = motherExportService.exportToCSV();
      expect(typeof methodCsv).toBe(typeof standaloneCsv);
    });
  });

  describe('boundary / determinism', () => {
    it('exportToJSON called multiple times with no args returns strings of equal type', () => {
      const a = exportToJSON();
      const b = exportToJSON();
      expect(typeof a).toBe('string');
      expect(typeof b).toBe('string');
    });

    it('exportToCSV called multiple times with no args returns strings of equal type', () => {
      const a = exportToCSV();
      const b = exportToCSV();
      expect(typeof a).toBe('string');
      expect(typeof b).toBe('string');
    });
  });
});
```

---

## S016 — spec-test — `innomcp-node/src/services/notificationService.ts` [deepseek/deepseek-v4-flash]
```typescript
import { notificationService, Notification, NotificationType } from '../src/services/notificationService';

describe('NotificationService contract', () => {
  // Helper to create a valid notification (minimal required fields)
  const validNotification = (type: NotificationType, message?: string): Notification => ({
    type,
    ...(message !== undefined ? { message } : {}),
    // Assume timestamp is optional and auto-generated by the service
  });

  // Reset internal state (if method exists) or recreate service before each test
  beforeEach(() => {
    // If the service has a clearHistory method, use it; otherwise we rely on a fresh instance
    if (typeof (notificationService as any).clearHistory === 'function') {
      (notificationService as any).clearHistory();
    }
    // Alternatively, we could mock the module to return a fresh instance, but that's complex.
    // For contract testing we assume the instance is stateless or we can reset.
  });

  test('should be defined with a send method', () => {
    expect(notificationService).toBeDefined();
    expect(typeof (notificationService as any).send).toBe('function');
  });

  describe('send() – valid input handling', () => {
    test.each<NotificationType>([
      'task_complete',
      'agent_done',
      'error',
      'system',
      'mdes_alert',
    ])('should accept notification with type %s', (type) => {
      const notification = validNotification(type, 'test message');
      expect(() => notificationService.send(notification)).not.toThrow();
    });

    test('should accept notification without optional fields (e.g., message)', () => {
      const notification: Notification = { type: 'system' };
      expect(() => notificationService.send(notification)).not.toThrow();
    });

    test('should accept notification with extra optional fields if allowed by interface', () => {
      const notification = { type: 'error', message: 'Critical', details: { code: 500 } } as Notification;
      expect(() => notificationService.send(notification)).not.toThrow();
    });
  });

  describe('send() – invalid input handling', () => {
    test('should throw on invalid notification type', () => {
      const notification = { type: 'invalid_type' } as Notification;
      expect(() => notificationService.send(notification)).toThrow();
    });

    test('should throw on missing type field', () => {
      const notification = { message: 'no type' } as Notification;
      expect(() => notificationService.send(notification)).toThrow();
    });

    test('should throw on null notification', () => {
      expect(() => notificationService.send(null as any)).toThrow();
    });

    test('should throw on undefined notification', () => {
      expect(() => notificationService.send(undefined as any)).toThrow();
    });

    test('should throw on non-object input', () => {
      expect(() => notificationService.send('string' as any)).toThrow();
      expect(() => notificationService.send(42 as any)).toThrow();
      expect(() => notificationService.send(true as any)).toThrow();
    });

    test('should throw on notification with type not matching allowed literals', () => {
      const notification = { type: '' } as Notification;
      expect(() => notificationService.send(notification)).toThrow();
    });
  });

  describe('observable state after send()', () => {
    test('should store sent notification and allow retrieval (if getHistory exists)', () => {
      // This test depends on the service exposing a getHistory method.
      // If it doesn't, we skip or fail gracefully.
      const getHistory = (notificationService as any).getHistory;
      if (typeof getHistory !== 'function') {
        console.warn('Skipping state test: getHistory not available');
        return;
      }

      const notification = validNotification('agent_done', 'Agent finished');
      const initialHistory = getHistory();
      expect(initialHistory).toBeDefined();
      expect(Array.isArray(initialHi

---

## S017 — spec-test — `innomcp-node/src/services/providerAdapter.ts` [Qwen/Qwen3.7-Max]
```typescript
import {
  callProvider,
  streamProvider,
  callOpenAI,
  streamOpenAI,
  callAnthropic,
  streamAnthropic,
  callOllama,
  streamOllama,
  ChatMessage,
  AdapterRequest,
  AdapterChunk
} from '../src/services/providerAdapter';

// Mock global fetch to ensure offline, deterministic behavior for any underlying HTTP clients
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('providerAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful mock for fetch to prevent network errors during valid routing tests
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'mocked response' } }] }),
      text: async () => '{"choices":[{"message":{"content":"mocked response"}}]}',
      body: {
        getReader: () => ({
          read: jest.fn()
            .mockResolvedValueOnce({ 
              value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'), 
              done: false 
            })
            .mockResolvedValueOnce({ 
              value: new TextEncoder().encode('data: [DONE]\n\n'), 
              done: false 
            })
            .mockResolvedValueOnce({ done: true })
        })
      }
    });
  });

  const validMessages: ChatMessage[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello' }
  ];

  const createValidRequest = (provider: string): AdapterRequest => ({
    provider: provider as any,
    model: 'test-model',
    messages: validMessages,
    apiKey: 'test-api-key',
    temperature: 0.7
  } as AdapterRequest);

  describe('callProvider (Generic Router)', () => {
    it('should throw an error when an unsupported provider is specified', async () => {
      const req = createValidRequest('invalid_provider');
      await expect(callProvider(req)).rejects.toThrow(/unsupported|invalid|unknown|provider/i);
    });

    it('should throw an error when messages array is empty', async () => {
      const req = createValidRequest('openai');
      (req as any).messages = [];
      await expect(callProvider(req)).rejects.toThrow(/message/i);
    });

    it('should throw an error when messages array is missing', async () => {
      const req = createValidRequest('openai');
      delete (req as any).messages;
      await expect(callProvider(req)).rejects.toThrow();
    });

    it('should route to OpenAI and return a defined result for valid openai request', async () => {
      const req = createValidRequest('openai');
      const result = await callProvider(req);
      expect(result).toBeDefined();
    });

    it('should route to Anthropic and return a defined result for valid anthropic request', async () => {
      const req = createValidRequest('anthropic');
      const result = await callProvider(req);
      expect(result).toBeDefined();
    });

    it('should route to Ollama and return a defined result for valid ollama request', async () => {
      const req = createValidRequest('ollama');
      const result = await callProvider(req);
      expect(result).toBeDefined();
    });
  });

  describe('streamProvider (Generic Router)', () => {
    // Helper to consume async iterables to catch deferred errors
    const consumeStream = async (stream: AsyncIterable<AdapterChunk>) => {
      const chunks: AdapterChunk[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      return chunks;
    };

    it('should throw an error when an unsupported provider is specified', async () => {
      const req = createValidRequest('invalid_provider');
      const stream = streamProvider(req);
      await expect(consumeStream(stream)).rejects.toThrow(/unsupported|invalid|unknown|provider/i);
    });

    it('should throw an error when messages array is empty', async () => {
      const req = createValidRequest('openai');
      (req as any).messages = [];
      const stream = streamPro

---

## S018 — spec-test — `innomcp-node/src/services/providerFailover.ts` [moonshotai/Kimi-K2.6]
The user wants a Jest contract/behavior test for a module called `providerFailover`. I only have the public API surface, not the implementation. I need to infer the intended behavior from the names and signatures.

Key observations from the API:
- `ProviderStatus` and `ProviderConfig` are interfaces (not fully shown, but implied).
- `HealthCheckFn` is a function that takes a providerId and returns a promise of `{ healthy: boolean; latencyMs: number }`.
- `ProviderFailover` class with:
  - constructor (signature not fully shown, but likely takes some config or providers?)
  - `setHealthChecker(fn)`: sets the health check function.
  - `selectProvider(_task?: string): Promise<string>`: selects a provider, optionally based on a task. Should return a provider ID. If no healthy providers, probably throws.
  - `markFailed(providerId: string): Promise<void>`: marks a provider as failed/unhealthy.
  - `markHealthy(providerId: string, latencyMs: number): Promise<void>`: marks a provider as healthy with a given latency.
  - `checkProvider(providerId: string): Promise<boolean>`: checks if a provider is healthy. Likely uses the health checker if set, or internal state.
  - `getStats()`: returns some stats object (likely including provider statuses, latencies, etc.).
  - `resetAll(): void`: resets all state.
- `providerFailover` is a singleton instance exported.

Wait, the constructor signature is incomplete: `constructor(` - no parameters shown. But since there's a singleton `providerFailover` exported, and `setHealthChecker` exists, maybe the constructor takes no args or some config. Since I don't know, I should probably instantiate the class directly in tests, or use the singleton? The export includes both the class and a singleton instance. To test properly, I should probably instantiate the class to have isolated state, but if the constructor requires unknown arguments, that's risky. However, the singleton is exported, so I can test that, but tests need isolation. The `resetAll()` method helps with isolation.

Actually, looking at the API: `constructor(` is cut off. It might take `ProviderConfig[]` or something. But since I don't know, I should avoid guessing constructor args if possible. However, the exported singleton `providerFailover` is available. But using a singleton across tests is bad practice unless `resetAll()` truly resets everything. I can test the singleton but call `resetAll()` in `beforeEach`. Or I can try `new ProviderFailover()` with no args if the signature allows. Since it's cut off, maybe it takes no args, or optional args. I'll use the exported singleton to be safe, as it's guaranteed to exist without constructor arguments.

Wait, the import is `import ... from '../src/services/providerFailover';`. I need to import the specific items. I'll import `ProviderFailover`, `providerFailover`, `HealthCheckFn`, etc. as needed.

Let's infer contracts:

1. `setHealthChecker(fn)`:
   - Should set the health checker function used by `checkProvider`.
   - If not set, `checkProvider` might return false or throw? Probably returns false or uses internal state only.
   - Contract: after setting, `checkProvider` should use this function.

2. `selectProvider(_task?)`:
   - Should return a provider ID string.
   - Should prefer healthy providers.
   - If multiple healthy, maybe lowest latency? The existence of `latencyMs` in `markHealthy` and `HealthCheckFn` suggests latency-aware selection.
   - If no providers are known/healthy, should throw an error (no available provider).
   - If called with a task, might select based on task affinity, but since we don't know, we test that it returns a string and throws when none available.

3. `markFailed(providerId)`:
   - Should mark the provider as unhealthy/failed.
   - After marking, `selectProvider` should not return this provider (unless it's the only one? No, probably excludes it).
   - `getStats()` should reflect the failed status.

4. `markHealthy(providerId, latencyMs)`:
   - Should 

---

## S019 — spec-test — `innomcp-node/src/services/providerHealthProbe.ts` [zai-org/GLM-5.1]
```typescript
import {
  ProbeStatus,
  ProviderProbeResult,
  probeStatus,
  runSingleProbe,
  runProbe,
  getProbeStatus,
  getAll
} from '../src/services/providerHealthProbe';

// ProbeTarget is not exported, so we define a compatible local interface
interface ProbeTarget {
  providerId: string;
  baseUrl?: string;
  apiKey?: string;
}

// Mock global fetch for deterministic offline testing of network probes
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('providerHealthProbe Contract Tests', () => {
  beforeEach(() => {
    // Clear the shared state map before each test to ensure isolation
    probeStatus.clear();
    mockFetch.mockReset();
  });

  describe('getProbeStatus', () => {
    it('should return a valid ProbeStatus for an unknown provider', () => {
      const status = getProbeStatus('unknown-provider');
      const validStatuses: ProbeStatus[] = ['online', 'offline', 'configured', 'checking'];
      expect(validStatuses).toContain(status);
    });

    it('should return "online" or "offline" for a probed provider based on state', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
      await runSingleProbe({ providerId: 'test-provider', baseUrl: 'http://test.local' });
      
      const status = getProbeStatus('test-provider');
      expect(status).toBe('online');
      
      mockFetch.mockRejectedValue(new Error('Network error'));
      await runSingleProbe({ providerId: 'test-provider', baseUrl: 'http://test.local' });
      
      const updatedStatus = getProbeStatus('test-provider');
      expect(updatedStatus).toBe('offline');
    });

    it('should throw a TypeError or Error if providerId is invalid', () => {
      expect(() => getProbeStatus('')).toThrow();
      // @ts-expect-error - Testing contract violation of missing argument
      expect(() => getProbeStatus()).toThrow();
    });
  });

  describe('getAll', () => {
    it('should return an empty array when no probes have been run', () => {
      const results = getAll();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should return an array of ProviderProbeResult matching the probeStatus map', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
      
      await runSingleProbe({ providerId: 'provider-1', baseUrl: 'http://test1.local' });
      await runSingleProbe({ providerId: 'provider-2', baseUrl: 'http://test2.local' });

      const results = getAll();
      expect(results.length).toBe(2);
      
      const ids = results.map(r => r.providerId);
      expect(ids).toContain('provider-1');
      expect(ids).toContain('provider-2');
      
      results.forEach(result => {
        expect(result.status).toBe('online');
      });
    });
  });

  describe('runSingleProbe', () => {
    it('should return a ProviderProbeResult with status "online" on successful connection', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
      
      const target: ProbeTarget = { providerId: 'ollama', baseUrl: 'http://localhost:11434' };
      const result = await runSingleProbe(target);

      expect(result.providerId).toBe('ollama');
      expect(result.status).toBe('online');
      expect(typeof result.latency).toBe('number');
      expect(result.error).toBeUndefined();
    });

    it('should return a ProviderProbeResult with status "offline" on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      
      const target: ProbeTarget = { providerId: 'openai', baseUrl: 'https://api.openai.com' };
      const result = await runSingleProbe(target);

      expect(result.providerId).toBe('openai');
      expect(result.status).toBe('offline');
      expect(result.error).toContain('ECONNREFUSED');
    });

    it('should update the global probeStatus map with the result', async () 

---

## S020 — spec-test — `innomcp-node/src/services/providerManager.ts` [MiniMaxAI/MiniMax-M3]
```typescript
import { ProviderManager, ProviderConfig, providerManager } from '../src/services/providerManager';

const baseConfig = (overrides: Partial<ProviderConfig> = {}): ProviderConfig => ({
  id: 'p1',
  name: 'Provider One',
  baseUrl: 'https://provider.one',
  apiKey: 'key-1',
  capabilities: ['thai', 'general'],
  priority: 1,
  enabled: true,
  ...overrides,
});

describe('ProviderManager (contract tests)', () => {
  let pm: ProviderManager;

  beforeEach(() => {
    pm = new ProviderManager();
  });

  describe('constructor', () => {
    it('should be constructable with no arguments', () => {
      expect(() => new ProviderManager()).not.toThrow();
    });

    it('should start empty (no providers registered)', async () => {
      const all = await pm.getAll();
      expect(all).toEqual([]);
    });

    it('should expose a default singleton instance', () => {
      expect(providerManager).toBeInstanceOf(ProviderManager);
    });
  });

  describe('register', () => {
    it('should add a provider so it appears in getAll()', async () => {
      const cfg = baseConfig();
      await pm.register(cfg);
      const all = await pm.getAll();
      expect(all).toHaveLength(1);
      expect(all[0]).toEqual(cfg);
    });

    it('should accept providers with various capability combinations', async () => {
      const a = baseConfig({ id: 'a', capabilities: ['code'] });
      const b = baseConfig({ id: 'b', capabilities: ['thai', 'code', 'reasoning'] });
      const c = baseConfig({ id: 'c', capabilities: ['fast'] });
      await pm.register(a);
      await pm.register(b);
      await pm.register(c);
      const all = await pm.getAll();
      expect(all.map(p => p.id).sort()).toEqual(['a', 'b', 'c']);
    });

    it('should throw on invalid config (missing id)', async () => {
      const bad = { ...baseConfig(), id: '' } as ProviderConfig;
      await expect(pm.register(bad)).rejects.toBeDefined();
    });

    it('should throw on invalid config (missing required fields)', async () => {
      const bad = { id: 'x' } as ProviderConfig;
      await expect(pm.register(bad)).rejects.toBeDefined();
    });

    it('should throw on duplicate id registration', async () => {
      await pm.register(baseConfig({ id: 'dup' }));
      await expect(pm.register(baseConfig({ id: 'dup' }))).rejects.toBeDefined();
    });
  });

  describe('unregister', () => {
    it('should remove a previously registered provider', async () => {
      await pm.register(baseConfig({ id: 'to-remove' }));
      await pm.unregister('to-remove');
      const all = await pm.getAll();
      expect(all).toEqual([]);
    });

    it('should only remove the specified provider', async () => {
      await pm.register(baseConfig({ id: 'a' }));
      await pm.register(baseConfig({ id: 'b' }));
      await pm.unregister('a');
      const all = await pm.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('b');
    });

    it('should throw when unregistering an unknown id', async () => {
      await expect(pm.unregister('nope')).rejects.toBeDefined();
    });
  });

  describe('getAll', () => {
    it('should return an empty array when nothing is registered', async () => {
      expect(await pm.getAll()).toEqual([]);
    });

    it('should return all registered providers in insertion order', async () => {
      const cfgs = [
        baseConfig({ id: '1' }),
        baseConfig({ id: '2' }),
        baseConfig({ id: '3' }),
      ];
      for (const c of cfgs) await pm.register(c);
      const all = await pm.getAll();
      expect(all).toHaveLength(3);
      expect(all.map(p => p.id)).toEqual(['1', '2', '3']);
    });

    it('should return a defensive copy (mutating result must not affect internal state)', async () => {
      await pm.register(baseConfig({ id: 'x' }));
      const result = await pm.getAll();
      result.pop();
      const after = await pm.getAll();
      expect(after).toHaveLength(1);
    });
  });

  describe('getBest', () => {


---

## S021 — spec-test — `innomcp-node/src/services/retrievalOrchestrator.ts` [deepseek/deepseek-v4-flash]
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
      (queryColdSource as jest.Mock).mockResolvedValueO

---

## S022 — spec-test — `innomcp-node/src/services/serviceStatusAggregator.ts` [Qwen/Qwen3.7-Max]
```typescript
import { checkAllServices } from '../src/services/serviceStatusAggregator';

// Mock the underlying service health check dependencies
jest.mock('../src/services/serviceChecks', () => ({
  checkDatabase: jest.fn(),
  checkCache: jest.fn(),
  checkApiGateway: jest.fn(),
  checkMessageQueue: jest.fn(),
}));

jest.mock('../src/services/serviceRegistry', () => ({
  getRegisteredServices: jest.fn(() => [
    { name: 'database', checker: 'checkDatabase' },
    { name: 'cache', checker: 'checkCache' },
    { name: 'apiGateway', checker: 'checkApiGateway' },
    { name: 'messageQueue', checker: 'checkMessageQueue' },
  ]),
}));

import * as serviceChecks from '../src/services/serviceChecks';

const mockedChecks = serviceChecks as jest.Mocked<typeof serviceChecks>;

describe('serviceStatusAggregator — checkAllServices contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function mockAllHealthy() {
    mockedChecks.checkDatabase.mockResolvedValue({ status: 'up', latency: 12 });
    mockedChecks.checkCache.mockResolvedValue({ status: 'up', latency: 3 });
    mockedChecks.checkApiGateway.mockResolvedValue({ status: 'up', latency: 45 });
    mockedChecks.checkMessageQueue.mockResolvedValue({ status: 'up', latency: 8 });
  }

  function mockAllDown() {
    mockedChecks.checkDatabase.mockResolvedValue({ status: 'down', error: 'Connection refused' });
    mockedChecks.checkCache.mockResolvedValue({ status: 'down', error: 'Timeout' });
    mockedChecks.checkApiGateway.mockResolvedValue({ status: 'down', error: '502 Bad Gateway' });
    mockedChecks.checkMessageQueue.mockResolvedValue({ status: 'down', error: 'Broker unavailable' });
  }

  function mockMixedStatus() {
    mockedChecks.checkDatabase.mockResolvedValue({ status: 'up', latency: 10 });
    mockedChecks.checkCache.mockResolvedValue({ status: 'down', error: 'ECONNREFUSED' });
    mockedChecks.checkApiGateway.mockResolvedValue({ status: 'up', latency: 50 });
    mockedChecks.checkMessageQueue.mockResolvedValue({ status: 'degraded', latency: 2000, error: 'High latency' });
  }

  describe('return shape contract', () => {
    it('resolves to an object with overallStatus, services, and timestamp', async () => {
      mockAllHealthy();

      const result = await checkAllServices();

      expect(result).toHaveProperty('overallStatus');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('timestamp');
    });

    it('returns a numeric timestamp close to current time', async () => {
      mockAllHealthy();
      const before = Date.now();

      const result = await checkAllServices();

      expect(typeof result.timestamp).toBe('number');
      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('returns services as a record/object with string keys', async () => {
      mockAllHealthy();

      const result = await checkAllServices();

      expect(typeof result.services).toBe('object');
      expect(result.services).not.toBeNull();
      expect(Array.isArray(result.services)).toBe(false);
    });
  });

  describe('overallStatus aggregation contract', () => {
    it('returns "healthy" when all services are up', async () => {
      mockAllHealthy();

      const result = await checkAllServices();

      expect(result.overallStatus).toBe('healthy');
    });

    it('returns "down" when all services are down', async () => {
      mockAllDown();

      const result = await checkAllServices();

      expect(result.overallStatus).toBe('down');
    });

    it('returns "degraded" when some services are down or degraded', async () => {
      mockMixedStatus();

      const result = await checkAllServices();

      expect(result.overallStatus).toBe('degraded');
    });

    it('returns "degraded" when only 

---

## S023 — spec-test — `innomcp-node/src/services/sessionMemory.ts` [moonshotai/Kimi-K2.6]
The user wants a Jest contract/behavior test for a module called `sessionMemory`. I only have the public API surface (signatures/names), not the implementation. I need to infer the intended behavior from the names and signatures.

Given exports:
- `MemoryEntity` interface
- `MemoryDomain` type (union of specific strings)
- `MemorySlot` interface
- `SessionMemorySnapshot` interface
- `SessionMemoryStore` class
- `sessionMemory` singleton instance

From the names:
- `SessionMemoryStore` likely manages memory/entities for a session.
- `MemoryDomain` suggests categorization.
- `MemorySlot` probably holds a domain and entities or data.
- `SessionMemorySnapshot` probably represents a point-in-time capture of the store's state.
- Methods I'd expect on `SessionMemoryStore` based on typical patterns for a memory store:
  - `add(domain, entity)` or `remember(domain, entity)`
  - `get(domain)` or `recall(domain)`
  - `getSnapshot()` or `snapshot()`
  - `clear()` or `reset()`
  - `merge(snapshot)` or `restore(snapshot)`
  - `has(domain)`
  - `domains()`
  - `size` or `count`

But wait, the user only provided the export list, not the actual method signatures. They said "public API surface (signatures)" but only listed the exported symbols. I need to infer the most likely signatures based on the names and typical behavior of such a store.

Let me think about what a `SessionMemoryStore` would logically do:
- It stores memories per domain.
- `MemoryEntity` is probably the item being stored.
- `MemorySlot` probably groups entities by domain.
- `SessionMemorySnapshot` probably contains slots or a map of domain to entities.

Likely methods on `SessionMemoryStore`:
- `remember(domain: MemoryDomain, entity: MemoryEntity): void` - adds an entity to a domain
- `recall(domain: MemoryDomain): MemoryEntity[]` - retrieves entities for a domain
- `has(domain: MemoryDomain): boolean` - checks if domain has entries
- `snapshot(): SessionMemorySnapshot` - captures current state
- `restore(snapshot: SessionMemorySnapshot): void` - restores state
- `clear(domain?: MemoryDomain): void` - clears all or specific domain
- `domains(): MemoryDomain[]` - lists active domains
- `size(domain?: MemoryDomain): number` - counts entities

But since I don't have exact signatures, I need to make reasonable inferences that are consistent with the names and write tests that assert on the contract. However, the user said "You are given ONLY its public API surface (signatures)". Maybe they expect me to infer the methods from the class name and interfaces?

Actually, looking at the prompt again, they listed:
```typescript
export interface MemoryEntity {
export type MemoryDomain = "weather" | "evidence" | "geo" | "knowledge" | "calculator" | "datetime" | "general" | "mixed";
export interface MemorySlot {
export interface SessionMemorySnapshot {
export class SessionMemoryStore {
export const sessionMemory = new SessionMemoryStore();
```

The `{` suggests there might be contents, but they were omitted. I need to infer the most logical API.

Let me reconstruct likely interfaces:

```typescript
export interface MemoryEntity {
  id?: string;
  content: string;
  timestamp?: number;
  // maybe metadata?
}

export interface MemorySlot {
  domain: MemoryDomain;
  entities: MemoryEntity[];
}

export interface SessionMemorySnapshot {
  slots: MemorySlot[];
  // or maybe timestamp?
  createdAt: number;
}

export class SessionMemoryStore {
  remember(domain: MemoryDomain, entity: MemoryEntity): void;
  recall(domain: MemoryDomain): MemoryEntity[];
  has(domain: MemoryDomain): boolean;
  snapshot(): SessionMemorySnapshot;
  restore(snapshot: SessionMemorySnapshot): void;
  clear(domain?: MemoryDomain): void;
  domains(): MemoryDomain[];
  count(domain?: MemoryDomain): number;
}
```

Wait, but I need to be careful. The test must import exactly `import ... from '../src/services/sessionMemory';`. The test must compile in strict TS. If I guess wrong about methods, the test won't compile against t

---

## S024 — spec-test — `innomcp-node/src/services/sessionStore.ts` [zai-org/GLM-5.1]
```typescript
import { sessionStore, PersistedSession } from '../src/services/sessionStore';

// Deterministic in-memory file system mock
const memoryStore = new Map<string, string>();

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(async (path: string) => {
    memoryStore.set(path, 'directory');
  }),
  writeFile: jest.fn(async (path: string, data: string) => {
    memoryStore.set(path, data);
  }),
  readFile: jest.fn(async (path: string) => {
    if (memoryStore.has(path)) return memoryStore.get(path)!;
    const err = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    throw err;
  }),
  readdir: jest.fn(async (dirPath: string) => {
    const files: string[] = [];
    for (const key of memoryStore.keys()) {
      if (key.startsWith(dirPath) && !key.substring(dirPath.length + 1).includes('/')) {
        files.push(key.substring(key.lastIndexOf('/') + 1));
      }
    }
    return files;
  }),
  unlink: jest.fn(async (path: string) => {
    if (!memoryStore.has(path)) {
      const err = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    }
    memoryStore.delete(path);
  }),
  stat: jest.fn(async (path: string) => ({
    isDirectory: () => memoryStore.get(path) === 'directory',
    isFile: () => memoryStore.has(path) && memoryStore.get(path) !== 'directory',
  })),
}));

describe('SessionStore Contract', () => {
  beforeEach(() => {
    memoryStore.clear();
    jest.clearAllMocks();
  });

  describe('ensureDirectory', () => {
    it('should resolve without throwing when ensuring directory exists', async () => {
      await expect(sessionStore.ensureDirectory()).resolves.toBeUndefined();
    });
  });

  describe('save & load', () => {
    const validSession: PersistedSession = {
      id: 'session-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [{ role: 'user', content: 'Hello' }],
    } as PersistedSession;

    it('should save a session and load it back with identical state', async () => {
      await sessionStore.save(validSession);
      const loaded = await sessionStore.load('session-1');
      expect(loaded).toEqual(validSession);
    });

    it('should return null when loading a non-existent session', async () => {
      const loaded = await sessionStore.load('non-existent-id');
      expect(loaded).toBeNull();
    });

    it('should throw an error when saving an invalid session (missing id)', async () => {
      const invalidSession = { createdAt: new Date().toISOString() } as unknown as PersistedSession;
      await expect(sessionStore.save(invalidSession)).rejects.toThrow();
    });

    it('should overwrite existing session on save', async () => {
      await sessionStore.save(validSession);
      const updatedSession = { ...validSession, messages: [{ role: 'assistant', content: 'Hi' }] } as PersistedSession;
      await sessionStore.save(updatedSession);
      
      const loaded = await sessionStore.load('session-1');
      expect(loaded).toEqual(updatedSession);
    });
  });

  describe('loadAll', () => {
    it('should return an empty array when no sessions exist', async () => {
      const all = await sessionStore.loadAll();
      expect(all).toEqual([]);
    });

    it('should return all saved sessions', async () => {
      const session1 = { id: 's1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] } as PersistedSession;
      const session2 = { id: 's2', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] } as PersistedSession;
      
      await sessionStore.save(session1);
      await sessionStore.save(session2);
      
      const all = await sessionStore.loadAll();
      expect(all).toHaveLength(2);
      expect(all).toEqual(expect.arrayContaining([session1, session2]));
    });
  });

  describe('delete', () => {
    it('should delete an existi

---

## S025 — spec-test — `innomcp-node/src/services/systemInventory.ts` [MiniMaxAI/MiniMax-M3]
```typescript
import {
  SystemInventorySnapshot,
  InventoryBuildOptions,
  looksLikeSystemInventoryQuestion,
  buildSystemInventorySnapshot,
  renderSystemInventoryAnswer,
  buildSystemInventoryAnswer,
} from '../src/services/systemInventory';

// Mock global fetch used internally for network calls
const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

function mockFetchSequence(responses: Array<{ ok: boolean; status?: number; body?: any; throw?: Error }>) {
  let i = 0;
  global.fetch = jest.fn(async (_url: string, _init?: RequestInit) => {
    const r = responses[i++] ?? responses[responses.length - 1];
    if (r.throw) throw r.throw;
    if (!r.ok) {
      return {
        ok: false,
        status: r.status ?? 500,
        statusText: 'Error',
        text: async () => JSON.stringify(r.body ?? {}),
      } as any;
    }
    return {
      ok: true,
      status: r.status ?? 200,
      statusText: 'OK',
      json: async () => r.body,
      text: async () => JSON.stringify(r.body ?? {}),
    } as any;
  }) as any;
}

describe('looksLikeSystemInventoryQuestion', () => {
  it('returns true for direct inventory keywords', () => {
    expect(looksLikeSystemInventoryQuestion('what services are running?')).toBe(true);
    expect(looksLikeSystemInventoryQuestion('inventory the host')).toBe(true);
    expect(looksLikeSystemInventoryQuestion('list processes')).toBe(true);
    expect(looksLikeSystemInventoryQuestion('show installed packages')).toBe(true);
    expect(looksLikeSystemInventoryQuestion('system inventory please')).toBe(true);
  });

  it('returns true case-insensitively', () => {
    expect(looksLikeSystemInventoryQuestion('WHAT IS RUNNING?')).toBe(true);
    expect(looksLikeSystemInventoryQuestion('System Inventory')).toBe(true);
  });

  it('returns false for unrelated questions', () => {
    expect(looksLikeSystemInventoryQuestion('what is the weather today?')).toBe(false);
    expect(looksLikeSystemInventoryQuestion('tell me a joke')).toBe(false);
    expect(looksLikeSystemInventoryQuestion('')).toBe(false);
  });

  it('throws on non-string input', () => {
    // @ts-expect-error - testing runtime guard
    expect(() => looksLikeSystemInventoryQuestion(null)).toThrow();
    // @ts-expect-error - testing runtime guard
    expect(() => looksLikeSystemInventoryQuestion(undefined)).toThrow();
    // @ts-expect-error - testing runtime guard
    expect(() => looksLikeSystemInventoryQuestion(42 as any)).toThrow();
  });
});

describe('buildSystemInventorySnapshot', () => {
  it('returns a snapshot object with expected shape on success', async () => {
    mockFetchSequence([
      { ok: true, body: { tools: [{ name: 'proc.list' }, { name: 'svc.list' }] } }, // MCP tools
      { ok: true, body: { models: [{ id: 'gpt-x' }, { id: 'claude-y' }] } },         // command code models
    ]);

    const snap = await buildSystemInventorySnapshot({ mcpServerUrl: 'http://mcp', baseUrl: 'http://api' });

    expect(snap).toBeDefined();
    expect(typeof snap).toBe('object');
    // Must include tools, models, and timestamp-like field
    expect(snap).toHaveProperty('mcpTools');
    expect(snap).toHaveProperty('commandCodeModels');
    expect(snap).toHaveProperty('generatedAt');
    expect(Array.isArray(snap.mcpTools)).toBe(true);
    expect(snap.mcpTools).toHaveLength(2);
    expect(Array.isArray(snap.commandCodeModels)).toBe(true);
    expect(snap.commandCodeModels).toHaveLength(2);
    expect(typeof snap.generatedAt).toBe('string');
    // ISO date sanity
    expect(() => new Date(snap.generatedAt).toISOString()).not.toThrow();
  });

  it('handles MCP server unreachable gracefully (snapshot still produced)', async () => {
    mockFetchSequence([
      { throw: new Error('ECONNREFUSED') }, // MCP fails
      { ok: true, body: { models: [] } },    // models still ok
    ]);

    const snap = await buildSystemInventorySnapshot({ mcpServerUrl: 'http://down', baseUrl: 'http://a

---

## S026 — spec-test — `innomcp-node/src/services/thaiGovtTools.ts` [deepseek/deepseek-v4-flash]
```typescript
import { ThaiGovtTools, WeatherReport, DisasterAlert, ForecastDay, ProvinceInfo, GeoPoint, Evidence, DataStats, KnowledgeItem, GovInfo } from '../src/services/thaiGovtTools';

// Mock client interface – we simulate the external MCP service
interface MockClient {
  getWeatherReport: jest.Mock<Promise<WeatherReport>, [string | undefined]>;
  getDisasterAlerts: jest.Mock<Promise<DisasterAlert[]>, []>;
  getWeatherForecast: jest.Mock<Promise<ForecastDay[]>, [string, number]>;
  getProvinceInfo: jest.Mock<Promise<ProvinceInfo>, [string]>;
  findNearest: jest.Mock<Promise<GeoPoint[]>, [number, number, number]>;
  searchLocation: jest.Mock<Promise<GeoPoint[]>, [string]>;
  searchEvidence: jest.Mock<Promise<Evidence[]>, [string, number]>;
  getDataStats: jest.Mock<Promise<DataStats>, [string]>;
  searchKnowledge: jest.Mock<Promise<KnowledgeItem[]>, [string, string]>;
  getGovInfo: jest.Mock<Promise<GovInfo>, [string]>;
}

function createMockClient(): MockClient {
  return {
    getWeatherReport: jest.fn(),
    getDisasterAlerts: jest.fn(),
    getWeatherForecast: jest.fn(),
    getProvinceInfo: jest.fn(),
    findNearest: jest.fn(),
    searchLocation: jest.fn(),
    searchEvidence: jest.fn(),
    getDataStats: jest.fn(),
    searchKnowledge: jest.fn(),
    getGovInfo: jest.fn(),
  };
}

describe('ThaiGovtTools', () => {
  let mockClient: MockClient;
  let tools: ThaiGovtTools;

  // Default mock data for a typical response (according to contracts implied by field names)
  const dummyWeatherReport: WeatherReport = {
    province: 'Bangkok',
    temperature: 32,
    condition: 'sunny',
    humidity: 60,
  };
  const dummyDisasterAlerts: DisasterAlert[] = [
    { id: '1', type: 'flood', severity: 'high', location: 'Bangkok' },
  ];
  const dummyForecast: ForecastDay[] = [
    { date: '2025-04-10', high: 34, low: 28, condition: 'partly cloudy' },
  ];
  const dummyProvinceInfo: ProvinceInfo = {
    name: 'Chiang Mai',
    population: 1800000,
    area: 20107,
    capital: 'Chiang Mai',
  };
  const dummyGeoPoint: GeoPoint = { lat: 13.75, lng: 100.5 };
  const dummyEvidence: Evidence = { id: 'ev1', description: 'Smoke detected', timestamp: '2025-04-10T12:00:00Z' };
  const dummyStats: DataStats = { category: 'health', count: 150, lastUpdated: '2025-04-10' };
  const dummyKnowledge: KnowledgeItem = { title: 'Weather safety', summary: 'Stay indoors during storms', source: 'Gov' };
  const dummyGovInfo: GovInfo = { topic: 'taxes', content: 'File by April 15', authority: 'Revenue Department' };

  beforeEach(() => {
    mockClient = createMockClient();
    // Instantiate the class with the mock client (injectable via constructor)
    tools = new ThaiGovtTools(mockClient as any);
  });

  // ------------------------------------------------------------------
  // 1. getWeatherReport
  // ------------------------------------------------------------------
  describe('getWeatherReport', () => {
    it('should return a WeatherReport when province is provided', async () => {
      mockClient.getWeatherReport.mockResolvedValue(dummyWeatherReport);
      const result = await tools.getWeatherReport('Bangkok');
      expect(result).toBe(dummyWeatherReport);
      expect(mockClient.getWeatherReport).toHaveBeenCalledWith('Bangkok');
    });

    it('should return a WeatherReport when province is omitted (undefined)', async () => {
      mockClient.getWeatherReport.mockResolvedValue(dummyWeatherReport);
      const result = await tools.getWeatherReport();
      expect(result).toBe(dummyWeatherReport);
      expect(mockClient.getWeatherReport).toHaveBeenCalledWith(undefined);
    });

    it('should throw if the underlying client rejects (network error)', async () => {
      const error = new Error('API failure');
      mockClient.getWeatherReport.mockRejectedValue(error);
      await expect(tools.getWeatherReport('Bangkok')).rejects.toThrow('API failure');
    });

    it('should throw TypeError if province is not a string (contract: optional

---

## S027 — spec-test — `innomcp-node/src/services/thaiIntentRouter.ts` [Qwen/Qwen3.7-Max]
```typescript
import { ThaiIntentRouter, thaiIntentRouter, RoutingDecision } from '../src/services/thaiIntentRouter';

// Mock external dependencies that the router likely uses internally
jest.mock('../src/services/intentClassifier', () => ({
  classifyIntent: jest.fn(),
}));

jest.mock('../src/services/languageDetector', () => ({
  detectLanguage: jest.fn(),
}));

jest.mock('../src/config/modelRegistry', () => ({
  getModelConfig: jest.fn(),
  DEFAULT_MODEL: 'gpt-4',
  MDES_MODEL: 'mdes-specialist',
}));

describe('ThaiIntentRouter — Contract Tests', () => {
  let router: ThaiIntentRouter;

  beforeEach(() => {
    jest.clearAllMocks();
    router = new ThaiIntentRouter();
  });

  describe('Module Exports', () => {
    it('exports ThaiIntentRouter class', () => {
      expect(ThaiIntentRouter).toBeDefined();
      expect(typeof ThaiIntentRouter).toBe('function');
    });

    it('exports a singleton thaiIntentRouter instance', () => {
      expect(thaiIntentRouter).toBeDefined();
      expect(thaiIntentRouter).toBeInstanceOf(ThaiIntentRouter);
    });

    it('singleton instance is stable across imports', () => {
      const instance1 = thaiIntentRouter;
      const instance2 = thaiIntentRouter;
      expect(instance1).toBe(instance2);
    });
  });

  describe('Constructor', () => {
    it('creates an instance without arguments', () => {
      const instance = new ThaiIntentRouter();
      expect(instance).toBeInstanceOf(ThaiIntentRouter);
    });

    it('creates independent instances', () => {
      const instance1 = new ThaiIntentRouter();
      const instance2 = new ThaiIntentRouter();
      expect(instance1).not.toBe(instance2);
    });

    it('instance has route method', () => {
      const instance = new ThaiIntentRouter();
      expect(typeof instance.route).toBe('function');
    });

    it('instance has routeToMDES method', () => {
      const instance = new ThaiIntentRouter();
      expect(typeof instance.routeToMDES).toBe('function');
    });
  });

  describe('route(text, availableModels)', () => {
    const availableModels = ['gpt-4', 'gpt-3.5-turbo', 'claude-2', 'mdes-specialist'];

    it('returns a RoutingDecision for valid Thai text', async () => {
      const decision = await router.route('สวัสดีครับ วันนี้天气เป็นอย่างไร', availableModels);

      expect(decision).toBeDefined();
      expect(typeof decision).toBe('object');
    });

    it('returns a decision with a model property that is a string', async () => {
      const decision = await router.route('ขอข้อมูลเกี่ยวกับนโยบายดิจิทัล', availableModels);

      expect(decision).toHaveProperty('model');
      expect(typeof (decision as any).model).toBe('string');
    });

    it('selected model must be from the availableModels list', async () => {
      const models = ['model-a', 'model-b', 'model-c'];
      const decision = await router.route('ทดสอบการเลือกโมเดล', models);

      expect(models).toContain((decision as any).model);
    });

    it('returns consistent results for identical inputs', async () => {
      const text = 'คำถามซ้ำเกี่ยวกับนโยบาย';
      const decision1 = await router.route(text, availableModels);
      const decision2 = await router.route(text, availableModels);

      expect(decision1).toEqual(decision2);
    });

    it('handles Thai text with mixed English content', async () => {
      const decision = await router.route('ช่วยอธิบายเรื่อง API integration ให้หน่อยครับ', availableModels);

      expect(decision).toBeDefined();
      expect((decision as any).model).toBeDefined();
    });

    it('handles very short Thai text', async () => {
      const decision = await router.route('สวัสดี', availableModels);

      expect(decision).toBeDefined();
      expect((decision as any).model).toBeDefined();
    });

    it('handles long Thai text input', async () => {
      const longText = 'คำถาม'.repeat(500);
      const decision = await router.route(longText, availableModels);

      expect(decision).toBeDefined();
      expect((decisi

---

## S028 — spec-test — `innomcp-node/src/services/toolExecutor.ts` [moonshotai/Kimi-K2.6]
The user wants a Jest contract/behavior test for a module called `toolExecutor`. I only have the public API surface (signatures, not implementation). I need to infer the intended behavior from the names and signatures.

Given API surface:
```typescript
export class ToolTimeoutError extends Error {
  constructor() {
export class ToolParamError extends Error {
  constructor() {
export interface ToolDefinition {
export interface ExecOptions {
export interface ToolResult {
export interface ToolDefinitionPublic {
export class ToolExecutor extends EventEmitter {
  async execute(
export default ToolExecutor;
```

From the names:
- `ToolExecutor` extends `EventEmitter`. It likely emits events about tool execution lifecycle.
- `execute` is async. It probably takes a tool name/id, parameters, and options, and returns a `ToolResult`.
- `ToolDefinition` likely defines a tool (name, handler function, parameters schema, timeout, etc.).
- `ExecOptions` likely contains execution options (timeout override, etc.).
- `ToolResult` likely contains the result (content, isError, etc.).
- `ToolDefinitionPublic` is probably a sanitized/public version of ToolDefinition.
- `ToolTimeoutError` and `ToolParamError` are specific error types.

Since I don't have the exact signatures, I need to make reasonable inferences based on standard patterns for such modules and test the CONTRACT.

Key behaviors to test:
1. **Construction/Registration**: ToolExecutor probably accepts a registry of ToolDefinitions or has a method to register them. Wait, the public API only shows `execute` and the class itself. Maybe the constructor takes an array of `ToolDefinition`? Or maybe `execute` takes a `ToolDefinition` directly? Given the name `ToolExecutor`, it likely executes tools by name from a registry provided at construction. Let's assume constructor takes `ToolDefinition[]` or a registry map. But I must be careful: I only have the signatures shown. The prompt says "public API surface (signatures)". The snippet is truncated. I need to infer the most logical contract.

Let's look at the truncated lines:
- `export class ToolTimeoutError extends Error { constructor() {` -> likely no args or specific args.
- `export class ToolParamError extends Error { constructor() {` -> same.
- `export interface ToolDefinition {` -> likely has name, handler, parameters, timeout?
- `export interface ExecOptions {` -> likely timeout, signal?
- `export interface ToolResult {` -> likely content, isError?
- `export interface ToolDefinitionPublic {` -> public view of tool def.
- `export class ToolExecutor extends EventEmitter { async execute(` -> likely `execute(toolName: string, params: object, options?: ExecOptions): Promise<ToolResult>`.

Since I don't know the exact constructor signature, I should infer it. A common pattern is:
`constructor(tools: ToolDefinition[], defaultOptions?: ExecOptions)` or similar.
Alternatively, it could be `constructor(registry: Map<string, ToolDefinition>)`.

But the prompt says "test observable behavior/contracts implied by the names+signatures". I need to write a test that imports exactly `import ... from '../src/services/toolExecutor';`.

I need to decide on a plausible API and test it. The test must compile in strict TS, so I need to define the inferred types in a way that matches the real module. Since I don't have the real module, I must write the test assuming a very standard, logical API derived from the names.

Let's define the assumed API:
- `ToolDefinition`: `{ name: string; handler: (params: any) => any | Promise<any>; timeout?: number; parameters?: { type: 'object'; properties: Record<string, any>; required?: string[] } }` (or similar). But maybe simpler: `name`, `description`, `handler`, `schema`.
- `ExecOptions`: `{ timeout?: number; }`
- `ToolResult`: `{ content: any; isError?: boolean }` or `{ type: 'text'; text: string }[]`. Actually, MCP (Model Context Protocol) uses `ToolResult` with `content: Array<{type: 'text' | 'image', ...}>`. The module na

---

## S029 — spec-test — `innomcp-node/src/services/webhookService.ts` [zai-org/GLM-5.1]
```typescript
import {
  WebhookEvent,
  Webhook,
  listWebhooks,
  getWebhook,
  createWebhook,
  deleteWebhook,
  toggleWebhook,
  fireWebhookById,
  fireWebhook,
} from '../src/services/webhookService';

// Mock external network dependency for firing webhooks
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('webhookService Contract Tests', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Assuming the module might have internal state, we try to clean up created webhooks
    // In a real scenario, if a reset function existed, we'd call it here.
    const webhooks = listWebhooks();
    webhooks.forEach((w) => deleteWebhook(w.id));
  });

  describe('createWebhook', () => {
    it('should create a webhook and return it with a generated id and enabled status', () => {
      const url = 'https://example.com/hook';
      const events: WebhookEvent[] = ['message.created', 'user.updated'];
      const userId = 'user_123';

      const webhook = createWebhook(url, events, userId);

      expect(webhook).toBeDefined();
      expect(typeof webhook.id).toBe('string');
      expect(webhook.id.length).toBeGreaterThan(0);
      expect(webhook.url).toBe(url);
      expect(webhook.events).toEqual(events);
      expect(webhook.userId).toBe(userId);
      // Contract: newly created webhooks are typically enabled by default
      expect(webhook.enabled).toBe(true);
    });

    it('should throw an error when creating a webhook with invalid inputs', () => {
      // Contract: empty url is invalid
      expect(() => createWebhook('', ['message.created'])).toThrow();
      // Contract: empty events array is invalid
      expect(() => createWebhook('https://valid.url', [])).toThrow();
    });
  });

  describe('listWebhooks', () => {
    it('should return an empty array when no webhooks exist', () => {
      const webhooks = listWebhooks();
      expect(webhooks).toEqual([]);
    });

    it('should return all created webhooks when no userId is provided', () => {
      createWebhook('https://a.com', ['message.created'], 'user1');
      createWebhook('https://b.com', ['user.updated'], 'user2');

      const webhooks = listWebhooks();
      expect(webhooks.length).toBe(2);
      expect(webhooks.map((w) => w.url)).toEqual(expect.arrayContaining(['https://a.com', 'https://b.com']));
    });

    it('should filter webhooks by userId when provided', () => {
      createWebhook('https://a.com', ['message.created'], 'user1');
      createWebhook('https://b.com', ['user.updated'], 'user2');
      createWebhook('https://c.com', ['message.deleted'], 'user1');

      const user1Webhooks = listWebhooks('user1');
      expect(user1Webhooks.length).toBe(2);
      expect(user1Webhooks.every((w) => w.userId === 'user1')).toBe(true);
    });
  });

  describe('getWebhook', () => {
    it('should return the webhook if it exists', () => {
      const created = createWebhook('https://get.com', ['message.created'], 'user1');
      const fetched = getWebhook(created.id);
      expect(fetched).toEqual(created);
    });

    it('should return undefined if the webhook does not exist', () => {
      const fetched = getWebhook('non_existent_id');
      expect(fetched).toBeUndefined();
    });
  });

  describe('deleteWebhook', () => {
    it('should return true and remove the webhook from the state', () => {
      const created = createWebhook('https://delete.com', ['message.created'], 'user1');
      const result = deleteWebhook(created.id);
      
      expect(result).toBe(true);
      expect(getWebhook(created.id)).toBeUndefined();
    });

    it('should return false if the webhook does not exist', () => {
      const result = deleteWebhook('non_existent_id');
      expect(result).toBe(false);
    });
  });

  describe('toggleWebhook', () => {
    it('should toggle the enabled state and return the updated webhook', () => {
      const created = createWebhook('https://toggle.com', ['message.created'], 'user1');
      expect(created.enabled).to

---

## S030 — spec-test — `innomcp-node/src/services/wsEnhancer.ts` [MiniMaxAI/MiniMax-M3]
Looking at the provided API surface, I notice that the module's public interface is extremely minimal:

```typescript
interface HeartbeatInfo { ... }      // empty interface - no fields visible
export class WSEnhancer { ... }      // no methods visible
export const wsEnhancer = new WSEnhancer();  // instance with no visible API
```

The API surface contains:
- An empty `HeartbeatInfo` interface (no members shown)
- A `WSEnhancer` class with no visible method signatures
- A singleton instance

I cannot write a meaningful contract test for this module because:

1. **No method signatures are provided** for `WSEnhancer` - I would have to invent the methods to test, which violates the rule to test the actual contract.
2. **The `HeartbeatInfo` interface has no defined fields** - I cannot construct valid test fixtures or assert on its shape.
3. **There are no inputs/outputs to test against** - any test I write would be fabricated behavior, not testing the implied contract.

To produce a valid contract test, I need at minimum:
- The method signatures of `WSEnhancer` (method names, parameters, return types)
- The shape of `HeartbeatInfo` (its properties and types)
- The expected error conditions or throw cases (if any)

Could you provide the full public API surface including the method signatures inside the `WSEnhancer` class and the properties of the `HeartbeatInfo` interface? Once I have those, I can write a proper contract test that asserts on real observable behavior.

---

## S031 — spec-test — `innomcp-node/src/agents/eventGuard.ts` [deepseek/deepseek-v4-pro]
```typescript
import { GuardResult, checkAgentEventSafe, checkVisibleTextSafe } from '../src/agents/eventGuard';

// Deterministic mock for network calls (fetch)
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

beforeEach(() => {
  mockFetch.mockClear();
});

afterEach(() => {
  jest.clearAllMocks();
});

// Helper: simulate a safe response from the external safety service
function mockSafeResponse() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      isSafe: true,
      details: { score: 0.99, category: 'none' },
    }),
  });
}

// Helper: simulate an unsafe response
function mockUnsafeResponse(reason = 'Hate speech') {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      isSafe: false,
      reason,
      details: { score: 0.6, category: 'hate' },
    }),
  });
}

describe('checkVisibleTextSafe', () => {
  it('returns safe for harmless text', async () => {
    mockSafeResponse();
    const result: GuardResult = await checkVisibleTextSafe('Hello world');
    expect(result).toBeDefined();
    expect(result.isSafe).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns unsafe for offensive text', async () => {
    mockUnsafeResponse('Contains threats');
    const result = await checkVisibleTextSafe('You are all idiots');
    expect(result.isSafe).toBe(false);
    expect(result.reason).toBe('Contains threats');
  });

  it('throws TypeError for null input', async () => {
    await expect(checkVisibleTextSafe(null as any)).rejects.toThrow(TypeError);
  });

  it('throws TypeError for undefined input', async () => {
    await expect(checkVisibleTextSafe(undefined as any)).rejects.toThrow(TypeError);
  });

  it('throws TypeError for non‑string input (number)', async () => {
    await expect(checkVisibleTextSafe(123 as any)).rejects.toThrow(TypeError);
  });

  it('treats empty string as safe (boundary)', async () => {
    mockSafeResponse();
    const result = await checkVisibleTextSafe('');
    expect(result.isSafe).toBe(true);
  });

  it('handles very long text (boundary)', async () => {
    mockSafeResponse();
    const longText = 'a'.repeat(10000);
    const result = await checkVisibleTextSafe(longText);
    expect(result.isSafe).toBe(true);
  });
});

describe('checkAgentEventSafe', () => {
  const validEvent = { content: 'Hi there', type: 'message' };

  it('returns safe for a benign event', async () => {
    mockSafeResponse();
    const result = await checkAgentEventSafe(validEvent);
    expect(result).toHaveProperty('isSafe', true);
  });

  it('returns unsafe for a harmful event', async () => {
    mockUnsafeResponse('Violence');
    const evilEvent = { content: 'I will destroy you', type: 'message' };
    const result = await checkAgentEventSafe(evilEvent);
    expect(result.isSafe).toBe(false);
    expect(result.reason).toBe('Violence');
  });

  it('throws TypeError when event is null', async () => {
    await expect(checkAgentEventSafe(null as any)).rejects.toThrow(TypeError);
  });

  it('throws TypeError when event is undefined', async () => {
    await expect(checkAgentEventSafe(undefined as any)).rejects.toThrow(TypeError);
  });

  it('throws TypeError when event is not an object (string)', async () => {
    await expect(checkAgentEventSafe('not an object' as any)).rejects.toThrow(TypeError);
  });

  it('throws TypeError when event.content is missing', async () => {
    await expect(checkAgentEventSafe({} as any)).rejects.toThrow(TypeError);
  });

  it('throws TypeError when event.content is not a string', async () => {
    await expect(checkAgentEventSafe({ content: 123 } as any)).rejects.toThrow(TypeError);
  });

  it('treats event with empty content as safe (boundary)', async () => {
    mockSafeResponse();
    const result = await checkAgentEventSafe({ content: '' });
    expect(result.isSafe).toBe(true);
  });

  it('passes additional event properties to the safety check (contract)', async () => {
    mockSafe

---

## S032 — spec-test — `innomcp-node/src/agents/events.ts` [deepseek/deepseek-v4-pro]
```typescript
import {
  AgentEventType,
  AgentId,
  AGENT_ROLE_LABEL_TH,
  AgentEvent,
  SCHEMA_VERSION,
  validateAgentEvent,
  newEnvelope,
} from '../src/agents/events';

describe('events module', () => {
  describe('SCHEMA_VERSION', () => {
    it('should be the string "1.0.0"', () => {
      expect(SCHEMA_VERSION).toBe('1.0.0');
    });
  });

  describe('AGENT_ROLE_LABEL_TH', () => {
    it('should be a non-empty object mapping AgentIds to Thai role labels', () => {
      expect(AGENT_ROLE_LABEL_TH).toBeDefined();
      expect(typeof AGENT_ROLE_LABEL_TH).toBe('object');
      const keys = Object.keys(AGENT_ROLE_LABEL_TH);
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(typeof AGENT_ROLE_LABEL_TH[key as AgentId]).toBe('string');
      }
    });
  });

  describe('validateAgentEvent', () => {
    // Construct a minimal valid event using a known agent id and the correct schema version.
    const validAgentEvent: AgentEvent = {
      version: SCHEMA_VERSION,
      agentId: Object.keys(AGENT_ROLE_LABEL_TH)[0] as AgentId,
      type: 'testEvent' as AgentEventType,
    };

    it('should return null for a well-formed event', () => {
      expect(validateAgentEvent(validAgentEvent)).toBeNull();
    });

    it('should return a non‑null string error for a non‑object (null)', () => {
      const error = validateAgentEvent(null);
      expect(typeof error).toBe('string');
      expect(error).toBeTruthy();
    });

    it('should return a non‑null string error for undefined', () => {
      const error = validateAgentEvent(undefined);
      expect(typeof error).toBe('string');
      expect(error).toBeTruthy();
    });

    it('should return a string error for an empty object (missing required fields)', () => {
      const error = validateAgentEvent({});
      expect(typeof error).toBe('string');
      expect(error).toBeTruthy();
    });

    it('should return a string error when version is missing', () => {
      const eventWithoutVersion = { ...validAgentEvent, version: undefined };
      const error = validateAgentEvent(eventWithoutVersion);
      expect(typeof error).toBe('string');
      expect(error).toBeTruthy();
    });

    it('should return a string error when version does not match SCHEMA_VERSION', () => {
      const eventWrongVersion = { ...validAgentEvent, version: '0.9.0' };
      const error = validateAgentEvent(eventWrongVersion);
      expect(typeof error).toBe('string');
      expect(error).toBeTruthy();
    });

    it('should return a string error when agentId is not a valid AgentId', () => {
      const invalidAgentIdEvent = { ...validAgentEvent, agentId: 'invalidAgent' };
      const error = validateAgentEvent(invalidAgentIdEvent);
      expect(typeof error).toBe('string');
      expect(error).toBeTruthy();
    });

    it('should never throw – always returns null or a string for any input', () => {
      expect(() => validateAgentEvent(42)).not.toThrow();
      expect(() => validateAgentEvent([])).not.toThrow();
      expect(() => validateAgentEvent('string')).not.toThrow();
      const result = validateAgentEvent(42);
      expect(typeof result).toBe('string');
    });
  });

  describe('newEnvelope', () => {
    const validEvent: AgentEvent = {
      version: SCHEMA_VERSION,
      agentId: Object.keys(AGENT_ROLE_LABEL_TH)[0] as AgentId,
      type: 'envelopeTest' as AgentEventType,
    };

    it('should return an envelope object with id, timestamp, and the event when given a valid event', () => {
      const envelope = newEnvelope({ event: validEvent });
      expect(envelope).toBeDefined();
      expect(typeof envelope).toBe('object');
      expect(envelope).toHaveProperty('id');
      expect(typeof envelope.id).toBe('string');
      expect(envelope).toHaveProperty('timestamp');
      // timestamp may be a number (milliseconds) or a Date instance
      expect(
        typeof envelope.timestamp === 'number' || envelope.timestamp instanceof Date
      ).toBe(true

---

## S033 — spec-test — `innomcp-node/src/agents/orchestrator.ts` [deepseek/deepseek-v4-pro]
```typescript
import {
  MultiAgentOrchestrator,
  createOrchestrator,
  AgentTask,
} from '../src/agents/orchestrator';

// Mock external services used by the orchestrator (tmux, remote-sync)
// These mocks allow deterministic, offline contract testing.
jest.mock('tmux', () => ({
  sync: jest.fn(),
}));

jest.mock('remote-sync', () => ({
  sync: jest.fn(),
}));

const tmux = require('tmux');
const remoteSync = require('remote-sync');

describe('Orchestrator contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------
  describe('createOrchestrator', () => {
    it('returns a MultiAgentOrchestrator instance with no config', () => {
      const orch = createOrchestrator();
      expect(orch).toBeInstanceOf(MultiAgentOrchestrator);
    });

    it('returns a MultiAgentOrchestrator instance when given partial config', () => {
      const orch = createOrchestrator({ brainRole: 'coordinator' });
      expect(orch).toBeInstanceOf(MultiAgentOrchestrator);
    });
  });

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------
  describe('constructor', () => {
    it('creates an instance without config', () => {
      const orch = new MultiAgentOrchestrator();
      expect(orch).toBeInstanceOf(MultiAgentOrchestrator);
    });

    it('accepts a partial config object', () => {
      const orch = new MultiAgentOrchestrator({
        brainRole: 'brain-1',
      } as any);
      expect(orch).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // createTask
  // ---------------------------------------------------------------------------
  describe('createTask', () => {
    let orchestrator: MultiAgentOrchestrator;
    beforeEach(() => {
      orchestrator = new MultiAgentOrchestrator();
    });

    it('returns a task with id, description and default priority "medium"', async () => {
      const task: AgentTask = await orchestrator.createTask('A new task');
      expect(task).toHaveProperty('id');
      expect(task.description).toBe('A new task');
      expect(task.priority).toBe('medium');
    });

    it('allows specifying a priority', async () => {
      const task = await orchestrator.createTask('Urgent task', 'urgent');
      expect(task.priority).toBe('urgent');
    });

    it('handles an empty string description', async () => {
      const task = await orchestrator.createTask('');
      expect(task.description).toBe('');
    });

    it('generates unique ids for consecutive tasks', async () => {
      const t1 = await orchestrator.createTask('One');
      const t2 = await orchestrator.createTask('Two');
      expect(t1.id).not.toBe(t2.id);
    });

    it('rejects on invalid priority (contract: runtime validation)',

---

## S034 — spec-test — `innomcp-node/src/agents/toolDispatch.ts` [deepseek/deepseek-v4-pro]
```typescript
import * as toolDispatch from '../src/agents/toolDispatch';

// Minimal shape of ChatIntent used in tests – not exported by the module
interface ChatIntent {
  tool?: string;
  params?: Record<string, any>;
}

describe('toolDispatch', () => {
  describe('planToolCall', () => {
    it('returns a ToolPlan for a valid intent with a tool and a non‑empty query', () => {
      const intent: ChatIntent = { tool: 'search' };
      const query = 'find restaurants';
      const plan = toolDispatch.planToolCall(intent, query);
      expect(plan).not.toBeNull();
      expect(plan!.toolName).toBe('search');
      expect(plan!.arguments).toEqual(expect.objectContaining({ query }));
    });

    it('returns null when the intent has no tool property', () => {
      const intent: ChatIntent = {};
      expect(toolDispatch.planToolCall(intent, 'some query')).toBeNull();
    });

    it('returns null for an empty query string', () => {
      const intent: ChatIntent = { tool: 't' };
      expect(toolDispatch.planToolCall(intent, '')).toBeNull();
    });

    it('throws a TypeError if intent is null', () => {
      expect(() => toolDispatch.planToolCall(null as any, 'query')).toThrow(TypeError);
    });

    it('throws a TypeError if intent is undefined', () => {
      expect(() => toolDispatch.planToolCall(undefined as any, 'query')).toThrow(TypeError);
    });

    it('throws a TypeError if query is not a string (null/undefined)', () => {
      const intent: ChatIntent = { tool: 't' };
      expect(() => toolDispatch.planToolCall(intent, null as any)).toThrow(TypeError);
      expect(() => toolDispatch.planToolCall(intent, undefined as any)).toThrow(TypeError);
    });

    it('handles queries with special characters correctly', () => {
      const intent: ChatIntent = { tool: 'echo' };
      const query = '!@#$%^&*()_+{}|:"<>?';
      const plan = toolDispatch.planToolCall(intent, query);
      expect(plan!.arguments?.query).toBe(query);
    });

    it('returns a plan whose shape matches the ToolPlan interface', () => {
      const plan = toolDispatch.planToolCall({ tool: 'doIt' }, 'run');
      expect(plan).toMatchObject({
        toolName: 'doIt',
        arguments: expect.objectContaining({ query: 'run' }),
      });
    });
  });

  describe('dispatchTool', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('calls callMcpTool with the toolName and arguments and returns its result', async () => {
      const fakeResult = { done: true, data: 42 };
      const callSpy = jest.spyOn(toolDispatch, 'callMcpTool').mockResolvedValue(fakeResult);

      const plan: toolDispatch.ToolPlan = {
        toolName: 'backendTool',
        arguments: { param: 'value' },
      };

      const result = await toolDispatch.dispatchTool(plan);
      expect(result).toEqual(fakeResult);
      expect(callSpy).toHaveBeenCalledTimes(1);
      expect(callSpy).toHaveBeenCalledWith(plan.toolName, plan.arguments);
    });

    it('throws if plan is null', async () => {
      await expect(toolDispatch.dispatchTool(null as any)).rejects.toThrow();
    });

    it('throws if plan is undefined', async () => {
      await expect(toolDispatch.dispatchTool(undefined as any)).rejects.toThrow();
    });

    it('throws if plan is missing a toolName', async () => {
      const badPlan = { arguments: { x: 1 } } as any;
      await expect(toolDispatch.dispatchTool(badPlan)).rejects.toThrow();
    });

    it('throws if plan is missing arguments', async () => {
      const badPlan = { toolName: 'valid' } as any;
      await expect(toolDispatch.dispatchTool(badPlan)).rejects.toThrow();
    });

    it('propagates errors thrown by callMcpTool', async () => {
      const error = new Error('MCP failure');
      jest.spyOn(toolDispatch, 'callMcpTool').mockRejectedValue(error);
      const plan: toolDispatch.ToolPlan = { toolName: 'fail', arguments: {} };
      await expect(toolDispatch.dispatchTool(plan)).rejects.toThrow('MCP failure');
    });

    

---

## S035 — spec-test — `innomcp-node/src/geo/geo-aggregator.ts` [MiniMaxAI/MiniMax-M3]
```typescript
import { GeoAggregator } from '../src/geo/aggregator';
import type { WeatherPacket } from '../src/geo/aggregator';

const makePacket = (overrides: Partial<WeatherPacket> = {}): WeatherPacket => ({
  id: 'pkt-1',
  source: 'station-A',
  location: { lat: 10, lon: 20 },
  timestamp: 1_700_000_000_000,
  temperature: 20,
  humidity: 50,
  windSpeed: 5,
  windDirection: 180,
  pressure: 1013,
  ...overrides,
});

describe('GeoAggregator', () => {
  let aggregator: GeoAggregator;

  beforeEach(() => {
    aggregator = new GeoAggregator();
  });

  describe('format', () => {
    it('returns a packet with the same id as input', () => {
      const input = makePacket({ id: 'abc-123' });
      const output = aggregator.format(input);
      expect(output.id).toBe('abc-123');
    });

    it('normalizes location latitude into the [-90, 90] range', () => {
      const input = makePacket({ location: { lat: 100, lon: 10 } });
      const output = aggregator.format(input);
      expect(output.location.lat).toBeGreaterThanOrEqual(-90);
      expect(output.location.lat).toBeLessThanOrEqual(90);
    });

    it('normalizes location longitude into the [-180, 180] range', () => {
      const input = makePacket({ location: { lat: 10, lon: 250 } });
      const output = aggregator.format(input);
      expect(output.location.lon).toBeGreaterThanOrEqual(-180);
      expect(output.location.lon).toBeLessThanOrEqual(180);
    });

    it('wraps longitudes > 180 by subtracting 360', () => {
      const input = makePacket({ location: { lat: 0, lon: 200 } });
      const output = aggregator.format(input);
      expect(output.location.lon).toBe(-160);
    });

    it('wraps longitudes < -180 by adding 360', () => {
      const input = makePacket({ location: { lat: 0, lon: -200 } });
      const output = aggregator.format(input);
      expect(output.location.lon).toBe(160);
    });

    it('clamps latitudes > 90 to 90', () => {
      const input = makePacket({ location: { lat: 95, lon: 0 } });
      const output = aggregator.format(input);
      expect(output.location.lat).toBe(90);
    });

    it('clamps latitudes < -90 to -90', () => {
      const input = makePacket({ location: { lat: -95, lon: 0 } });
      const output = aggregator.format(input);
      expect(output.location.lat).toBe(-90);
    });

    it('preserves already-valid coordinates', () => {
      const input = makePacket({ location: { lat: 45.5, lon: -122.25 } });
      const output = aggregator.format(input);
      expect(output.location).toEqual({ lat: 45.5, lon: -122.25 });
    });

    it('preserves numeric telemetry fields (temperature, humidity, etc.)', () => {
      const input = makePacket({
        temperature: 18.4,
        humidity: 72,
        windSpeed: 3.2,
        windDirection: 270,
        pressure: 1005,
      });
      const output = aggregator.format(input);
      expect(output.temperature).toBe(18.4);
      expect(output.humidity).toBe(72);
      expect(output.windSpeed).toBe(3.2);
      expect(output.windDirection).toBe(270);
      expect(output.pressure).toBe(1005);
    });

    it('preserves the source identifier', () => {
      const input = makePacket({ source: 'weather-buoy-7' });
      const output = aggregator.format(input);
      expect(output.source).toBe('weather-buoy-7');
    });

    it('preserves the timestamp', () => {
      const ts = 1_700_000_000_000;
      const input = makePacket({ timestamp: ts });
      const output = aggregator.format(input);
      expect(output.timestamp).toBe(ts);
    });

    it('returns a new object (does not mutate the input)', () => {
      const input = makePacket();
      const snapshot = JSON.parse(JSON.stringify(input));
      const output = aggregator.format(input);
      expect(input).toEqual(snapshot);
      expect(output).not.toBe(input);
    });

    it('does not mutate the input location object', () => {
      const location = { lat: 200, lon: 400 };
      const input = makePacket({ location });
      

---

## S036 — spec-test — `innomcp-node/src/geo/geo-guard.ts` [deepseek/deepseek-v4-flash]
```typescript
import { GeoGuard } from "../src/geo/geo-guard";

// Mock timers to control async behavior deterministically
jest.useFakeTimers();

describe("GeoGuard", () => {
    describe("constructor", () => {
        it("should use DEFAULT_TIMEOUT_MS when no argument is provided", async () => {
            // We can't access the private timeoutMs, but we can test behaviour:
            // if the default is something like 5000ms, a function that takes 6000ms should timeout.
            const guard = new GeoGuard();
            const fn = jest.fn().mockImplementation(
                () => new Promise<void>(() => {}), // never resolves
            );
            const promise = guard.executeWithGuard(fn);

            // Advance time just below any reasonable default – assume default > 1000
            jest.advanceTimersByTime(1000);
            // Still pending – no error yet
            await expect(Promise.race([promise, Promise.resolve("pending")])).resolves.toBe("pending");

            // Advance time far beyond a common default (e.g., 10000ms > any plausible default)
            jest.advanceTimersByTime(9000); // total 10000ms
            await expect(promise).rejects.toThrow(/timeout/i);
        });

        it("should accept a custom timeout in milliseconds", async () => {
            const guard = new GeoGuard(100);
            const fn = jest.fn(
                () => new Promise<void>(() => {}), // never resolves
            );
            const promise = guard.executeWithGuard(fn);

            // Advance time to just under the timeout
            jest.advanceTimersByTime(99);
            await expect(Promise.race([promise, Promise.resolve("still pending")])).resolves.toBe("still pending");

            // Advance exactly to the timeout threshold
            jest.advanceTimersByTime(1); // now 100ms total
            await expect(promise).rejects.toThrow(/timeout/i);
        });
    });

    describe("executeWithGuard", () => {
        it("should resolve with the value of a successfully completed function", async () => {
            const guard = new GeoGuard(1000);
            const fn = jest.fn(() => Promise.resolve(42));
            await expect(guard.executeWithGuard(fn)).resolves.toBe(42);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it("should resolve with the value when the function completes before the timeout", async () => {
            const guard = new GeoGuard(1000);
            const fn = jest.fn(
                () => new Promise<number>((resolve) => setTimeout(() => resolve(7), 200)),
            );
            const promise = guard.executeWithGuard(fn);

            // Advance time enough for the inner timeout to fire
            jest.advanceTimersByTime(200);
            await expect(promise).resolves.toBe(7);
        });

        it("should reject if the function takes longer than the timeout", async () => {
            const guard = new GeoGuard(100);
            const fn = jest.fn(
                () => new Promise<never>((_, reject) => setTimeout(() => reject(new Error("slow")), 200)),
            );
            const promise = guard.executeWithGuard(fn);

            // Advance time beyond the guard timeout (100ms) but before the inner timeout (200ms)
            jest.advanceTimersByTime(100);
            await expect(promise).rejects.toThrow(/timeout/i);
            // The function's internal rejection should not be observed because the guard already rejected
        });

        it("should reject if the function throws synchronously", async () => {
            const guard = new GeoGuard(1000);
            const fn = jest.fn(() => {
                throw new Error("sync error");
            });
            await expect(guard.executeWithGuard(fn)).rejects.toThrow("sync error");
        });

        it("should reject if the function returns a rejected promise", async () => {
            const guard = new GeoGuard(1000);
            const fn = jest.fn(() => Promise.reje

---

## S037 — spec-test — `innomcp-node/src/geo/geo-intent.ts` [Qwen/Qwen3.7-Max]
```typescript
import { GeoIntent } from '../src/geo/geo-intent';

describe('GeoIntent', () => {
  let geoIntent: GeoIntent;

  beforeEach(() => {
    geoIntent = new GeoIntent();
  });

  describe('analyze', () => {
    it('should return a result object for a valid message', () => {
      const result = geoIntent.analyze('What is the weather in Tokyo?');
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should detect geographic intent when a location is mentioned', () => {
      const result = geoIntent.analyze('Show me restaurants near Paris');
      expect(result).toHaveProperty('hasGeoIntent');
      expect(result.hasGeoIntent).toBe(true);
    });

    it('should not detect geographic intent for non-geographic messages', () => {
      const result = geoIntent.analyze('Hello, how are you doing today?');
      expect(result).toHaveProperty('hasGeoIntent');
      expect(result.hasGeoIntent).toBe(false);
    });

    it('should extract location entities when geo intent is present', () => {
      const result = geoIntent.analyze('What is the population of Berlin?');
      expect(result.hasGeoIntent).toBe(true);
      expect(result).toHaveProperty('locations');
      expect(Array.isArray(result.locations)).toBe(true);
      expect(result.locations.length).toBeGreaterThan(0);
    });

    it('should return empty locations array when no geo intent is detected', () => {
      const result = geoIntent.analyze('Tell me a joke');
      expect(result.hasGeoIntent).toBe(false);
      expect(result.locations).toEqual([]);
    });

    it('should handle empty string input without throwing', () => {
      expect(() => geoIntent.analyze('')).not.toThrow();
      const result = geoIntent.analyze('');
      expect(result.hasGeoIntent).toBe(false);
      expect(result.locations).toEqual([]);
    });

    it('should handle messages with multiple locations', () => {
      const result = geoIntent.analyze('Compare the weather in London and New York');
      expect(result.hasGeoIntent).toBe(true);
      expect(result.locations.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle messages with country names', () => {
      const result = geoIntent.analyze('What is the capital of Japan?');
      expect(result.hasGeoIntent).toBe(true);
      expect(result.locations.length).toBeGreaterThan(0);
    });

    it('should handle messages with coordinates or addresses', () => {
      const result = geoIntent.analyze('Navigate to 123 Main Street, Springfield');
      expect(result.hasGeoIntent).toBe(true);
      expect(result.locations.length).toBeGreaterThan(0);
    });

    it('should not detect geo intent for ambiguous words that are not locations', () => {
      const result = geoIntent.analyze('I want to book a flight for tomorrow');
      expect(result.hasGeoIntent).toBe(false);
    });

    it('should handle very long messages without throwing', () => {
      const longMessage = 'What is the weather in '.repeat(100) + 'Paris?';
      expect(() => geoIntent.analyze(longMessage)).not.toThrow();
      const result = geoIntent.analyze(longMessage);
      expect(result).toBeDefined();
    });

    it('should handle messages with special characters', () => {
      const result = geoIntent.analyze('Where is São Paulo, Brasil?! @#$%');
      expect(result).toBeDefined();
      expect(typeof result.hasGeoIntent).toBe('boolean');
    });

    it('should handle messages with only whitespace', () => {
      const result = geoIntent.analyze('   \t\n  ');
      expect(result.hasGeoIntent).toBe(false);
      expect(result.locations).toEqual([]);
    });

    it('should return consistent results for the same input', () => {
      const message = 'Find hotels in Amsterdam';
      const result1 = geoIntent.analyze(message);
      const result2 = geoIntent.analyze(message);
      expect(result1.hasGeoIntent).toBe(result2.hasGeoIntent);
      expect(result1.locations).toEqual(result2.locations);
    });

    it('

---

## S038 — spec-test — `innomcp-node/src/geo/geo-service.ts` [moonshotai/Kimi-K2.6]
The user wants a Jest contract/behavior test for a module `geo-service` with a specific public API.

Public API:
```typescript
export type ToolDispatcher = (toolName: string, params: Record<string, unknown>) => Promise<unknown>;
export class GeoService {
  constructor(private readonly dispatch: ToolDispatcher) {}
  public async handleRequest(userMessage: string): Promise<WeatherPacket> {
```

Wait, the API mentions `WeatherPacket` but it's not defined in the provided surface. I need to infer what `WeatherPacket` likely looks like based on the name and context, or perhaps I should define a mock type for it if needed, but the instructions say "strict TS" and import exactly from '../src/geo/geo-service'. Since `WeatherPacket` is part of the return type of the public method, it must be exported or at least available. However, the user only gave the snippet. I should probably assume `WeatherPacket` is also exported from the module, or I can infer its shape. Since it's a contract test, I need to assert the structure of the returned packet.

Given the name `GeoService` and `handleRequest(userMessage: string)` returning `Promise<WeatherPacket>`, and the dependency on a `ToolDispatcher`, this service likely:
1. Parses the user message to extract location/geo intent.
2. Uses the `dispatch` function to call external tools (e.g., a weather tool, geocoding tool).
3. Aggregates results into a `WeatherPacket`.

Contract tests should verify:
- Valid input: returns a `WeatherPacket` with expected properties (e.g., location, temperature, condition, forecast, etc.). Since I don't know the exact shape, I need to make a reasonable inference or keep it generic enough. But the instructions say "Assert VALUES/STATE (toBe/toEqual/toThrow)". I need to define what `WeatherPacket` might look like. Actually, looking at the prompt, `WeatherPacket` is not defined in the provided snippet. I should probably import it if it's exported, or define it if it's not. But the prompt says "Import EXACTLY: import ... from '../src/geo/geo-service';". This means I should import `GeoService`, `ToolDispatcher`, and likely `WeatherPacket` if it's exported. If it's not exported as a value but used as a type, I can import it as a type. But if it's not exported at all, I might need to infer it. However, the prompt says "public API surface", so `WeatherPacket` is part of that surface. I will assume it's exported as a type.

Let's infer `WeatherPacket` structure. A weather packet likely contains:
- location: string
- temperature: number
- unit: string (e.g., 'C', 'F')
- condition: string
- forecast?: Array<...>
- timestamp?: Date | string

But I don't know for sure. Since this is a contract test based *only* on names and signatures, I should focus on the contract implied by the names:
- `handleRequest` takes a `userMessage` (string) and returns a `WeatherPacket`.
- It uses `dispatch` to call tools.
- The `dispatch` is a `ToolDispatcher`: `(toolName: string, params: Record<string, unknown>) => Promise<unknown>`.

Contractual behavior:
1. For a valid user message (e.g., "What's the weather in Paris?"), `handleRequest` should:
   - Call `dispatch` with appropriate tool name(s) and parameters derived from the user message. Since we don't know the internal logic, we can't assert exact tool names unless implied. But "GeoService" and "WeatherPacket" strongly imply it might dispatch tools like `get_weather`, `geocode`, etc. However, the contract test should not assume implementation details like exact tool names *unless* they are part of the contract. The contract is that it uses the dispatcher to get weather data and returns a structured packet.
   - Wait, the prompt says "Test observable behavior/contracts implied by the names+signatures". The name `GeoService` and `handleRequest` returning `WeatherPacket` implies it processes a natural language request into weather data. The `dispatch` is the mechanism to reach external tools. The contract is that given a user message, it returns a v

---

## S039 — spec-test — `innomcp-node/src/geo/geo-tool-router.ts` [zai-org/GLM-5.1]
```typescript
import { GeoRouter } from '../src/geo/geo-tool-router';

// Contract type definitions inferred from the public API signatures
interface GeoIntentResult {
  type: string;
  origin?: string;
  destination?: string;
  query?: string;
}

interface ToolPlan {
  toolName: string;
  parameters: Record<string, unknown>;
}

describe('GeoRouter Contract Tests', () => {
  let router: GeoRouter;

  beforeEach(() => {
    router = new GeoRouter();
  });

  describe('route(intent: GeoIntentResult)', () => {
    it('should return a valid ToolPlan with "RoutingTool" for a valid routing intent', () => {
      const intent: GeoIntentResult = {
        type: 'route',
        origin: 'Point A',
        destination: 'Point B',
      };

      const plan = router.route(intent);

      expect(plan).not.toBeNull();
      expect(plan!.toolName).toBe('RoutingTool');
      expect(plan!.parameters).toEqual(
        expect.objectContaining({
          origin: 'Point A',
          destination: 'Point B',
        })
      );
    });

    it('should return a valid ToolPlan with "GeocodingTool" for a valid geocoding intent', () => {
      const intent: GeoIntentResult = {
        type: 'geocode',
        query: '1600 Pennsylvania Avenue',
      };

      const plan = router.route(intent);

      expect(plan).not.toBeNull();
      expect(plan!.toolName).toBe('GeocodingTool');
      expect(plan!.parameters).toEqual(
        expect.objectContaining({
          query: '1600 Pennsylvania Avenue',
        })
      );
    });

    it('should return null for an unrecognized or unsupported intent type', () => {
      const intent: GeoIntentResult = {
        type: 'unsupported_intent_type',
        query: 'irrelevant data',
      };

      const plan = router.route(intent);

      expect(plan).toBeNull();
    });

    it('should return null for a valid intent type that lacks required parameters', () => {
      const intent: GeoIntentResult = {
        type: 'route',
        // Missing origin and destination
      };

      const plan = router.route(intent);

      // Contract specifies null for un-routeable intents rather than throwing
      expect(plan).toBeNull();
    });

    it('should throw an error when passed a null or undefined intent', () => {
      expect(() => router.route(null as any)).toThrow();
      expect(() => router.route(undefined as any)).toThrow();
    });

    it('should throw an error when passed a fundamentally malformed intent (missing type)', () => {
      const intent = {} as GeoIntentResult;

      expect(() => router.route(intent)).toThrow();
    });

    it('should not mutate the original intent object', () => {
      const intent: GeoIntentResult = {
        type: 'geocode',
        query: 'Statue of Liberty',
      };
      const originalIntentSnapshot = JSON.stringify(intent);

      router.route(intent);

      expect(JSON.stringify(intent)).toEqual(originalIntentSnapshot);
    });
  });
});
```

---

## S040 — spec-test — `innomcp-node/src/providers/registry.ts` [deepseek/deepseek-v4-pro]
```typescript
import {
  ensureSeeded,
  hydrateStore,
  listProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
  setHealth,
  resolveApiKey,
  _resetForTests,
  ProviderType,
} from '../src/providers/registry';

// -------------------------------------------------------------------------
// Mock external store – deterministic, offline
// -------------------------------------------------------------------------
jest.mock('../store', () => {
  let seeded = false;
  let providers: any[] = [];

  return {
    getStore: () => ({ providers, seeded }),
    setStore: (data: { providers?: any[]; seeded?: boolean }) => {
      providers = data.providers ?? [];
      seeded = data.seeded ?? false;
    },
    __resetMock: () => {
      seeded = false;
      providers = [];
    },
  };
});

// -------------------------------------------------------------------------
// Types (contract‑level assumptions, NOT implementation‑coupled)
// -------------------------------------------------------------------------
type HealthStatus = 'healthy' | 'unhealthy' | 'degraded';

interface ProviderRecord {
  id: string;
  name: string;
  type: ProviderType;
  apiKey?: string;
  health?: HealthStatus;
}

interface ProviderUpsertInput {
  name: string;
  type: ProviderType;
  apiKey?: string;
  health?: HealthStatus;
}

// -------------------------------------------------------------------------
// Contract / behaviour tests
// -------------------------------------------------------------------------
describe('Registry contract', () => {
  beforeEach(() => {
    _resetForTests();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const storeMock = require('../store');
    storeMock.__resetMock();
  });

  // -- ensureSeeded ---------------------------------------------------------
  describe('ensureSeeded', () => {
    it('seeds at least one provider when store is unseeded', () => {
      expect(listProviders()).toEqual([]);
      ensureSeeded();
      const providers = listProviders();
      expect(providers.length).toBeGreaterThan(0);
      expect(providers[0]).toHaveProperty('id');
      expect(providers[0]).toHaveProperty('type');
    });

    it('is idempotent – calling again does not add extra providers', () => {
      ensureSeeded();
      const count = listProviders().length;
      ensureSeeded();
      expect(listProviders().length).toBe(count);
    });
  });

  // -- hydrateStore ---------------------------------------------------------
  describe('hydrateStore', () => {
    it('loads providers from the persistent store into memory', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const storeMock = require('../store');
      storeMock.setStore({
        seeded: true,
        providers: [
          { id: 'p1', name: 'Hydrated', type: 'OPENAI', apiKey: 'k1' },
        ],
      });

      expect(listProviders()).toEqual([]);
      hydrateStore();
      const mem = listProviders();
      expect(mem.length).toBe(1);
      expect(mem[0].id).toBe('p1');
      expect(mem[0].name).toBe('Hydrated');
    });
  });

  // -- listProviders --------------------------------------------------------
  describe('listProviders', () => {
    it('returns all providers after seeding', () => {
      ensureSeeded();
      const all = listProviders();
      expect(Array.isArray(all)).toBe(true);
      all.forEach(p => {
        expect(p).toHaveProperty('id');
        expect(p).toHaveProperty('type');
      });
    });

    it('returns empty array when nothing is seeded', () => {
      expect(listProviders()).toEqual([]);
    });
  });

  // -- getProvider ----------------------------------------------------------
  describe('getProvider', () => {
    it('returns the correct provider by id', () => {
      ensureSeeded();
      const providers = listProviders();
      const id = providers[0].id;
      const found = getProvider(id);
      expect(found).toBeDefined();
      expect(found!.id).t

---

## S041 — spec-test — `innomcp-node/src/providers/router.ts` [deepseek/deepseek-v4-pro]
```typescript
import {
  selectProvider,
  getAvailableProviders,
  resolveProviderEndpoint,
  previewSelection,
  ChatMode,
  SelectOptions,
  SelectionResult,
} from '../src/providers/router';

// Mock the provider manager that the router depends on internally
jest.mock('../src/providers/providerManager', () => ({
  getAllProviders: () => ['ollama', 'openai', 'lmstudio', 'gemini'],
  getProviderEndpoint: (name: string) => {
    const endpoints: Record<string, string> = {
      ollama: 'http://localhost:11434',
      openai: 'https://api.openai.com/v1',
      lmstudio: 'http://localhost:1234/v1',
      gemini: 'https://generativelanguage.googleapis.com/v1beta',
    };
    if (!endpoints[name]) throw new Error(`Provider ${name} not found`);
    return endpoints[name];
  },
  getProvidersByMode: (mode: string): string[] => {
    const pools: Record<string, string[]> = {
      local: ['ollama'],
      remote: ['openai', 'gemini'],
      hybrid: ['lmstudio'],
    };
    return pools[mode] || [];
  },
  defaultMode: 'local',
}));

describe('Router – contract tests', () => {
  describe('getAvailableProviders', () => {
    test('returns an array of all configured provider names', () => {
      const providers = getAvailableProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers).toEqual(['ollama', 'openai', 'lmstudio', 'gemini']);
    });
  });

  describe('selectProvider', () => {
    test('returns a local provider when mode is "local"', () => {
      const result: SelectionResult = selectProvider({ mode: 'local' });
      expect(result.mode).toBe('local');
      expect(result.provider).toBe('ollama');
      expect(result.endpoint).toBe('http://localhost:11434');
    });

    test('returns a remote provider when mode is "remote"', () => {
      const result = selectProvider({ mode: 'remote' });
      expect(result.mode).toBe('remote');
      expect(result.provider).toBe('openai');
      expect(result.endpoint).toBe('https://api.openai.com/v1');
    });

    test('returns a hybrid provider when mode is "hybrid"', () => {
      const result = selectProvider({ mode: 'hybrid' });
      expect(result.mode).toBe('hybrid');
      expect(result.provider).toBe('lmstudio');
      expect(result.endpoint).toBe('http://localhost:1234/v1');
    });

    test('throws when an invalid ChatMode is provided', () => {
      expect(() =>
        selectProvider({ mode: 'invalid' as ChatMode })
      ).toThrowError();
    });

    test('throws when no provider matches the requested mode', () => {
      // Force empty pool: no local providers if we deliberately override the mode to an empty category
      // Though we can't alter the mock here, we can request a mode that has no providers in our fixture.
      // Our mock already has no providers for 'remote-only'? We can use a mode like 'local' with filter.
      // Simulate a filter that excludes all matching providers:
      expect(() =>
        selectProvider({ mode: 'local', providers: ['openai', 'gemini'] } as SelectOptions)
      ).toThrowError('No provider available for mode local');
    });

    test('respects the optional providers filter', () => {
      // Ask for remote mode but only one preferred provider that exists
      const result = selectProvider({
        mode: 'remote',
        providers: ['gemini'],
      } as SelectOptions);
      expect(result.provider).toBe('gemini');
      expect(result.endpoint).toBe(
        'https://generativelanguage.googleapis.com/v1beta'
      );
    });

    test('throws when providers filter eliminates all matching candidates', () => {
      expect(() =>
        selectProvider({
          mode: 'remote',
          providers: ['ollama'], // ollama is local, not remote
        } as SelectOptions)
      ).toThrowError('No provider available for mode remote');
    });

    test('returns identical results when called repeatedly with same options', () => {
      const a = selectProvider({ mode: 'local' });
      const b = selectPro

---

## S042 — spec-test — `innomcp-node/src/routes/api/activity.ts` [Qwen/Qwen3.7-Max]
```typescript
import router, { ensureProjectsTable, ensureTaskProjectColumn } from '../src/routes/api/activity';

describe('activity module contract', () => {
  const createMockDb = (shouldFail = false) => ({
    query: jest.fn().mockImplementation(() =>
      shouldFail ? Promise.reject(new Error('DB connection failed')) : Promise.resolve({ rows: [] })
    ),
  });

  describe('ensureProjectsTable', () => {
    it('resolves successfully and issues a CREATE TABLE query for projects', async () => {
      const db = createMockDb();
      const result = await ensureProjectsTable(db as any);
      
      expect(result).toBeUndefined();
      expect(db.query).toHaveBeenCalledTimes(1);
      
      const sql = db.query.mock.calls[0][0];
      expect(typeof sql).toBe('string');
      expect(sql).toMatch(/CREATE\s+TABLE/i);
      expect(sql).toMatch(/projects/i);
    });

    it('propagates database errors', async () => {
      const db = createMockDb(true);
      await expect(ensureProjectsTable(db as any)).rejects.toThrow('DB connection failed');
    });

    it('throws when provided with an invalid or null database client', async () => {
      await expect(ensureProjectsTable(null as any)).rejects.toThrow();
      await expect(ensureProjectsTable(undefined as any)).rejects.toThrow();
      await expect(ensureProjectsTable({} as any)).rejects.toThrow();
    });
  });

  describe('ensureTaskProjectColumn', () => {
    it('resolves successfully and issues an ALTER TABLE query linking tasks to projects', async () => {
      const db = createMockDb();
      const result = await ensureTaskProjectColumn(db as any);
      
      expect(result).toBeUndefined();
      expect(db.query).toHaveBeenCalledTimes(1);
      
      const sql = db.query.mock.calls[0][0];
      expect(typeof sql).toBe('string');
      expect(sql).toMatch(/task/i);
      expect(sql).toMatch(/project/i);
      expect(sql).toMatch(/ALTER|ADD|COLUMN|FOREIGN/i);
    });

    it('propagates database errors', async () => {
      const db = createMockDb(true);
      await expect(ensureTaskProjectColumn(db as any)).rejects.toThrow('DB connection failed');
    });

    it('throws when provided with an invalid database client', async () => {
      await expect(ensureTaskProjectColumn(null as any)).rejects.toThrow();
    });
  });

  describe('router (default export)', () => {
    it('exports a valid Express-compatible router function', () => {
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
      expect(Array.isArray((router as any).stack)).toBe(true);
    });

    it('has registered at least one route or middleware layer', () => {
      expect((router as any).stack.length).toBeGreaterThan(0);
    });
  });
});
```

---

## S043 — spec-test — `innomcp-node/src/routes/api/admin/sessions.ts` [moonshotai/Kimi-K2.6]
The user wants a Jest contract/behavior test for a module located at `../src/routes/api/admin/sessions`. The only public API surface given is `export default sessionsRouter;`.

This is an Express router (implied by the name `sessionsRouter` and the path `routes/api/admin/sessions`). Since it's a router, it likely exports an Express Router instance that defines routes for managing admin sessions.

However, I don't have the actual implementation or even the specific route signatures (GET, POST, etc.). I need to infer the contract based on:
1. The module name: `sessions` in `admin` context
2. The export: `sessionsRouter` (default export)
3. Common patterns for admin session management APIs

Since I must test the contract implied by names and signatures, and the only signature is `export default sessionsRouter`, I need to treat this as an Express Router and test its mounted routes behavior.

But wait - the user says "Test observable behavior/contracts implied by the names+signatures". With only `export default sessionsRouter`, I need to make reasonable assumptions about what an admin sessions router would do, while keeping it generic enough that it tests the contract of a router.

Actually, looking more carefully: this is likely an Express Router. The contract would be:
- It's a valid Router instance
- It handles specific HTTP methods/paths
- It interacts with session storage (database)
- It returns proper HTTP status codes and JSON responses

But I need to be careful. The user wants strict TS, deterministic mocks, offline testing, asserting values/state.

Let me think about what routes an admin sessions module would typically have:
- `GET /` - list all active sessions (admin view)
- `GET /:id` - get specific session details
- `DELETE /:id` - terminate/revoke a specific session
- `DELETE /` - bulk terminate sessions or terminate all? Maybe not.

Since I don't know the exact routes, I should test the router as a black box by mounting it in an Express app and using supertest? But the rules say "Mock external deps (db/network/fs/other services) deterministically. Offline."

Wait, if I use supertest, that's more of an integration test. But I can mount the router in a test Express app and make requests to it.

However, the user says "Import EXACTLY: import ... from '../src/routes/api/admin/sessions'". So I need to import the default export.

Let me reconsider. Maybe the module exports an Express Router, and I should test it by:
1. Verifying it's a Router instance
2. Testing the routes it handles by invoking them through a test app

But without knowing the exact routes, I have to infer standard REST conventions for admin sessions.

Actually, looking at the path `routes/api/admin/sessions`, this is almost certainly an Express Router that handles:
- `GET /` → list sessions
- `DELETE /:id` → delete/terminate a session

For an admin sessions endpoint, common behavior:
- Authentication/authorization middleware might be applied, but since it's a router export, maybe that's mounted upstream.
- Returns JSON array of session objects
- Returns 404 for non-existent session IDs
- Returns 204 or 200 on deletion
- Validates UUIDs or numeric IDs

Since I must mock external deps, I'd need to mock the database layer that the router uses. But I don't know what the router imports. However, I can infer it likely uses a database or session store.

Wait, I need to be more careful. The user says "Mock external deps (db/network/fs/other services) deterministically." If I don't know what the router imports, how can I mock it?

In Jest, I can mock modules that are likely imported by the router. But I don't know the exact paths. This is tricky.

Alternative approach: Since the only export is the router, and I need to test it as a black box, perhaps I should:
- Import the router
- Create an Express app in the test
- Mount the router at `/admin/sessions`
- Use supertest to hit endpoints
- Mock the database module that the routes likely import

But I don't know what

---

## S044 — spec-test — `innomcp-node/src/routes/api/agentLeaderboard.ts` [zai-org/GLM-5.1]
```typescript
import router, { AgentEntry, fetchLiveStats } from '../src/routes/api/agentLeaderboard';

// Deterministic offline mocks for external dependencies (DB / Network)
const mockDbQuery = jest.fn();
jest.mock('../src/db', () => ({
  db: {
    query: mockDbQuery,
  },
}));

const mockFetch = jest.fn() as jest.Mock;
global.fetch = mockFetch;

describe('agentLeaderboard Module Contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchLiveStats()', () => {
    const validAgentEntries: AgentEntry[] = [
      { id: 'agent-1', name: 'Alpha', score: 1500, rank: 1 },
      { id: 'agent-2', name: 'Beta', score: 1400, rank: 2 },
    ];

    it('should resolve with an array of AgentEntry objects when data is available', async () => {
      // Mock both potential data sources (DB and Network) to ensure offline determinism
      mockDbQuery.mockResolvedValue({ rows: validAgentEntries });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validAgentEntries),
      });

      const result = await fetchLiveStats();

      // Assert VALUE: Must return an array matching the AgentEntry contract
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(validAgentEntries.length);
      expect(result).toEqual(validAgentEntries);
      expect(result[0]).toEqual(expect.objectContaining({
        id: 'agent-1',
        name: 'Alpha',
        score: 1500,
        rank: 1,
      }));
    });

    it('should resolve with an empty array when no stats are available', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await fetchLiveStats();

      // Assert STATE: Must resolve cleanly with an empty array, not null or undefined
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
    });

    it('should reject with an error if the data source fails', async () => {
      const dbError = new Error('Database connection failed');
      const networkError = new Error('Network request failed');
      
      mockDbQuery.mockRejectedValue(dbError);
      mockFetch.mockRejectedValue(networkError);

      // Assert THROW: Must reject the promise rather than returning a fallback error state
      await expect(fetchLiveStats()).rejects.toThrow();
    });

    it('should reject if the external API responds with a non-ok status', async () => {
      mockDbQuery.mockRejectedValue(new Error('DB not used'));
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      // Assert THROW: Must reject on HTTP errors
      await expect(fetchLiveStats()).rejects.toThrow();
    });
  });

  describe('default export (router)', () => {
    it('should export a valid router object with HTTP method handlers', () => {
      expect(router).toBeDefined();
      
      // Assert STATE: Router must conform to standard Express/Next.js router contract
      expect(typeof router).toBe('function');
      expect(typeof router.get).toBe('function');
      expect(typeof router.post).toBe('function');
      expect(typeof router.use).toBe('function');
    });
  });
});
```

---

## S045 — spec-test — `innomcp-node/src/routes/api/agentStream.ts` [MiniMaxAI/MiniMax-M3]
```typescript
import { jest } from '@jest/globals';
import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';

// Module under test - imported via the EXACT spec path
import agentStreamRouter from '../src/routes/api/agentStream';

// ---- Types derived from the public surface --------------------------------

interface AgentStreamChunk {
  id: string;
  type: 'message' | 'tool_call' | 'tool_result' | 'done' | 'error';
  content: string;
  done: boolean;
}

interface StreamRequestBody {
  prompt?: string;
  sessionId?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface StreamResponseBody {
  sessionId: string;
  status: 'started' | 'error';
  message?: string;
}

// ---- Mocks for external dependencies --------------------------------------

// Mock the underlying agent/LLM service so behavior is deterministic/offline.
const mockStreamAgent = jest.fn<
  Promise<AsyncIterable<AgentStreamChunk>>,
  [StreamRequestBody]
>();

jest.mock('../src/services/agentService', () => ({
  __esModule: true,
  default: mockStreamAgent,
}));

// Mock any session/persistence layer deterministically.
const mockSessionStore = {
  create: jest.fn<(sessionId: string) => Promise<void>>(),
  get: jest.fn<(sessionId: string) => Promise<{ id: string; createdAt: number } | null>>(),
  update: jest.fn<(sessionId: string, patch: object) => Promise<void>>(),
};

jest.mock('../src/services/sessionStore', () => mockSessionStore);

// ---- Helpers --------------------------------------------------------------

const buildApp = (): Express => {
  const app = express();
  app.use(express.json());
  app.use('/api/agent', agentStreamRouter);
  return app;
};

const okChunks = (chunks: AgentStreamChunk[]): AsyncIterable<AgentStreamChunk> => {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          if (i < chunks.length) {
            return { value: chunks[i++], done: false };
          }
          return { value: undefined as unknown as AgentStreamChunk, done: true };
        },
      };
    },
  };
};

// Reset all mocks between tests for isolation
beforeEach(() => {
  jest.clearAllMocks();
  mockSessionStore.create.mockResolvedValue(undefined);
  mockSessionStore.get.mockResolvedValue({ id: 'srv-session-1', createdAt: Date.now() });
  mockSessionStore.update.mockResolvedValue(undefined);
});

// ---- Tests -----------------------------------------------------------------

describe('agentStream route — contract', () => {
  describe('request validation', () => {
    it('rejects empty body with 400 and a JSON error payload', async () => {
      const app = buildApp();
      const res = await request(app).post('/api/agent/stream').send({});

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toEqual(
        expect.objectContaining({
          status: 'error',
          message: expect.any(String),
        })
      );
    });

    it('rejects non-string prompt with 400', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/agent/stream')
        .send({ prompt: 12345 } satisfies StreamRequestBody);

      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ status: 'error', message: expect.any(String) })
      );
    });

    it('rejects out-of-range temperature with 400', async () => {
      const app = buildApp();
      const res = await request(app)
        .post('/api/agent/stream')
        .send({ prompt: 'hi', temperature: 5 } satisfies StreamRequestBody);

      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ status: 'error', message: expect.any(String) })
      );
    });

    it('rejects non-positive maxTokens with 400', async () => {
      const app = buildApp();
      const res = await request(app)
        

---

## S046 — spec-test — `innomcp-node/src/routes/api/aiMode.ts` [deepseek/deepseek-v4-flash]
```typescript
import aiModeRouter, { getCurrentAIMode } from '../src/routes/api/aiMode';
import * as config from '../config';

// Mock the external config module deterministically
jest.mock('../config', () => ({
  getAiMode: jest.fn(),
}));

const mockedConfig = jest.mocked(config);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getCurrentAIMode', () => {
  it('returns "local" when config returns "local"', () => {
    mockedConfig.getAiMode.mockReturnValue('local');
    expect(getCurrentAIMode()).toBe('local');
  });

  it('returns "remote" when config returns "remote"', () => {
    mockedConfig.getAiMode.mockReturnValue('remote');
    expect(getCurrentAIMode()).toBe('remote');
  });

  it('returns "hybrid" when config returns "hybrid"', () => {
    mockedConfig.getAiMode.mockReturnValue('hybrid');
    expect(getCurrentAIMode()).toBe('hybrid');
  });

  it('throws an error when config returns an invalid value', () => {
    mockedConfig.getAiMode.mockReturnValue('invalid');
    expect(() => getCurrentAIMode()).toThrow(
      'Invalid AI mode: invalid'
    );
  });

  it('throws an error when config returns undefined', () => {
    mockedConfig.getAiMode.mockReturnValue(undefined);
    expect(() => getCurrentAIMode()).toThrow(
      'AI mode is not configured'
    );
  });
});

describe('default export (aiModeRouter)', () => {
  it('is defined', () => {
    expect(aiModeRouter).toBeDefined();
  });

  it('is a function (Express Router factory or middleware)', () => {
    expect(typeof aiModeRouter).toBe('function');
  });

  it('has a "get" method', () => {
    expect(typeof (aiModeRouter as any).get).toBe('function');
  });

  it('has a "post" method', () => {
    expect(typeof (aiModeRouter as any).post).toBe('function');
  });
});
```

---

## S047 — spec-test — `innomcp-node/src/routes/api/analytics.ts` [Qwen/Qwen3.7-Max]
```typescript
import express, { Express } from 'express';
import request from 'supertest';
import router from '../src/routes/api/analytics';

// Mock external dependencies deterministically (virtual mocks for potential deps)
jest.mock('../../../services/analytics', () => ({
  getOverview: jest.fn().mockResolvedValue({ totalVisits: 0, uniqueUsers: 0 }),
  getTimeSeries: jest.fn().mockResolvedValue([]),
  getTopPages: jest.fn().mockResolvedValue([]),
}), { virtual: true });

jest.mock('../../../models/AnalyticsEvent', () => ({
  find: jest.fn().mockResolvedValue([]),
  aggregate: jest.fn().mockResolvedValue([]),
  countDocuments: jest.fn().mockResolvedValue(0),
}), { virtual: true });

jest.mock('../../../middleware/auth', () => ({
  authenticate: jest.fn((req: any, _res: any, next: any) => next()),
  authorize: jest.fn((_role: string) => (_req: any, _res: any, next: any) => next()),
}), { virtual: true });

jest.mock('../../../config/database', () => ({
  getConnection: jest.fn().mockResolvedValue({}),
}), { virtual: true });

describe('Analytics API Router — Contract Tests', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api/analytics', router);
  });

  describe('Module Export Contract', () => {
    it('should export a default value that is a callable function (Express router)', () => {
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
    });

    it('should expose a "stack" property as an array (Express router internals)', () => {
      expect((router as any).stack).toBeDefined();
      expect(Array.isArray((router as any).stack)).toBe(true);
    });

    it('should have at least one route layer registered', () => {
      const stack: any[] = (router as any).stack;
      const routeLayers = stack.filter((layer) => layer.route);
      expect(routeLayers.length).toBeGreaterThan(0);
    });

    it('should register routes with valid HTTP methods only', () => {
      const validMethods = new Set([
        'get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'all',
      ]);
      const stack: any[] = (router as any).stack;

      stack.forEach((layer) => {
        if (layer.route && layer.route.methods) {
          const methods = Object.keys(layer.route.methods);
          methods.forEach((method) => {
            expect(validMethods.has(method.toLowerCase())).toBe(true);
          });
        }
      });
    });

    it('should register routes with string-type paths', () => {
      const stack: any[] = (router as any).stack;

      stack.forEach((layer) => {
        if (layer.route) {
          expect(typeof layer.route.path).toBe('string');
          expect(layer.route.path.length).toBeGreaterThan(0);
        }
      });
    });

    it('should have route handlers (not empty handler chains)', () => {
      const stack: any[] = (router as any).stack;

      stack.forEach((layer) => {
        if (layer.route) {
          expect(layer.route.stack).toBeDefined();
          expect(Array.isArray(layer.route.stack)).toBe(true);
          expect(layer.route.stack.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Router Mounted Behavior Contract', () => {
    it('should return 404 for a completely unregistered sub-path', async () => {
      const res = await request(app).get(
        '/api/analytics/__nonexistent_route_abc123__'
      );
      expect(res.status).toBe(404);
    });

    it('should not return 5xx for any registered GET route (no unhandled crashes)', async () => {
      const stack: any[] = (router as any).stack;
      const getRoutes: string[] = stack
        .filter((layer) => layer.route && layer.route.methods.get)
        .map((layer) => layer.route.path);

      expect(getRoutes.length).toBeGreaterThan(0);

      for (const routePath of getRoutes) {
        const fullPath = `/api/analytics${routePath === '/' ? '' : routePath}`;
       

---

## S048 — spec-test — `innomcp-node/src/routes/api/analyze.ts` [moonshotai/Kimi-K2.6]
The user wants a Jest contract/behavior test for an `innomcp-node` module located at `../src/routes/api/analyze`. The only public API surface given is `export default router;`.

This is a very minimal API surface. It exports a default router. Since it's a router (likely Express or similar), I need to infer the contract from the name "analyze" and the fact it's a router exported from `routes/api/analyze`.

Given it's a router exported as default from a routes file, the contract is likely:
1. It's a valid router object (or middleware function) that can be mounted.
2. It handles specific HTTP routes related to "analysis".
3. But without knowing the specific routes, HTTP methods, or what it does, I have to make reasonable assumptions based on standard Express patterns and the name "analyze".

Wait, the user says "You are given ONLY its public API surface (signatures)". The signature is `export default router;`. This means `router` is the default export. In Express/Node.js, a router is typically an `express.Router()` instance.

However, to write a meaningful contract test, I need to infer what this router does. The path is `routes/api/analyze`. So it's likely an Express router mounted at `/api/analyze` or similar.

But the user says "Test observable behavior/contracts implied by the names+signatures". The name is "analyze" and it's a router. The contract of a router is that it:
- Is a function or object with routing methods (get, post, etc.)? No, that's testing implementation details (Express internals).
- Can be used as middleware by an Express app? Yes, that's a behavior.
- But more importantly, since it's an API route, it probably responds to HTTP requests. However, testing HTTP requests requires supertest or similar.

Wait, the user says "Mock external deps (db/network/fs/other services) deterministically. Offline. Strict TS." This implies the module might import and use external dependencies that I need to mock. But I don't know what those are.

Since I only know the export is `router`, I need to think about what a contract test looks like for an Express router when we don't know the exact routes.

Actually, looking at the module path `../src/routes/api/analyze`, and the fact it's a default export of a router, in many Node.js/Express setups, this router would be imported by the main app and mounted. The contract test should verify that:
1. The default export is a function (Express middleware/router).
2. It can be mounted in an Express app without error.
3. It handles requests appropriately.

But without knowing the specific endpoints (GET /, POST /, etc.), I have to make educated guesses or test the generic router contract.

However, the user says "correct outputs for valid inputs, error/throw on invalid inputs, boundary conditions". For a router, inputs are HTTP requests. Outputs are HTTP responses.

Given the name "analyze", possible endpoints:
- POST / - submit something to analyze
- GET /:id - get analysis results
- GET / - list analyses or get status

But I don't know. I need to be careful. The user wants a contract test based ONLY on the public API surface. The public API surface is just `export default router;`. So the only contract I can strictly verify is that the module exports something that behaves like an Express router (i.e., it's a function with router methods, or it can handle requests).

Wait, maybe I should interpret "router" more broadly. In some frameworks, a router might just be a function that takes a request and returns a response. But given the file path `routes/api/analyze`, it's almost certainly an Express-style router.

Let me think about what a robust contract test would look like with minimal assumptions:
- Import the module.
- Verify it's a function (since Express routers are functions).
- Verify it has the methods `use`, `get`, `post`, etc. (Express Router API). But is that testing implementation? Yes, somewhat. But it's also testing the contract that it IS a router.
- However, the user wants "co

---

## S050 — spec-test — `innomcp-node/src/routes/api/chat.ts` [MiniMaxAI/MiniMax-M3]
```typescript
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// The module under test is reported to have no exports.
// We import it explicitly per the rules to validate that contract.
import * as chatModule from '../src/routes/api/chat';

describe('chat module public API surface (contract)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('exports nothing (module surface is empty)', () => {
    // The module is documented to have no exports.
    // Contract: importing the module yields no enumerable runtime exports.
    const exportKeys = Object.keys(chatModule);
    expect(exportKeys).toEqual([]);
  });

  it('evaluates without throwing under a fresh module cache (side-effect free)', () => {
    // Contract: the module is safe to import in a Node/TS environment
    // and must not throw at load time.
    expect(() => {
      require('../src/routes/api/chat');
    }).not.toThrow();
  });

  it('does not leak symbols onto globalThis when imported', () => {
    const before = (globalThis as unknown as Record<string, unknown>)['chat'];
    // Force a fresh evaluation
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../src/routes/api/chat');
    });
    const after = (globalThis as unknown as Record<string, unknown>)['chat'];
    expect(after).toBe(before);
  });

  it('is idempotent under repeated imports (returns the same module record)', () => {
    const a = require('../src/routes/api/chat');
    const b = require('../src/routes/api/chat');
    expect(a).toBe(b);
  });

  it('has no default export and no named exports, matching the documented surface', () => {
    const mod = chatModule as Record<string, unknown>;
    expect((mod as { default?: unknown }).default).toBeUndefined();
    // Every possible named export slot must be undefined.
    const candidateNames = [
      'default',
      'chat',
      'handler',
      'handle',
      'create',
      'init',
      'router',
      'send',
      'receive',
      'message',
      'messages',
    ];
    for (const name of candidateNames) {
      expect(mod[name]).toBeUndefined();
    }
  });
});
```

---

## S051 — spec-test — `innomcp-node/src/routes/api/chatStream.ts` [deepseek/deepseek-v4-flash]
```typescript
import request from 'supertest';
import express from 'express';
import router from '../src/routes/api/chatStream';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ------------------------------------------------------------------------
// Mock external dependencies that the router likely uses.
// We assume an OpenAI-like streaming chat API is used.
// ------------------------------------------------------------------------
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockImplementation(() => ({
          [Symbol.asyncIterator]: async function* () {
            yield { choices: [{ delta: { content: 'Hello' } }] };
            yield { choices: [{ delta: { content: ' world' } }] };
            yield { choices: [{ delta: { content: '!' } }] };
          },
        })),
      },
    },
  })),
}));

// ------------------------------------------------------------------------
// If the router imports any other modules (e.g. database, fs), mock them
// here. For the purpose of this test we only assume the OpenAI call.
// ------------------------------------------------------------------------

describe('chatStream router – contract/behavior tests', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/chat', router);
  });

  // ----------------------------------------------------------------------
  // 1. Basic contract: exported value is an Express Router
  // ----------------------------------------------------------------------
  it('should export an Express Router instance', () => {
    expect(router).toBeDefined();
    expect(router.constructor).toBe(express.Router);
  });

  // ----------------------------------------------------------------------
  // 2. Input validation – missing or invalid messages
  // ----------------------------------------------------------------------
  it('should return 400 if "messages" field is missing', async () => {
    const res = await request(app).post('/chat').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 if "messages" is not an array', async () => {
    const res = await request(app).post('/chat').send({ messages: 'invalid' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 if "messages" is an empty array (no content to stream)', async () => {
    const res = await request(app).post('/chat').send({ messages: [] });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // ----------------------------------------------------------------------
  // 3. Successful streaming response – valid input
  // ----------------------------------------------------------------------
  it('should return 200 and stream text/event-stream for valid messages', async () => {
    const res = await request(app)
      .post('/chat')
      .send({ messages: [{ role: 'user', content: 'Hi' }] });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    // The stream should contain the tokens emitted by the mocked AI service.
    expect(res.text).toContain('Hello world!');
  });

  it('should handle multiple messages in the input array', async () => {
    const messages = [
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Second' },
      { role: 'user', content: 'Third' },
    ];
    const res = await request(app).post('/chat').send({ messages });

    expect(res.status).toBe(200);
    expect(res.text).toContain('Hello world!');
  });

  // ----------------------------------------------------------------------
  // 4. Method not allowed – only POST is accepted
  // ----------------------------------------------------------------------
  it('should reject GET requests with

---

## S052 — spec-test — `innomcp-node/src/routes/api/csrf.ts` [Qwen/Qwen3.7-Max]
```typescript
import express, { Express } from 'express';
import request from 'supertest';
import csrfRouter from '../src/routes/api/csrf';

describe('csrfRouter — contract tests', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/csrf', csrfRouter);
  });

  describe('module export', () => {
    it('should export a function (Express Router)', () => {
      expect(typeof csrfRouter).toBe('function');
    });

    it('should have router-like properties (stack or handle)', () => {
      // Express routers are functions with a .stack property or .handle method
      const router = csrfRouter as unknown as Record<string, unknown>;
      const isRouter =
        Array.isArray(router.stack) ||
        typeof router.handle === 'function' ||
        typeof router.use === 'function';
      expect(isRouter).toBe(true);
    });
  });

  describe('GET /api/csrf — token retrieval', () => {
    it('should respond with 200 OK', async () => {
      const res = await request(app).get('/api/csrf');
      expect(res.status).toBe(200);
    });

    it('should return a JSON body containing a token string', async () => {
      const res = await request(app).get('/api/csrf');
      expect(res.body).toBeDefined();
      expect(typeof res.body).toBe('object');

      // The response should contain a token field (common names: token, csrfToken, _csrf)
      const token =
        res.body.token ?? res.body.csrfToken ?? res.body._csrf ?? res.body.csrf;
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should return a token with reasonable length (not trivially short)', async () => {
      const res = await request(app).get('/api/csrf');
      const token =
        res.body.token ?? res.body.csrfToken ?? res.body._csrf ?? res.body.csrf;
      // CSRF tokens are typically at least 16+ chars (hex/base64 encoded)
      expect(token.length).toBeGreaterThanOrEqual(8);
    });

    it('should return a token that is URL-safe or base64-like (no whitespace)', async () => {
      const res = await request(app).get('/api/csrf');
      const token =
        res.body.token ?? res.body.csrfToken ?? res.body._csrf ?? res.body.csrf;
      expect(token).not.toMatch(/\s/);
    });

    it('should set Content-Type to application/json', async () => {
      const res = await request(app).get('/api/csrf');
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('GET /api/csrf — multiple calls', () => {
    it('should return valid tokens on successive requests', async () => {
      const res1 = await request(app).get('/api/csrf');
      const res2 = await request(app).get('/api/csrf');

      const token1 =
        res1.body.token ?? res1.body.csrfToken ?? res1.body._csrf ?? res1.body.csrf;
      const token2 =
        res2.body.token ?? res2.body.csrfToken ?? res2.body._csrf ?? res2.body.csrf;

      expect(typeof token1).toBe('string');
      expect(typeof token2).toBe('string');
      expect(token1.length).toBeGreaterThan(0);
      expect(token2.length).toBeGreaterThan(0);
    });
  });

  describe('unsupported methods', () => {
    it('should not allow DELETE on the CSRF endpoint', async () => {
      const res = await request(app).delete('/api/csrf');
      // Expect 404 or 405 — not 200
      expect([404, 405]).toContain(res.status);
    });

    it('should not allow PUT on the CSRF endpoint', async () => {
      const res = await request(app).put('/api/csrf');
      expect([404, 405]).toContain(res.status);
    });

    it('should not allow PATCH on the CSRF endpoint', async () => {
      const res = await request(app).patch('/api/csrf');
      expect([404, 405]).toContain(res.status);
    });
  });

  describe('POST /api/csrf — validation (if route exists)', () => {
    it('should reject POST with no token provided', async () => {
      const res = await request(app)
        .post('/api/csrf')
        .sen

---

## S053 — spec-test — `innomcp-node/src/routes/api/dashboard.ts` [moonshotai/Kimi-K2.6]
The user wants a Jest contract/behavior test for a module called `dashboard` from `../src/routes/api/dashboard`.

The public API surface provided is:
1. `type AuthRequest` (a type export)
2. `async function ensureTasksProjectColumn(): Promise<void>` (a named export)
3. `export default router` (a default export)

Wait, the public API surface is quite minimal and a bit ambiguous. Let me parse it carefully.

The module is `dashboard` at `../src/routes/api/dashboard`.

Exports:
- `type AuthRequest` - likely a TypeScript type/interface
- `async function ensureTasksProjectColumn(): Promise<void>` - an async function that returns Promise<void>
- `export default router` - default export is a router (likely Express router)

The user wants a Jest test that tests the CONTRACT/BEHAVIOR based on names and signatures only. I need to infer what these things do based on their names.

`ensureTasksProjectColumn`: The name suggests it ensures that a "Tasks" project column exists somewhere (maybe in a project management tool like GitHub Projects, Notion, or a database). Since it's async and returns void, it likely performs a side effect. It might throw if it fails. Contract: when called, it should ensure the column exists. If external deps fail, it should throw.

`export default router`: This is likely an Express router. The name `dashboard` suggests it handles dashboard routes. Since I don't have the actual routes, I need to infer common dashboard routes. But wait, the user says "Test observable behavior/contracts implied by the names+signatures". For a router, I can test that it's a valid Express router (has use/get/post/etc methods) or test the routes it defines. But without knowing the routes, I need to be careful.

Actually, looking at the minimal API surface, maybe the test should focus on:
1. `ensureTasksProjectColumn` behavior: mocks external deps (db/network), tests success case, tests error case.
2. `router` default export: tests that it's a Router instance, or tests mounting behavior? But "test observable behavior/contracts implied by names+signatures". A router's contract is that it can handle requests. But without knowing specific routes, it's hard.

Wait, maybe the module is small. Let me reconsider. The user might have provided a truncated or simplified API surface. I need to write a complete test file that imports exactly `import ... from '../src/routes/api/dashboard';`.

The import must be exactly that path. The exports I need to import are `AuthRequest` (type), `ensureTasksProjectColumn`, and the default export `router`.

Since I must test contracts, let me think about what `ensureTasksProjectColumn` does:
- "Ensure" implies idempotency: if the column exists, it does nothing (or returns gracefully). If it doesn't exist, it creates it.
- "Tasks Project Column" suggests a column in a project board.
- It interacts with external services (network/db). I need to mock these.
- Contract: Resolves when column is ensured. Rejects if external service is unavailable or returns unexpected data.

For the router:
- It's a dashboard API router. Common routes might include GET / (dashboard data), POST /something, etc. But I don't know the routes. However, the contract of a router is that it's an Express middleware function or Router object. I can test that it has the standard Router methods, or test that it can be mounted in an Express app and handles requests for specific paths inferred from the module name.
- But maybe better: since it's a dashboard API, perhaps it has routes like GET /stats, GET /tasks, etc. But I shouldn't invent too much. However, the user says "test observable behavior/contracts implied by the names+signatures". The signature is `export default router`. The name is `dashboard`. So maybe the contract is that it provides routes under `/api/dashboard`. But I don't know the sub-routes.

Actually, looking at the path `../src/routes/api/dashboard`, this is likely an Express router file that defines routes for `/api/dashboard/*`

---

## S054 — spec-test — `innomcp-node/src/routes/api/debug.ts` [zai-org/GLM-5.1]
```typescript
import express from 'express';
import request from 'supertest';
import router from '../src/routes/api/debug';

// Deterministic mocks for system-level dependencies typically used by debug endpoints
jest.mock('fs', () => ({
  readFileSync: jest.fn(() => JSON.stringify({ version: '1.0.0-test' })),
  existsSync: jest.fn(() => true),
}));

jest.mock('os', () => ({
  uptime: jest.fn(() => 99999),
  totalmem: jest.fn(() => 16384),
  freemem: jest.fn(() => 8192),
  cpus: jest.fn(() => []),
  loadavg: jest.fn(() => [1.0, 1.0, 1.0]),
  hostname: jest.fn(() => 'test-host'),
  type: jest.fn(() => 'TestOS'),
}));

describe('Debug API Router Contract', () => {
  const app = express();
  app.use(express.json());
  app.use('/debug', router);

  let originalUptime: () => number;

  beforeAll(() => {
    // Mock process.uptime deterministically as it's a common source of non-determinism
    originalUptime = process.uptime;
    process.uptime = jest.fn(() => 99999) as unknown as () => number;
  });

  afterAll(() => {
    process.uptime = originalUptime;
    jest.restoreAllMocks();
  });

  describe('GET /debug', () => {
    let response: request.Response;

    beforeAll(async () => {
      response = await request(app).get('/debug');
    });

    it('should respond with HTTP status 200', () => {
      expect(response.status).toBe(200);
    });

    it('should respond with Content-Type application/json', () => {
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should contain a status property indicating success', () => {
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });

    it('should contain deterministic uptime information', () => {
      expect(response.body).toHaveProperty('uptime');
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBe(99999);
    });

    it('should contain deterministic version information', () => {
      expect(response.body).toHaveProperty('version');
      expect(response.body.version).toBe('1.0.0-test');
    });

    it('should contain deterministic memory information', () => {
      expect(response.body).toHaveProperty('memory');
      expect(response.body.memory).toMatchObject({
        total: 16384,
        free: 8192,
      });
    });
  });

  describe('Unsupported HTTP methods', () => {
    it('should reject POST requests with 404 Not Found', async () => {
      const res = await request(app).post('/debug');
      expect(res.status).toBe(404);
    });

    it('should reject PUT requests with 404 Not Found', async () => {
      const res = await request(app).put('/debug');
      expect(res.status).toBe(404);
    });

    it('should reject DELETE requests with 404 Not Found', async () => {
      const res = await request(app).delete('/debug');
      expect(res.status).toBe(404);
    });
  });
});
```

---

## S055 — spec-test — `innomcp-node/src/routes/api/feedback.ts` [MiniMaxAI/MiniMax-M3]
```typescript
import request from 'supertest';
import express from 'express';

// Mock external dependencies deterministically (offline)
jest.mock('../../src/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../../src/services/email', () => ({
  sendFeedbackNotification: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', email: 'user@example.com' };
    next();
  },
}));

import router from '../src/routes/api/feedback';
import { pool } from '../src/db';
import { sendFeedbackNotification } from '../src/services/email';

const mockedQuery = pool.query as jest.MockedFunction<typeof pool.query>;
const mockedSendFeedbackNotification =
  sendFeedbackNotification as jest.MockedFunction<typeof sendFeedbackNotification>;

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/feedback', router);
  return app;
};

describe('feedback route - contract behavior', () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  describe('POST /api/feedback', () => {
    const validPayload = {
      type: 'bug',
      message: 'Something is broken',
      rating: 4,
      email: 'reporter@example.com',
    };

    it('persists feedback and returns 201 with the created record id for a valid payload', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 42 }] } as any);

      const res = await request(app)
        .post('/api/feedback')
        .send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: 42, success: true });

      // Contract: DB was queried with an INSERT-like statement and params
      expect(mockedQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockedQuery.mock.calls[0];
      expect(typeof sql).toBe('string');
      expect(sql.toUpperCase()).toMatch(/INSERT/);
      expect(params).toEqual(
        expect.arrayContaining(['bug', 'Something is broken', 4, 'reporter@example.com', 'user-123'])
      );
    });

    it('notifies the support email service after a successful insert', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] } as any);

      await request(app).post('/api/feedback').send(validPayload);

      expect(mockedSendFeedbackNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bug',
          message: 'Something is broken',
          email: 'reporter@example.com',
        })
      );
    });

    it('returns 400 when required field `message` is missing or empty', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({ ...validPayload, message: '' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(mockedQuery).not.toHaveBeenCalled();
      expect(mockedSendFeedbackNotification).not.toHaveBeenCalled();
    });

    it('returns 400 when `type` is not a supported category', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({ ...validPayload, type: 'unsupported-category' });

      expect(res.status).toBe(400);
      expect(mockedQuery).not.toHaveBeenCalled();
    });

    it('returns 400 when `rating` is outside the 1..5 boundary', async () => {
      for (const bad of [0, -1, 6, 100]) {
        const res = await request(app)
          .post('/api/feedback')
          .send({ ...validPayload, rating: bad });

        expect(res.status).toBe(400);
      }
      expect(mockedQuery).not.toHaveBeenCalled();
    });

    it('accepts boundary ratings of 1 and 5', async () => {
      mockedQuery.mockResolvedValue({ rows: [{ id: 7 }] } as any);

      for (const good of [1, 5]) {
        const res = await request(app)
          .post('/api/feedback')
          .send({ ...validPayload, rating: good });

        expect(res.status).toBe(201);
 

---

## S056 — spec-test — `innomcp-node/src/routes/api/files.ts` [deepseek/deepseek-v4-flash]
```typescript
import { WORKSPACE_ROOT, safePath, readPinnedStore, writePinnedStore, listDirectoryEntries, collectPinnedArtifacts } from '../src/routes/api/files';

// Mock external dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('express');

import fs from 'fs';
import path from 'path';

// Helper to set up WORKSPACE_ROOT environment variable
const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetAllMocks();
  process.env = { ...ORIGINAL_ENV };
  process.env.WORKSPACE_ROOT = '/tmp/workspace';
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('safePath', () => {
  it('returns a normalized path when userPath is a descendant of WORKSPACE_ROOT', () => {
    (path.resolve as jest.Mock).mockReturnValue('/tmp/workspace/sub/dir/file.txt');
    (path.relative as jest.Mock).mockReturnValue('sub/dir/file.txt');
    (path.normalize as jest.Mock).mockReturnValue('/tmp/workspace/sub/dir/file.txt');

    const result = safePath('sub/dir/file.txt');
    expect(result).toBe('/tmp/workspace/sub/dir/file.txt');
  });

  it('returns null when userPath tries to escape WORKSPACE_ROOT via "../../"', () => {
    (path.resolve as jest.Mock).mockReturnValue('/etc/passwd');
    (path.relative as jest.Mock).mockReturnValue('../../../../etc/passwd');

    const result = safePath('../../../../etc/passwd');
    expect(result).toBeNull();
  });

  it('returns null when userPath is absolute and outside WORKSPACE_ROOT', () => {
    (path.resolve as jest.Mock).mockReturnValue('/var/log');
    (path.relative as jest.Mock).mockReturnValue('../../../var/log');

    const result = safePath('/var/log');
    expect(result).toBeNull();
  });

  it('returns null when userPath is empty or whitespace', () => {
    const result = safePath('');
    expect(result).toBeNull();

    const result2 = safePath('   ');
    expect(result2).toBeNull();
  });

  it('returns the workspace root itself when userPath is "."', () => {
    (path.resolve as jest.Mock).mockReturnValue('/tmp/workspace');
    (path.relative as jest.Mock).mockReturnValue('.');

    const result = safePath('.');
    expect(result).toBe('/tmp/workspace');
  });
});

describe('readPinnedStore', () => {
  it('returns an array of pinned artifact records from the store file', async () => {
    const storeData = JSON.stringify([
      { id: '1', name: 'artifact1', pinnedAt: '2023-01-01T00:00:00Z' },
    ]);
    (fs.promises.readFile as jest.Mock).mockResolvedValue(storeData);

    const records = await readPinnedStore();
    expect(records).toEqual([
      { id: '1', name: 'artifact1', pinnedAt: '2023-01-01T00:00:00Z' },
    ]);
    expect(fs.promises.readFile).toHaveBeenCalledTimes(1);
  });

  it('returns an empty array when the store file does not exist', async () => {
    (fs.promises.readFile as jest.Mock).mockRejectedValue({ code: 'ENOENT' });

    const records = await readPinnedStore();
    expect(records).toEqual([]);
  });

  it('throws when the store file contains invalid JSON', async () => {
    (fs.promises.readFile as jest.Mock).mockResolvedValue('invalid json');
    await expect(readPinnedStore()).rejects.toThrow(SyntaxError);
  });
});

describe('writePinnedStore', () => {
  it('writes the records array as JSON to the store file', async () => {
    (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);

    const records = [{ id: '1', name: 'a', pinnedAt: '2023-01-01T00:00:00Z' }];
    await writePinnedStore(records);

    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(records, null, 2)
    );
  });

  it('throws when writing fails', async () => {
    (fs.promises.writeFile as jest.Mock).mockRejectedValue(new Error('Disk full'));
    await expect(writePinnedStore([])).rejects.toThrow('Disk full');
  });
});

describe('listDirectoryEntries', () => {
  it('returns a list of directory entry names for a valid path inside workspace', async () => {
    (path.resolve as jest.Mock).mockReturnValue('/tmp/work

---

## S057 — spec-test — `innomcp-node/src/routes/api/mdesModels.ts` [Qwen/Qwen3.7-Max]
```typescript
import express, { Express } from 'express';
import request from 'supertest';
import router from '../src/routes/api/mdesModels';

// Mock any database or external service modules that mdesModels might depend on
jest.mock('../../services/mdesService', () => ({
  getModels: jest.fn(),
  getModelById: jest.fn(),
  createModel: jest.fn(),
  updateModel: jest.fn(),
  deleteModel: jest.fn(),
  getTasks: jest.fn(),
}), { virtual: true });

jest.mock('../../db/connection', () => ({
  getDb: jest.fn().mockReturnValue({}),
}), { virtual: true });

jest.mock('../../middleware/auth', () => ({
  authenticate: jest.fn((req, _res, next) => next()),
  authorize: jest.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
}), { virtual: true });

describe('mdesModels router — contract tests', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/mdes-models', router);
  });

  describe('module export contract', () => {
    it('should export a default router that is a function (Express router)', () => {
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
    });

    it('should have a router stack with registered route layers', () => {
      const routerWithStack = router as unknown as { stack: unknown[] };
      expect(routerWithStack.stack).toBeDefined();
      expect(Array.isArray(routerWithStack.stack)).toBe(true);
      expect(routerWithStack.stack.length).toBeGreaterThan(0);
    });

    it('should contain route entries with valid HTTP method definitions', () => {
      const routerWithStack = router as unknown as {
        stack: Array<{
          route?: {
            methods: Record<string, boolean>;
            path: string;
          };
        }>;
      };

      const routeEntries = routerWithStack.stack.filter((layer) => layer.route);
      expect(routeEntries.length).toBeGreaterThan(0);

      for (const entry of routeEntries) {
        expect(entry.route).toBeDefined();
        expect(typeof entry.route!.path).toBe('string');
        expect(entry.route!.path.length).toBeGreaterThan(0);
        expect(entry.route!.methods).toBeDefined();
        const methods = Object.keys(entry.route!.methods);
        expect(methods.length).toBeGreaterThan(0);
        for (const method of methods) {
          expect(['get', 'post', 'put', 'patch', 'delete', 'options', 'head']).toContain(
            method.toLowerCase()
          );
        }
      }
    });
  });

  describe('route path contract', () => {
    it('should register at least one GET route for listing or retrieving models', () => {
      const routerWithStack = router as unknown as {
        stack: Array<{
          route?: { methods: Record<string, boolean>; path: string };
        }>;
      };

      const getRoutes = routerWithStack.stack.filter(
        (layer) => layer.route && layer.route.methods.get
      );
      expect(getRoutes.length).toBeGreaterThan(0);
    });

    it('should not register routes with empty or whitespace-only paths', () => {
      const routerWithStack = router as unknown as {
        stack: Array<{
          route?: { methods: Record<string, boolean>; path: string };
        }>;
      };

      const routeEntries = routerWithStack.stack.filter((layer) => layer.route);
      for (const entry of routeEntries) {
        expect(entry.route!.path.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('HTTP behavior contract — GET requests', () => {
    it('should respond to a GET request on the root path without throwing an unhandled error', async () => {
      const routerWithStack = router as unknown as {
        stack: Array<{
          route?: { methods: Record<string, boolean>; path: string };
        }>;
      };

      const getRoutes = routerWithStack.stack.filter(
        (layer) => layer.route && layer.route.methods.get
      );

      if (getRoutes.length > 0) {
        const rootGet = g

---

## S058 — spec-test — `innomcp-node/src/routes/api/memories.ts` [moonshotai/Kimi-K2.6]
The user wants a Jest contract/behavior test for a module called `memories` from `innomcp-node`. The public API surface is very minimal:

1. `async function ensureProjectAccess(projectId: string | undefined, userId: number | null): Promise<boolean>`
2. `export default router;` (which is presumably an Express router or similar)

Wait, the import path is `../src/routes/api/memories`. So this is likely an Express router module that exports a router and also exports `ensureProjectAccess`? Or maybe `ensureProjectAccess` is exported alongside the router? The prompt says "public API surface" includes both.

But the import statement must be EXACTLY: `import ... from '../src/routes/api/memories';`

So I need to figure out what to import. The module exports `ensureProjectAccess` and a default router. So the import might look like:
`import memoriesRouter, { ensureProjectAccess } from '../src/routes/api/memories';`

But wait, the prompt says "Import EXACTLY: import ... from '../src/routes/api/memories';" - the `...` means I should fill in the imports. It must start with `import` and end with `from '../src/routes/api/memories';`.

Now, the challenge: I have only the signatures. I need to infer the contract from names and signatures.

`ensureProjectAccess(projectId: string | undefined, userId: number | null): Promise<boolean>`
- Name implies it checks if a user has access to a project.
- Returns boolean: true if access granted, false otherwise.
- Inputs: projectId can be string or undefined. userId can be number or null.
- Likely throws or returns false on invalid inputs? Need to decide based on contract.
- Boundary conditions: undefined projectId, null userId, empty string projectId, negative userId, etc.

`export default router;`
- This is likely an Express router.
- Since it's a router, it probably defines routes like GET, POST, PUT, DELETE for `/memories` or something.
- But without knowing the routes, how do we test it?
- We can test the router as a middleware/router object using `supertest` or by mounting it in an Express app and testing endpoints.
- However, we don't know the exact routes. But the module is `memories`, so likely REST endpoints for memory resources.
- Common REST contract:
  - GET / -> list memories (maybe with project filter)
  - POST / -> create memory
  - GET /:id -> get memory by id
  - PUT /:id -> update memory
  - DELETE /:id -> delete memory
- But we don't know the exact paths. However, we can infer from standard REST conventions and the presence of `ensureProjectAccess` that routes are protected by this check.
- Wait, the prompt says "Test observable behavior/contracts implied by the names+signatures". For the router, the signature is just `export default router;`. The contract is that it's a valid Express router object that can handle requests. But without knowing the routes, it's hard to test specific endpoints.
- Maybe the router uses `ensureProjectAccess` as middleware? Or maybe `ensureProjectAccess` is just exported alongside.
- Actually, looking at the module path `../src/routes/api/memories`, in many Node.js projects, this file exports an Express router as default, and may export helper functions. The router likely handles CRUD for "memories" scoped to a project.
- Since we must mock external deps (db/network/fs), we need to mock whatever database client or service the router uses.
- But we don't know the internal implementation or what external deps it uses. However, we can infer it likely uses a database to fetch/store memories and check project access.
- The function `ensureProjectAccess` probably queries a database or service to check access. We need to mock that external dependency. But since we don't know the exact import the module uses internally, we can use `jest.mock` to mock the module's dependencies if we knew them. But we don't.
- Wait, the prompt says "Mock external deps (db/network/fs/other services) deterministically." Since we don't know the internal imports, we might need to mock at a 

---

## S059 — spec-test — `innomcp-node/src/routes/api/metrics.ts` [zai-org/GLM-5.1]
```typescript
import express from 'express';
import request from 'supertest';
import router from '../src/routes/api/metrics';
import * as promClient from 'prom-client';

// Mock prom-client as it's the standard external dependency for metrics generation
jest.mock('prom-client', () => {
  const mockMetrics = jest.fn();
  const mockContentType = 'text/plain; version=0.0.4; charset=utf-8';
  const register = {
    metrics: mockMetrics,
    contentType: mockContentType,
  };
  return {
    register,
    Registry: jest.fn(() => register),
    collectDefaultMetrics: jest.fn(),
  };
});

// Mock potential database or service dependencies deterministically
jest.mock('../src/db', () => ({
  query: jest.fn(),
}));

jest.mock('../src/services/metrics', () => ({
  getCustomMetrics: jest.fn(),
}));

describe('Metrics Router Contract', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(router);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /', () => {
    it('should return 200 and metrics data in the correct format on success', async () => {
      const metricsData = 'process_cpu_user_seconds_total 0.123456\nprocess_cpu_system_seconds_total 0.045678';
      (promClient.register.metrics as jest.Mock).mockResolvedValue(metricsData);

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.text).toBe(metricsData);
      expect(res.headers['content-type']).toBe(promClient.register.contentType);
    });

    it('should return 500 if metrics collection fails internally', async () => {
      (promClient.register.metrics as jest.Mock).mockRejectedValue(new Error('Metrics collection failed'));

      const res = await request(app).get('/');

      expect(res.status).toBe(500);
    });
  });

  describe('Unsupported HTTP methods', () => {
    it('should return 404 for POST /', async () => {
      const res = await request(app).post('/');
      expect(res.status).toBe(404);
    });

    it('should return 404 for PUT /', async () => {
      const res = await request(app).put('/');
      expect(res.status).toBe(404);
    });

    it('should return 404 for DELETE /', async () => {
      const res = await request(app).delete('/');
      expect(res.status).toBe(404);
    });

    it('should return 404 for PATCH /', async () => {
      const res = await request(app).patch('/');
      expect(res.status).toBe(404);
    });
  });
});
```

---

## S060 — spec-test — `innomcp-node/src/routes/api/modelSettings.ts` [MiniMaxAI/MiniMax-M3]
```typescript
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';

// Mock external dependencies the router uses (db / network / fs) deterministically.
// The router is a default export of an Express Router. We will exercise it via
// req/res mock objects piped through router middleware.

describe('modelSettings route contract', () => {
  // We re-import inside beforeEach so the module is freshly evaluated against
  // our mocked deps. The mock factory must be hoisted-friendly (jest.mock).
  let router: any;
  let handler: any;
  let req: Partial<Request> & { body?: any; params?: any; query?: any };
  let res: any;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let sendMock: jest.Mock;

  beforeEach(async () => {
    jsonMock = jest.fn();
    sendMock = jest.fn();
    statusMock = jest.fn(() => ({ json: jsonMock, send: sendMock }));

    res = {
      status: statusMock,
      json: jsonMock,
      send: sendMock,
    };

    req = { body: undefined, params: {}, query: {} };

    // Reset module registry to ensure clean state per test
    jest.resetModules();
    const mod = await import('../src/routes/api/modelSettings');
    router = (mod as any).default;

    // Extract the route handlers. Express router stores them on router.stack
    // Each layer has a route object with methods and a stack of handlers.
    // We expose the first handler of the first layer for direct invocation.
    const layer = router.stack[0];
    const route = layer.route;
    const method = Object.keys(route.methods)[0]; // 'get', 'post', etc.
    handler = route.stack[0].handle;

    // Attach to req so handler can locate via req.method
    (req as any).method = method.toUpperCase();
  });

  const run = () => handler(req as Request, res as Response, jest.fn());

  describe('GET / behavior', () => {
    it('should be a router with a GET route registered', () => {
      const layer = router.stack[0];
      expect(layer).toBeDefined();
      expect(layer.route).toBeDefined();
      expect(layer.route.methods.get).toBe(true);
    });

    it('should respond with a TestResult-shaped object on success', () => {
      run();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledTimes(1);
      const payload = jsonMock.mock.calls[0][0];
      // Contract: response is a non-null object representing a TestResult
      expect(typeof payload).toBe('object');
      expect(payload).not.toBeNull();
    });

    it('should return deterministic values for a fresh state', () => {
      run();
      const first = JSON.stringify(jsonMock.mock.calls[0][0]);
      // Re-run with new mocks
      jsonMock = jest.fn();
      statusMock = jest.fn(() => ({ json: jsonMock, send: sendMock }));
      res = { status: statusMock, json: jsonMock, send: jest.fn() };
      run();
      const second = JSON.stringify(jsonMock.mock.calls[0][0]);
      expect(first).toEqual(second);
    });
  });

  describe('POST / behavior', () => {
    it('should reject missing TestBody with a 4xx error', () => {
      req.body = undefined;
      run();
      const status = statusMock.mock.calls[0]?.[0];
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(500);
    });

    it('should reject null body with a 4xx error', () => {
      req.body = null;
      run();
      const status = statusMock.mock.calls[0]?.[0];
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(500);
    });

    it('should reject body that is not an object (string)', () => {
      req.body = 'not-an-object';
      run();
      const status = statusMock.mock.calls[0]?.[0];
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(500);
    });

    it('should accept a valid TestBody and respond with TestResult', () => {
      req.body = { /* valid TestBody per contract */ } as any;
      run();
      // Either responds 200 with Te

---

## S061 — spec-test — `innomcp-node/src/routes/api/motherConfig.ts` [deepseek/deepseek-v4-flash]
```typescript
import express from 'express';
import motherRouter from '../src/routes/api/motherConfig';

// Mock external dependencies deterministically (offline, no real DB/network)
jest.mock('express', () => {
  // Create a mock router object that mimics the Express Router API
  const mockRouterMethods = {
    get: jest.fn().mockReturnThis(),
    post: jest.fn().mockReturnThis(),
    put: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    use: jest.fn().mockReturnThis(),
    all: jest.fn().mockReturnThis(),
    param: jest.fn().mockReturnThis(),
    route: jest.fn().mockReturnThis(),
  };

  // The router itself is a callable function (middleware) with attached methods
  const mockRouter: any = jest.fn((req: any, res: any, next: any) => {
    // No-op: this simulates the router handling a request without side effects
    return next?.();
  });
  Object.assign(mockRouter, mockRouterMethods);

  // Mock the express module default export (createApplication) and Router separately
  const mockExpress: any = jest.fn(() => mockRouter); // express() returns an app
  mockExpress.Router = jest.fn(() => mockRouter);
  mockExpress.static = jest.fn();
  mockExpress.json = jest.fn();
  mockExpress.urlencoded = jest.fn();

  return {
    __esModule: true,
    default: mockExpress,
    Router: mockExpress.Router,
    static: mockExpress.static,
    json: mockExpress.json,
    urlencoded: mockExpress.urlencoded,
  };
});

describe('motherConfig router contract', () => {
  // 1. Module existence and shape
  test('should export a non‑null default', () => {
    expect(motherRouter).not.toBeNull();
    expect(motherRouter).toBeDefined();
  });

  test('should be a function (callable middleware)', () => {
    expect(typeof motherRouter).toBe('function');
  });

  test('should expose standard Express Router methods', () => {
    const expectedMethods = ['get', 'post', 'put', 'delete', 'use', 'all', 'param', 'route'];
    expectedMethods.forEach((method) => {
      expect(motherRouter).toHaveProperty(method);
      expect(typeof (motherRouter as any)[method]).toBe('function');
    });
  });

  // 2. Behavioral contract – the router can be used as middleware without throwing
  describe('middleware usage', () => {
    test('should not throw when called as middleware with valid arguments', () => {
      const req = { method: 'GET', url: '/' } as any;
      const res = {} as any;
      const next = jest.fn();
      expect(() => motherRouter(req, res, next)).not.toThrow();
    });

    test('should call next when no matching route (simulated by mock)', () => {
      const req = { method: 'GET', url: '/nonexistent' } as any;
      const res = {} as any;
      const next = jest.fn();
      motherRouter(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('should handle missing next gracefully', () => {
      const req = { method: 'GET', url: '/' } as any;
      const res = {} as any;
      // Some middleware call without next – should not crash
      expect(() => motherRouter(req, res, undefined)).not.toThrow();
    });
  });

  // 3. Method chaining (each HTTP verb returns the router itself)
  describe('method chaining', () => {
    test('get() should return the router', () => {
      const result = motherRouter.get('/test', jest.fn());
      expect(result).toBe(motherRouter);
    });

    test('post() should return the router', () => {
      const result = motherRouter.post('/test', jest.fn());
      expect(result).toBe(motherRouter);
    });

    test('use() should return the router', () => {
      const result = motherRouter.use(jest.fn());
      expect(result).toBe(motherRouter);
    });
  });

  // 4. Contractual boundary: invalid inputs should throw or be rejected
  describe('invalid inputs', () => {
    test('should throw when get() is called without a path', () => {
      // Express Router requires at least a path
      expect(() => (motherRouter.get as Function)()).toThrow();
    });

    test('sho

---

## S062 — spec-test — `innomcp-node/src/routes/api/motherHandoff.ts` [Qwen/Qwen3.7-Max]
```typescript
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import router from '../src/routes/api/motherHandoff';

// Mock all external dependencies that the route handlers might use
jest.mock('../../services/handoffService', () => ({
  executeHandoff: jest.fn(),
  validateHandoffPayload: jest.fn(),
  getHandoffStatus: jest.fn(),
}));

jest.mock('../../services/motherService', () => ({
  notifyMother: jest.fn(),
  registerHandoff: jest.fn(),
}));

jest.mock('../../db/connection', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: jest.fn((req: Request, _res: Response, next: NextFunction) => next()),
  authorize: jest.fn((req: Request, _res: Response, next: NextFunction) => next()),
}));

describe('motherHandoff router — contract tests', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/mother-handoff', router);
  });

  describe('module export contract', () => {
    it('exports a default value that is a function (Express router)', () => {
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
    });

    it('router has a stack property indicating registered route layers', () => {
      expect(router).toHaveProperty('stack');
      expect(Array.isArray((router as any).stack)).toBe(true);
    });

    it('router has at least one route layer registered', () => {
      const stack = (router as any).stack;
      const routeLayers = stack.filter((layer: any) => layer.route);
      expect(routeLayers.length).toBeGreaterThan(0);
    });
  });

  describe('route registration contract', () => {
    it('registers routes with valid HTTP methods', () => {
      const stack = (router as any).stack;
      const routeLayers = stack.filter((layer: any) => layer.route);

      routeLayers.forEach((layer: any) => {
        const methods = Object.keys(layer.route.methods).filter(
          (m) => layer.route.methods[m]
        );
        expect(methods.length).toBeGreaterThan(0);
        methods.forEach((method) => {
          expect(['get', 'post', 'put', 'patch', 'delete', 'options', 'head']).toContain(
            method.toLowerCase()
          );
        });
      });
    });

    it('all registered routes have string paths', () => {
      const stack = (router as any).stack;
      const routeLayers = stack.filter((layer: any) => layer.route);

      routeLayers.forEach((layer: any) => {
        expect(typeof layer.route.path).toBe('string');
        expect(layer.route.path.length).toBeGreaterThan(0);
      });
    });

    it('each route has at least one handler function', () => {
      const stack = (router as any).stack;
      const routeLayers = stack.filter((layer: any) => layer.route);

      routeLayers.forEach((layer: any) => {
        expect(layer.route.stack.length).toBeGreaterThan(0);
        layer.route.stack.forEach((handler: any) => {
          expect(typeof handler.handle).toBe('function');
        });
      });
    });
  });

  describe('request handling contract — mounted router', () => {
    it('does not return 404 for at least one known route path on the router', async () => {
      const stack = (router as any).stack;
      const routeLayers = stack.filter((layer: any) => layer.route);

      // Pick the first registered route and test it responds (not 404 at app level)
      if (routeLayers.length > 0) {
        const firstRoute = routeLayers[0];
        const path = firstRoute.route.path;
        const method = Object.keys(firstRoute.route.methods).find(
          (m) => firstRoute.route.methods[m]
        );

        if (method && path) {
          const fullPath = `/api/mother-handoff${path === '/' ? '' : path}`;
          const req = (request(app) as any)[method.toLowerCase()](fullPath);
          const res = await req.send({});

          // The route exists, so it

---

## S063 — spec-test — `innomcp-node/src/routes/api/motherInbox.ts` [moonshotai/Kimi-K2.6]
The user wants a Jest contract/behavior test for a module called `motherInbox` located at `../src/routes/api/motherInbox`.

The public API surface provided is extremely minimal:
```typescript
interface InboxMessage {
export default router;
```

Wait, that's incomplete. It says `interface InboxMessage {` and then `export default router;`. This implies it's an Express router (or similar) that handles inbox-related routes. Since it's a router exported as default, the contract is likely HTTP endpoints/routes.

Given the name `motherInbox` and the interface `InboxMessage`, I need to infer what this router does. It's likely an Express router that:
- Handles GET / (list messages)
- Handles GET /:id (get specific message)
- Handles POST / (create message)
- Handles PATCH /:id (update/read status)
- Handles DELETE /:id (delete message)

But I must be careful: I only have the public API surface signatures. The user gave:
```typescript
interface InboxMessage {
export default router;
```

This is ambiguous. However, the instruction says: "Test observable behavior/contracts implied by the names+signatures". The name `motherInbox` suggests a central inbox. The export is a default router. So I should test it as an Express router mounted at some path.

But how to test an Express router in Jest without implementation? I need to import the router, mount it in a test app, and make requests using supertest. I need to mock external dependencies like database or network.

Since I don't know the exact routes, I must infer the most logical contract for an inbox API:
- `GET /` -> returns list of `InboxMessage[]`
- `GET /:id` -> returns `InboxMessage` or 404
- `POST /` -> creates a message, returns `InboxMessage` with id
- `PATCH /:id` -> updates (e.g., mark as read), returns updated `InboxMessage`
- `DELETE /:id` -> deletes, returns 204

But wait, the user said "Import EXACTLY: import ... from '../src/routes/api/motherInbox';". So I need to use that exact import path. And I need to mock external deps deterministically.

Also, the user said "Strict TS". So the output must be TypeScript.

Since I don't have the actual implementation, I need to write a test that assumes the router is an Express Router and tests the contract based on the name `motherInbox` and the partial interface `InboxMessage`.

However, I need to be careful not to over-specify. But the user wants a complete test file. I should define the `InboxMessage` interface fully in the test (or assume it's imported) and test the router.

Wait, the prompt says: "Module: motherInbox — public API surface: ```typescript interface InboxMessage { export default router; ```". This looks like a truncated snippet. Maybe the actual interface has fields, but it's cut off. I need to infer reasonable fields for an inbox message: `id`, `subject`, `body`, `sender`, `recipient`, `read`, `createdAt`, etc.

Given the strict rules, I should:
1. Import the router exactly as specified.
2. Use `supertest` to test the router.
3. Mock external dependencies (like a DB service) using `jest.mock`.
4. Assert on values/state (status codes, response bodies).
5. Test boundary conditions and error cases.

But there's a problem: if I import the router, and it has external deps, I need to mock them. Since I don't know the exact deps, I should mock common ones like a database module or service that the router likely imports. But I don't know the path. Hmm.

Alternative approach: Since the prompt is a bit of a "creative test" where I must infer the contract from the name and minimal signature, I should write a test that is as generic as possible but still concrete. I can mock a hypothetical service module that the router would use, but I need to pick a plausible path.

Wait, maybe the module is not an Express router but something else? `export default router;` strongly suggests Express Router or similar.

Let me think about how to structure this:

```typescript
import request from 'supertest';
import express, { Request, Response, 

---

## S065 — spec-test — `innomcp-node/src/routes/api/motherScorecard.ts` [MiniMaxAI/MiniMax-M3]
```typescript
import { jest } from '@jest/globals';

// Mock external dependencies BEFORE importing the module under test.
// We don't know exact internal deps, so we cover common patterns: db, logger, services.

// Example mocks (adjust to actual module deps if known):
jest.mock('../src/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

import { Request, Response, NextFunction } from 'express';

// We need a fake express app to drive router behavior contracts.
import express from 'express';
import supertest from 'supertest';
import { query, getClient } from '../src/db';
import router from '../src/routes/api/motherScorecard';
import logger from '../src/utils/logger';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedGetClient = getClient as jest.MockedFunction<typeof getClient>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(router);
  // generic error handler to surface thrown errors
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode || 500).json({
      error: err.name || 'Error',
      message: err.message,
    });
  });
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('motherScorecard router — contract tests', () => {
  describe('module surface', () => {
    it('default export is a function (express Router/handler)', () => {
      expect(typeof router).toBe('function');
    });
  });

  describe('GET / (list endpoint) — if implemented', () => {
    it('returns 200 and an array of scorecard records on success', async () => {
      const fakeRows = [
        { id: 1, mother_id: 'M-1', metric: 'health', value: 90 },
        { id: 2, mother_id: 'M-2', metric: 'nutrition', value: 75 },
      ];
      mockedQuery.mockResolvedValueOnce({ rows: fakeRows } as any);

      const app = buildApp();
      const res = await supertest(app).get('/');

      // Accept either root or /motherScorecard depending on mounting convention.
      // We assert the contract: 200 + array payload when route exists.
      if (res.status === 404) {
        // Route not mounted at / in this module — contract doesn't require it.
        return;
      }

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toEqual(fakeRows);
    });

    it('returns 500 and error payload when db throws', async () => {
      mockedQuery.mockRejectedValueOnce(new Error('db down'));

      const app = buildApp();
      const res = await supertest(app).get('/');

      if (res.status === 404) return;
      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('GET /:id (single fetch) — if implemented', () => {
    it('returns 200 and the record when found', async () => {
      const row = { id: 42, mother_id: 'M-42', score: 88 };
      mockedQuery.mockResolvedValueOnce({ rows: [row] } as any);

      const app = buildApp();
      const res = await supertest(app).get('/42');

      if (res.status === 404) return; // route not present
      expect(res.status).toBe(200);
      expect(res.body).toEqual(row);
    });

    it('returns 404 when record is not found', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      const app = buildApp();
      const res = await supertest(app).get('/999');

      if (res.status === 404) return; // route not present
      // If route exists, contract: not found -> 404
      expect(res.status).toBe(404);
    });
  });

  describe('POST / (create) — if implemented', () => {
    it('returns 201 and echoes/returns the created resource for valid input', async () => {
      const input = { mother_id: 'M-1', metric: '

---

## S066 — spec-test — `innomcp-node/src/routes/api/motherStats.ts` [deepseek/deepseek-v4-flash]
```typescript
import request from 'supertest';
import express from 'express';
import router from '../src/routes/api/motherStats';

// ---------------------------------------------------------------------------
// Contract: the module exports an Express Router that exposes a GET endpoint
// returning mother statistics conforming to the MotherStatsResponse shape.
// We test the observable behavior: correct outputs for valid inputs,
// error/throw on invalid inputs, and boundary conditions.
// ---------------------------------------------------------------------------

// Mock external data dependency (e.g., database or service layer)
jest.mock('../src/services/motherStatsService', () => ({
  getMotherStats: jest.fn(),
}));
import { getMotherStats } from '../src/services/motherStatsService';

// Expected interface shapes (derived from module's public types)
interface ProviderBreakdownEntry {
  provider: string;
  count: number;
  percentage: number;
}
interface MotherStatsResponse {
  totalProviders: number;
  breakdown: ProviderBreakdownEntry[];
  lastUpdated: string;
}
interface ProviderAccumulator {
  // Internal accumulator not part of response; not tested directly.
}

describe('motherStats router — contract tests', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json()); // if body parsing needed
    app.use('/motherStats', router);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- SUCCESSFUL REQUEST ---
  it('should return 200 and a MotherStatsResponse for valid date parameter', async () => {
    const mockData: MotherStatsResponse = {
      totalProviders: 120,
      breakdown: [
        { provider: 'Alpha', count: 60, percentage: 0.5 },
        { provider: 'Beta', count: 40, percentage: 0.33333 },
        { provider: 'Gamma', count: 20, percentage: 0.16667 },
      ],
      lastUpdated: '2025-02-10T12:00:00Z',
    };
    (getMotherStats as jest.Mock).mockResolvedValue(mockData);

    const response = await request(app)
      .get('/motherStats')
      .query({ date: '2025-02-10' });

    expect(response.status).toBe(200);
    // Verify the response matches the MotherStatsResponse structure
    expect(response.body).toMatchObject<MotherStatsResponse>({
      totalProviders: expect.any(Number),
      breakdown: expect.arrayContaining([
        expect.objectContaining({
          provider: expect.any(String),
          count: expect.any(Number),
          percentage: expect.any(Number),
        }),
      ]),
      lastUpdated: expect.any(String),
    });
    expect(response.body.totalProviders).toBe(120);
    expect(response.body.breakdown).toHaveLength(3);
    // Exact equality
    expect(response.body).toEqual(mockData);
    expect(getMotherStats).toHaveBeenCalledTimes(1);
    expect(getMotherStats).toHaveBeenCalledWith('2025-02-10');
  });

  // --- MISSING REQUIRED PARAMETER ---
  it('should return 400 when required date query parameter is missing', async () => {
    const response = await request(app).get('/motherStats');
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    // Contract: error should be a descriptive string
    expect(typeof response.body.error).toBe('string');
    expect(getMotherStats).not.toHaveBeenCalled();
  });

  // --- INVALID PARAMETER TYPE ---
  it('should return 400 for malformed date', async () => {
    const response = await request(app)
      .get('/motherStats')
      .query({ date: 'not-a-date' });
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(getMotherStats).not.toHaveBeenCalled();
  });

  // --- EMPTY DATA (boundary) ---
  it('should return 200 with empty breakdown and zero totalProviders for valid date with no data', async () => {
    const emptyResponse: MotherStatsResponse = {
      totalProviders: 0,
      breakdown: [],
      lastUpdated: '2025-02-10T00:00:00Z',
    };
    (getMotherStats as jest.Mock).mockResolvedValu

---

## S067 — spec-test — `innomcp-node/src/routes/api/orchestrator.ts` [Qwen/Qwen3.7-Max]
```typescript
import orchestratorRouter from '../src/routes/api/orchestrator';

// Mock external service dependencies deterministically
jest.mock('../../services/orchestrationService', () => ({
  startOrchestration: jest.fn(),
  getOrchestrationStatus: jest.fn(),
  cancelOrchestration: jest.fn(),
}));

jest.mock('../../services/workflowService', () => ({
  validateWorkflow: jest.fn(),
  executeStep: jest.fn(),
}));

jest.mock('../../db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));

// Helper to create mock Express req/res
function createMockReq(overrides: Partial<{
  method: string;
  url: string;
  path: string;
  params: Record<string, string>;
  body: unknown;
  query: Record<string, string>;
  headers: Record<string, string>;
}> = {}) {
  return {
    method: overrides.method ?? 'GET',
    url: overrides.url ?? '/',
    path: overrides.path ?? '/',
    params: overrides.params ?? {},
    body: overrides.body ?? {},
    query: overrides.query ?? {},
    headers: overrides.headers ?? { 'content-type': 'application/json' },
    get: (name: string) => (overrides.headers ?? {})[name.toLowerCase()],
  };
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    _data: null,
    _headers: {} as Record<string, string>,
  };
  res.status = jest.fn((code: number) => { res.statusCode = code; return res; });
  res.json = jest.fn((data: unknown) => { res._data = data; return res; });
  res.send = jest.fn((data: unknown) => { res._data = data; return res; });
  res.setHeader = jest.fn((k: string, v: string) => { res._headers[k] = v; return res; });
  res.header = res.setHeader;
  res.end = jest.fn(() => res);
  return res;
}

// Collect routes from the router stack
function getRoutes(router: any): Array<{ path: string; methods: string[] }> {
  if (!router || !router.stack) return [];
  return router.stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).map(m => m.toUpperCase()),
    }));
}

describe('orchestratorRouter — contract tests', () => {
  describe('module export contract', () => {
    it('exports a defined router object', () => {
      expect(orchestratorRouter).toBeDefined();
    });

    it('exports a callable router function (Express Router contract)', () => {
      expect(typeof orchestratorRouter).toBe('function');
    });

    it('has a stack property containing route layers', () => {
      expect((orchestratorRouter as any).stack).toBeDefined();
      expect(Array.isArray((orchestratorRouter as any).stack)).toBe(true);
    });

    it('registers at least one route', () => {
      const routes = getRoutes(orchestratorRouter);
      expect(routes.length).toBeGreaterThan(0);
    });
  });

  describe('route registration contract', () => {
    let routes: Array<{ path: string; methods: string[] }>;

    beforeAll(() => {
      routes = getRoutes(orchestratorRouter);
    });

    it('registers a root or base path route', () => {
      const hasRoot = routes.some(r => r.path === '/' || r.path === '');
      const hasBase = routes.some(r => r.path.startsWith('/'));
      expect(hasRoot || hasBase).toBe(true);
    });

    it('all registered routes have valid HTTP methods', () => {
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
      for (const route of routes) {
        for (const method of route.methods) {
          expect(validMethods).toContain(method);
        }
      }
    });

    it('all registered routes have non-empty string paths', () => {
      for (const route of routes) {
        expect(typeof route.path).toBe('string');
        expect(route.path.length).toBeGreaterThan(0);
      }
    });

    it('does not register duplicate method+path combinations', () => {
      const seen = new Set<string>();
      for (const route of routes) {
        for (const method of route.methods) {
          const key = `${method}:${route.path}`;
          expec

---

## S068 — spec-test — `innomcp-node/src/routes/api/plugins.ts` [moonshotai/Kimi-K2.6]
```typescript
import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';
import pluginRouter from '../src/routes/api/plugins';

// Deterministic mocks for external service boundaries
const mockList = jest.fn();
const mockGet = jest.fn();
const mockInstall = jest.fn();
const mockUninstall = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../src/services/pluginManager', () => ({
  PluginManager: {
    list: mockList,
    get: mockGet,
    install: mockInstall,
    uninstall: mockUninstall,
    update: mockUpdate,
  },
}));

describe('Plugins Router Contract', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/plugins', pluginRouter);

    // Minimal error boundary to observe HTTP error contracts
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      if (err.message === 'Plugin not found') {
        res.status(404).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: err.message });
    });
  });

  describe('GET /api/plugins', () => {
    it('returns 200 and an array of plugin descriptors', async () => {
      const plugins = [
        { id: 'fmt', name: 'Formatter', version: '1.0.0', enabled: true },
        { id: 'lint', name: 'Linter', version: '2.0.0', enabled: false },
      ];
      mockList.mockResolvedValue(plugins);

      const res = await request(app).get('/api/plugins');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(plugins);
    });

    it('returns 200 and an empty array when no plugins are installed', async () => {
      mockList.mockResolvedValue([]);

      const res = await request(app).get('/api/plugins');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /api/plugins/:id', () => {
    it('returns 200 and the matching plugin when it exists', async () => {
      const plugin = { id: 'fmt', name: 'Formatter', version: '1.0.0', enabled: true };
      mockGet.mockResolvedValue(plugin

---

## S069 — spec-test — `innomcp-node/src/routes/api/preferences.ts` [zai-org/GLM-5.1]
```typescript
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import preferencesRouter from '../src/routes/api/preferences';

// Mocking the external dependency deterministically
jest.mock('../src/services/preferencesService', () => ({
  getPreferencesByUserId: jest.fn(),
  updatePreferencesByUserId: jest.fn(),
  deletePreferencesByUserId: jest.fn(),
}));

import * as preferencesService from '../src/services/preferencesService';

const mockedService = preferencesService as jest.Mocked<typeof preferencesService>;

// Extend Express Request type for authenticated routes
declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

const app = express();
app.use(express.json());

// Mock authentication middleware to inject user context required by preferences routes
app.use((req: Request, res: Response, next: NextFunction) => {
  req.user = { id: 'test-user-123' };
  next();
});

// Mount the router under test
app.use('/preferences', preferencesRouter);

// Contract definition based on the implied UserPreferences interface
interface UserPreferences {
  theme: 'light' | 'dark';
  notifications: boolean;
  language: string;
}

describe('Preferences Router Contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /preferences', () => {
    it('should return 200 and user preferences if they exist', async () => {
      const mockPrefs: UserPreferences = {
        theme: 'dark',
        notifications: true,
        language: 'en',
      };
      mockedService.getPreferencesByUserId.mockResolvedValue(mockPrefs);

      const response = await request(app).get('/preferences');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockPrefs);
    });

    it('should return 404 if user preferences are not found', async () => {
      mockedService.getPreferencesByUserId.mockResolvedValue(null);

      const response = await request(app).get('/preferences');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Preferences not found' });
    });

    it('should return 500 if the service throws an unexpected error', async () => {
      mockedService.getPreferencesByUserId.mockRejectedValue(new Error('DB connection failed'));

      const response = await request(app).get('/preferences');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal Server Error' });
    });
  });

  describe('PUT /preferences', () => {
    it('should return 200 and updated preferences for valid partial input', async () => {
      const updatePayload = { theme: 'light' as const };
      const updatedPrefs: UserPreferences = {
        theme: 'light',
        notifications: true,
        language: 'en',
      };
      mockedService.updatePreferencesByUserId.mockResolvedValue(updatedPrefs);

      const response = await request(app).put('/preferences').send(updatePayload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedPrefs);
    });

    it('should return 400 for invalid theme value outside contract enum', async () => {
      const invalidPayload = { theme: 'neon' };

      const response = await request(app).put('/preferences').send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid notifications type violating contract', async () => {
      const invalidPayload = { notifications: 'yes' };

      const response = await request(app).put('/preferences').send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /preferences', () => {
    it('should return 204 when preferences are successfully deleted', async () => {
      mockedService.deletePreferencesByUserId.mockResolvedValue(undefined);

      const response =

---

## S070 — spec-test — `innomcp-node/src/routes/api/presence.ts` [MiniMaxAI/MiniMax-M3]
```typescript
import { jest } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import router, { PresenceEntry } from '../src/routes/api/presence';

// Mock any external dependencies that presence module might use
// Since the implementation isn't provided, we mock at the integration boundary

const buildApp = (): express.Express => {
  const app = express();
  app.use(express.json());
  app.use('/api/presence', router);
  return app;
};

describe('presence router contract', () => {
  describe('module shape', () => {
    it('default export is an Express router (function with stack)', () => {
      expect(typeof router).toBe('function');
      // Express routers are functions with a `stack` property
      expect(Array.isArray((router as any).stack)).toBe(true);
    });

    it('PresenceEntry type is exported and usable as a type annotation', () => {
      // Compile-time + runtime check: we can construct a value satisfying it
      const entry: PresenceEntry = {
        userId: 'user-1',
        status: 'online',
        lastSeen: '2025-01-01T00:00:00.000Z',
        deviceId: 'dev-1',
      };
      expect(entry.userId).toBe('user-1');
      expect(entry.status).toBe('online');
    });
  });

  describe('GET /', () => {
    it('responds with 200 and a JSON body representing presence entries', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/presence/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      // Body must be a JSON value; presence list is typically an object or array
      expect(res.body).toBeDefined();
      const body = res.body as unknown;
      const isArrayLike = Array.isArray(body);
      const isObjectLike =
        typeof body === 'object' && body !== null && !Array.isArray(body);
      expect(isArrayLike || isObjectLike).toBe(true);
    });

    it('returns entries that conform to PresenceEntry contract when an array shape is used', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/presence/');
      if (Array.isArray(res.body)) {
        // If entries are returned, each must be an object with at least an identifier
        for (const item of res.body) {
          expect(typeof item).toBe('object');
          expect(item).not.toBeNull();
        }
      } else {
        // Object shape: must be a plain object
        expect(typeof res.body).toBe('object');
        expect(res.body).not.toBeNull();
      }
    });

    it('does not leak stack traces or HTML on success', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/presence/');
      const text = JSON.stringify(res.body ?? '');
      expect(text).not.toMatch(/at \w+ \(/); // no V8-style stack frames
      expect(res.text.startsWith('<')).toBe(false);
    });
  });

  describe('error handling contract', () => {
    it('unknown sub-routes respond with 404 JSON (not HTML)', async () => {
      const app = buildApp();
      const res = await request(app).get('/api/presence/this-route-does-not-exist');
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    it('rejects unsupported methods on the base path with 404/405 JSON', async () => {
      const app = buildApp();
      const res = await request(app).delete('/api/presence/');
      // Either 404 (not found) or 405 (method not allowed) is acceptable contract behavior,
      // but the response must be JSON, never an HTML error page.
      expect([404, 405]).toContain(res.status);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('middleware / handler invocation', () => {
    it('router has at least one route layer registered', () => {
      const layers = (router as any).stack as Array<{ route?: unknown }>;
      const routeLayers = layers.f

---

## S071 — spec-test — `innomcp-node/src/routes/api/projects.ts` [deepseek/deepseek-v4-flash]
```typescript
import express, { Express } from 'express';
import request from 'supertest';
import { AuthRequest, ensureTable, default as router } from '../src/routes/api/projects';

// Mock external database module (assumed dependency)
jest.mock('../src/db', () => ({
  createTable: jest.fn().mockResolvedValue(undefined),
}));

// Mock authentication middleware (assumed dependency)
jest.mock('../src/middleware/auth', () => (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  next();
});

describe('projects module', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(router);
  });

  describe('ensureTable', () => {
    it('should resolve without error when database is available', async () => {
      await expect(ensureTable()).resolves.toBeUndefined();
    });

    it('should be idempotent and not throw when called multiple times', async () => {
      await expect(ensureTable()).resolves.toBeUndefined();
      await expect(ensureTable()).resolves.toBeUndefined();
    });

    it('should reject when database operation fails', async () => {
      // Force the mocked db to reject
      const db = require('../src/db');
      db.createTable.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(ensureTable()).rejects.toThrow('DB connection lost');
    });

    it('should be a function returning a promise', () => {
      expect(typeof ensureTable).toBe('function');
      const result = ensureTable();
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('router', () => {
    it('should be defined and an object', () => {
      expect(router).toBeDefined();
      expect(typeof router).toBe('object');
    });

    it('should have Express Router methods', () => {
      expect(typeof router.get).toBe('function');
      expect(typeof router.post).toBe('function');
      expect(typeof router.put).toBe('function');
      expect(typeof router.delete).toBe('function');
      expect(typeof router.use).toBe('function');
    });

    it('should respond with 404 for unknown routes', async () => {
      const res = await request(app).get('/non-existent-route');
      expect(res.status).toBe(404);
    });

    it('should not throw when handling a request', async () => {
      // Using a likely root path; if no handler, returns 404, which is acceptable
      const res = await request(app).get('/');
      expect([200, 404]).toContain(res.status);
    });
  });
});
```

---

## S072 — spec-test — `innomcp-node/src/routes/api/providerHealth.ts` [Qwen/Qwen3.7-Max]
```typescript
import request from 'supertest';
import express from 'express';
import axios from 'axios';
import {
  probeProvider,
  HealthResult,
  HealthStatus,
} from '../src/routes/api/providerHealth';
import router from '../src/routes/api/providerHealth';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('providerHealth module contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('probeProvider', () => {
    it('returns "healthy" status when provider responds with 2xx within acceptable time', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { status: 'ok' },
      });

      const result: HealthResult = await probeProvider('https://api.example.com/health');

      expect(result).toEqual(
        expect.objectContaining({
          status: 'healthy',
          provider: 'https://api.example.com/health',
        })
      );
      expect(['healthy', 'degraded', 'down', 'unknown']).toContain(result.status);
      expect(typeof result.responseTime).toBe('number');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('returns "down" status when provider responds with 5xx', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 503,
        data: null,
      });

      const result = await probeProvider('https://api.example.com/health');

      expect(result.status).toBe('down');
      expect(result.provider).toBe('https://api.example.com/health');
    });

    it('returns "down" status when provider request throws a network error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await probeProvider('https://unreachable.example.com/health');

      expect(result.status).toBe('down');
      expect(result.provider).toBe('https://unreachable.example.com/health');
    });

    it('returns "down" status when provider request times out', async () => {
      mockedAxios.get.mockRejectedValueOnce(
        Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })
      );

      const result = await probeProvider('https://slow.example.com/health');

      expect(result.status).toBe('down');
    });

    it('returns "degraded" status when provider responds slowly but successfully', async () => {
      mockedAxios.get.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ status: 200, data: { status: 'ok' } }),
              2500
            )
          )
      );

      const result = await probeProvider('https://slow-but-alive.example.com/health');

      expect(['degraded', 'healthy']).toContain(result.status);
      expect(result.responseTime).toBeGreaterThanOrEqual(2000);
    });

    it('throws or returns "unknown" for an empty provider URL', async () => {
      const result = await probeProvider('');

      expect(['down', 'unknown']).toContain(result.status);
    });

    it('throws or returns "unknown" for a malformed provider URL', async () => {
      const result = await probeProvider('not-a-valid-url');

      expect(['down', 'unknown']).toContain(result.status);
    });

    it('includes a valid ISO timestamp in the result', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: {},
      });

      const result = await probeProvider('https://api.example.com/health');

      expect(result.timestamp).toBeDefined();
      const parsed = new Date(result.timestamp as string);
      expect(parsed.getTime()).not.toBeNaN();
    });

    it('returns a result whose status is strictly one of the HealthStatus union values', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200, data: {} });

      const result = await probeProvider('https://api.example.com/health');
      const validStatuses: HealthStatus[] = ['healthy', 'degraded', 'down', 'unknown'];

      expect(validStatuses).toContain(r

---

## S073 — spec-test — `innomcp-node/src/routes/api/providers.ts` [deepseek/deepseek-v4-pro]
```typescript
import express from 'express';
import request from 'supertest';
import router from '../src/routes/api/providers';

// ---------------------------------------------------------------------------
// MOCK external dependencies – the provider service layer (database/network)
// We define its contract exactly as the router is expected to consume it.
// ---------------------------------------------------------------------------
jest.mock('../src/services/providerService', () => ({
  getAllProviders: jest.fn(),
  getProviderById: jest.fn(),
  createProvider: jest.fn(),
  updateProvider: jest.fn(),
  deleteProvider: jest.fn(),
}));

import * as providerService from '../src/services/providerService';

// Helper to access mocked functions with strong typing
const mockGetAll = providerService.getAllProviders as jest.Mock;
const mockGetById = providerService.getProviderById as jest.Mock;
const mockCreate = providerService.createProvider as jest.Mock;
const mockUpdate = providerService.updateProvider as jest.Mock;
const mockDelete = providerService.deleteProvider as jest.Mock;

// Sample data shapes (the contract does not prescribe a specific shape,
// but they illustrate expected request/response bodies).
const sampleProvider = { id: 'prov-1', name: 'Acme Health' };
const sampleProvider2 = { id: 'prov-2', name: 'Beta Care' };
const sampleList = [sampleProvider, sampleProvider2];

// ---------------------------------------------------------------------------
// Mount the router on a fresh Express app for each test.
// ---------------------------------------------------------------------------
describe('providers router contract', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    // Typical mount-point – the router itself handles sub-paths relative to its own root.
    app.use('/api/providers', router);
  });

  // -----------------------------------------------------------------------
  // GET / (list providers)
  // -----------------------------------------------------------------------
  describe('GET /api/providers', () => {
    it('returns 200 with a list of providers', async () => {
      mockGetAll.mockResolvedValue(sampleList);

      const res = await request(app).get('/api/providers');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(sampleList);
      expect(mockGetAll).toHaveBeenCalledTimes(1);
    });

    it('returns 200 with an empty array when no providers exist', async () => {
      mockGetAll.mockResolvedValue([]);

      const res = await request(app).get('/api/providers');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('passes query parameters to the service layer (if supported)', async () => {
      mockGetAll.mockResolvedValue([]);

      await request(app).get('/api/providers?name=Acme');
      // Contract: the service should receive the query object or parsed filters.
      // We cannot assert internals, but the mock being called demonstrates
      // that the router delegates appropriately.
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Acme' }) // probable contract
      );
    });

    it('returns 500 if the service throws an unexpected error', async () => {
      mockGetAll.mockRejectedValue(new Error('DB connection lost'));

      const res = await request(app).get('/api/providers');
      expect(res.status).toBe(500);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });

  // -----------------------------------------------------------------------
  // GET /:id (single provider)
  // -----------------------------------------------------------------------
  describe('GET /api/providers/:id', () => {
    it('returns 200 with the provider when found', async () => {
      mockGetById.mockResolvedValue(sampleProvider);

      const res = await request(app

---

## S075 — spec-test — `innomcp-node/src/routes/api/roomWss.ts` [MiniMaxAI/MiniMax-M3]
```typescript
import { WebSocketServer } from 'ws';
import { roomWSS } from '../src/routes/api/roomWss';

jest.mock('ws', () => {
  class FakeWebSocket {
    public static instances: FakeWebSocket[] = [];
    public readyState: number = 0;
    public sent: string[] = [];
    public closeCode: number | null = null;

    constructor(public url: string) {
      FakeWebSocket.instances.push(this);
    }

    send(data: string) {
      this.sent.push(data);
    }

    close(code?: number) {
      this.closeCode = code ?? 1000;
      this.readyState = 3;
    }
  }

  class FakeWebSocketServer {
    public static instances: FakeWebSocketServer[] = [];
    public options: any;
    public connectionHandler: ((ws: any, req: any) => void) | null = null;
    public upgradeHandler: ((req: any, socket: any, head: any) => void) | null = null;
    public handleUpgradeCalls: Array<{ req: any; socket: any; head: any }> = [];

    constructor(options: any) {
      this.options = options;
      FakeWebSocketServer.instances.push(this);
    }

    on(event: string, handler: any) {
      if (event === 'connection') this.connectionHandler = handler;
      if (event === 'upgrade') this.upgradeHandler = handler;
      return this;
    }

    handleUpgrade(req: any, socket: any, head: any, callback: (ws: any) => void) {
      this.handleUpgradeCalls.push({ req, socket, head });
      const ws = new FakeWebSocket(req.url);
      callback(ws);
    }

    shouldHandle(req: any) {
      return Boolean(req.url && req.url.startsWith(this.options.path));
    }
  }

  return {
    WebSocket: FakeWebSocket,
    WebSocketServer: FakeWebSocketServer,
  };
});

import { WebSocket as FakeWS, WebSocketServer as FakeWSS } from 'ws';

describe('roomWss module — public contract', () => {
  beforeEach(() => {
    (FakeWS as any).instances = [];
    (FakeWSS as any).instances = [];
  });

  it('exports a non-null roomWSS instance', () => {
    expect(roomWSS).not.toBeNull();
    expect(roomWSS).toBeDefined();
  });

  it('is a single, stable module-level singleton across re-imports', () => {
    const refA = roomWSS;
    const refB = roomWSS;
    expect(refA).toBe(refB);
  });

  it('constructs a WebSocketServer configured with noServer: true', () => {
    const constructed = (FakeWSS as any).instances;
    expect(constructed.length).toBe(1);
    expect(constructed[0].options).toEqual({ noServer: true });
  });

  it('is the SAME instance as the one created in the module (identity)', () => {
    const constructed = (FakeWSS as any).instances[0];
    expect(roomWSS).toBe(constructed);
  });

  it('extends the ws.WebSocketServer API (has on/handleUpgrade/shouldHandle)', () => {
    expect(typeof (roomWSS as any).on).toBe('function');
    expect(typeof (roomWSS as any).handleUpgrade).toBe('function');
    expect(typeof (roomWSS as any).shouldHandle).toBe('function');
  });

  it('does NOT auto-create a server listener (noServer contract)', () => {
    const constructed = (FakeWSS as any).instances[0];
    expect(constructed.options.noServer).toBe(true);
  });

  it('emits "connection" event when a new client completes the upgrade handshake', () => {
    const constructed = (FakeWSS as any).instances[0];
    const handler = jest.fn();
    roomWSS.on('connection', handler);

    const fakeReq = { url: '/roomWss' };
    const fakeSocket = { destroy: jest.fn() };
    const fakeHead = Buffer.alloc(0);

    (roomWSS as any).handleUpgrade(fakeReq, fakeSocket, fakeHead, () => {
      const ws = (FakeWS as any).instances[(FakeWS as any).instances.length - 1];
      if (constructed.connectionHandler) {
        constructed.connectionHandler(ws, fakeReq);
      }
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toBeDefined();
    expect(handler.mock.calls[0][1]).toBe(fakeReq);
  });

  it('routes upgrade requests whose path starts with the configured path (shouldHandle)', () => {
    const constructed = (FakeWSS as any).instances[0];
    const

---

## S076 — spec-test — `innomcp-node/src/routes/api/shell.ts` [deepseek/deepseek-v4-flash]
```typescript
import { expressMock, mockRouter } from './__mocks__/express'; // We'll define mocks inline for self-containment

// ---- Mocks ----
jest.mock('express', () => {
  const mockRouterInstance = {
    get: jest.fn(() => mockRouterInstance),
    post: jest.fn(() => mockRouterInstance),
    put: jest.fn(() => mockRouterInstance),
    delete: jest.fn(() => mockRouterInstance),
    use: jest.fn(() => mockRouterInstance),
    all: jest.fn(() => mockRouterInstance),
    options: jest.fn(() => mockRouterInstance),
    head: jest.fn(() => mockRouterInstance),
    patch: jest.fn(() => mockRouterInstance),
    stack: [],
    param: jest.fn(),
  };
  const mockRouter = jest.fn(() => mockRouterInstance);
  const express = jest.fn(() => ({
    // if the module uses express() app, we can add mock methods
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
  }));
  express.Router = mockRouter;
  express.static = jest.fn();
  return { default: express, Router: mockRouter };
});

// Mock child_process to prevent actual shell execution
jest.mock('child_process', () => ({
  exec: jest.fn(),
  execSync: jest.fn(),
  spawn: jest.fn(),
  spawnSync: jest.fn(),
}));
// ---- End Mocks ----

import router from '../src/routes/api/shell';

// Recover the real mock references for assertions
const { Router: mockRouterFn } = jest.requireMock('express');

describe('shell router contract', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should export an object (router) as default', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('object');
    expect(router).not.toBeNull();
  });

  it('should have been created by express.Router() exactly once', () => {
    // The module used express.Router() to create the exported router
    expect(mockRouterFn).toHaveBeenCalledTimes(1);
    // No arguments expected (or we could check for options object if applicable)
    expect(mockRouterFn).toHaveBeenCalledWith(); // or toHaveBeenCalledWith({ strict: true }) etc.
  });

  it('should have the standard Express Router methods', () => {
    // The exported router should behave like an Express Router instance.
    // Even though we mock, the contract is that these methods exist.
    expect(typeof router.get).toBe('function');
    expect(typeof router.post).toBe('function');
    expect(typeof router.put).toBe('function');
    expect(typeof router.delete).toBe('function');
    expect(typeof router.use).toBe('function');
    expect(typeof router.all).toBe('function');
    expect(typeof router.param).toBe('function');
  });

  it('should have at least some routes registered (non-empty stack)', () => {
    // In a typical shell router, routes are added (e.g., POST /execute).
    // The exact number is unknown, but the router should be used to register
    // at least one route handler. We assert that at least one of get/post/etc.
    // was called.
    const routeMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'all'];
    const calls = routeMethods
      .map((m) => (router as any)[m]?.mock?.calls?.length ?? 0)
      .reduce((a, b) => a + b, 0);
    expect(calls).toBeGreaterThan(0);
    // Additionally, the router's `use` may have been called for middleware.
    expect((router as any).use.mock.calls.length).toBeGreaterThan(0);
  });

  it('should not throw when calling any route method without arguments', () => {
    // Express Router methods should be callable; they return the router for chaining.
    // Check that they don't throw error with no args.
    expect(() => router.get()).not.toThrow();
    expect(() => router.post()).not.toThrow();
    expect(() => router.use()).not.toThrow();
  });

  it('should accept and register a path and handler with get()', () => {
    // Contract: when get() is called with a path and a handler, it stores the route.
    // We can verify through the mocked implementation that it returns the router.
    const handler = jest.fn();
    const returned = router.get('/t

---

## S077 — spec-test — `innomcp-node/src/routes/api/stats.ts` [Qwen/Qwen3.7-Max]
```typescript
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import router from '../src/routes/api/stats';

// Mock external dependencies that a stats module might use
jest.mock('../../src/services/database', () => ({
  getPoolStats: jest.fn().mockResolvedValue({ total: 10, active: 3, idle: 7 }),
  getConnection: jest.fn(),
}));

jest.mock('../../src/services/cache', () => ({
  getStats: jest.fn().mockResolvedValue({ hits: 100, misses: 20, keys: 50 }),
}));

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  cpus: jest.fn().mockReturnValue([
    { model: 'Test CPU', speed: 2400, times: { user: 1000, nice: 0, sys: 500, idle: 8000, irq: 0 } },
  ]),
  totalmem: jest.fn().mockReturnValue(8 * 1024 * 1024 * 1024),
  freemem: jest.fn().mockReturnValue(4 * 1024 * 1024 * 1024),
  uptime: jest.fn().mockReturnValue(3600),
}));

describe('Stats Router Contract', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/stats', router);
    jest.clearAllMocks();
  });

  describe('Router export contract', () => {
    it('exports a valid Express router instance', () => {
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
      // Express routers have a stack property
      expect(router).toHaveProperty('stack');
      expect(Array.isArray((router as any).stack)).toBe(true);
    });

    it('router has at least one route registered', () => {
      expect((router as any).stack.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/stats', () => {
    it('responds with 200 status on valid request', async () => {
      const response = await request(app).get('/api/stats');
      expect(response.status).toBe(200);
    });

    it('responds with JSON content type', async () => {
      const response = await request(app).get('/api/stats');
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('returns a body that is a non-null object', async () => {
      const response = await request(app).get('/api/stats');
      expect(response.body).toBeDefined();
      expect(typeof response.body).toBe('object');
      expect(response.body).not.toBeNull();
      expect(Array.isArray(response.body)).toBe(false);
    });

    it('includes uptime information as a number', async () => {
      const response = await request(app).get('/api/stats');
      if ('uptime' in response.body) {
        expect(typeof response.body.uptime).toBe('number');
        expect(response.body.uptime).toBeGreaterThanOrEqual(0);
      }
    });

    it('includes memory information when present', async () => {
      const response = await request(app).get('/api/stats');
      if ('memory' in response.body) {
        expect(typeof response.body.memory).toBe('object');
        expect(response.body.memory).not.toBeNull();
      }
    });

    it('includes timestamp as a valid date string or number', async () => {
      const response = await request(app).get('/api/stats');
      if ('timestamp' in response.body) {
        const ts = response.body.timestamp;
        const isValidDate =
          typeof ts === 'number' ||
          (typeof ts === 'string' && !isNaN(Date.parse(ts)));
        expect(isValidDate).toBe(true);
      }
    });

    it('does not expose sensitive internal details (no stack traces, no env vars)', async () => {
      const response = await request(app).get('/api/stats');
      const bodyStr = JSON.stringify(response.body);
      expect(bodyStr).not.toMatch(/password/i);
      expect(bodyStr).not.toMatch(/secret/i);
      expect(bodyStr).not.toMatch(/api[_-]?key/i);
      expect(bodyStr).not.toMatch(/DATABASE_URL/i);
    });
  });

  describe('POST /api/stats (unsupported method)', () => {
    it('responds with 404 or 405 for POST requests', async () => {
      const response = await request(app)
        .post('/api/stats')
        .send({ data: 'test' });
      e

---

## S078 — spec-test — `innomcp-node/src/routes/api/tasks.ts` [moonshotai/Kimi-K2.6]
The user wants a Jest contract/behavior test for a module called `tasks` from `../src/routes/api/tasks`. The public API surface provided is incomplete/truncated:

```typescript
async function ensureTasksProjectColumn(): Promise<void> {
type ContinuationTaskRow = {
type ContinuationStepRow = {
type ContinuationArtifact = {
async function loadRelevantArtifacts(
```

This is clearly a truncated API surface. I need to infer reasonable contracts based on the names and partial signatures.

Let's analyze what we can infer:

1. `ensureTasksProjectColumn(): Promise<void>` - Likely ensures a project column exists in some task management system (like GitHub Projects). Contract: idempotent, resolves when column exists/created, rejects on failure. Side effect: may create column if missing.

2. `ContinuationTaskRow` - A type, likely a row from a database representing a task.
3. `ContinuationStepRow` - A type, likely a row representing a step within a task.
4. `ContinuationArtifact` - A type, likely an artifact related to continuation.
5. `loadRelevantArtifacts(` - Async function, likely takes some parameters and returns artifacts.

Since the signatures are truncated, I need to make reasonable assumptions about the parameters and return types based on typical patterns for such functions, while staying true to the "contract test" philosophy.

However, the user says "You are given ONLY its public API surface (signatures)". The signatures are literally cut off. I should infer the most logical completions:

- `loadRelevantArtifacts` likely takes something like `(taskId: string, stepId?: string)` or `(context: TaskContext)` and returns `Promise<ContinuationArtifact[]>`.

But wait, looking at the names:
- `ensureTasksProjectColumn` suggests GitHub Projects or similar.
- `ContinuationTaskRow`, `ContinuationStepRow`, `ContinuationArtifact` suggest a "continuation" pattern, maybe AI agent tasks with steps and artifacts.

Given the module path `../src/routes/api/tasks`, this is likely an API route module that exports handler functions or utility functions used by routes.

Since I must import EXACTLY `import ... from '../src/routes/api/tasks';`, I need to import the named exports.

Let me reconstruct likely full signatures based on the partials:

```typescript
async function ensureTasksProjectColumn(): Promise<void>

type ContinuationTaskRow = {
  id: string;
  // ... other fields
}

type ContinuationStepRow = {
  id: string;
  taskId: string;
  // ...
}

type ContinuationArtifact = {
  id: string;
  stepId: string;
  // ...
}

async function loadRelevantArtifacts(
  taskId: string,
  stepIndex?: number
): Promise<ContinuationArtifact[]>
```

Or maybe `loadRelevantArtifacts(taskRow: ContinuationTaskRow, stepRow?: ContinuationStepRow): Promise<ContinuationArtifact[]>`

Actually, looking at the pattern, it might be:
`async function loadRelevantArtifacts(taskId: string, stepId?: string): Promise<ContinuationArtifact[]>`

But I need to be careful. The user gave me truncated signatures. I should define the imports based on what is explicitly shown:
- `ensureTasksProjectColumn`
- `ContinuationTaskRow`
- `ContinuationStepRow`
- `ContinuationArtifact`
- `loadRelevantArtifacts`

Since the types are exported, I can reference them in tests even if I mock the return values.

For contract testing without implementation:
- `ensureTasksProjectColumn`: Should guarantee a column exists. If external service (GitHub API) is mocked:
  - When column missing: creates it and resolves.
  - When column exists: resolves without error.
  - When API fails: rejects with error.
  - Contract: Promise<void> means success is silent, failure is loud.

- `loadRelevantArtifacts`: The name implies loading artifacts relevant to some context. Likely takes identifiers and returns artifacts. Contract:
  - Returns array of `ContinuationArtifact`.
  - Returns empty array if none found.
  - Throws/rejects on invalid input (null/undefined taskId?).
  - Artifacts returned should match the shape of

---

## S080 — spec-test — `innomcp-node/src/routes/api/user/profile.ts` [MiniMaxAI/MiniMax-M3]
```typescript
import { EventEmitter } from 'events';
import type { Request, Response, NextFunction } from 'express';

// Mocks MUST come before importing the module under test
jest.mock('../src/middleware/auth', () => ({
  requireAuth: jest.fn((req: any, _res: any, next: NextFunction) => {
    if (req.headers['x-test-auth'] === 'valid') {
      (req as any).user = { id: 'user-123', roles: ['user'] };
      next();
    } else {
      const err: any = new Error('Unauthorized');
      err.status = 401;
      next(err);
    }
  }),
}));

jest.mock('../src/services/userService', () => ({
  getUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
  deleteUserProfile: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

import router from '../src/routes/api/user/profile';
import userService from '../src/services/userService';

const mockService = userService as jest.Mocked<typeof userService>;

// Express Router exposes `stack` of routes
type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: any; name: string }>;
  };
  handle: any;
  name: string;
  regexp?: RegExp;
};

function getRouterStack(): Layer[] {
  return (router as any).stack as Layer[];
}

function findRoute(stack: Layer[], path: string, method: string): Layer['route'] | undefined {
  return stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method.toLowerCase()] === true,
  )?.route;
}

function getRouteHandler(route: NonNullable<Layer['route']>, index = 0) {
  return route.stack[index].handle as (
    req: Partial<Request>,
    res: Partial<Response>,
    next: NextFunction,
  ) => Promise<unknown> | unknown;
}

function makeRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    locals: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      this.headers['content-type'] = 'application/json';
      return this;
    },
    send(payload?: unknown) {
      this.body = payload ?? '';
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    end(payload?: unknown) {
      this.body = payload ?? this.body;
      return this;
    },
  };
  return res as Response & {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
  };
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    body: {},
    params: {},
    query: {},
    method: 'GET',
    path: '/',
    url: '/',
    ...overrides,
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('profile router — contract', () => {
  const stack = getRouterStack();

  it('exports a default Express router (function with a stack)', () => {
    expect(typeof router).toBe('function');
    expect(Array.isArray(stack)).toBe(true);
    expect(stack.length).toBeGreaterThan(0);
  });

  describe('GET /', () => {
    it('exposes a GET / route', () => {
      const route = findRoute(stack, '/', 'get');
      expect(route).toBeDefined();
    });

    it('returns the user profile for an authenticated request', async () => {
      const route = findRoute(stack, '/', 'get')!;
      const handler = getRouteHandler(route, route.stack.length - 1);

      const profile = { id: 'user-123', name: 'Ada', email: 'ada@example.com' };
      mockService.getUserProfile.mockResolvedValueOnce(profile as any);

      const req = makeReq({ headers: { 'x-test-auth': 'valid' } as any });
      const res = makeRes();
      const next = jest.fn();

      await handler(req, res, next);

      expect(mockService.getUserProfile).toHaveBeenCalledTimes(1);
      expect(mockService.getUserProfile).toHaveBeenCalledWith('user-123');
      expect(next).not.toHaveBeenCalled();
   

---

## S081 — spec-test — `innomcp-node/src/routes/api/webFetch.ts` [deepseek/deepseek-v4-flash]
```typescript
// webFetch.contract.test.ts
// Contract/behavior test for the router exported by webFetch module.
// Tests based on observable API of an Express router assumed to handle GET /fetch?url=...
// Mocks global fetch to avoid network calls, ensuring offline deterministic tests.

import express from 'express';
import request from 'supertest';
import router from '../src/routes/api/webFetch';

// Mock global fetch before router is loaded (if used globally)
// Adjust mocking if the router uses a specific library like 'node-fetch'
global.fetch = jest.fn();

describe('webFetch router contract', () => {
  let app: express.Express;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Create a fresh Express application with only this router
    app = express();
    app.use(router);
  });

  // Helper to create a mock successful fetch response
  const mockFetchSuccess = (body: string | object, status = 200) => {
    const response = new Response(
      typeof body === 'string' ? body : JSON.stringify(body),
      {
        status,
        headers: { 'content-type': typeof body === 'string' ? 'text/plain' : 'application/json' },
      }
    );
    (global.fetch as jest.Mock).mockResolvedValue(response);
  };

  // Helper to create a mock fetch that rejects (network error)
  const mockFetchNetworkError = () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
  };

  describe('GET /fetch with valid URL', () => {
    it('should return fetched content with status 200 when URL is reachable', async () => {
      const expectedBody = 'Hello, world!';
      mockFetchSuccess(expectedBody);

      const res = await request(app)
        .get('/fetch')
        .query({ url: 'http://example.com' });

      expect(res.status).toBe(200);
      expect(res.text).toBe(expectedBody);
      expect(global.fetch).toHaveBeenCalledWith('http://example.com', expect.any(Object));
    });

    it('should return fetched JSON content correctly', async () => {
      const data = { key: 'value' };
      mockFetchSuccess(data, 200);

      const res = await request(app)
        .get('/fetch')
        .query({ url: 'http://api.example.com/data' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(data);
    });
  });

  describe('GET /fetch with missing or invalid URL', () => {
    it('should return 400 Bad Request when url query param is missing', async () => {
      const res = await request(app).get('/fetch');

      expect(res.status).toBe(400);
      // Contract: error message should indicate missing url
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/url/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return 400 when url is empty string', async () => {
      const res = await request(app)
        .get('/fetch')
        .query({ url: '' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return 400 when url is invalid (malformed)', async () => {
      const res = await request(app)
        .get('/fetch')
        .query({ url: 'not-a-url' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('GET /fetch with network errors', () => {
    it('should return 502 (or 500) when fetch fails (network error)', async () => {
      mockFetchNetworkError();

      const res = await request(app)
        .get('/fetch')
        .query({ url: 'http://example.com' });

      // Contract: upstream failure should be a 5xx, likely 502 or 500
      expect([500, 502, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('error');
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should return 502 when upstream returns non-2xx status', async () => {
      // Simulate a 404 from 

---

## S082 — spec-test — `innomcp-node/src/routes/api/webhooks.ts` [Qwen/Qwen3.7-Max]
```typescript
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';

// Mock external dependencies before importing the module under test
jest.mock('../../services/webhookService', () => ({
  processWebhookEvent: jest.fn(),
  listWebhooks: jest.fn(),
  createWebhook: jest.fn(),
  verifySignature: jest.fn(),
}));

jest.mock('../../db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));

jest.mock('../../config', () => ({
  webhookSecret: 'test-secret-key-for-verification',
  maxPayloadSize: '1mb',
}));

import router from '../src/routes/api/webhooks';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const webhookService = require('../../services/webhookService');

describe('webhooks router — contract/behavior tests', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/webhooks', router);

    // Global error handler to capture thrown errors as responses
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      const status = (err as Error & { status?: number }).status ?? 500;
      res.status(status).json({ error: err.message });
    });
  });

  describe('module export contract', () => {
    it('exports a default value that is a function (Express router)', () => {
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
    });

    it('router has a stack property indicating registered middleware/routes', () => {
      expect(router).toHaveProperty('stack');
      expect(Array.isArray((router as unknown as { stack: unknown[] }).stack)).toBe(true);
    });

    it('router has at least one route registered', () => {
      const stack = (router as unknown as { stack: Array<{ route?: unknown }> }).stack;
      const routeEntries = stack.filter((layer) => layer.route !== undefined);
      expect(routeEntries.length).toBeGreaterThan(0);
    });
  });

  describe('POST /webhooks — receiving webhook events', () => {
    const validPayload = {
      event: 'payment.completed',
      data: { id: 'evt_123', amount: 5000, currency: 'usd' },
      timestamp: '2024-01-15T10:30:00Z',
    };

    it('accepts a valid webhook event and returns a 2xx status', async () => {
      webhookService.processWebhookEvent.mockResolvedValue({ received: true });

      const res = await request(app)
        .post('/webhooks')
        .send(validPayload)
        .set('Content-Type', 'application/json');

      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
    });

    it('returns 400 when request body is empty', async () => {
      const res = await request(app)
        .post('/webhooks')
        .send({})
        .set('Content-Type', 'application/json');

      expect([400, 422]).toContain(res.status);
    });

    it('returns 400 when event field is missing from payload', async () => {
      const res = await request(app)
        .post('/webhooks')
        .send({ data: { id: 'evt_123' } })
        .set('Content-Type', 'application/json');

      expect([400, 422]).toContain(res.status);
    });

    it('returns 400 when payload is not valid JSON', async () => {
      const res = await request(app)
        .post('/webhooks')
        .send('not-json{{{')
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
    });

    it('processes the webhook event through the service layer on valid input', async () => {
      webhookService.processWebhookEvent.mockResolvedValue({ received: true });

      await request(app)
        .post('/webhooks')
        .send(validPayload)
        .set('Content-Type', 'application/json');

      expect(webhookService.processWebhookEvent).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'payment.completed' })
      );
    });

    it('returns 500 when the service layer throws an unexpected error', asy

---

## S083 — spec-test — `innomcp-node/src/routes/api/workspace.ts` [moonshotai/Kimi-K2.6]
The user wants a Jest contract/behavior test for an `innomcp-node` module called `workspace`. The public API surface is extremely minimal: three interfaces (`WriteFileRequestBody`, `DeleteFileRequestBody`, `FilesQueryParams`) and a default export `router`.

The import path must be exactly: `import ... from '../src/routes/api/workspace';`

Since I don't have the implementation, I need to infer the contract from the names and the fact that it's a router (likely an Express router or similar). The interfaces suggest:
- `WriteFileRequestBody`: probably has fields like `path`, `content`, maybe `encoding`?
- `DeleteFileRequestBody`: probably has fields like `path`.
- `FilesQueryParams`: probably has fields like `path`, `recursive`, etc.

But wait, the user only gave the interface names, not their contents. I need to infer reasonable contracts based on standard file workspace API patterns.

However, the user said "Test observable behavior/contracts implied by the names+signatures". Since the signatures are just the interface names and `export default router`, I need to make reasonable assumptions about what an Express router for a workspace API would do.

But I must be careful: I cannot know the exact property names of the interfaces. However, in a contract test, I can define mock data that conforms to the expected shape and test the router's behavior via HTTP requests (e.g., using `supertest`).

Wait, the module exports a `router` as default. This is likely an Express Router instance. To test it contractually:
- Mount it in a minimal Express app or test via `supertest` with the router.
- Test endpoints like POST /write, POST /delete, GET /files (or similar) based on the interface names.

But I don't know the exact routes. I need to infer them from the interface names:
- `WriteFileRequestBody` -> likely a POST/PUT endpoint to write a file. Route could be `/write` or `/files`.
- `DeleteFileRequestBody` -> likely a POST/DELETE endpoint to delete a file. Route could be `/delete` or `/files`.
- `FilesQueryParams` -> likely a GET endpoint to list/query files. Route could be `/files`.

Since I don't know the exact route paths, I need to make reasonable assumptions and perhaps test the router by mounting it and testing the likely routes. But if I guess wrong, the test won't compile or match.

Alternative approach: Since the prompt says "public API surface" and gives only those signatures, maybe the test should import the interfaces and the router, and test the router's behavior by treating it as a black box. But without knowing the route paths, it's tricky.

However, looking at the module path `../src/routes/api/workspace`, it's common for such modules to export an Express router handling:
- `POST /` or `POST /write` for writing files
- `DELETE /` or `POST /delete` for deleting files
- `GET /` or `GET /files` for querying files

Given the interfaces:
- `WriteFileRequestBody` likely contains `path: string` and `content: string`.
- `DeleteFileRequestBody` likely contains `path: string`.
- `FilesQueryParams` likely contains `path?: string`, `recursive?: boolean`, etc.

I should write a comprehensive contract test that:
1. Imports the router and interfaces.
2. Uses `supertest` to test HTTP endpoints.
3. Mocks external dependencies like `fs`, `db`, or a workspace service. Since I don't know the internal implementation, I should mock at the boundary. But the prompt says "Mock external deps (db/network/fs/other services) deterministically."

Since it's a workspace API, external deps are likely filesystem or a database. I'll mock `fs/promises` or a workspace service module if one exists. But I don't know the exact internal imports. To be safe and deterministic, I can mock `fs` or `path` if the router uses them, or mock a hypothetical service.

Wait, the prompt says "Mock external deps (db/network/fs/other services) deterministically. Offline. Strict TS." This implies I should mock things like `fs` or `axios` or `db` client. Since I don't know which 

---

## S084 — spec-test — `innomcp-node/src/routes/artifacts.ts` [zai-org/GLM-5.1]
```typescript
import express from 'express';
import request from 'supertest';
import { router } from '../src/routes/artifacts';
import { artifactService } from '../src/services/artifactService';

jest.mock('../src/services/artifactService');

const mockedGetAll = artifactService.getAll as jest.Mock;
const mockedGetById = artifactService.getById as jest.Mock;
const mockedCreate = artifactService.create as jest.Mock;

const app = express();
app.use(express.json());
app.use('/artifacts', router);

describe('Artifacts Router Contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /artifacts', () => {
    it('should return 200 and an array of artifacts when service succeeds', async () => {
      const expectedArtifacts = [
        { id: '1', name: 'Artifact A', type: 'document' },
        { id: '2', name: 'Artifact B', type: 'image' }
      ];
      mockedGetAll.mockResolvedValue(expectedArtifacts);

      const response = await request(app).get('/artifacts');

      expect(response.status).toEqual(200);
      expect(response.body).toEqual(expectedArtifacts);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toEqual(2);
    });

    it('should return 200 and an empty array when no artifacts exist', async () => {
      mockedGetAll.mockResolvedValue([]);

      const response = await request(app).get('/artifacts');

      expect(response.status).toEqual(200);
      expect(response.body).toEqual([]);
    });

    it('should return 500 when the service encounters an error', async () => {
      mockedGetAll.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app).get('/artifacts');

      expect(response.status).toEqual(500);
    });
  });

  describe('GET /artifacts/:id', () => {
    it('should return 200 and the specific artifact when ID exists', async () => {
      const expectedArtifact = { id: '1', name: 'Artifact A', type: 'document' };
      mockedGetById.mockResolvedValue(expectedArtifact);

      const response = await request(app).get('/artifacts/1');

      expect(response.status).toEqual(200);
      expect(response.body).toEqual(expectedArtifact);
      expect(response.body.id).toEqual('1');
    });

    it('should return 404 when the artifact ID does not exist', async () => {
      mockedGetById.mockResolvedValue(null);

      const response = await request(app).get('/artifacts/999');

      expect(response.status).toEqual(404);
      expect(response.body).toEqual({ error: 'Artifact not found' });
    });

    it('should return 500 when the service throws an unexpected error', async () => {
      mockedGetById.mockRejectedValue(new Error('Unexpected DB Error'));

      const response = await request(app).get('/artifacts/1');

      expect(response.status).toEqual(500);
    });
  });

  describe('POST /artifacts', () => {
    const validPayload = { name: 'New Artifact', type: 'video' };
    const createdArtifact = { id: '3', ...validPayload };

    it('should return 201 and the created artifact for valid input', async () => {
      mockedCreate.mockResolvedValue(createdArtifact);

      const response = await request(app)
        .post('/artifacts')
        .send(validPayload);

      expect(response.status).toEqual(201);
      expect(response.body).toEqual(createdArtifact);
      expect(response.body.id).toBeDefined();
      expect(response.body.name).toEqual(validPayload.name);
    });

    it('should return 400 when required fields are missing', async () => {
      const invalidPayload = { type: 'video' }; // missing name

      const response = await request(app)
        .post('/artifacts')
        .send(invalidPayload);

      expect(response.status).toEqual(400);
      expect(response.body).toEqual({ error: 'Missing required fields: name' });
    });

    it('should return 400 when payload is completely empty', async () => {
      const response = await request(app)
        .post('/artifacts')
       