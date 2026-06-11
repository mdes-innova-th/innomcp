import { EventEmitter } from 'events';

/**
 * Configuration for a model endpoint.
 */
export interface ModelConfig {
  id: string;
  endpoint: string;
  model: string;
  weight?: number;
  maxConcurrent?: number;
  tags?: string[];
}

/**
 * Statistics for a model endpoint.
 */
export interface ModelStats {
  id: string;
  avgLatency: number;
  errorRate: number;
  activeRequests: number;
  totalRequests: number;
}

/**
 * Load balancing strategies.
 */
export type Strategy = 'round-robin' | 'least-latency' | 'weighted' | 'random';

interface ModelState {
  config: ModelConfig;
  latencyWindow: number[];
  consecutiveErrors: number;
  totalRequests: number;
  totalErrors: number;
  activeRequests: number;
  disabledUntil: number | null;
}

/**
 * Production-ready load balancer for MDES models with circuit breaking,
 * rolling latency windows, and periodic health probes.
 */
export default class ModelLoadBalancer {
  private static instance: ModelLoadBalancer | null = null;

  private models: Map<string, ModelState> = new Map();
  private currentStrategy: Strategy = 'round-robin';
  private roundRobinIndex = 0;
  private healthProbeTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // Bootstrap default MDES model
    this.addModel({
      id: 'mdes-default',
      endpoint: 'https://ollama.mdes-innova.online',
      model: 'gemma4:26b',
      weight: 1,
      tags: [],
    });
    this.startHealthProbes();
  }

  /**
   * Returns the singleton instance of ModelLoadBalancer.
   */
  static getInstance(): ModelLoadBalancer {
    if (!ModelLoadBalancer.instance) {
      ModelLoadBalancer.instance = new ModelLoadBalancer();
    }
    return ModelLoadBalancer.instance;
  }

  /**
   * Adds or updates a model configuration.
   * If the model ID already exists, its config is updated (stats are preserved).
   * @param config - Model configuration.
   */
  addModel(config: ModelConfig): void {
    if (this.models.has(config.id)) {
      // Update existing configuration without resetting stats
      const state = this.models.get(config.id)!;
      state.config = { ...config };
    } else {
      const state: ModelState = {
        config: { ...config, weight: config.weight ?? 1, tags: config.tags ?? [] },
        latencyWindow: [],
        consecutiveErrors: 0,
        totalRequests: 0,
        totalErrors: 0,
        activeRequests: 0,
        disabledUntil: null,
      };
      this.models.set(config.id, state);
    }
  }

  /**
   * Removes a model by ID.
   * @param id - Model identifier.
   */
  removeModel(id: string): void {
    this.models.delete(id);
  }

  /**
   * Selects a model using the current strategy (or an override).
   * Excludes disabled and overloaded models (if maxConcurrent is set).
   * @param strategy - Optional strategy override for this call only.
   * @returns The selected ModelConfig or null if no eligible models.
   */
  selectModel(strategy?: Strategy): ModelConfig | null {
    const strat = strategy ?? this.currentStrategy;
    const now = Date.now();
    const eligible = Array.from(this.models.values()).filter((st) => {
      if (st.disabledUntil && st.disabledUntil > now) return false;
      if (st.config.maxConcurrent && st.activeRequests >= st.config.maxConcurrent) return false;
      return true;
    });

    if (eligible.length === 0) return null;

    let selected: ModelState | null = null;
    switch (strat) {
      case 'round-robin': {
        // Use modulo over eligible list length
        if (this.roundRobinIndex >= eligible.length) {
          this.roundRobinIndex = 0;
        }
        selected = eligible[this.roundRobinIndex];
        this.roundRobinIndex = (this.roundRobinIndex + 1) % eligible.length;
        break;
      }
      case 'least-latency': {
        selected = eligible.reduce((best, curr) => {
          const bestAvg = best.latencyWindow.length > 0
            ? best.latencyWindow.reduce((a, b) => a + b, 0) / best.latencyWindow.length
            : 0;
          const currAvg = curr.latencyWindow.length > 0
            ? curr.latencyWindow.reduce((a, b) => a + b, 0) / curr.latencyWindow.length
            : 0;
          return currAvg < bestAvg ? curr : best;
        });
        break;
      }
      case 'weighted': {
        const totalWeight = eligible.reduce((sum, m) => sum + (m.config.weight ?? 1), 0);
        let rand = Math.random() * totalWeight;
        for (const m of eligible) {
          rand -= m.config.weight ?? 1;
          if (rand <= 0) {
            selected = m;
            break;
          }
        }
        // Fallback (should never happen)
        if (!selected) selected = eligible[0];
        break;
      }
      case 'random': {
        const idx = Math.floor(Math.random() * eligible.length);
        selected = eligible[idx];
        break;
      }
      default:
        throw new Error(`Unknown strategy: ${strat}`);
    }

    if (selected) {
      selected.activeRequests++;
    }
    return selected ? { ...selected.config } : null;
  }

  /**
   * Records a successful request latency for a model.
   * Resets consecutive errors, decrements active requests, and updates the rolling window.
   * @param modelId - The model that handled the request.
   * @param latencyMs - Response latency in milliseconds.
   */
  recordLatency(modelId: string, latencyMs: number): void {
    const state = this.models.get(modelId);
    if (!state) return;

    state.totalRequests++;
    state.consecutiveErrors = 0;
    state.activeRequests = Math.max(0, state.activeRequests - 1);

    state.latencyWindow.push(latencyMs);
    if (state.latencyWindow.length > 20) {
      state.latencyWindow.shift();
    }
  }

  /**
   * Records a failed request (error) for a model.
   * Triggers circuit breaker after 5 consecutive errors.
   * @param modelId - The model that handled the request.
   */
  recordError(modelId: string): void {
    const state = this.models.get(modelId);
    if (!state) return;

    state.totalRequests++;
    state.totalErrors++;
    state.activeRequests = Math.max(0, state.activeRequests - 1);
    state.consecutiveErrors++;

    if (state.consecutiveErrors >= 5) {
      // Disable for 60 seconds
      state.disabledUntil = Date.now() + 60_000;
    }
  }

  /**
   * Returns current statistics for all models.
   * @returns Array of ModelStats.
   */
  getStats(): ModelStats[] {
    return Array.from(this.models.values()).map((st) => {
      const avgLatency =
        st.latencyWindow.length > 0
          ? st.latencyWindow.reduce((a, b) => a + b, 0) / st.latencyWindow.length
          : 0;
      const errorRate = st.totalRequests > 0 ? st.totalErrors / st.totalRequests : 0;
      return {
        id: st.config.id,
        avgLatency: Math.round(avgLatency * 100) / 100,
        errorRate: Math.round(errorRate * 10000) / 10000,
        activeRequests: st.activeRequests,
        totalRequests: st.totalRequests,
      };
    });
  }

  /**
   * Sets the default load balancing strategy.
   * @param strategy - The new default strategy.
   */
  setStrategy(strategy: Strategy): void {
    this.currentStrategy = strategy;
  }

  /**
   * Starts periodic health probes to re-enable circuit-broken models.
   * Runs every 30 seconds.
   */
  private startHealthProbes(): void {
    if (this.healthProbeTimer) return;
    this.healthProbeTimer = setInterval(() => this.runHealthProbes(), 30_000);
  }

  private async runHealthProbes(): Promise<void> {
    const now = Date.now();
    const probes: Promise<void>[] = [];

    for (const state of this.models.values()) {
      if (state.disabledUntil && state.disabledUntil <= now) {
        probes.push(this.probeModel(state));
      }
    }
    await Promise.allSettled(probes);
  }

  /**
   * Probes a single model's endpoint to decide if it should be re-enabled.
   * A successful response (status 2xx) re-enables the model and resets its error counter.
   */
  private async probeModel(state: ModelState): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(state.config.endpoint, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        // Re-enable the model
        state.disabledUntil = null;
        state.consecutiveErrors = 0;
      }
    } catch {
      // Probe failed – model remains disabled until next attempt
    } finally {
      clearTimeout(timeoutId);
    }
  }
}