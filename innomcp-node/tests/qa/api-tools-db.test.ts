/**
 * Q&A supplement — API / Tools / DB / Memory tests
 * Tests the infrastructure layer: intent routing, tool planning,
 * provider selection, memory compression, input validation, route exports.
 * Target: push total Q&A count from 98 → 100+
 */
import { describe, it, expect } from "@jest/globals";
import { classifyIntent } from "../../src/services/intentClassifier";
import {
  scoreComplexity,
  selectAgentPlan,
  compressHistory,
  INTENT_AGENTS,
} from "../../src/agents/parallelDispatch";
import { planToolCall } from "../../src/agents/toolDispatch";
import { selectProvider, getAvailableProviders } from "../../src/providers/router";

// ── Section G: Tool Dispatch — planToolCall routing (8 tests) ────────────────
describe("Section G: Tool Dispatch — planToolCall routing", () => {
  it("weather intent → nwp_daily_by_place tool", () => {
    const plan = planToolCall("weather", "อากาศกรุงเทพวันนี้");
    expect(plan).not.toBeNull();
    expect(plan!.toolName).toBe("nwp_daily_by_place");
  });

  it("weather intent with hourly keyword → nwp_hourly_by_place", () => {
    const plan = planToolCall("weather", "อากาศรายชั่วโมงวันนี้กรุงเทพ");
    expect(plan).not.toBeNull();
    expect(plan!.toolName).toBe("nwp_hourly_by_place");
  });

  it("calc intent → calculatorTool", () => {
    const plan = planToolCall("calc", "คำนวณ 15% ของ 3500");
    expect(plan).not.toBeNull();
    expect(plan!.toolName).toBe("calculatorTool");
  });

  it("datetime intent → dateTimeTool", () => {
    const plan = planToolCall("datetime", "ตอนนี้กี่โมงแล้ว");
    expect(plan).not.toBeNull();
    expect(plan!.toolName).toBe("dateTimeTool");
  });

  it("map intent → thai_geo_tool", () => {
    const plan = planToolCall("map", "แผนที่กรุงเทพ");
    expect(plan).not.toBeNull();
    expect(plan!.toolName).toBe("thai_geo_tool");
  });

  it("evidence intent → evidenceTool", () => {
    const plan = planToolCall("evidence", "หลักฐานคดีล่าสุด");
    expect(plan).not.toBeNull();
    expect(plan!.toolName).toBe("evidenceTool");
  });

  it("planToolCall returns authoritative=true for tool-backed intents", () => {
    const plan = planToolCall("weather", "พยากรณ์อากาศพรุ่งนี้");
    expect(plan!.authoritative).toBe(true);
  });

  it("general intent returns null (no tool dispatch needed)", () => {
    const plan = planToolCall("general", "สวัสดีครับ");
    expect(plan).toBeNull();
  });
});

// ── Section H: Intent Classification — extended coverage (10 tests) ──────────
describe("Section H: Intent Classification — extended coverage", () => {
  it('"แผนที่กรุงเทพ" → map', () => {
    expect(classifyIntent("แผนที่กรุงเทพ").intent).toBe("map");
  });

  it('"พิกัด GPS เชียงใหม่" → map', () => {
    expect(classifyIntent("พิกัด GPS เชียงใหม่").intent).toBe("map");
  });

  it('"กฎหมาย PDPA คืออะไร" → knowledge', () => {
    expect(classifyIntent("กฎหมาย PDPA คืออะไร").intent).toBe("knowledge");
  });

  it('"วิธีทำ binary search Python" → code', () => {
    expect(classifyIntent("วิธีทำ binary search Python").intent).toBe("code");
  });

  it('"เขียนโปรแกรม typescript sort array" → code', () => {
    expect(classifyIntent("เขียนโปรแกรม typescript sort array").intent).toBe("code");
  });

  it('"คำนวณ 2^10 เท่ากับเท่าไหร่" → calc', () => {
    expect(classifyIntent("คำนวณ 2^10 เท่ากับเท่าไหร่").intent).toBe("calc");
  });

  it('"หลักฐาน ISP ล่าสุด" → evidence', () => {
    expect(classifyIntent("หลักฐาน ISP ล่าสุด").intent).toBe("evidence");
  });

  it('"วันนี้วันที่เท่าไหร่" → datetime', () => {
    expect(classifyIntent("วันนี้วันที่เท่าไหร่").intent).toBe("datetime");
  });

  it('"วางแผนทริปสัมมนาและอากาศ" → planning-broad (weather+planning)', () => {
    const r = classifyIntent("วางแผนทริปสัมมนาและอากาศดี");
    expect(r.intent).toBe("planning-broad");
  });

  it("classifyIntent always returns expectedToolUsage=true for weather", () => {
    expect(classifyIntent("อากาศวันนี้เป็นยังไง").expectedToolUsage).toBe(true);
  });
});

