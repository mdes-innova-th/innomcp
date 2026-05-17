jest.mock("../../src/agents/toolDispatch", () => ({
  dispatchTool: jest.fn(async () => undefined),
  planToolCalls: jest.fn((intent: string) => {
    if (intent === "weather") {
      return [{
        toolName: "nwp_daily_by_place",
        args: { province: "เชียงใหม่" },
        reason: "weather intent",
        authoritative: true,
      }];
    }
    return [];
  }),
}));

import { runConductor } from "../../src/agents/conductor";
import { sessionMemory } from "../../src/services/sessionMemory";

describe("runConductor session memory", () => {
  const previousParallelAgents = process.env.PARALLEL_AGENTS;

  beforeEach(() => {
    process.env.PARALLEL_AGENTS = "0";
    sessionMemory.clear("session-memory-weather");
  });

  afterEach(() => {
    sessionMemory.clear("session-memory-weather");
    if (previousParallelAgents === undefined) {
      delete process.env.PARALLEL_AGENTS;
    } else {
      process.env.PARALLEL_AGENTS = previousParallelAgents;
    }
  });

  test("records a turn and reroutes ambiguous follow-up from session memory", async () => {
    await runConductor(
      {
        message: "อากาศเชียงใหม่วันนี้",
        sessionId: "session-memory-weather",
        preferredMode: "local",
        userTier: "user",
        capabilityLevel: 100,
      },
      () => undefined
    );

    const snapshot = sessionMemory.getSnapshot("session-memory-weather");
    expect(snapshot.activeDomain).toBe("weather");

    const followUp = await runConductor(
      {
        message: "แล้วพรุ่งนี้ล่ะ",
        sessionId: "session-memory-weather",
        preferredMode: "local",
        userTier: "user",
        capabilityLevel: 100,
      },
      () => undefined
    );

    expect(followUp.intent).toBe("weather");
  });
});