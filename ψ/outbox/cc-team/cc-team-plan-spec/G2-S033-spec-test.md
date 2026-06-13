<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S033 role=spec-test model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":353,"completion_tokens":7000,"total_tokens":7353,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6333,"image_tokens":0},"cache_creation_input_tokens":0} | 80s
 generated: 2026-06-13T11:29:41.363Z -->
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