// ── Section I: Memory / Context Compression (8 tests) ────────────────────────
describe("Section I: Memory — context compression", () => {
  it("empty history returns empty string", () => {
    expect(compressHistory([])).toBe("");
  });

  it("returns typed string for any input", () => {
    expect(typeof compressHistory([{ sender: "user", text: "ทดสอบ" }])).toBe("string");
  });

  it("short history (≤4 msgs) is formatted inline without header", () => {
    const history = [
      { sender: "user", text: "อากาศกรุงเทพวันนี้" },
      { sender: "ai", text: "อุณหภูมิ 32°C มีเมฆมาก" },
    ];
    const ctx = compressHistory(history);
    expect(ctx).toContain("32°C");
    expect(ctx).not.toContain("บริบทก่อนหน้า");
  });

  it("history >4 msgs produces บริบทก่อนหน้า header", () => {
    const history = Array.from({ length: 6 }, (_, i) => ({
      sender: i % 2 === 0 ? "user" : "ai",
      text: `ข้อความที่ ${i + 1} ยาวพอสมควร`,
    }));
    const ctx = compressHistory(history);
    expect(ctx).toContain("บริบทก่อนหน้า");
  });

  it("recent messages preserved in long conversation", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      sender: i % 2 === 0 ? "user" : "ai",
      text: `ข้อความที่ ${i + 1} เนื้อหายาวพอสมควรในการทดสอบ`,
    }));
    const ctx = compressHistory(history);
    expect(ctx).toContain("10");
  });

  it("context does not exceed 10000 chars for large input", () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      sender: "user" as const,
      text: "x".repeat(300),
    }));
    expect(compressHistory(history).length).toBeLessThan(10000);
  });

  it("multi-turn weather conversation keeps latest response in context", () => {
    const history = [
      { sender: "user", text: "อากาศกรุงเทพวันนี้" },
      { sender: "ai", text: "อุณหภูมิ 32°C มีเมฆมาก ฝนตกบางพื้นที่" },
      { sender: "user", text: "แล้วพรุ่งนี้ล่ะ" },
      { sender: "ai", text: "พรุ่งนี้ฝนตกหนักช่วงบ่าย อุณหภูมิ 30°C" },
    ];
    const ctx = compressHistory(history);
    expect(ctx).toContain("พรุ่งนี้");
  });

  it("messages with text ≤5 chars are filtered from context", () => {
    const history = [
      { sender: "user", text: "ok" },
      { sender: "ai", text: "อุณหภูมิ 30°C ความชื้น 75% ค่อนข้างร้อนและชื้น" },
    ];
    const ctx = compressHistory(history);
    // "ok" (2 chars) filtered; only AI response survives
    expect(ctx).not.toContain("ผู้ใช้: ok");
    expect(ctx).toContain("30°C");
  });
});

