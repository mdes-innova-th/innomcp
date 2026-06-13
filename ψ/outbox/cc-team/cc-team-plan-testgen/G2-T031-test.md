<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T031 role=test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1930,"completion_tokens":2936,"total_tokens":4866,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1687,"image_tokens":0},"cache_creation_input_tokens":0} | 27s
 generated: 2026-06-13T10:57:37.697Z -->
```typescript
import { checkAgentEventSafe, checkVisibleTextSafe } from '../src/agents/eventGuard';
import type { GuardResult } from '../src/agents/eventGuard';
import type { AgentEvent } from '../src/agents/events';
import { validateAgentEvent } from '../src/agents/events';

jest.mock('../src/agents/events');

const mockValidate = validateAgentEvent as jest.MockedFunction<typeof validateAgentEvent>;

describe('eventGuard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    mockValidate.mockReturnValue(null); // default: valid
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const validEvent: AgentEvent = {
    type: 'draft_delta',
    runId: 'r1',
    messageId: 'm1',
    publicSummary: 'a summary',
    isSafeForUser: true,
    timestamp: new Date().toISOString(),
    deltaText: 'hello',
  };

  describe('checkAgentEventSafe', () => {
    it('returns ok:true for a structurally valid event', () => {
      expect(checkAgentEventSafe(validEvent)).toEqual({ ok: true });
    });

    it('returns shapeError when validateAgentEvent fails', () => {
      mockValidate.mockReturnValue('invalid type');
      expect(checkAgentEventSafe(validEvent)).toEqual({
        ok: false,
        reason: 'shape: invalid type',
        shapeError: 'invalid type',
      });
    });

    it('rejects an event containing a forbidden key name (case-insensitive)', () => {
      const ev = { ...validEvent, rawThought: 'test' };
      const result = checkAgentEventSafe(ev);
      expect(result.ok).toBe(false);
      expect(result.forbiddenKey).toBe('rawThought');
      expect(result.reason).toContain('rawThought');
    });

    it('blocks the word "placeholder" in visible fields by default', () => {
      const ev = { ...validEvent, publicSummary: 'This is a Placeholder' };
      const result = checkAgentEventSafe(ev);
      expect(result.ok).toBe(false);
      expect(result.forbiddenSubstring).toBe('placeholder');
    });

    it('allows "placeholder" when allowMapTerms is true', () => {
      const ev = { ...validEvent, publicSummary: 'Placeholder text' };
      expect(checkAgentEventSafe(ev, { allowMapTerms: true })).toEqual({ ok: true });
    });

    it('blocks the literal "Weather Map Placeholder" even with allowMapTerms', () => {
      const ev = { ...validEvent, finalText: 'Weather Map Placeholder' };
      const result = checkAgentEventSafe(ev, { allowMapTerms: true });
      expect(result.ok).toBe(false);
      expect(result.forbiddenSubstring).toBe('Weather Map Placeholder');
    });

    it('blocks "Deterministic Local Static Tile"', () => {
      const ev = { ...validEvent, deltaText: 'Deterministic Local Static Tile' };
      expect(checkAgentEventSafe(ev).ok).toBe(false);
    });

    it('blocks "ข้อมูลไม่ครบสำหรับการแสดงแผนที่"', () => {
      const ev = { ...validEvent, fallbackReason: 'ข้อมูลไม่ครบสำหรับการแสดงแผนที่' };
      expect(checkAgentEventSafe(ev).ok).toBe(false);
    });

    it('blocks "Used tools: none" when expectedToolUsage is true', () => {
      const ev = { ...validEvent, deltaText: 'Used tools: none' };
      const result = checkAgentEventSafe(ev, { expectedToolUsage: true });
      expect(result.ok).toBe(false);
      expect(result.forbiddenSubstring).toBe('Used tools: none');
    });

    it('does not block "Used tools: none" when expectedToolUsage is false/undefined', () => {
      const ev = { ...validEvent, deltaText: 'Used tools: none' };
      expect(checkAgentEventSafe(ev).ok).toBe(true);
      expect(checkAgentEventSafe(ev, { expectedToolUsage: false }).ok).toBe(true);
    });

    it('rejects on first encountered forbidden key', () => {
      const ev = { ...validEvent, hiddenReasoning: 'a', apiKey: 'b' };
      const result = checkAgentEventSafe(ev);
      expect(result.ok).toBe(false);
      expect(result.forbiddenKey).toBe('hiddenReasoning');
    });
  });

  describe('checkVisibleTextSafe', () => {
    it('wraps text and returns ok:true for clean content', () => {
      const result = checkVisibleTextSafe('plain text');
      expect(result.ok).toBe(true);
    });

    it('propagates shape errors from the wrapper event', () => {
      mockValidate.mockReturnValue('invalid');
      expect(checkVisibleTextSafe('x')).toEqual({
        ok: false,
        reason: 'shape: invalid',
        shapeError: 'invalid',
      });
    });

    it('blocks "placeholder" in the supplied text', () => {
      const result = checkVisibleTextSafe('A placeholder');
      expect(result.ok).toBe(false);
      expect(result.forbiddenSubstring).toBe('placeholder');
    });

    it('respects allowMapTerms for "placeholder"', () => {
      expect(checkVisibleTextSafe('A placeholder', { allowMapTerms: true }).ok).toBe(true);
    });

    it('respects expectedToolUsage for visible text', () => {
      const result = checkVisibleTextSafe('Used tools: none', { expectedToolUsage: true });
      expect(result.ok).toBe(false);
    });
  });
});
```
