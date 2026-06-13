<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S032 role=spec-test model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":263,"completion_tokens":6073,"total_tokens":6336,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4846,"image_tokens":0},"cache_creation_input_tokens":0} | 66s
 generated: 2026-06-13T11:29:02.148Z -->
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
      ).toBe(true);
      expect(envelope).toHaveProperty('event', validEvent);
    });

    it('should produce envelopes with unique ids', () => {
      const env1 = newEnvelope({ event: validEvent });
      const env2 = newEnvelope({ event: validEvent });
      expect(env1.id).not.toBe(env2.id);
    });

    it('should throw an error when the provided event is invalid', () => {
      const invalidEvent = { ...validEvent, version: '0.0.0' };
      expect(() => newEnvelope({ event: invalidEvent as AgentEvent })).toThrow();
    });

    it('should throw when required options are missing (e.g., no event property)', () => {
      expect(() => newEnvelope({} as any)).toThrow();
      expect(() => newEnvelope(undefined as any)).toThrow();
    });

    it('should pass validation on the event stored inside the envelope', () => {
      const envelope = newEnvelope({ event: validEvent });
      const validationResult = validateAgentEvent(envelope.event);
      expect(validationResult).toBeNull();
    });
  });
});
```
