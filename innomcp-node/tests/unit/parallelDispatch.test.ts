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

  test("normal hybrid mode uses exactly two agents with local plus remote when available", () => {
    process.env.OLLAMA_URL = "https://ollama.mdes-innova.online";

    const plan = selectAgentPlan("general", "สรุปข่าวนี้ให้หน่อย", {
      runMode: "normal",
      preferredMode: "hybrid",
      remoteAvailable: true,
    });

    expect(plan).toHaveLength(2);
    expect(plan.map((p) => p.kind)).toEqual(["local", "remote"]);
  });

  test("normal local mode stays at two local agents", () => {
    const plan = selectAgentPlan("knowledge", "อธิบาย PDPA แบบสั้น", {
      runMode: "normal",
      preferredMode: "local",
      remoteAvailable: true,
    });

    expect(plan).toHaveLength(2);
    expect(plan.every((p) => p.kind === "local")).toBe(true);
  });

  test("thinking mode expands to full multi-agent logic with longer timeouts", () => {
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

    expect(normal).toHaveLength(2);
    expect(thinking.length).toBeGreaterThan(2);
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
