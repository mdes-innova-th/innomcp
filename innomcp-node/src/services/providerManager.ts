// providerManager.ts
// Node 18+ has global fetch — no undici import needed

export interface ProviderConfig {
  id: string;
  name: string;
  type: 'mdes-ollama' | 'openai-compat' | 'anthropic' | 'custom';
  baseUrl: string;
  model: string;
  apiKey?: string;
  capabilities: string[];
  priority: number;       // higher = more preferred
  enabled: boolean;
  healthStatus: 'healthy' | 'degraded' | 'unknown';
  latencyMs?: number;
  lastChecked?: number;
}

export class ProviderManager {
  private providers: Map<string, ProviderConfig>;

  constructor() {
    this.providers = new Map();
    this.registerDefaultMDESPrimary();
  }

  /**
   * Register a new provider or update an existing one.
   * Throws if config is invalid.
   */
  async register(config: ProviderConfig): Promise<void> {
    if (!config.id || !config.baseUrl || !config.model) {
      throw new Error('Invalid provider config: id, baseUrl, and model are required');
    }
    // Merge with existing if any (keep existing health data if not provided)
    const existing = this.providers.get(config.id);
    if (existing) {
      this.providers.set(config.id, {
        ...existing,
        ...config,
        // Preserve last health check data if new config doesn't provide it
        healthStatus: config.healthStatus ?? existing.healthStatus,
        latencyMs: config.latencyMs ?? existing.latencyMs,
        lastChecked: config.lastChecked ?? existing.lastChecked,
      });
    } else {
      this.providers.set(config.id, {
        ...config,
        healthStatus: config.healthStatus ?? 'unknown',
        capabilities: config.capabilities ?? [],
        enabled: config.enabled ?? true,
        priority: config.priority ?? 0,
      });
    }
  }

  /**
   * Remove a provider by id.
   */
  async unregister(id: string): Promise<void> {
    this.providers.delete(id);
  }

  /**
   * Return all registered providers (shallow copies).
   */
  async getAll(): Promise<ProviderConfig[]> {
    return Array.from(this.providers.values()).map(p => ({ ...p }));
  }

  /**
   * Return the best enabled provider, optionally filtered by a capability.
   * Sorted by: priority (desc), health (healthy > degraded > unknown), latency (asc).
   */
  async getBest(capability?: string): Promise<ProviderConfig | undefined> {
    const enabled = Array.from(this.providers.values()).filter(p => p.enabled);
    if (enabled.length === 0) return undefined;

    let candidates = enabled;
    if (capability) {
      candidates = candidates.filter(p => p.capabilities.includes(capability));
      if (candidates.length === 0) return undefined;
    }

    candidates.sort((a, b) => {
      // priority descending
      if (a.priority !== b.priority) return b.priority - a.priority;

      // health status order: healthy -> degraded -> unknown
      const healthOrder = { healthy: 0, degraded: 1, unknown: 2 };
      const healthDiff = healthOrder[a.healthStatus] - healthOrder[b.healthStatus];
      if (healthDiff !== 0) return healthDiff;

      // latency ascending (undefined treated as Infinity)
      const latA = a.latencyMs ?? Infinity;
      const latB = b.latencyMs ?? Infinity;
      return latA - latB;
    });

    return { ...candidates[0] };
  }

  /**
   * Perform a health check on a provider by id.
   * Updates the provider's healthStatus, latencyMs, and lastChecked.
   * Returns health check result.
   */
  async checkHealth(id: string): Promise<{ healthy: boolean; latencyMs: number }> {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Provider ${id} not found`);
    }

    const timeoutMs = 10_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const start = Date.now();
    try {
      // Generic health endpoint (commonly /health or /v1/models)
      const url = new URL('/health', provider.baseUrl).toString();
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: provider.apiKey
          ? { Authorization: `Bearer ${provider.apiKey}` }
          : undefined,
      });

      clearTimeout(timeout);
      const latency = Date.now() - start;

      if (response.ok) {
        // Update provider
        provider.healthStatus = 'healthy';
        provider.latencyMs = latency;
        provider.lastChecked = Date.now();
        return { healthy: true, latencyMs: latency };
      } else {
        throw new Error(`Non-OK status: ${response.status}`);
      }
    } catch (err: any) {
      clearTimeout(timeout);
      const latency = Date.now() - start;
      provider.healthStatus = 'degraded';
      provider.latencyMs = latency;
      provider.lastChecked = Date.now();
      return { healthy: false, latencyMs: latency };
    }
  }

  /**
   * Check health of all registered providers and return updated configs.
   */
  async checkAllHealth(): Promise<ProviderConfig[]> {
    const ids = Array.from(this.providers.keys());
    await Promise.allSettled(ids.map(id => this.checkHealth(id)));
    return this.getAll();
  }

  /**
   * Return the primary MDES Ollama provider.
   * This provider is automatically registered in the constructor.
   */
  getMDESPrimary(): ProviderConfig {
    const primary = this.providers.get('mdes-primary-ollama');
    if (!primary) {
      throw new Error('MDES primary provider not found');
    }
    return { ...primary };
  }

  /**
   * Select the best provider for a given task type.
   * Maps tasks to capabilities for filtering.
   */
  async selectForTask(task: 'thai' | 'code' | 'reasoning' | 'fast' | 'general'): Promise<ProviderConfig> {
    const capabilityMap: Record<typeof task, string> = {
      thai: 'thai-language',
      code: 'code-generation',
      reasoning: 'reasoning',
      fast: 'low-latency',
      general: 'general-purpose',
    };

    const capability = capabilityMap[task];
    const best = await this.getBest(capability);
    if (!best) {
      // Fallback: no capability filter
      const fallback = await this.getBest();
      if (!fallback) throw new Error(`No available provider for task "${task}"`);
      return fallback;
    }
    return best;
  }

  /**
   * Register the built-in MDES primary provider (can be overridden later).
   */
  private registerDefaultMDESPrimary(): void {
    // Use environment variables or defaults for local Ollama by MDES
    const mdesBaseUrl = process.env.MDES_OLLAMA_URL || 'http://localhost:11434';
    const mdesModel = process.env.MDES_OLLAMA_MODEL || 'mdes-llm-v1';
    const config: ProviderConfig = {
      id: 'mdes-primary-ollama',
      name: 'MDES Ollama Primary',
      type: 'mdes-ollama',
      baseUrl: mdesBaseUrl,
      model: mdesModel,
      capabilities: ['thai-language', 'general-purpose', 'reasoning', 'code-generation', 'low-latency'],
      priority: 100,
      enabled: true,
      healthStatus: 'unknown',
    };
    this.providers.set(config.id, config);
  }
}

// Singleton instance
export const providerManager = new ProviderManager();