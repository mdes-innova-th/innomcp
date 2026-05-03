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

  return seeds;
}

/** Hydrate the registry with seed entries (idempotent). */
export function ensureSeeded(): void {
  if (registry.size > 0) return;
  for (const p of buildSeed()) registry.set(p.id, p);
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