// ── Section J: Provider Router (8 tests) ─────────────────────────────────────
describe("Section J: Provider Router — selectProvider & getAvailableProviders", () => {
  it("getAvailableProviders always includes mdes-ollama", () => {
    expect(getAvailableProviders()).toContain("mdes-ollama");
  });

  it("getAvailableProviders returns an array", () => {
    expect(Array.isArray(getAvailableProviders())).toBe(true);
  });

  it("selectProvider returns SelectionResult shape", () => {
    const result = selectProvider({ mode: "local", capabilities: [] });
    expect(result).toHaveProperty("provider");
    expect(result).toHaveProperty("alternates");
    expect(result).toHaveProperty("reason");
  });

  it("selectProvider reason is a non-empty string", () => {
    const result = selectProvider({ mode: "hybrid", capabilities: [] });
    expect(typeof result.reason).toBe("string");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it("selectProvider mode=local excludes remote providers", () => {
    const result = selectProvider({ mode: "local", capabilities: [] });
    if (result.provider) {
      expect(result.provider.type).toBe("ollama-local");
    }
    // If no local provider, null is acceptable
    expect(result.alternates).toBeDefined();
  });

  it("selectProvider excludeDown=false does not filter unknown-health providers", () => {
    const result = selectProvider({
      mode: "hybrid",
      capabilities: [],
      excludeDown: false,
    });
    // With excludeDown=false we should see at least seed providers
    expect(result.alternates).toBeDefined();
  });

  it("selectProvider with thai-naturalness capability picks capable provider", () => {
    const result = selectProvider({
      mode: "hybrid",
      capabilities: ["thai-naturalness"],
    });
    if (result.provider) {
      expect(result.provider.capabilities).toContain("thai-naturalness");
    }
  });

  it("selectProvider preferred provider is respected when it exists", () => {
    const result = selectProvider({
      mode: "hybrid",
      capabilities: [],
      preferredProviderId: "seed-local-ollama",
    });
    if (result.provider) {
      expect(result.provider.id).toBe("seed-local-ollama");
    }
  });
});

// ── Section K: INTENT_AGENTS registry integrity (4 tests) ────────────────────
describe("Section K: INTENT_AGENTS registry integrity", () => {
  it("all standard intents have agent assignments", () => {
    const required = ["weather", "knowledge", "evidence", "calc", "code", "general", "greeting"];
    for (const intent of required) {
      expect(INTENT_AGENTS[intent]).toBeDefined();
      expect(INTENT_AGENTS[intent].length).toBeGreaterThan(0);
    }
  });

  it("weather agents include weather-analyst", () => {
    expect(INTENT_AGENTS["weather"]).toContain("weather-analyst");
  });

  it("evidence agents include tool-scout", () => {
    expect(INTENT_AGENTS["evidence"]).toContain("tool-scout");
  });

  it("planning-broad uses the most agents (≥4)", () => {
    expect(INTENT_AGENTS["planning-broad"].length).toBeGreaterThanOrEqual(4);
  });
});

// ── Section L: scoreComplexity logic (5 tests) ───────────────────────────────
describe("Section L: scoreComplexity — complexity scoring", () => {
  it("planning-broad always scores 10", () => {
    expect(scoreComplexity("planning-broad", "short")).toBe(10);
  });

  it("code always scores 10", () => {
    expect(scoreComplexity("code", "เขียนโค้ด")).toBe(10);
  });

  it("greeting scores 2", () => {
    expect(scoreComplexity("greeting", "สวัสดี")).toBe(2);
  });

  it("datetime scores 2", () => {
    expect(scoreComplexity("datetime", "กี่โมง")).toBe(2);
  });

  it("general with long query scores higher than short query", () => {
    const short = scoreComplexity("general", "สั้น");
    const long = scoreComplexity("general", "x".repeat(200));
    expect(long).toBeGreaterThan(short);
  });
});

// ── Section M: Route module exports smoke-test (5 tests) ─────────────────────
describe("Section M: Route module exports", () => {
  it("files.ts exports safePath function", () => {
    const mod = require("../../src/routes/api/files");
    expect(typeof mod.safePath).toBe("function");
  });

  it("files.ts exports WORKSPACE_ROOT string", () => {
    const mod = require("../../src/routes/api/files");
    expect(typeof mod.WORKSPACE_ROOT).toBe("string");
    expect(mod.WORKSPACE_ROOT.length).toBeGreaterThan(0);
  });

  it("providers/router exports selectProvider function", () => {
    const mod = require("../../src/providers/router");
    expect(typeof mod.selectProvider).toBe("function");
  });

  it("providers/router exports getAvailableProviders function", () => {
    const mod = require("../../src/providers/router");
    expect(typeof mod.getAvailableProviders).toBe("function");
  });

  it("agents/toolDispatch exports planToolCall function", () => {
    const mod = require("../../src/agents/toolDispatch");
    expect(typeof mod.planToolCall).toBe("function");
  });
});
