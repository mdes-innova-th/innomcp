/**
 * providerRouter.test.ts — Phase C provider broker
 */

import {
  ensureSeeded,
  _resetForTests,
  createProvider,
  setHealth,
  listProviders,
} from "../../src/providers/registry";
import { selectProvider, previewSelection } from "../../src/providers/router";
import { toPublicView } from "../../src/providers/types";

beforeEach(() => {
  _resetForTests();
  ensureSeeded();
});

describe("provider router (selectProvider)", () => {
  test("local mode picks the seeded local Ollama for thai-naturalness", () => {
    const r = selectProvider({
      mode: "local",
      capabilities: ["thai-naturalness"],
    });
    expect(r.provider?.id).toBe("seed-local-ollama");
    expect(r.reason).toMatch(/Local Ollama/);
  });

  test("remote mode skips local Ollama", () => {
    const r = selectProvider({
      mode: "remote",
      capabilities: ["hard-reasoning"],
    });
    expect(r.provider?.type).not.toBe("ollama-local");
  });

  test("hybrid mode considers everything", () => {
    const r = selectProvider({
      mode: "hybrid",
      capabilities: ["thai-naturalness"],
    });
    expect(r.provider).not.toBeNull();
  });

  test("excludes providers marked down", () => {
    setHealth("seed-local-ollama", "down");
    const r = selectProvider({
      mode: "local",
      capabilities: ["thai-naturalness"],
    });
    expect(r.provider?.id).not.toBe("seed-local-ollama");
  });

  test("higher priority wins for equal capability fit", () => {
    const created = createProvider({
      displayName: "Local-99",
      type: "ollama-local",
      baseUrl: "http://localhost:9999",
      model: "test-model",
      capabilities: ["thai-naturalness"],
      priority: 99,
    });
    const r = selectProvider({
      mode: "local",
      capabilities: ["thai-naturalness"],
    });
    expect(r.provider?.id).toBe(created.id);
  });

  test("capability fit beats unrelated high priority providers", () => {
    const unrelated = createProvider({
      displayName: "Local-unrelated-high-priority",
      type: "ollama-local",
      baseUrl: "http://localhost:9994",
      model: "unrelated-model",
      capabilities: ["fast-cheap"],
      priority: 999,
    });
    const r = selectProvider({
      mode: "local",
      capabilities: ["thai-naturalness"],
    });
    expect(r.provider?.id).not.toBe(unrelated.id);
    expect(r.provider?.capabilities).toContain("thai-naturalness");
  });

  test("returns alternates in priority order", () => {
    const lowPri = createProvider({
      displayName: "Local-low",
      type: "ollama-local",
      baseUrl: "http://localhost:9998",
      model: "test-low",
      capabilities: ["thai-naturalness"],
      priority: 10,
    });
    const r = selectProvider({
      mode: "local",
      capabilities: ["thai-naturalness"],
    });
    expect(r.alternates.map((p) => p.id)).toContain(lowPri.id);
  });

  test("honors preferredProviderId when the provider is eligible", () => {
    const preferred = createProvider({
      displayName: "Local-preferred",
      type: "ollama-local",
      baseUrl: "http://localhost:9997",
      model: "preferred-model",
      capabilities: ["thai-naturalness"],
      priority: 1,
    });
    const r = selectProvider({
      mode: "local",
      capabilities: ["thai-naturalness"],
      preferredProviderId: preferred.id,
    });
    expect(r.provider?.id).toBe(preferred.id);
    expect(r.reason).toMatch(/provider/);
  });

  test("ignores preferredProviderId when the provider is down", () => {
    const preferred = createProvider({
      displayName: "Local-down-preferred",
      type: "ollama-local",
      baseUrl: "http://localhost:9996",
      model: "down-model",
      capabilities: ["thai-naturalness"],
      priority: 99,
    });
    setHealth(preferred.id, "down");
    const r = selectProvider({
      mode: "local",
      capabilities: ["thai-naturalness"],
      preferredProviderId: preferred.id,
    });
    expect(r.provider?.id).not.toBe(preferred.id);
  });

  test("ignores preferredProviderId when capabilities do not match", () => {
    const preferred = createProvider({
      displayName: "Local-no-capability-match",
      type: "ollama-local",
      baseUrl: "http://localhost:9995",
      model: "no-match-model",
      capabilities: ["fast-cheap"],
      priority: 999,
    });
    const r = selectProvider({
      mode: "local",
      capabilities: ["thai-naturalness"],
      preferredProviderId: preferred.id,
    });
    expect(r.provider?.id).not.toBe(preferred.id);
    expect(r.provider?.capabilities).toContain("thai-naturalness");
  });
});

describe("provider broker preview", () => {
  test("returns selected + fallbackChain + Thai reason", () => {
    const r = previewSelection({
      mode: "local",
      capabilities: ["thai-naturalness"],
    });
    expect(r.selected?.id).toBe("seed-local-ollama");
    expect(Array.isArray(r.fallbackChain)).toBe(true);
    expect(r.reason).toMatch(/เลือก/);
  });
});

describe("provider public view (no secret leakage)", () => {
  test("toPublicView never includes apiKeyEncrypted or apiKeyRef", () => {
    const created = createProvider({
      displayName: "Has-secret",
      type: "openai-compatible",
      baseUrl: "https://api.example.com",
      apiKeyEncrypted: "ciphertextblob",
      apiKeyRef: "MY_SECRET_ENV",
      model: "gpt-4o-mini",
      capabilities: ["fast-cheap"],
    });
    const view = toPublicView(created);
    expect(view).not.toHaveProperty("apiKeyEncrypted");
    expect(view).not.toHaveProperty("apiKeyRef");
    expect(view).not.toHaveProperty("apiKey");
    expect(view.hasApiKey).toBe(true);
  });

  test("hasApiKey is false when neither apiKeyRef nor apiKeyEncrypted is set", () => {
    const seed = listProviders().find((p) => p.id === "seed-local-ollama")!;
    const view = toPublicView(seed);
    expect(view.hasApiKey).toBe(false);
  });
});
