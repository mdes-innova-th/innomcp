<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: E013 role=test-edge model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2583,"completion_tokens":7656,"total_tokens":10239,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4635,"image_tokens":0},"cache_creation_input_tokens":0} | 80s
 generated: 2026-06-13T11:16:20.204Z -->
```typescript
import { MultiAgentOrchestrator } from '../src/agents/orchestrator';
import { selectProvider } from '../src/providers/router';
import { writeFile } from 'fs/promises';

jest.mock('../src/providers/router', () => ({
  selectProvider: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

describe('MultiAgentOrchestrator', () => {
  let orchestrator: MultiAgentOrchestrator;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
    (selectProvider as jest.Mock).mockReset();
    (global.fetch as jest.Mock) = jest.fn().mockReset();
    (writeFile as jest.Mock).mockReset();
    orchestrator = new MultiAgentOrchestrator();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('applies defaults when no partial config given', () => {
      const orch = new MultiAgentOrchestrator();
      // access private member for testing
      const config = (orch as any).config;
      expect(config.coordinatorModel).toBe('minimax-m2.5:cloud');
      expect(config.brain1Model).toBe('gemma4:26b');
      expect(config.brain2Model).toBe('gemma4:e4b');
      expect(config.sharedMemoryPath).toBe('.claude/memory');
      expect(config.enableTmuxSync).toBe(false);
      expect(config.enableRemoteSync).toBe(false);
    });

    test('merges partial config overrides', () => {
      const orch = new MultiAgentOrchestrator({
        brain1Model: 'custom-brain',
        enableTmuxSync: true,
      });
      const config = (orch as any).config;
      expect(config.brain1Model).toBe('custom-brain');
      expect(config.brain2Model).toBe('gemma4:e4b');
      expect(config.enableTmuxSync).toBe(true);
    });

    test('empty partial config results in full defaults', () => {
      const orch = new MultiAgentOrchestrator({});
      const config = (orch as any).config;
      expect(config.coordinatorModel).toBeDefined();
    });
  });

  describe('createTask', () => {
    test('returns a pending task with default medium priority and valid id', async () => {
      const task = await orchestrator.createTask('Summarize meeting');
      expect(task.id).toMatch(/^task-1704067200000-[a-z0-9]{6}$/);
      expect(task.description).toBe('Summarize meeting');
      expect(task.priority).toBe('medium');
      expect(task.status).toBe('pending');
      expect(task.cycle).toEqual([]);
    });

    test('accepts explicit priority and empty description', async () => {
      const task = await orchestrator.createTask('', 'high');
      expect(task.description).toBe('');
      expect(task.priority).toBe('high');
    });

    test('creates distinct ids for successive calls', async () => {
      const t1 = await orchestrator.createTask('a');
      const t2 = await orchestrator.createTask('b');
      expect(t1.id).not.toBe(t2.id);
    });
  });

  describe('executeCycle', () => {
    test('throws when taskId is not found', async () => {
      await expect(orchestrator.executeCycle('nonexistent')).rejects
        .toThrow('Task nonexistent not found');
    });

    test('fails when brain-1 provider is unavailable', async () => {
      const task = await orchestrator.createTask('Analyze code');
      (selectProvider as jest.Mock).mockImplementation(
        (criteria: any) => ({ provider: null })
      );

      const result = await orchestrator.executeCycle(task.id);
      expect(result.status).toBe('failed');
      expect(result.brain1Result).toBeUndefined();
      expect(result.cycle).toHaveLength(1);
      expect(result.cycle[0].phase).toBe('coordinate');
      expect(result.cycle[0].result).toContain('No provider available');
    });

    test('fails when brain-2 provider is unavailable after brain-1 succeeds', async () => {
      const task = await orchestrator.createTask('Review PR');
      (selectProvider as jest.Mock).mockImplementation(
        (criteria: any) => {
          if (criteria.capabilities?.includes('long-context')) {
            return { provider: { baseUrl: 'http://localhost:11434', model: 'gemma4:26b' } };
          }
          return { provider: null };
        }
      );
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'brain-1 deep analysis' }),
      });

      const result = await orchestrator.executeCycle(task.id);
      expect(result.status).toBe('failed');
      expect(result.brain1Result).toBe('brain-1 deep analysis');
      expect(result.brain2Result).toBeUndefined();
      expect(result.cycle).toHaveLength(2);
      expect(result.cycle[0].phase).toBe('analyze');
      expect(result.cycle[0].actor).toBe('brain-1');
      expect(result.cycle[1].phase).toBe('coordinate');
      expect(result.cycle[1].result).toContain('No provider available');
    });

    test('fails when brain-1 fetch returns non-ok status', async () => {
      const task = await orchestrator.createTask('Fetch error test');
      (selectProvider as jest.Mock).mockImplementation(
        (criteria: any) => ({
          provider: { baseUrl: 'http://localhost:11434', model: 'gemma4:26b' },
        })
      );
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const result = await orchestrator.executeCycle(task.id);
      expect(result.status).toBe('failed');
      expect(result.cycle).toHaveLength(1);
      expect(result.cycle[0].result).toContain('Error: Brain brain-1 call failed: 500');
    });

    test('fails when brain-2 fetch fails after brain-1 succeeds', async () => {
      const task = await orchestrator.createTask('API error in second phase');
      (selectProvider as jest.Mock).mockImplementation(
        (criteria: any) => {
          if (criteria.capabilities?.includes('long-context')) {
            return { provider: { baseUrl: 'http://localhost:11434', model: 'gemma4:26b' } };
          }
          if (criteria.capabilities?.includes('fast-cheap')) {
            return { provider: { baseUrl: 'http://localhost:11434', model: 'gemma4:e4b' } };
          }
          return { provider: null };
        }
      );
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: 'brain-1 analysis' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
        });

      const result = await orchestrator.executeCycle(task.id);
      expect(result.status).toBe('failed');
      expect(result.brain1Result).toBe('brain-1 analysis');
      expect(result.brain2Result).toBeUndefined();
      expect(result.cycle.length).toBeGreaterThanOrEqual(2);
      expect(result.cycle[1].result).toContain('Brain brain-2 call failed: 503');
    });

    test('completes gracefully when coordinator provider is missing (skip action)', async () => {
      const task = await orchestrator.createTask('Commit work');
      // Setup providers for brain-1 and brain-2 but not for coordinator
      (selectProvider as jest.Mock).mockImplementation(
        (criteria: any) => {
          if (criteria.capabilities?.includes('long-context') || criteria.capabilities?.includes('fast-cheap')) {
            return { provider: { baseUrl: 'http://localhost:11434', model: 'some-model' } };
          }
          // coordinator call: no provider
          return { provider: null };
        }
      );
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: 'brain-1 result' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: 'brain-2 summary' }),
        });

      const result = await orchestrator.executeCycle(task.id);
      expect(result.status).toBe('completed');
      expect(result.coordinatorAction).toBe(
        'SKIP: No coordinator provider available - task logged but not committed'
      );
      expect(result.cycle.length).toBeGreaterThanOrEqual(4); // analyze, summarize, coordinate, memory
      expect(result.cycle[2].phase).toBe('coordinate');
    });

    test('fails when saveToMemory throws an error', async () => {
      const task = await orchestrator.createTask('Persist error');
      // all providers available
      (selectProvider as jest.Mock).mockImplementation(
        (criteria: any) => ({
          provider: { baseUrl: 'http://localhost:11434', model: 'any-model' },
        })
      );
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: 'analysis' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: 'summary' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: 'COMMIT' }),
        });

      // Simulate write failure
      (writeFile as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

      const result = await orchestrator.executeCycle(task.id);
      expect(result.status).toBe('failed');
      expect(result.cycle).toHaveLength(3); // analyze, summarize, coordinate with error (memory phase not added)
      const errorCycle = result.cycle.find(c => c.phase === 'coordinate' && c.result.includes('Error'));
      expect(errorCycle).toBeTruthy();
      expect(errorCycle!.result).toContain('disk full');
    });

    test('handles empty brain-1 response field gracefully (uses empty string)', async () => {
      const task = await orchestrator.createTask('Empty response');
      (selectProvider as jest.Mock).mockImplementation(
        (criteria: any) => ({
          provider: { baseUrl: 'http://localhost:11434', model: 'any-model' },
        })
      );
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: undefined }), // no response field
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: 'summary' }),
        });

      const result = await orchestrator.executeCycle(task.id);
      expect(result.brain1Result).toBe('');
    });

    test('records cycles with correct phase and actor even when early failure', async () => {
      const task = await orchestrator.createTask('Partial error');
      (selectProvider as jest.Mock).mockImplementation(
        (criteria: any) => {
          if (criteria.capabilities?.includes('long-context')) {
            return { provider: { baseUrl: 'http://localhost:11434', model: 'gemma4:26b' } };
          }
          return { provider: null };
        }
      );
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'analysis' }),
      });

      const result = await orchestrator.executeCycle(task.id);
      const analyzeCycle = result.cycle.find(c => c.phase === 'analyze');
      expect(analyzeCycle).toBeDefined();
      expect(analyzeCycle!.actor).toBe('brain-1');
      expect(analyzeCycle!.result).toContain('analysis');
    });

    test('does not crash when description is extremely long (boundary)', async () => {
      const longDesc = 'x'.repeat(10000);
      const task = await orchestrator.createTask(longDesc);
      (selectProvider as jest.Mock).mockImplementation(
        (criteria: any) => ({
          provider: { baseUrl: 'http://localhost:11434', model: 'any' },
        })
      );
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: 'short result' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: 'summary' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
        });

      const result = await orchestrator.executeCycle(task.id);
      expect(result.description).toBe(longDesc);
      // Should not crash, though may fail later
    });

    test('throws synchronously if taskId is not a string (runtime check)', async () => {
      // The constructor expects string, but runtime can pass anything
      await expect(orchestrator.executeCycle(undefined as any)).rejects.toThrow();
      await expect(orchestrator.executeCycle(123 as any)).rejects.toThrow('Task 123 not found');
    });
  });
});
```
