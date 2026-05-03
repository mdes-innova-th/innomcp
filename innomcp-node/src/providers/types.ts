/**
 * providers/types.ts — Phase C provider registry shape
 *
 * Reference: docs/brain/SECOND_BRAIN.md (provider registry shape)
 *
 * Hard rule: API keys NEVER appear in any GET/list response. The wire
 * shape only ever carries `hasApiKey: boolean`. Storage uses either
 * `apiKeyRef` (env-var name, safe to log) or `apiKeyEncrypted` (opaque
 * blob, redacted from logs).
 */

export type ProviderType =
  | "ollama-local"
  | "ollama-remote"
  | "openai-compatible"
  | "anthropic-compatible"
  | "custom";

export type Capability =
  | "thai-naturalness"
  | "code"
  | "vision"
  | "long-context"
  | "tool-use"
  | "fast-cheap"
  | "hard-reasoning"
  | "grounding-critic";

export type PrivacyLevel = "public" | "internal" | "confidential";

export type HealthStatus = "unknown" | "healthy" | "degraded" | "down";

/** Internal record stored in the registry. Never leaves the backend. */
export interface ProviderRecord {
  id: string;
  displayName: string;
  type: ProviderType;
  baseUrl: string;
  /** Name of the env var that holds the API key (preferred). */
  apiKeyRef?: string;
  /** Encrypted API key blob (fallback when env-var ref is not set). */
  apiKeyEncrypted?: string;
  model: string;
  capabilities: Capability[];
  priority: number;
  enabled: boolean;
  privacyLevel: PrivacyLevel;
  timeoutMs: number;
  maxTokens?: number;
  temperature?: number;
  healthStatus: HealthStatus;
  lastHealthCheckAt?: string;
}

/** Wire-safe view returned by GET /api/ai/providers and similar endpoints. */
export interface ProviderPublicView {
  id: string;
  displayName: string;
  type: ProviderType;
  baseUrl: string;
  hasApiKey: boolean;
  model: string;
  capabilities: Capability[];
  priority: number;
  enabled: boolean;
  privacyLevel: PrivacyLevel;
  timeoutMs: number;
  maxTokens?: number;
  temperature?: number;
  healthStatus: HealthStatus;
  lastHealthCheckAt?: string;
}

/** Project to public view — drops both apiKeyRef and apiKeyEncrypted. */
export function toPublicView(p: ProviderRecord): ProviderPublicView {
  return {
    id: p.id,
    displayName: p.displayName,
    type: p.type,
    baseUrl: p.baseUrl,
    hasApiKey: Boolean(p.apiKeyRef || p.apiKeyEncrypted),
    model: p.model,
    capabilities: [...p.capabilities],
    priority: p.priority,
    enabled: p.enabled,
    privacyLevel: p.privacyLevel,
    timeoutMs: p.timeoutMs,
    maxTokens: p.maxTokens,
    temperature: p.temperature,
    healthStatus: p.healthStatus,
    lastHealthCheckAt: p.lastHealthCheckAt,
  };
}

/** Input shape for create/update. apiKeyRef preferred over apiKey. */
export interface ProviderUpsertInput {
  displayName: string;
  type: ProviderType;
  baseUrl: string;
  apiKeyRef?: string;
  apiKeyEncrypted?: string;
  model: string;
  capabilities: Capability[];
  priority?: number;
  enabled?: boolean;
  privacyLevel?: PrivacyLevel;
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Validation result for upsert input. Returns null if the input is well-
 * formed, or a string explaining the first issue.
 */
export function validateUpsertInput(input: unknown): string | null {
  if (!input || typeof input !== "object") return "body is not an object";
  const i = input as Record<string, unknown>;
  if (typeof i.displayName !== "string" || (i.displayName as string).trim().length === 0) {
    return "displayName required";
  }
  const allowedTypes: ProviderType[] = [
    "ollama-local",
    "ollama-remote",
    "openai-compatible",
    "anthropic-compatible",
    "custom",
  ];
  if (!allowedTypes.includes(i.type as ProviderType)) return "type invalid";
  if (typeof i.baseUrl !== "string" || !/^https?:\/\//.test(i.baseUrl as string)) {
    return "baseUrl must start with http:// or https://";
  }
  if (typeof i.model !== "string" || (i.model as string).length === 0) {
    return "model required";
  }
  if (!Array.isArray(i.capabilities) || (i.capabilities as unknown[]).length === 0) {
    return "capabilities must be a non-empty array";
  }
  return null;
}
