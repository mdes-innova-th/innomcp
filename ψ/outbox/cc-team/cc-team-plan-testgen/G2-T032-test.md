<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T032 role=test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2288,"completion_tokens":3256,"total_tokens":5544,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1047,"image_tokens":0},"cache_creation_input_tokens":0} | 32s
 generated: 2026-06-13T10:57:57.562Z -->
```typescript
import {
  SCHEMA_VERSION,
  AGENT_ROLE_LABEL_TH,
  validateAgentEvent,
  newEnvelope,
} from '../src/agents/events';
import type { AgentEvent, AgentEventType, AgentId } from '../src/agents/events';

describe('events module', () => {
  describe('SCHEMA_VERSION', () => {
    test('is "1.0.0"', () => {
      expect(SCHEMA_VERSION).toBe('1.0.0');
    });
  });

  describe('AGENT_ROLE_LABEL_TH', () => {
    test('maps all AgentId keys to Thai strings', () => {
      const keys: AgentId[] = [
        'conductor',
        'concierge',
        'tool-scout',
        'weather-analyst',
        'geo-planner',
        'rag-agent',
        'critic',
        'stylist',
        'broker',
        'scribe',
        'thinker',
        'researcher',
        'fact-checker',
        'linguist',
        'domain-expert',
        'data-analyst',
      ];
      keys.forEach((key) => {
        expect(typeof AGENT_ROLE_LABEL_TH[key]).toBe('string');
        expect(AGENT_ROLE_LABEL_TH[key].length).toBeGreaterThan(0);
      });
    });
  });

  describe('validateAgentEvent', () => {
    const makeValid = (overrides: Partial<AgentEvent> = {}): AgentEvent => ({
      type: 'agent_started',
      runId: 'r1',
      messageId: 'm1',
      publicSummary: 'summary',
      isSafeForUser: true,
      timestamp: new Date().toISOString(),
      ...overrides,
    });

    test('returns null for a valid minimal event', () => {
      expect(validateAgentEvent(makeValid())).toBeNull();
    });

    test('rejects null or non-object', () => {
      expect(validateAgentEvent(null)).toBe('event is not an object');
      expect(validateAgentEvent(undefined)).toBe('event is not an object');
      expect(validateAgentEvent(42)).toBe('event is not an object');
      expect(validateAgentEvent('str')).toBe('event is not an object');
    });

    test.each([
      'type',
      'runId',
      'messageId',
      'publicSummary',
      'timestamp',
    ] as const)('requires non-empty string for %s', (field) => {
      const ev = makeValid();
      delete (ev as any)[field];
      expect(validateAgentEvent(ev)).toBe(
        `missing or empty required string field: ${field}`
      );

      (ev as any)[field] = '';
      expect(validateAgentEvent(ev)).toBe(
        `missing or empty required string field: ${field}`
      );
    });

    test('isSafeForUser must be literal true', () => {
      const ev = makeValid();
      (ev as any).isSafeForUser = false;
      expect(validateAgentEvent(ev)).toBe('isSafeForUser must be the literal true');
      (ev as any).isSafeForUser = 1;
      expect(validateAgentEvent(ev)).toBe('isSafeForUser must be the literal true');
      (ev as any).isSafeForUser = 'true';
      expect(validateAgentEvent(ev)).toBe('isSafeForUser must be the literal true');
      // literal true passes
      ev.isSafeForUser = true;
      expect(validateAgentEvent(ev)).toBeNull();
    });

    test('rejects unknown event type', () => {
      expect(validateAgentEvent(makeValid({ type: 'unknown' as AgentEventType }))).toBe(
        'unknown event type: unknown'
      );
    });

    test('publicSummary max 240 chars', () => {
      // 240 chars exactly is ok
      const ok = makeValid({ publicSummary: 'a'.repeat(240) });
      expect(validateAgentEvent(ok)).toBeNull();

      const bad = makeValid({ publicSummary: 'a'.repeat(241) });
      expect(validateAgentEvent(bad)).toBe('publicSummary exceeds 240 chars');
    });

    test('confidence must be 0..1 if present', () => {
      // valid
      expect(validateAgentEvent(makeValid({ confidence: 0 }))).toBeNull();
      expect(validateAgentEvent(makeValid({ confidence: 1 }))).toBeNull();
      expect(validateAgentEvent(makeValid({ confidence: 0.5 }))).toBeNull();

      // invalid
      const cases = [
        { confidence: -0.1, label: 'negative' },
        { confidence: 1.1, label: 'above 1' },
        { confidence: '0.5', label: 'string' },
        { confidence: NaN, label: 'NaN' },
        { confidence: Infinity, label: 'Infinity' },
      ];
      for (const c of cases) {
        expect(validateAgentEvent(makeValid({ confidence: c.confidence as any })))
          .toBe('confidence must be 0..1');
      }
    });

    test('sourceIds must be string[] if present', () => {
      expect(validateAgentEvent(makeValid({ sourceIds: [] }))).toBeNull();
      expect(validateAgentEvent(makeValid({ sourceIds: ['a', 'b'] }))).toBeNull();

      expect(validateAgentEvent(makeValid({ sourceIds: 'not-array' as any })))
        .toBe('sourceIds must be string[]');
      expect(validateAgentEvent(makeValid({ sourceIds: [1, 'a'] as any })))
        .toBe('sourceIds must be string[]');
    });

    describe('type-specific required fields', () => {
      test('draft_delta requires deltaText', () => {
        const ev = makeValid({ type: 'draft_delta', deltaText: 'delta' });
        expect(validateAgentEvent(ev)).toBeNull();

        delete (ev as any).deltaText;
        expect(validateAgentEvent(ev)).toBe('draft_delta requires deltaText:string');
      });

      test('final_answer requires finalText', () => {
        const ev = makeValid({ type: 'final_answer', finalText: 'answer' });
        expect(validateAgentEvent(ev)).toBeNull();

        delete (ev as any).finalText;
        expect(validateAgentEvent(ev)).toBe('final_answer requires finalText:string');
      });

      test('tool_call_started requires toolName', () => {
        const ev = makeValid({ type: 'tool_call_started', toolName: 'search' });
        expect(validateAgentEvent(ev)).toBeNull();

        delete (ev as any).toolName;
        expect(validateAgentEvent(ev)).toBe('tool_call_started requires toolName:string');
      });

      test('tool_call_finished requires toolName', () => {
        const ev = makeValid({ type: 'tool_call_finished', toolName: 'search' });
        expect(validateAgentEvent(ev)).toBeNull();

        delete (ev as any).toolName;
        expect(validateAgentEvent(ev)).toBe('tool_call_finished requires toolName:string');
      });

      test('fallback requires fallbackReason', () => {
        const ev = makeValid({ type: 'fallback', fallbackReason: 'timeout' });
        expect(validateAgentEvent(ev)).toBeNull();

        delete (ev as any).fallbackReason;
        expect(validateAgentEvent(ev)).toBe('fallback requires fallbackReason:string');
      });

      test('other types skip type-specific requirements', () => {
        // agent_started has no extra required fields
        expect(validateAgentEvent(makeValid({ type: 'agent_started' }))).toBeNull();
      });
    });

    test('ignores unknown extra fields', () => {
      const ev = makeValid({ extra: 'abc' } as any);
      expect(validateAgentEvent(ev)).toBeNull();
    });
  });

  describe('newEnvelope', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('builds a base envelope with required fields', () => {
      const env = newEnvelope({
        runId: 'r1',
        messageId: 'm1',
        type: 'agent_started',
        publicSummary: 'starting',
        agentId: 'concierge',
      });

      const expected: AgentEvent = {
        type: 'agent_started',
        runId: 'r1',
        messageId: 'm1',
        agentId: 'concierge',
        role: AGENT_ROLE_LABEL_TH.concierge,
        publicSummary: 'starting',
        isSafeForUser: true,
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      expect(env).toEqual(expected);
    });

    test('omits role when agentId not provided', () => {
      const env = newEnvelope({
        runId: 'r1',
        messageId: 'm1',
        type: 'final_answer',
        publicSummary: 'done',
        // no agentId
      });

      expect(env.role).toBeUndefined();
      expect(env.agentId).toBeUndefined();
      expect(env.isSafeForUser).toBe(true);
      expect(env.timestamp).toBe('2025-01-01T00:00:00.000Z');
    });

    test('timestamp uses current system time', () => {
      const now = new Date('2025-06-15T10:30:00.000Z');
      jest.setSystemTime(now);
      const env = newEnvelope({
        runId: 'r2',
        messageId: 'm2',
        type: 'error',
        publicSummary: 'error',
      });

      expect(env.timestamp).toBe('2025-06-15T10:30:00.000Z');
    });
  });
});
```
