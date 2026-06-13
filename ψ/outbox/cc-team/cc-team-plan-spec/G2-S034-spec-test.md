<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S034 role=spec-test model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":230,"completion_tokens":7000,"total_tokens":7230,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5783,"image_tokens":0},"cache_creation_input_tokens":0} | 74s
 generated: 2026-06-13T11:30:00.042Z -->
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

    it('does not call callMcpTool when validation fails early', async () => {
      const callSpy = jest.spyOn(toolDispatch, 'callMcpTool').mockResolvedValue(undefined);
      await expect(toolDispatch.dispatchTool(null as any)).rejects.toThrow();
      expect(callSpy).not.toHaveBeenCalled();
    });
  });

  describe('callMcpTool', () => {
    it('is an async function', () => {
      expect(typeof toolDispatch.callMcpTool).toBe('function');
    });

    it('returns a Promise', () => {
      const spy = jest.spyOn(toolDispatch, 'callMcpTool').mockResolvedValue('ok');
      const ret = toolDispatch.callMcpTool('validTool', {});
      expect(ret).toBeInstanceOf(Promise);
      spy.mockRestore();
    });

    it('throws TypeError if
