// mdesModelCache.ts
// MDES Ollama model list cache for innomcp-node
// Caches available models from MDES Ollama endpoint
// (https://ollama.mdes-innova.online)

const MDES_OLLAMA_URL = process.env.MDES_OLLAMA_URL || "https://ollama.mdes-innova.online";

export interface MDESModel {
  name: string;
  size?: number;
  modified_at?: string;
  details?: {
    parameter_size?: string;
    family?: string;
    quantization_level?: string;
  };
}

interface OllamaTagsResponse {
  models: MDESModel[];
}

export class MDESModelCache {
  private cache: MDESModel[] = [];
  private lastFetch = 0;
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch and return the list of available models.
   * Caching is applied unless forceRefresh is true.
   */
  async getModels(forceRefresh = false): Promise<MDESModel[]> {
    const now = Date.now();
    if (!forceRefresh && this.cache.length > 0 && now - this.lastFetch < this.TTL_MS) {
      return this.cache;
    }

    try {
      const response = await fetch(`${MDES_OLLAMA_URL}/api/tags`);
      if (!response.ok) {
        throw new Error(`MDES Ollama responded with status ${response.status}`);
      }
      const data: OllamaTagsResponse = await response.json();
      const models = data.models ?? [];
      this.cache = models;
      this.lastFetch = now;
      return models;
    } catch (error) {
      // If cache exists, return stale cache to avoid service disruption
      if (this.cache.length > 0) {
        console.warn("Failed to refresh model cache, using stale cache:", error);
        return this.cache;
      }
      throw new Error("Failed to fetch models from MDES Ollama and no cache available");
    }
  }

  /**
   * Get a specific model by exact name.
   */
  async getModel(name: string): Promise<MDESModel | undefined> {
    const models = await this.getModels();
    return models.find((m) => m.name === name);
  }

  /**
   * Return all unique model families present in the cache.
   */
  getModelFamilies(): string[] {
    const families = new Set<string>();
    for (const model of this.cache) {
      if (model.details?.family) {
        families.add(model.details.family);
      }
    }
    return Array.from(families);
  }

  /**
   * Check if a model with the given name is currently available.
   */
  async isModelAvailable(name: string): Promise<boolean> {
    const models = await this.getModels();
    return models.some((m) => m.name === name);
  }

  /**
   * Select the best model for a specific task.
   *
   * - 'thai': models optimized for Thai language (name/family contains "thai")
   * - 'code': code models (name/family contains "code")
   * - 'reasoning': largest parameter size (≥7B ideally)
   * - 'fast': smallest parameter size, preferably with high quantization
   *
   * Falls back to the first available model if no specific match is found.
   */
  async getBestModelForTask(task: "thai" | "code" | "reasoning" | "fast"): Promise<string> {
    const models = await this.getModels();
    if (models.length === 0) {
      throw new Error("No models available");
    }

    // Helper to parse parameter_size to a float (GB)
    const sizeValue = (size: string | undefined): number => {
      if (!size) return Infinity;
      const match = size.match(/^([\d.]+)\s*B$/i);
      if (match) return parseFloat(match[1]);
      // default to a large number if unrecognized
      return Infinity;
    };

    const lowerTask = task.toLowerCase();

    // Task-specific heuristic selectors
    switch (lowerTask) {
      case "thai": {
        const thaiModel = models.find(
          (m) =>
            m.name.toLowerCase().includes("thai") ||
            m.details?.family?.toLowerCase().includes("thai")
        );
        if (thaiModel) return thaiModel.name;
        // if no specifically Thai model, fallback to largest (assume better for language)
        break; // go to reasoning fallback
      }

      case "code": {
        const codeModel = models.find(
          (m) =>
            m.name.toLowerCase().includes("code") ||
            m.details?.family?.toLowerCase().includes("code")
        );
        if (codeModel) return codeModel.name;
        break;
      }

      case "reasoning": {
        // prefer largest parameter size, but at least 7B
        let best: MDESModel | undefined;
        let bestSize = -Infinity;
        for (const m of models) {
          const s = sizeValue(m.details?.parameter_size);
          if (s >= 7 && s > bestSize) {
            best = m;
            bestSize = s;
          }
        }
        if (best) return best.name;
        // if none ≥7B, just pick the largest overall
        break; // generic largest selection below
      }

      case "fast": {
        // smallest model, preferably with high quantization (higher level is faster)
        // lack of quantization_level counts as 0
        let best: MDESModel | undefined;
        let bestScore = Infinity;
        for (const m of models) {
          const s = sizeValue(m.details?.parameter_size);
          const q = m.details?.quantization_level ? parseInt(m.details.quantization_level, 10) || 0 : 0;
          // lower size and higher quantization => faster
          const score = s - q * 0.1; // simple heuristic
          if (score < bestScore) {
            bestScore = score;
            best = m;
          }
        }
        if (best) return best.name;
        break;
      }
    }

    // Generic fallback: return the model with the largest parameter size (considered most capable)
    const sorted = [...models].sort(
      (a, b) => sizeValue(b.details?.parameter_size) - sizeValue(a.details?.parameter_size)
    );
    return sorted[0].name;
  }

  /**
   * Pre-fetch model list. This should be called on server start.
   */
  async warmUp(): Promise<void> {
    await this.getModels(true);
  }

  /**
   * Return cache statistics.
   */
  getStats(): { modelCount: number; lastFetched: Date | null; ttlRemaining: number } {
    const now = Date.now();
    const expiresAt = this.lastFetch + this.TTL_MS;
    const ttlRemaining = Math.max(0, expiresAt - now);
    return {
      modelCount: this.cache.length,
      lastFetched: this.lastFetch > 0 ? new Date(this.lastFetch) : null,
      ttlRemaining,
    };
  }
}

export const mdesModelCache = new MDESModelCache();