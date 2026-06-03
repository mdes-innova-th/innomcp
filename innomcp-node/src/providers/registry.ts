/**
 * providers/registry.ts — Phase C in-memory provider registry
 *
 * Boot-time hydration: starts with a built-in seed of the local Ollama
 * provider and (optionally) the MDES remote endpoint. DB-backed
 * persistence is wired in C-2.5 once the `ai_provider` migration lands;
 * for now this is a pure in-memory map so the route can be exercised
 * end-to-end without a schema change.
 *
 * Hard rule: this module never logs apiKeyEncrypted. Logs may include
 * apiKeyRef (it's a name, not a secret).
 */

import { randomUUID } from "node:crypto";
import type {
  ProviderRecord,
  ProviderUpsertInput,
  ProviderType,
} from "./types";
import { validateUpsertInput } from "./types";

const registry = new Map<string, ProviderRecord>();

function nowIso(): string {
  return new Date().toISOString();
}

function buildSeed(): ProviderRecord[] {
  const seeds: ProviderRecord[] = [];

  // Local Ollama — always present
  seeds.push({
    id: "seed-local-ollama",
    displayName: "Local Ollama (innomcp)",
    type: "ollama-local",
    baseUrl: process.env.OLLAMA_LOCAL_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_LOCAL_DEFAULT_MODEL || "minimax-m2.5:cloud",
    capabilities: ["thai-naturalness", "tool-use", "fast-cheap"],
    priority: 90,
    enabled: true,
    privacyLevel: "internal",
    timeoutMs: 60_000,
    healthStatus: "unknown",
  });

  // Remote MDES Ollama — optional (only seeded if URL env present)
  const mdesUrl =
    process.env.OLLAMA_REMOTE_BASE_URL || "https://ollama.mdes-innova.online";
  if (mdesUrl) {
    seeds.push({
      id: "seed-mdes-ollama",
      displayName: "MDES Remote Ollama",
      type: "ollama-remote",
      baseUrl: mdesUrl.replace(/\/$/, ""),
      apiKeyRef: process.env.OLLAMA_REMOTE_API_KEY_REF || undefined,
      model: process.env.OLLAMA_REMOTE_DEFAULT_MODEL || "gpt-oss:120b-cloud",
      capabilities: ["thai-naturalness", "hard-reasoning", "long-context", "grounding-critic"],
      priority: 70,
      enabled: true,
      privacyLevel: "internal",
      timeoutMs: 90_000,
      healthStatus: "unknown",
    });
  }

  // GPT-4o-mini (OpenAI) — optional (only seeded if OPENAI_API_KEY is present)
  if (process.env.OPENAI_API_KEY) {
    seeds.push({
      id: "seed-gpt-4o-mini",
      displayName: "GPT-4o-mini (OpenAI)",
      type: "openai-compatible",
      baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
      apiKeyRef: "OPENAI_API_KEY",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      capabilities: ["code", "tool-use", "fast-cheap"],
      priority: 60,
      enabled: true,
      privacyLevel: "internal",
      timeoutMs: 30_000,
      healthStatus: "unknown",
    });

    seeds.push({
      id: "seed-gpt-4o-full",
      displayName: "GPT-4o (Full)",
      type: "openai-compatible",
      baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
      apiKeyRef: "OPENAI_API_KEY",
      model: "gpt-4o",
      capabilities: ["tool-use", "general-purpose", "fast-cheap"],
      priority: 70,
      enabled: true,
      privacyLevel: "internal",
      timeoutMs: 60_000,
      healthStatus: "unknown",
    });
  }

  // GitHub Copilot — optional (only seeded if GITHUB_COPILOT_TOKEN is present)
  if (process.env.GITHUB_COPILOT_TOKEN) {
    seeds.push({
      id: "seed-github-copilot",
      displayName: "GitHub Copilot",
      type: "openai-compatible",
      baseUrl: (process.env.COPILOT_BASE_URL || "https://api.githubcopilot.com").replace(/\/$/, ""),
      apiKeyRef: "GITHUB_COPILOT_TOKEN",
      model: process.env.COPILOT_MODEL || "gpt-4o",
      capabilities: ["code", "tool-use", "hard-reasoning"],
      priority: 65,
      enabled: true,
      privacyLevel: "internal",
      timeoutMs: 45_000,
      healthStatus: "unknown",
    });
  }

  // Claude Haiku + Claude Sonnet + Claude Opus — all seeded if ANTHROPIC_API_KEY is present
  if (process.env.ANTHROPIC_API_KEY) {
    seeds.push({
      id: "seed-claude-haiku",
      displayName: "Claude Haiku 4.5",
      type: "anthropic-compatible",
      baseUrl: (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, ""),
      apiKeyRef: "ANTHROPIC_API_KEY",
      model: process.env.CLAUDE_HAIKU_MODEL || "claude-haiku-4-5-20251001",
      capabilities: ["thai-naturalness", "fast-cheap", "tool-use"],
      priority: 75,
      enabled: true,
      privacyLevel: "internal",
      timeoutMs: 20_000,
      healthStatus: "unknown",
    });

    seeds.push({
      id: "seed-claude-sonnet",
      displayName: "Claude Sonnet 4.6",
      type: "anthropic-compatible",
      baseUrl: (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, ""),
      apiKeyRef: "ANTHROPIC_API_KEY",
      model: process.env.CLAUDE_SONNET_MODEL || "claude-sonnet-4-6",
      capabilities: ["hard-reasoning", "long-context", "code", "tool-use"],
      priority: 80,
      enabled: true,
      privacyLevel: "internal",
      timeoutMs: 60_000,
      healthStatus: "unknown",
    });

    seeds.push({
      id: "seed-claude-opus-4.8",
      displayName: "Claude Opus 4.8 (Ultra)",
      type: "anthropic-compatible",
      baseUrl: (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, ""),
      apiKeyRef: "ANTHROPIC_API_KEY",
      model: "claude-opus-4.8",
      capabilities: ["ultra-reasoning", "complex-architecture", "code-review"],
      priority: 100,
      enabled: true,
      privacyLevel: "internal",
      timeoutMs: 60_000,
      healthStatus: "unknown",
    });
  }

  // DeepSeek R1 — optional (only seeded if DEEPSEEK_API_KEY is present)
  if (process.env.DEEPSEEK_API_KEY) {
    seeds.push({
      id: "seed-deepseek-r1",
      displayName: "DeepSeek R1 (Reasoning)",
      type: "openai-compatible",
      baseUrl: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, ""),
      apiKeyRef: "DEEPSEEK_API_KEY",
      model: "deepseek-reasoner",
      capabilities: ["hard-reasoning", "code", "math"],
      priority: 85,
      enabled: true,
      privacyLevel: "internal",
      timeoutMs: 90_000,
      healthStatus: "unknown",
    });
  }

  // Gemini 1.5 Pro — optional (only seeded if GEMINI_API_KEY is present)
  if (process.env.GEMINI_API_KEY) {
    seeds.push({
      id: "seed-gemini-1.5-pro",
      displayName: "Gemini 1.5 Pro (Google)",
      type: "custom",
      baseUrl: (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, ""),
      apiKeyRef: "GEMINI_API_KEY",
      model: "gemini-1.5-pro",
      capabilities: ["long-context", "multimodal", "thai-naturalness"],
      priority: 80,
      enabled: true,
      privacyLevel: "internal",
      timeoutMs: 60_000,
      healthStatus: "unknown",
    });
  }

  // ThaiLLM Specialist — optional (only seeded if THAI_LLM_API_KEY is present)
  if (process.env.THAI_LLM_API_KEY) {
    seeds.push({
      id: "seed-thai-llm-specialist",
      displayName: "ThaiLLM Specialist",
      type: "ollama-remote",
      baseUrl: (process.env.OLLAMA_REMOTE_BASE_URL || "https://ollama.mdes-innova.online").replace(/\/$/, ""),
      apiKeyRef: "THAI_LLM_API_KEY",
      model: "thai-llm-v2",
      capabilities: ["thai-naturalness", "culture-aware"],
      priority: 95,
      enabled: true,
      privacyLevel: "internal",
      timeoutMs: 60_000,
      healthStatus: "unknown",
    });
  }

  return seeds;
}

