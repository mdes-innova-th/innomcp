import { runConductor } from "../../src/agents/conductor";
import type { AgentEvent } from "../../src/agents/events";
import { selectAgentPlan, synthesizeAnswer } from "../../src/agents/parallelDispatch";

describe("runConductor", () => {
  const previousParallelAgents = process.env.PARALLEL_AGENTS;

  beforeEach(() => {
    process.env.PARALLEL_AGENTS = "0";
  });

  afterEach(() => {
    if (previousParallelAgents === undefined) {
      delete process.env.PARALLEL_AGENTS;
    } else {
      process.env.PARALLEL_AGENTS = previousParallelAgents;
    }
  });

  test("uses clientMessageId for emitted SSE events", async () => {
    const events: AgentEvent[] = [];
    const result = await runConductor(
      {
        message: "hello",
        clientMessageId: "msg-frontend-123",
        preferredMode: "local",
        userTier: "user",
        capabilityLevel: 100,
      },
      (ev) => events.push(ev)
    );

    expect(result.messageId).toBe("msg-frontend-123");
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((ev) => ev.messageId === "msg-frontend-123")).toBe(true);
  });

  test("normal mode plans exactly two local+remote agents in hybrid mode", () => {
    const plan = selectAgentPlan("general", "ช่วยสรุปข่าวนี้ให้หน่อย", {
      runMode: "normal",
      preferredMode: "hybrid",
      remoteAvailable: true,
    });

    expect(plan).toHaveLength(2);
    expect(plan.map((p) => p.kind)).toEqual(["local", "remote"]);
  });

  test("thinking mode can expand beyond two agents for complex prompts", () => {
    const plan = selectAgentPlan(
      "planning-broad",
      "ช่วยวางแผนเลือกจังหวัดสำหรับจัดสัมมนาหน้าฝนโดยดูอากาศ การเดินทาง งบประมาณ และความเสี่ยงให้ครบ",
      {
        runMode: "thinking",
        preferredMode: "hybrid",
        remoteAvailable: true,
      }
    );

    expect(plan.length).toBeGreaterThan(2);
  });

  test("final synthesis never promotes partial agent previews to final answer", () => {
    const text = synthesizeAnswer(
      {
        __partial_concierge: "นี่เป็น preview ที่ยังไม่ควรกลายเป็นคำตอบสุดท้าย",
      },
      "fallback ที่ครบถ้วนกว่า",
      { runMode: "normal" }
    );

    expect(text).toBe("fallback ที่ครบถ้วนกว่า");
  });
});
