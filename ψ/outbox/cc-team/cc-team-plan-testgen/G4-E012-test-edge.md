<!-- cc-team deliverable
 group: G4 (Generate jest unit tests for untested innomcp-node modules (batch 4))
 member: E012 role=test-edge model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2317,"completion_tokens":3081,"total_tokens":5398,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1173,"image_tokens":0},"cache_creation_input_tokens":0} | 32s
 generated: 2026-06-13T11:13:20.792Z -->
```typescript
import {
  validateAgentEvent,
  newEnvelope,
  SCHEMA_VERSION,
  AGENT_ROLE_LABEL_TH,
} from "../src/agents/events";
import type { AgentEvent, AgentEventType, AgentId } from "../src/agents/events";

describe("events module", () => {
  describe("validateAgentEvent", () => {
    const baseValid: Partial<AgentEvent> = {
      type: "agent_started",
      runId: "run-123",
      messageId: "msg-456",
      publicSummary: "Test agent started",
      isSafeForUser: true,
      timestamp: new Date().toISOString(),
    };

    test("returns null for a valid event", () => {
      expect(validateAgentEvent({ ...baseValid })).toBeNull();
    });

    test("returns error when input is null", () => {
      expect(validateAgentEvent(null)).toBe("event is not an object");
    });

    test("returns error when input is undefined", () => {
      expect(validateAgentEvent(undefined)).toBe("event is not an object");
    });

    test("returns error when input is a primitive", () => {
      expect(validateAgentEvent("not an object")).toBe("event is not an object");
      expect(validateAgentEvent(42)).toBe("event is not an object");
    });

    const requiredFields = [
      "type",
      "runId",
      "messageId",
      "publicSummary",
      "timestamp",
    ] as const;
    requiredFields.forEach((field) => {
      test(`returns error when required field "${field}" is missing`, () => {
        const invalid = { ...baseValid };
        delete invalid[field];
        expect(validateAgentEvent(invalid)).toBe(
          `missing or empty required string field: ${field}`
        );
      });

      test(`returns error when required field "${field}" is an empty string`, () => {
        const invalid = { ...baseValid, [field]: "" };
        expect(validateAgentEvent(invalid)).toBe(
          `missing or empty required string field: ${field}`
        );
      });
    });

    test("returns error when isSafeForUser is not true", () => {
      const invalid = { ...baseValid, isSafeForUser: false };
      expect(validateAgentEvent(invalid)).toBe(
        "isSafeForUser must be the literal true"
      );
    });

    test("returns error for an unknown event type", () => {
      const invalid = { ...baseValid, type: "nonexistent" };
      expect(validateAgentEvent(invalid)).toBe(
        "unknown event type: nonexistent"
      );
    });

    test("returns error when publicSummary exceeds 240 characters", () => {
      const longSummary = "x".repeat(241);
      const invalid = { ...baseValid, publicSummary: longSummary };
      expect(validateAgentEvent(invalid)).toBe(
        "publicSummary exceeds 240 chars"
      );
    });

    test("returns error when confidence is not a number", () => {
      const invalid = { ...baseValid, confidence: "high" };
      expect(validateAgentEvent(invalid)).toBe("confidence must be 0..1");
    });

    test("returns error when confidence is out of range", () => {
      expect(
        validateAgentEvent({ ...baseValid, confidence: -0.1 })
      ).toBe("confidence must be 0..1");
      expect(
        validateAgentEvent({ ...baseValid, confidence: 1.1 })
      ).toBe("confidence must be 0..1");
    });

    test("returns error when sourceIds is not an array", () => {
      const invalid = { ...baseValid, sourceIds: "doc1" };
      expect(validateAgentEvent(invalid)).toBe(
        "sourceIds must be string[]"
      );
    });

    test("returns error when sourceIds contains non-string elements", () => {
      const invalid = { ...baseValid, sourceIds: ["ok", 123] };
      expect(validateAgentEvent(invalid)).toBe(
        "sourceIds must be string[]"
      );
    });

    // Type‑specific required fields
    test("draft_delta requires deltaText of type string", () => {
      const invalid = {
        ...baseValid,
        type: "draft_delta" as AgentEventType,
        deltaText: undefined,
      };
      expect(validateAgentEvent(invalid)).toBe(
        "draft_delta requires deltaText:string"
      );
    });

    test("final_answer requires finalText of type string", () => {
      const invalid = {
        ...baseValid,
        type: "final_answer" as AgentEventType,
        finalText: 123,
      };
      expect(validateAgentEvent(invalid)).toBe(
        "final_answer requires finalText:string"
      );
    });

    test("tool_call_started requires toolName a non‑empty string", () => {
      const invalid = {
        ...baseValid,
        type: "tool_call_started" as AgentEventType,
        toolName: "",
      };
      expect(validateAgentEvent(invalid)).toBe(
        "tool_call_started requires toolName:string"
      );
    });

    test("tool_call_finished requires toolName a non‑empty string", () => {
      const invalid = {
        ...baseValid,
        type: "tool_call_finished" as AgentEventType,
      };
      expect(validateAgentEvent(invalid)).toBe(
        "tool_call_finished requires toolName:string"
      );
    });

    test("fallback requires fallbackReason of type string", () => {
      const invalid = {
        ...baseValid,
        type: "fallback" as AgentEventType,
        fallbackReason: undefined,
      };
      expect(validateAgentEvent(invalid)).toBe(
        "fallback requires fallbackReason:string"
      );
    });

    test("allows optional fields to be absent", () => {
      // A valid event without any optional fields passes.
      expect(
        validateAgentEvent({
          type: "fact_found",
          runId: "r",
          messageId: "m",
          publicSummary: "s",
          isSafeForUser: true,
          timestamp: new Date().toISOString(),
        })
      ).toBeNull();
    });
  });

  describe("newEnvelope", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test("builds a base envelope with mandatory fields", () => {
      const env = newEnvelope({
        runId: "r1",
        messageId: "m1",
        type: "agent_started",
        publicSummary: "hello",
      });

      expect(env).toEqual({
        type: "agent_started",
        runId: "r1",
        messageId: "m1",
        agentId: undefined,
        role: undefined,
        publicSummary: "hello",
        isSafeForUser: true,
        timestamp: "2024-01-01T00:00:00.000Z",
      });
    });

    test("includes agentId and role when agentId is valid", () => {
      const env = newEnvelope({
        runId: "r2",
        messageId: "m2",
        type: "concierge",
        publicSummary: "summary",
        agentId: "concierge" as AgentId,
      });

      expect(env.agentId).toBe("concierge");
      expect(env.role).toBe(AGENT_ROLE_LABEL_TH.concierge);
    });

    test("role is undefined when agentId is not provided", () => {
      const env = newEnvelope({
        runId: "r3",
        messageId: "m3",
        type: "final_answer",
        publicSummary: "done",
        // no agentId
      });

      expect(env.agentId).toBeUndefined();
      expect(env.role).toBeUndefined();
    });

    test("role is undefined when agentId is not a valid AgentId (runtime bypass)", () => {
      // Force an invalid key
      const env = newEnvelope({
        runId: "r4",
        messageId: "m4",
        type: "critique",
        publicSummary: "bad agent",
        agentId: "nonexistent" as any,
      });

      expect(env.agentId).toBe("nonexistent" as any);
      expect(env.role).toBeUndefined();
    });
  });

  test("SCHEMA_VERSION is a non‑empty string", () => {
    expect(typeof SCHEMA_VERSION).toBe("string");
    expect(SCHEMA_VERSION.length).toBeGreaterThan(0);
  });
});
```