/** Hydrate the registry with seed entries (idempotent). */
export function ensureSeeded(): void {
  if (registry.size > 0) return;
  for (const p of buildSeed()) registry.set(p.id, p);
}

/**
 * Public API for boot-time hydration of the provider store.
 * Wraps ensureSeeded to provide a semantic 'hydrateStore' interface.
 */
export function hydrateStore(): void {
  ensureSeeded();
}


ensureSeeded();

export function listProviders(): ProviderRecord[] {
  return Array.from(registry.values()).sort((a, b) => b.priority - a.priority);
}

export function getProvider(id: string): ProviderRecord | undefined {
  return registry.get(id);
}

export function createProvider(input: ProviderUpsertInput): ProviderRecord {
  const issue = validateUpsertInput(input);
  if (issue) throw new Error(`invalid provider input: ${issue}`);
  const id = randomUUID();
  const rec: ProviderRecord = {
    id,
    displayName: input.displayName.trim(),
    type: input.type,
    baseUrl: input.baseUrl.replace(/\/$/, ""),
    apiKeyRef: input.apiKeyRef,
    apiKeyEncrypted: input.apiKeyEncrypted,
    model: input.model,
    capabilities: [...input.capabilities],
    priority: input.priority ?? 50,
    enabled: input.enabled ?? true,
    privacyLevel: input.privacyLevel ?? "internal",
    timeoutMs: input.timeoutMs ?? 60_000,
    maxTokens: input.maxTokens,
    temperature: input.temperature,
    healthStatus: "unknown",
    lastHealthCheckAt: undefined,
  };
  registry.set(id, rec);
  return rec;
}

export function updateProvider(
  id: string,
  patch: Partial<ProviderUpsertInput>
): ProviderRecord | undefined {
  const cur = registry.get(id);
  if (!cur) return undefined;
  const merged: ProviderRecord = {
    ...cur,
    ...patch,
    capabilities: patch.capabilities
      ? [...patch.capabilities]
      : cur.capabilities,
    baseUrl: patch.baseUrl ? patch.baseUrl.replace(/\/$/, "") : cur.baseUrl,
  };
  registry.set(id, merged);
  return merged;
}

export function deleteProvider(id: string): boolean {
  return registry.delete(id);
}

export function setHealth(
  id: string,
  status: ProviderRecord["healthStatus"]
): void {
  const rec = registry.get(id);
  if (!rec) return;
  rec.healthStatus = status;
  rec.lastHealthCheckAt = nowIso();
  registry.set(id, rec);
}

/** Resolve the API key VALUE for runtime use. Never returns it via API. */
export function resolveApiKey(id: string): string | undefined {
  const rec = registry.get(id);
  if (!rec) return undefined;
  if (rec.apiKeyRef) {
    const v = process.env[rec.apiKeyRef];
    return v && v.length > 0 ? v : undefined;
  }
  // Encrypted-at-rest decryption is out of scope for this slice; treat as not-decrypted.
  return undefined;
}

/**
 * Internal helper for tests: clear registry. Only exposed for unit tests
 * that want to assert seed/hydrate behavior. Not used in production
 * code.
 */
export function _resetForTests(): void {
  registry.clear();
}

export type { ProviderType };
