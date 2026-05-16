import { selectAgentPlan, synthesizeAnswer } from "../../src/agents/parallelDispatch";

describe("parallelDispatch agent planning", () => {
  const oldRemoteUrl = process.env.OLLAMA_URL;

  afterEach(() => {
    if (oldRemoteUrl === undefined) {
      delete process.env.OLLAMA_URL;
    } else {
      process.env.OLLAMA_URL = oldRemoteUrl;
    }
  });

  test("normal mode uses exactly 2 agents in local+remote hybrid", () => {
    process.env.OLLAMA_URL = "https://ollama.mdes-innova.online";

    const plan = selectAgentPlan("general", "summarize this news", {
      runMode: "normal",
      preferredMode: "hybrid",
      remoteAvailable: true,
    });

    expect(plan).toHaveLength(2);
    expect(plan.map((p) => p.agentId)).toEqual(["concierge", "critic"]);
    expect(plan.map((p) => p.kind)).toEqual(["local", "remote"]);
  });

  test("normal local mode keeps 2 local agents", () => {
    const plan = selectAgentPlan("knowledge", "explain PDPA briefly", {
      runMode: "normal",
      preferredMode: "local",
      remoteAvailable: true,
    });

    expect(plan).toHaveLength(2);
    expect(plan.map((p) => p.agentId)).toEqual(["rag-agent", "concierge"]);
    expect(plan.map((p) => p.kind)).toEqual(["local", "local"]);
  });

  test("thinking mode expands to full multi-agent (MultiAgent mode)", () => {
    const query = "plan a rainy-season seminar with travel constraints";
    const normal = selectAgentPlan("planning-broad", query, {
      runMode: "normal",
      preferredMode: "hybrid",
      remoteAvailable: true,
    });
    const thinking = selectAgentPlan("planning-broad", query, {
      runMode: "thinking",
      preferredMode: "hybrid",
      remoteAvailable: true,
    });

    expect(normal).toHaveLength(2);
    expect(thinking.length).toBeGreaterThan(normal.length);
    expect(thinking.some((p) => !normal.some((n) => n.agentId === p.agentId))).toBe(true);
  });
});

describe("parallelDispatch synthesis", () => {
  test("normal mode lets authoritative tool output win", () => {
    const answer = synthesizeAnswer(
      {
        __tool__: "Weather tool result with complete authoritative details.",
        concierge: "Model answer",
      },
      "fallback",
      { runMode: "normal" }
    );

    expect(answer).toBe("Weather tool result with complete authoritative details.");
  });

  test("thinking mode combines tool output with analysis when both are available", () => {
    const answer = synthesizeAnswer(
      {
        __tool__: "Weather tool result with complete authoritative details.",
        concierge: "Bring an umbrella and avoid outdoor activities in the afternoon because rain risk is high.",
      },
      "fallback",
      { runMode: "thinking" }
    );

    expect(answer).toContain("Weather tool result");
    expect(answer).toContain("สรุปเพิ่มเติมจากทีมวิเคราะห์");
  });
});
