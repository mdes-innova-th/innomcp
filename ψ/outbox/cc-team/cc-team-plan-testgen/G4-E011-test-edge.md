<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: E011 role=test-edge model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1959,"completion_tokens":7567,"total_tokens":9526,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5247,"image_tokens":0},"cache_creation_input_tokens":0} | 75s
 generated: 2026-06-13T11:13:42.894Z -->
```typescript
import { checkAgentEventSafe, checkVisibleTextSafe } from '../src/agents/eventGuard';
import type { AgentEvent } from '../src/agents/events';
import * as events from '../src/agents/events';

jest.mock('../src/agents/events');

describe('checkAgentEventSafe', () => {
  const mockValidate = events.validateAgentEvent as jest.Mock;
  const safeBase: AgentEvent = {
    type: 'draft_delta',
    runId: 'test',
    messageId: 'test',
    publicSummary: 'Hello',
    isSafeForUser: true,
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    mockValidate.mockReturnValue(null);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('returns ok for a clean event', () => {
    const result = checkAgentEventSafe(safeBase);
    expect(result).toEqual({ ok: true });
  });

  test('rejects with shapeError when validateAgentEvent fails', () => {
    mockValidate.mockReturnValue('Invalid event shape');
    const result = checkAgentEventSafe(safeBase);
    expect(result).toEqual({
      ok: false,
      reason: 'shape: Invalid event shape',
      shapeError: 'Invalid event shape',
    });
  });

  // Forbidden key-name tests
  test.each([
    'privateThought',
    'hiddenReasoning',
    'chainOfThought',
    'rawThought',
    'innerMonologue',
    'secret',
    'apiKey',
    'password',
  ] as const)('blocks event containing forbidden key: %s', (key) => {
    const event: any = { ...safeBase, [key]: 'some value' };
    const result = checkAgentEventSafe(event);
    expect(result.ok).toBe(false);
    expect(result.forbiddenKey).toBe(key);
    expect(result.reason).toContain(`forbidden key: ${key}`);
  });

  test('forbidden key scan is case-insensitive', () => {
    const event: any = { ...safeBase, PRIVATETHOUGHT: 'leak' };
    const result = checkAgentEventSafe(event);
    expect(result.ok).toBe(false);
    // Reported key is the canonical lower-case name from the constant list
    expect(result.forbiddenKey).toBe('privateThought');
  });

  test('blocked if forbidden key appears nested in an object', () => {
    const event: any = {
      ...safeBase,
      meta: { privateThought: 'secret stuff' },
    };
    const result = checkAgentEventSafe(event);
    expect(result.ok).toBe(false);
    expect(result.forbiddenKey).toBe('privateThought');
  });

  test('does not block if forbidden key name appears only as a value substring without quotes', () => {
    const event: any = {
      ...safeBase,
      publicSummary: 'This mentions privateThought in a sentence',
    };
    const result = checkAgentEventSafe(event);
    expect(result.ok).toBe(true);
  });

  // Forbidden visible literals
  test.each([
    'Weather Map Placeholder',
    'Deterministic Local Static Tile',
    'ข้อมูลไม่ครบสำหรับการแสดงแผนที่',
  ])('blocks event if visible field contains forbidden literal: %s', (lit) => {
    const event = { ...safeBase, publicSummary: `content with ${lit} inside` };
    const result = checkAgentEventSafe(event);
    expect(result.ok).toBe(false);
    expect(result.forbiddenSubstring).toBe(lit);
    expect(result.reason).toContain(lit);
  });

  test('does not block when forbidden literal appears only in non-visible fields (e.g., runId)', () => {
    const event: any = { ...safeBase, runId: 'Weather Map Placeholder', publicSummary: 'clean' };
    const result = checkAgentEventSafe(event);
    expect(result.ok).toBe(true);
  });

  test('forbidden literal scan is case-sensitive', () => {
    const event = { ...safeBase, publicSummary: 'weather map placeholder' };
    const result = checkAgentEventSafe(event);
    expect(result.ok).toBe(true);
  });

  // Placeholder word boundary check
  test('blocks visible text containing standalone "placeholder" (case-insensitive)', () => {
    const event = { ...safeBase, deltaText: 'this is a placeholder for now' };
    const result = checkAgentEventSafe(event);
    expect(result.ok).toBe(false);
    expect(result.forbiddenSubstring).toBe('placeholder');
  });

  test('does not block when "placeholder" is part of a larger word (no word boundary)', () => {
    const event = { ...safeBase, finalText: 'this is placeholderless' };
    const result = checkAgentEventSafe(event);
    expect(result.ok).toBe(true);
  });

  test('blocks "Placeholder" (capital P) due to case-insensitive regex', () => {
    const event = { ...safeBase, publicSummary: 'My Placeholder here' };
    const result = checkAgentEventSafe(event);
    expect(result.ok).toBe(false);
  });

  test('blocks "placeholder" with punctuation as boundary', () => {
    const event = { ...safeBase, publicSummary: '(placeholder) test' };
    const result = checkAgentEventSafe(event);
    expect(result.ok).toBe(false);
  });

  test('does not block "placeholder" when allowMapTerms is true', () => {
    const event = { ...safeBase, deltaText: 'placeholder' };
    const result = checkAgentEventSafe(event, { allowMapTerms: true });
    expect(result.ok).toBe(true);
  });

  test('allowMapTerms does not skip forbidden literals (still blocked)', () => {
    const event = { ...safeBase, publicSummary: 'Weather Map Placeholder ahead' };
    const result = checkAgentEventSafe(event, { allowMapTerms: true });
    expect(result.ok).toBe(false);
    expect(result.forbiddenSubstring).toBe('Weather Map Placeholder');
  });

  // Used tools: none check
  test.each([
    'Used tools: none',
    'Used tools:   none',
    'used tools: NONE',
    'USED TOOLS: none',
  ])('rejects when visible contains "%s" and expectedToolUsage is true', (phrase) => {
    const event = { ...safeBase, finalText: phrase };
    const result = checkAgentEventSafe(event, { expectedToolUsage: true });
    expect(result.ok).toBe(false);
    expect(result.forbiddenSubstring).toBe('Used tools: none');
    expect(result.reason).toContain('forbidden visible phrase: Used tools: none');
  });

  test('does not reject Used tools: none when expectedToolUsage is false (default)', () => {
    const event = { ...safeBase, publicSummary: 'Used tools: none' };
    const result = checkAgentEventSafe(event);
    expect(result.ok).toBe(true);
  });

  test('does not reject Used tools: none when expectedToolUsage is true but phrase absent', () => {
    const event = { ...safeBase, deltaText: 'Used tools: some' };
    const result = checkAgentEventSafe(event, { expectedToolUsage: true });
    expect(result.ok).toBe(true);
  });

  // Combined options
  test('respects both allowMapTerms and expectedToolUsage simultaneously', () => {
    const eventPlaceholder = { ...safeBase, deltaText: 'placeholder' };
    const result1 = checkAgentEventSafe(eventPlaceholder, {
      allowMapTerms: true,
      expectedToolUsage: true,
    });
    expect(result1.ok).toBe(true);

    const eventToolNone = { ...safeBase, publicSummary: 'Used tools: none' };
    const result2 = checkAgentEventSafe(eventToolNone, {
      allowMapTerms: true,
      expectedToolUsage: true,
    });
    expect(result2.ok).toBe(false);
  });

  test('visible concatenation does not accidentally create forbidden literals', () => {
    const event = { ...safeBase, publicSummary: 'Weather', deltaText: ' Map Placeholder' };
    const result = checkAgentEventSafe(event);
    expect(result.ok).toBe(true);
  });
});

describe('checkVisibleTextSafe', () => {
  const mockValidate = events.validateAgentEvent as jest.Mock;

  beforeEach(() => {
    mockValidate.mockReturnValue(null);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('wraps text in a draft_delta event and delegates to checkAgentEventSafe', () => {
    const result = checkVisibleTextSafe('clean text');
    expect(result.ok).toBe(true);
    expect(mockValidate).toHaveBeenCalledTimes(1);
    const calledEvent: AgentEvent = mockValidate.mock.calls[0][0];
    expect(calledEvent.type).toBe('draft_delta');
    expect(calledEvent.deltaText).toBe('clean text');
    expect(calledEvent.runId).toBe('scan');
    expect(calledEvent.messageId).toBe('scan');
    expect(calledEvent.publicSummary).toBe('scan');
    expect(calledEvent.isSafeForUser).toBe(true);
    expect(typeof calledEvent.timestamp).toBe('string');
  });

  test('returns blocked when text contains forbidden literal', () => {
    const result = checkVisibleTextSafe('Weather Map Placeholder');
    expect(result.ok).toBe(false);
    expect(result.forbiddenSubstring).toBe('Weather Map Placeholder');
  });

  test('respects allowMapTerms option', () => {
    const result = checkVisibleTextSafe('placeholder', { allowMapTerms: true });
    expect(result.ok).toBe(true);
  });

  test('respects expectedToolUsage option', () => {
    const result = checkVisibleTextSafe('Used tools: none', { expectedToolUsage: true });
    expect(result.ok).toBe(false);
    expect(result.forbiddenSubstring).toBe('Used tools: none');
  });

  test('handles shape validation error from wrapped event', () => {
    mockValidate.mockReturnValue('Invalid event');
    const result = checkVisibleTextSafe('anything');
    expect(result.ok).toBe(false);
    expect(result.shapeError).toBe('Invalid event');
  });

  test('fabricated timestamp is a valid ISO string', () => {
    mockValidate.mockReturnValue(null);
    checkVisibleTextSafe('test');
    const event: AgentEvent = mockValidate.mock.calls[0][0];
    const date = new Date(event.timestamp);
    expect(date.toISOString()).toBe(event.timestamp);
  });
});
```
