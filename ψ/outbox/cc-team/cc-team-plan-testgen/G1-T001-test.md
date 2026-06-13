<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T001 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1902,"completion_tokens":5690,"total_tokens":7592,"prompt_tokens_details":{"cached_tokens":1792,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4241,"image_tokens":0},"cache_creation_input_tokens":0} | 47s
 generated: 2026-06-13T10:51:16.704Z -->
```typescript
import { runAgentLoop } from '../src/services/agentLoop';
import type { AgentEvent } from '../src/services/agentLoop';
import type { ToolRegistry, ToolSpec } from '../src/tools/registry';

describe('runAgentLoop', () => {
  let mockTools: jest.Mocked<ToolRegistry>;
  let mockLlm: jest.Mock;
  let mockSignal: { aborted: boolean };

  beforeEach(() => {
    jest.useFakeTimers();
    mockTools = {
      getToolSpecs: jest.fn().mockReturnValue([] as ToolSpec[]),
      execute: jest.fn(),
    } as jest.Mocked<ToolRegistry>;
    mockLlm = jest.fn();
    mockSignal = { aborted: false };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function collectEvents(opts: Parameters<typeof runAgentLoop>[0]): Promise<AgentEvent[]> {
    const events: AgentEvent[] = [];
    for await (const event of runAgentLoop(opts)) {
      events.push(event);
    }
    return events;
  }

  test('should yield plan event', async () => {
    mockLlm.mockResolvedValue({ content: 'Final answer', toolCalls: [] });
    const events = await collectEvents({ task: 'Write a poem', tools: mockTools, llm: mockLlm });
    expect(events[0]).toEqual({ type: 'plan', text: 'Starting task: Write a poem' });
  });

  test('should complete with content-only response', async () => {
    mockLlm.mockResolvedValue({ content: 'Hello world', toolCalls: [] });
    const events = await collectEvents({ task: 'T', tools: mockTools, llm: mockLlm });
    expect(events).toContainEqual({ type: 'message', content: 'Hello world', role: 'assistant' });
    expect(events).toContainEqual({ type: 'artifact', content: 'Hello world' });
    expect(events).toContainEqual({ type: 'done', finalOutput: 'Hello world' });
  });

  test('should handle tool calls and then content', async () => {
    mockLlm.mockResolvedValueOnce({
      content: null,
      toolCalls: [{ name: 'search', input: { query: 'test' } }],
    });
    mockLlm.mockResolvedValueOnce({
      content: 'Result',
      toolCalls: [],
    });
    mockTools.execute.mockResolvedValue('search output');

    const events = await collectEvents({ task: 'T', tools: mockTools, llm: mockLlm });
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool_call', name: 'search' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool_result', name: 'search', output: 'search output' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'message', content: 'Result' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'done', finalOutput: 'Result' }));
  });

  test('should handle tool execution error and continue', async () => {
    mockLlm.mockResolvedValueOnce({
      content: null,
      toolCalls: [{ name: 'badTool', input: {} }],
    });
    mockLlm.mockResolvedValueOnce({
      content: 'Fixed it',
      toolCalls: [],
    });
    mockTools.execute.mockRejectedValue(new Error('Tool failed'));

    const events = await collectEvents({ task: 'T', tools: mockTools, llm: mockLlm });
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'tool_result', name: 'badTool', output: 'Tool failed' }),
    );
    expect(events).toContainEqual(expect.objectContaining({ type: 'message', content: 'Fixed it' }));
  });

  test('should handle LLM error', async () => {
    mockLlm.mockRejectedValue(new Error('Network error'));
    const events = await collectEvents({ task: 'T', tools: mockTools, llm: mockLlm });
    expect(events).toContainEqual({ type: 'error', error: 'LLM error: Network error' });
  });

  test('should abort when signal is already aborted', async () => {
    mockSignal.aborted = true;
    const events = await collectEvents({
      task: 'T',
      tools: mockTools,
      llm: mockLlm,
      signal: mockSignal as AbortSignal,
    });
    expect(events[0]).toEqual({ type: 'plan', text: 'Starting task: T' });
    expect(events[1]).toEqual({ type: 'error', error: 'Aborted' });
    expect(events.length).toBe(2);
  });

  test('should stop on max steps', async () => {
    mockLlm.mockResolvedValue({
      content: null,
      toolCalls: [{ name: 'search', input: { q: 'x' } }],
    });
    mockTools.execute.mockResolvedValue('some output');
    const events = await collectEvents({
      task: 'T',
      tools: mockTools,
      llm: mockLlm,
      maxSteps: 3,
    });
    const toolCalls = events.filter((e) => e.type === 'tool_call');
    expect(toolCalls.length).toBe(3);
    expect(events[events.length - 1]).toEqual({
      type: 'error',
      error: 'Max steps (3) reached without completion',
    });
  });

  test('should handle empty LLM response', async () => {
    mockLlm.mockResolvedValue({ content: undefined, toolCalls: [] });
    const events = await collectEvents({ task: 'T', tools: mockTools, llm: mockLlm });
    expect(events[events.length - 1]).toEqual({ type: 'error', error: 'LLM returned empty response' });
  });

  test('should pass signal to tools.execute', async () => {
    mockLlm.mockResolvedValue({
      content: null,
      toolCalls: [{ name: 'tool', input: {} }],
    });
    mockTools.execute.mockResolvedValue('done');
    await collectEvents({
      task: 'T',
      tools: mockTools,
      llm: mockLlm,
      signal: mockSignal as AbortSignal,
    });
    expect(mockTools.execute).toHaveBeenCalledWith('tool', {}, { signal: mockSignal });
  });
});
```
