/**
 * agentEvents.test.ts — Phase C agent event contract + public-safe gate
 */

import {
  AGENT_ROLE_LABEL_TH,
  newEnvelope,
  validateAgentEvent,
  type AgentEvent,
} from "../../src/agents/events";
import {
  checkAgentEventSafe,
  checkVisibleTextSafe,
} from "../../src/agents/eventGuard";

describe("AgentEvent shape validator", () => {
  test("accepts a well-formed agent_run_started envelope", () => {
    const ev = newEnvelope({
      runId: "run-1",
      messageId: "msg-1",
      type: "agent_run_started",
      publicSummary: "เริ่มประมวลคำขอ",
      agentId: "conductor",
    });
    expect(validateAgentEvent(ev)).toBeNull();
    expect(ev.role).toBe(AGENT_ROLE_LABEL_TH.conductor);
  });

  test("rejects missing required fields", () => {
    const partial: any = { type: "agent_run_started", publicSummary: "x", isSafeForUser: true };
    const reason = validateAgentEvent(partial);
    expect(reason).toMatch(/missing or empty required string/);
  });

  test("rejects unknown event types", () => {
    const ev: any = newEnvelope({
      runId: "run-1",
      messageId: "msg-1",
      type: "agent_run_started",
      publicSummary: "x",
    });
    ev.type = "totally_made_up";
    expect(validateAgentEvent(ev)).toMatch(/unknown event type/);
  });

  test("rejects confidence outside 0..1", () => {
    const ev = newEnvelope({
      runId: "r",
      messageId: "m",
      type: "fact_found",
      publicSummary: "x",
      agentId: "weather-analyst",
    });
    (ev as any).confidence = 1.5;
    expect(validateAgentEvent(ev)).toMatch(/confidence must be 0..1/);
  });

  test("draft_delta requires deltaText", () => {
    const ev = newEnvelope({
      runId: "r",
      messageId: "m",
      type: "draft_delta",
      publicSummary: "ส่งคำตอบเป็นช่วงๆ",
      agentId: "concierge",
    });
    expect(validateAgentEvent(ev)).toMatch(/draft_delta requires deltaText/);
    ev.deltaText = "ส่งบางส่วน";
    expect(validateAgentEvent(ev)).toBeNull();
  });

  test("final_answer requires finalText", () => {
    const ev = newEnvelope({
      runId: "r",
      messageId: "m",
      type: "final_answer",
      publicSummary: "ส่งคำตอบสุดท้าย",
      agentId: "concierge",
    });
    expect(validateAgentEvent(ev)).toMatch(/final_answer requires finalText/);
    ev.finalText = "คำตอบ";
    expect(validateAgentEvent(ev)).toBeNull();
  });

  test("publicSummary length cap is enforced", () => {
    const ev = newEnvelope({
      runId: "r",
      messageId: "m",
      type: "agent_started",
      publicSummary: "ก".repeat(241),
      agentId: "concierge",
    });
    expect(validateAgentEvent(ev)).toMatch(/publicSummary exceeds/);
  });
});

describe("Public-safe event guard (key-name scan)", () => {
  test("accepts a clean event", () => {
    const ev = newEnvelope({
      runId: "r",
      messageId: "m",
      type: "fact_found",
      publicSummary: "พบข้อมูล",
      agentId: "rag-agent",
    });
    expect(checkAgentEventSafe(ev).ok).toBe(true);
  });

  test("rejects event carrying privateThought field (case-insensitive)", () => {
    const ev: any = newEnvelope({
      runId: "r",
      messageId: "m",
      type: "agent_started",
      publicSummary: "x",
      agentId: "concierge",
    });
    ev.privateThought = "secret stuff";
    const r = checkAgentEventSafe(ev);
    expect(r.ok).toBe(false);
    expect(r.forbiddenKey).toBe("privateThought");
  });

  test("rejects event carrying chainOfThought field", () => {
    const ev: any = newEnvelope({
      runId: "r",
      messageId: "m",
      type: "agent_started",
      publicSummary: "x",
      agentId: "concierge",
    });
    ev.chainOfThought = "step 1 ... step 2 ...";
    const r = checkAgentEventSafe(ev);
    expect(r.ok).toBe(false);
    expect(r.forbiddenKey).toBe("chainOfThought");
  });

  test("rejects event with apiKey or password", () => {
    const ev: any = newEnvelope({
      runId: "r",
      messageId: "m",
      type: "agent_started",
      publicSummary: "x",
      agentId: "concierge",
    });
    ev.apiKey = "sk-abc";
    expect(checkAgentEventSafe(ev).forbiddenKey).toBe("apiKey");
    delete ev.apiKey;
    ev.password = "p";
    expect(checkAgentEventSafe(ev).forbiddenKey).toBe("password");
  });

  test("rejects forbidden visible literals (Weather Map Placeholder, etc.)", () => {
    const ev: AgentEvent = newEnvelope({
      runId: "r",
      messageId: "m",
      type: "draft_delta",
      publicSummary: "Weather Map Placeholder cannot ship",
      agentId: "concierge",
    });
    ev.deltaText = "Weather Map Placeholder cannot ship";
    const r = checkAgentEventSafe(ev);
    expect(r.ok).toBe(false);
    expect(r.forbiddenSubstring).toBe("Weather Map Placeholder");
  });

  test("rejects standalone 'placeholder' word in visible text by default", () => {
    const r = checkVisibleTextSafe("This is a placeholder answer.");
    expect(r.ok).toBe(false);
    expect(r.forbiddenSubstring).toBe("placeholder");
  });

  test("allows map terms when allowMapTerms = true", () => {
    const r = checkVisibleTextSafe("This map placeholder is intentional.", {
      allowMapTerms: true,
    });
    expect(r.ok).toBe(true);
  });

  test("rejects 'Used tools: none' only when expectedToolUsage = true", () => {
    const text = "พร้อมตอบ Used tools: none ครับ";
    const off = checkVisibleTextSafe(text, { expectedToolUsage: false });
    expect(off.ok).toBe(true);
    const on = checkVisibleTextSafe(text, { expectedToolUsage: true });
    expect(on.ok).toBe(false);
    expect(on.forbiddenSubstring).toBe("Used tools: none");
  });
});
