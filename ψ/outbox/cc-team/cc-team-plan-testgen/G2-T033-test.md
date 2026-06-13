<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T033 role=test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2554,"completion_tokens":3690,"total_tokens":6244,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1353,"image_tokens":0},"cache_creation_input_tokens":0} | 39s
 generated: 2026-06-13T10:58:16.751Z -->
```typescript
import { MultiAgentOrchestrator } from '../src/agents/orchestrator';
import { selectProvider } from '../src/providers/router';

jest.mock('../src/providers/router', () => ({
  selectProvider: jest.fn(),
}));

const mockSelectProvider = selectProvider as jest.MockedFunction<typeof selectProvider>;

describe('MultiAgentOrchestrator', () => {
  let orchestrator: MultiAgentOrchestrator;
  const fixedTimestamp = '2025-03-17T00:00:00.000Z';

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(fixedTimestamp));
    jest.spyOn(Math, 'random').mockReturnValue(0.123);
    global.fetch = jest.fn() as jest.Mock;

    orchestrator = new MultiAgentOrchestrator();

    // Default mocks that can be overridden per test
    mockSelectProvider.mockImplementation(({ capabilities }) => {
      const cap = capabilities[0];
      if (cap === 'long-context') {
        return {
          provider: {
            id: 'brain1',
            model: 'gemma4:26b',
            baseUrl: 'http://ollama-brain1:11434',
            privacyLevel: 'internal',
          },
          confidence: 1,
          reason: '',
        };
      }
      if (cap === 'fast-cheap') {
        return {
          provider: {
            id: 'brain2',
            model: 'gemma4:e4b',
            baseUrl: 'http://ollama-brain2:11434',
            privacyLevel: 'internal',
          },
          confidence: 1,
          reason: '',
        };
      }
      if (cap === 'tool-use') {
        return {
          provider: {
            id: 'coord',
            model: 'minimax-m2.5:cloud',
            baseUrl: 'http://ollama-coord:11434',
            privacyLevel: 'internal',
          },
          confidence: 1,
          reason: '',
        };
      }
      return { provider: null, confidence: 0, reason: '' };
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ response: 'mock response' }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should use default config if no overrides', () => {
      expect((orchestrator as any).config).toEqual({
        coordinatorModel: 'minimax-m2.5:cloud',
        brain1Model: 'gemma4:26b',
        brain2Model: 'gemma4:e4b',
        sharedMemoryPath: '.claude/memory',
        enableTmuxSync: false,
        enableRemoteSync: false,
      });
    });

    test('should merge partial config', () => {
      const customOrchestrator = new MultiAgentOrchestrator({
        brain1Model: 'custom-brain1',
        enableTmuxSync: true,
      });
      expect((customOrchestrator as any).config).toEqual({
        coordinatorModel: 'minimax-m2.5:cloud',
        brain1Model: 'custom-brain1',
        brain2Model: 'gemma4:e4b',
        sharedMemoryPath: '.claude/memory',
        enableTmuxSync: true,
        enableRemoteSync: false,
      });
    });
  });

  describe('createTask', () => {
    test('should create a new pending task with expected structure', async () => {
      const task = await orchestrator.createTask('Do something', 'high');
      expect(task).toMatchObject({
        id: expect.stringMatching(/^task-1737043200000-(\w+)$/),
        description: 'Do something',
        priority: 'high',
        status: 'pending',
        cycle: [],
      });
      expect(task.brain1Result).toBeUndefined();
      expect(task.brain2Result).toBeUndefined();
      expect(task.coordinatorAction).toBeUndefined();
    });

    test('should default priority to medium', async () => {
      const task = await orchestrator.createTask('No priority');
      expect(task.priority).toBe('medium');
    });

    test('should add task to active tasks', async () => {
      const task = await orchestrator.createTask('Test');
      expect((orchestrator as any).activeTasks.get(task.id)).toBe(task);
    });
  });

  describe('executeCycle', () => {
    test('should throw if task ID is not found', async () => {
      await expect(orchestrator.executeCycle('nonexistent')).rejects.toThrow(
        'Task nonexistent not found',
      );
    });

    test('should complete full cycle and update task accordingly', async () => {
      const task = await orchestrator.createTask('Implement feature X');

      // Mock saveToMemory on the instance to avoid filesystem
      const saveSpy = jest
        .spyOn(orchestrator as any, 'saveToMemory')
        .mockResolvedValue(undefined);

      // Phase 1: brain-1 response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ response: 'Analysis: deep context reasoning'.repeat(100) }),
      });
      // Phase 2: brain-2 response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ response: 'Summary: concise overview' }),
      });
      // Phase 3: coordinator response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ response: 'COMMIT: All checks passed' }),
      });

      const result = await orchestrator.executeCycle(task.id);

      // Task should be completed
      expect(result.status).toBe('completed');
      expect(result.brain1Result).toContain('Analysis:');
      expect(result.brain2Result).toContain('Summary:');
      expect(result.coordinatorAction).toEqual('COMMIT: All checks passed');

      // Cycle should have 4 entries
      expect(result.cycle).toHaveLength(4);
      const [analyzeCycle, summarizeCycle, coordinateCycle, memoryCycle] = result.cycle;

      expect(analyzeCycle).toMatchObject({
        phase: 'analyze',
        actor: 'brain-1',
        timestamp: fixedTimestamp,
      });
      expect(analyzeCycle.result).toContain('Analysis:');
      // Should be truncated to 500 chars
      expect(analyzeCycle.result.length).toBeLessThanOrEqual(500);

      expect(summarizeCycle).toMatchObject({
        phase: 'summarize',
        actor: 'brain-2',
        timestamp: fixedTimestamp,
      });
      expect(summarizeCycle.result).toContain('Summary:');

      expect(coordinateCycle).toMatchObject({
        phase: 'coordinate',
        actor: 'coordinator',
        timestamp: fixedTimestamp,
      });
      expect(coordinateCycle.result).toEqual('COMMIT: All checks passed');

      expect(memoryCycle).toMatchObject({
        phase: 'memory',
        actor: 'coordinator',
        timestamp: fixedTimestamp,
        result: 'Task cycle saved to memory',
      });

      // Verify saveToMemory was called with the final task
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledWith(result);

      // Verify fetch was called with correct models
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        'http://ollama-brain1:11434/api/generate',
        expect.objectContaining({
          body: expect.stringContaining('"model":"gemma4:26b"'),
        }),
      );
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'http://ollama-brain2:11434/api/generate',
        expect.objectContaining({
          body: expect.stringContaining('"model":"gemma4:e4b"'),
        }),
      );
      expect(global.fetch).toHaveBeenNthCalledWith(
        3,
        'http://ollama-coord:11434/api/generate',
        expect.objectContaining({
          body: expect.stringContaining('"model":"minimax-m2.5:cloud"'),
        }),
      );
    });

    test('should set status to failed and record error in cycle on fetch failure', async () => {
      const task = await orchestrator.createTask('Will fail');
      jest.spyOn(orchestrator as any, 'saveToMemory').mockResolvedValue(undefined);

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await orchestrator.executeCycle(task.id);

      expect(result.status).toBe('failed');
      expect(result.cycle).toHaveLength(1);
      expect(result.cycle[0]).toMatchObject({
        phase: 'coordinate',
        actor: 'coordinator',
        timestamp: fixedTimestamp,
        result: 'Error: Network error',
      });
    });

    test('should handle missing provider for brain-1 gracefully', async () => {
      const task = await orchestrator.createTask('No brain');
      jest.spyOn(orchestrator as any, 'saveToMemory').mockResolvedValue(undefined);

      // Make selectProvider return null for brain-1 capability
      mockSelectProvider.mockImplementationOnce(() => ({ provider: null, confidence: 0, reason: '' }));

      const result = await orchestrator.executeCycle(task.id);

      expect(result.status).toBe('failed');
      expect(result.cycle).toHaveLength(1);
      expect(result.cycle[0].result).toContain('No provider available for brain-1');
    });

    test('should handle non-ok fetch response', async () => {
      const task = await orchestrator.createTask('Bad response');
      jest.spyOn(orchestrator as any, 'saveToMemory').mockResolvedValue(undefined);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockResolvedValue({}),
      });

      const result = await orchestrator.executeCycle(task.id);

      expect(result.status).toBe('failed');
      expect(result.cycle).toHaveLength(1);
      expect(result.cycle[0].result).toContain('Error: Brain brain-1 call failed: 500');
    });
  });
});
```
