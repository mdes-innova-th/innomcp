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

  // Phase 10.68 — normal mode: 1 fast concierge agent (ธรรมดา mode)
  test("normal mode uses exactly 1 concierge agent (fast, small model)", () => {
    process.env.OLLAMA_URL = "https://ollama.mdes-innova.online";

    const plan = selectAgentPlan("general", "สรุปข่าวนี้ให้หน่อย", {
      runMode: "normal",
      preferredMode: "hybrid",
      remoteAvailable: true,
    });

    expect(plan).toHaveLength(1);
    expect(plan[0].agentId).toBe("concierge");
    expect(plan[0].kind).toBe("remote"); // hybrid → remote when available
  });

  test("normal local mode stays at 1 local concierge agent", () => {
    const plan = selectAgentPlan("knowledge", "อธิบาย PDPA แบบสั้น", {
      runMode: "normal",
      preferredMode: "local",
      remoteAvailable: true,
    });

    expect(plan).toHaveLength(1);
    expect(plan[0].agentId).toBe("concierge");
    expect(plan[0].kind).toBe("local");
  });

  test("thinking mode expands to full multi-agent (MultiAgent mode)", () => {
    const normal = selectAgentPlan("planning-broad", "ช่วยวางแผนงานสัมมนาช่วงหน้าฝนและการเดินทาง", {
      runMode: "normal",
      preferredMode: "hybrid",
      remoteAvailable: true,
    });
    const thinking = selectAgentPlan("planning-broad", "ช่วยวางแผนงานสัมมนาช่วงหน้าฝนและการเดินทาง", {
      runMode: "thinking",
      preferredMode: "hybrid",
      remoteAvailable: true,
    });

    // normal = 1 agent, thinking = many
    expect(normal).toHaveLength(1);
    expect(thinking.length).toBeGreaterThan(1);
    expect(Math.min(...thinking.map((p) => p.timeoutMs))).toBeGreaterThan(
      Math.min(...normal.map((p) => p.timeoutMs))
    );
  });
});

describe("parallelDispatch synthesis", () => {
  test("normal mode lets authoritative tool output win", () => {
    const answer = synthesizeAnswer(
      {
        __tool__: "พยากรณ์อากาศจากเครื่องมือที่มีรายละเอียดครบถ้วน",
        concierge: "คำตอบจากโมเดล",
      },
      "fallback",
      { runMode: "normal" }
    );

    expect(answer).toBe("พยากรณ์อากาศจากเครื่องมือที่มีรายละเอียดครบถ้วน");
  });

  test("thinking mode combines tool output with analysis when both are available", () => {
    const answer = synthesizeAnswer(
      {
        __tool__: "พยากรณ์อากาศจากเครื่องมือที่มีรายละเอียดครบถ้วน",
        concierge: "ควรพกร่มและเลี่ยงกิจกรรมกลางแจ้งช่วงบ่ายเพราะฝนมีโอกาสสูง",
      },
      "fallback",
      { runMode: "thinking" }
    );

    expect(answer).toContain("พยากรณ์อากาศจากเครื่องมือ");
    expect(answer).toContain("สรุปเพิ่มเติมจากทีมวิเคราะห์");
  });
});
