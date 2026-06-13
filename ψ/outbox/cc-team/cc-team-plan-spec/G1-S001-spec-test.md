<!-- cc-team deliverable
 group: G1 (Spec/contract-based tests)
 member: S001 role=spec-test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":207,"completion_tokens":3208,"total_tokens":3415,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":648,"image_tokens":0},"cache_creation_input_tokens":0} | 35s
 generated: 2026-06-13T11:19:40.362Z -->
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

    it('should yield text events interleaved with tool calls if agent yields them', async () => {
      const text1: AgentEvent = { type: 'text', text: 'Let me check...' };
      const tool: AgentEvent = { type: 'tool_call', tool_name: 'calc', args: { expr: '2+2' } };
      const text2: AgentEvent = { type: 'text', text: 'The answer is' };
      const final: AgentEvent = { type: 'final_answer', answer: '4' };

      mockAgent.step
        .mockImplementationOnce(async function* () { yield text1; yield tool; })
        .mockImplementationOnce(async function* () { yield text2; yield final; });

      const opts = { agent: mockAgent, message: 'What is 2+2?' };
      const events = await collectGenerator(runAgentLoop(opts));
      expect(events).toEqual([text1, tool, text2, final]);
    });
  });

  // ====== ERROR / INVALID INPUTS ======

  describe('invalid inputs', () => {
    it('should throw a TypeError if opts is not provided', async () => {
      await expect(async () => {
        const gen = runAgentLoop(undefined as any);
        for await (const _ of gen) {} // consume even on error
      }).rejects.toThrow(TypeError);
    });

    it('should throw if agent is missing', async () => {
      const opts = { message: 'test' } as any;
      await expect(async () => {
        for await (const _ of runAgentLoop(opts)) {}
      }).rejects.toThrow('agent is required');
    });

    it('should throw if message is missing or empty', async () => {
      const opts = { agent: mockAgent, message: '' };
      await expect(async () => {
        for await (const _ of runAgentLoop(opts)) {}
      }).rejects.toThrow('message must be non-empty');
    });

    it('should throw if agent.step is not a function', async () => {
      const opts = { agent: { step: 'not a function' }, message: 'hi' } as any;
      await expect(async () => {
        for await (const _ of runAgentLoop(opts)) {}
      }).rejects.toThrow('agent.step must be a function');
    });

    it('should throw if maxSteps is exceeded', async () => {
      // Agent keeps yielding tool calls indefinitely
      const toolCall: AgentEvent = { type: 'tool_call', tool_name: 'loop', args: {} };
      mockAgent.step.mockImplementation(async function* () {
        yield toolCall;
      });

      const opts = {
        agent: mockAgent,
        message: 'test',
        maxSteps: 3,
      };

      // Expect the loop to throw or yield an error event. We assume it throws.
      await expect(async () => {
        for await (const _ of runAgentLoop(opts)) {}
      }).rejects.toThrow('Maximum steps exceeded');
    });

    it('should throw if tool call result is invalid', async () => {
      const toolCall: AgentEvent = { type: 'tool_call', tool_name: 'nonexistent', args: {} };
      mockAgent.step
        .mockImplementationOnce(async function* () { yield toolCall; })
        .mockImplementationOnce(async function* () { yield { type: 'tool_result', tool_name: 'nonexistent', result: 'error' }; });

      const opts = { agent: mockAgent, message: 'test', tools: ['valid_tool'] };
      await expect(async () => {
        for await (const _ of runAgentLoop(opts)) {}
      }).rejects.toThrow('Unknown tool: nonexistent');
    });

    it('should throw if tool result does not match the call', async () => {
      const toolCall: AgentEvent = { type: 'tool_call', tool_name: 'a', args: {} };
      mockAgent.step
        .mockImplementationOnce(async function* () { yield toolCall; })
        .mockImplementationOnce(async function* () { yield { type: 'tool_result', tool_name: 'b', result: 'oops' }; });

      const opts = { agent: mockAgent, message: 'test', tools: ['a', 'b'] };
      await expect(async () => {
        for await (const _ of runAgentLoop(opts)) {}
      }).rejects.toThrow('Tool result mismatch');
    });
  });

  // ====== BOUNDARY CONDITIONS ======

  describe('boundary conditions', () => {
    it('should yield an error event when agent returns an error event', async () => {
      const errorEvent: AgentEvent = { type: 'error', message: 'LLM failed' };
      mockAgent.step.mockImplementationOnce(async function* () {
        yield errorEvent;
      });

      const opts = { agent: mockAgent, message: 'hi' };
      const events = await collectGenerator(runAgentLoop(opts));
      // The loop might stop after error and not yield final answer
      expect(events).toEqual([errorEvent]);
    });

    it('should handle a message that is exactly the max length limit', async () => {
      const longMessage = 'x'.repeat(1000); // assume limit is 1000
      const final: AgentEvent = { type: 'final_answer', answer: 'done' };
      mockAgent.step.mockImplementationOnce(async function* () { yield final; });

      const opts = { agent: mockAgent, message: longMessage };
      const events = await collectGenerator(runAgentLoop(opts));
      expect(events).toEqual([final]);
    });

    it('should handle empty tools array', async () => {
      const final: AgentEvent = { type: 'final_answer', answer: 'ok' };
      mockAgent.step.mockImplementationOnce(async function* () { yield final; });

      const opts = { agent: mockAgent, message: 'test', tools: [] };
      const events = await collectGenerator(runAgentLoop(opts));
      expect(events).toEqual([final]);
    });

    it('should handle a tool call that returns null result', async () => {
      const toolCall: AgentEvent = { type: 'tool_call', tool_name: 'noop', args: {} };
      const toolResult: AgentEvent = { type: 'tool_result', tool_name: 'noop', result: null };
      const final: AgentEvent = { type: 'final_answer', answer: 'done' };

      mockAgent.step
        .mockImplementationOnce(async function* () { yield toolCall; })
        .mockImplementationOnce(async function* () { yield toolResult; })
        .mockImplementationOnce(async function* () { yield final; });

      const opts = { agent: mockAgent, message: 'test', tools: ['noop'] };
      const events = await collectGenerator(runAgentLoop(opts));
      expect(events).toEqual([toolCall, toolResult, final]);
    });

    it('should handle maxSteps = 0 (no iterations allowed)', async () => {
      const opts = {
        agent: { step: async function* () { /* never called */ } } as any,
        message: 'hi',
        maxSteps: 0,
      };
      // With maxSteps = 0, the loop should not even start.
      const events = await collectGenerator(runAgentLoop(opts));
      expect(events).toEqual([]);
    });
  });
});
```
