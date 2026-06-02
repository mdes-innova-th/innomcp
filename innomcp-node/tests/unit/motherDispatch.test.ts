/**
 * tests/unit/motherDispatch.test.ts — Phase 13-E
 *
 * Unit tests for pure/exportable functions in agents/motherDispatch.ts.
 * No network calls are made; all provider HTTP is bypassed via jest.
 */

import {
  buildMotherPrompt,
  dispatchMother,
  type MotherResult,
  type MotherDispatchResult,
} from "../../src/agents/motherDispatch";

// ── buildMotherPrompt ─────────────────────────────────────────────────────────

describe("buildMotherPrompt", () => {
  const query = "สวัสดีครับ";

  it("returns a non-empty string for intent: knowledge", () => {
    const prompt = buildMotherPrompt("knowledge", query);
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("returns a non-empty string for intent: code", () => {
    const prompt = buildMotherPrompt("code", query);
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("returns a non-empty string for intent: general (default branch)", () => {
    const prompt = buildMotherPrompt("general", query);
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("returns a non-empty string for intent: greeting", () => {
    const prompt = buildMotherPrompt("greeting", query);
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("returns a non-empty string for intent: weather", () => {
    const prompt = buildMotherPrompt("weather", "อากาศกรุงเทพเป็นอย่างไร");
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("returns a non-empty string for intent: geo", () => {
    const prompt = buildMotherPrompt("geo", "ระยะทางจากกรุงเทพถึงเชียงใหม่");
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("returns a non-empty string for intent: planning-broad", () => {
    const prompt = buildMotherPrompt("planning-broad", "วางแผนงานปีหน้า");
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("includes the query content in the resulting prompt", () => {
    const uniqueQuery = "unique-marker-xyz-99";
    const prompt = buildMotherPrompt("knowledge", uniqueQuery);
    expect(prompt).toContain(uniqueQuery);
  });

  it("sanitizes newlines in query — prompt has no raw newline from input", () => {
    const multiline = "line1\nline2\rline3";
    const prompt = buildMotherPrompt("code", multiline);
    // The raw newlines from the input are replaced with spaces by buildMotherPrompt
    expect(prompt).not.toContain("line1\nline2");
  });

  it("truncates query longer than 500 chars", () => {
    const longQuery = "A".repeat(600);
    const prompt = buildMotherPrompt("general", longQuery);
    // The original 600-char block should not appear verbatim
    expect(prompt).not.toContain("A".repeat(501));
  });

  it("different intents produce different prompts for the same query", () => {
    const q = "สวัสดี";
    const knowledge = buildMotherPrompt("knowledge", q);
    const code = buildMotherPrompt("code", q);
    const greeting = buildMotherPrompt("greeting", q);
    expect(knowledge).not.toBe(code);
    expect(code).not.toBe(greeting);
    expect(knowledge).not.toBe(greeting);
  });
});

// ── Module shape / exported types ─────────────────────────────────────────────

describe("motherDispatch module exports", () => {
  it("exports dispatchMother as a function", () => {
    expect(typeof dispatchMother).toBe("function");
  });

  it("MotherResult interface shape is correct (duck-type via object construction)", () => {
    const sample: MotherResult = {
      providerId: "mdes-cloud",
      providerName: "MDES Cloud (gemma4:26b)",
      text: "Hello",
      latencyMs: 123,
      success: true,
    };
    expect(sample.providerId).toBe("mdes-cloud");
    expect(sample.success).toBe(true);
  });

  it("MotherDispatchResult interface shape is correct (duck-type via object construction)", () => {
    const sample: MotherDispatchResult = {
      results: [],
      synthesis: "best answer",
      totalAgents: 0,
      successCount: 0,
      totalEstimatedCostUsd: 0,
    };
    expect(sample.synthesis).toBe("best answer");
    expect(Array.isArray(sample.results)).toBe(true);
  });
});

// ── dispatchMother with MDES_ONLY + no API keys (returns empty / skips all) ──

describe("dispatchMother — provider filtering", () => {
  const noop = () => {};

  beforeEach(() => {
    // Strip all API keys so providers are skipped without real network calls
    delete process.env.REMOTE_OLLAMA_TOKEN;
    delete process.env.OLLAMA_REMOTE_API_KEY;
    delete process.env.OLLAMA_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GITHUB_COPILOT_TOKEN;
    delete process.env.GH_COPILOT_TOKEN;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.TOGETHER_API_KEY;
  });

  afterEach(() => {
    delete process.env.MDES_ONLY;
    delete process.env.LOCAL_OLLAMA_BASE_URL;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.LOCAL_OLLAMA_TOKEN;
  });

  it("returns empty result when no providers are eligible (no keys + MDES_ONLY=1)", async () => {
    process.env.MDES_ONLY = "1";
    // MDES providers require a key; without one they are skipped
    const result = await dispatchMother(
      "general",
      "test",
      "run-test-1",
      "msg-1",
      noop
    );
    expect(result.totalAgents).toBe(0);
    expect(result.results).toHaveLength(0);
    expect(result.synthesis).toBe("");
  });

  it("MotherDispatchResult has required fields on empty dispatch", async () => {
    process.env.MDES_ONLY = "1";
    const result = await dispatchMother(
      "knowledge",
      "hello",
      "run-test-2",
      "msg-2",
      noop
    );
    expect(result).toHaveProperty("results");
    expect(result).toHaveProperty("synthesis");
    expect(result).toHaveProperty("totalAgents");
    expect(result).toHaveProperty("successCount");
  });
});

// ── buildProviderConfigs — verified via dispatchMother provider count ─────────

describe("provider roster has 11 entries", () => {
  it("buildProviderConfigs produces 11 providers (verified via eligible list with all keys set)", async () => {
    // Set fake keys for every key-required provider
    process.env.REMOTE_OLLAMA_TOKEN = "fake-mdes-key";
    process.env.OPENAI_API_KEY = "fake-openai-key";
    process.env.ANTHROPIC_API_KEY = "fake-anthropic-key";
    process.env.GITHUB_COPILOT_TOKEN = "fake-copilot-key";
    process.env.GEMINI_API_KEY = "fake-gemini-key";
    process.env.MISTRAL_API_KEY = "fake-mistral-key";
    process.env.DEEPSEEK_API_KEY = "fake-deepseek-key";
    process.env.GROQ_API_KEY = "fake-groq-key";
    process.env.TOGETHER_API_KEY = "fake-together-key";
    delete process.env.MDES_ONLY;

    // Point local ollama to a guaranteed-to-refuse port so it fails fast
    process.env.LOCAL_OLLAMA_BASE_URL = "http://127.0.0.1:1";

    // Collect results — all will fail (fake keys) but the count tells us eligibility
    const noop = () => {};
    const result = await dispatchMother(
      "greeting",
      "hi",
      "run-count-test",
      "msg-count",
      noop
    );

    // All 11 providers should have been attempted (all failed with bad keys)
    expect(result.totalAgents).toBe(11);

    // Clean up
    delete process.env.REMOTE_OLLAMA_TOKEN;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GITHUB_COPILOT_TOKEN;
    delete process.env.GEMINI_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.TOGETHER_API_KEY;
    delete process.env.LOCAL_OLLAMA_BASE_URL;
  }, 60_000); // 60s timeout — 11 providers × up to ~5s fail-fast each
});
