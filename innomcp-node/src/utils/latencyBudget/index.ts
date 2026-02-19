/**
 * Latency Budget Module
 * à¸„à¸§à¸šà¸„à¸¸à¸¡à¹€à¸§à¸¥à¸²à¸•à¸­à¸šà¸ªà¸™à¸­à¸‡à¹ƒà¸«à¹‰à¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¸à¸£à¸­à¸šà¸—à¸µà¹ˆà¸à¸³à¸«à¸™à¸”
 * 
 * Features:
 * - Parallel API calls
 * - Quick timeout and fallback
 * - Response time tracking
 * - Performance optimization
 * 
 * @module utils/latencyBudget
 */

import { logBoth } from '../mcpLogger';
import { performanceMetrics } from '../metrics';

/**
 * Latency Budget Config
 */
export interface LatencyBudgetConfig {
  maxLatency: number; // milliseconds
  parallelRequests?: boolean;
  fallbackOnTimeout?: boolean;
}

/**
 * Timed Result
 */
export interface TimedResult<T> {
  data: T;
  duration: number;
  source: string;
  timestamp: Date;
}

/**
 * Latency Budget Manager
 */
class LatencyBudgetManager {
  private budgets: Map<string, number> = new Map([
    ['weather', 800],      // WeatherNow â‰¤800ms
    ['time', 100],         // Time query fast
    ['officeholder', 2000], // May need scraping
    ['search', 3000],      // External search APIs
    ['general', 5000]      // Default budget
  ]);

  /**
   * Set latency budget for service
   */
  setBudget(service: string, maxLatencyMs: number): void {
    this.budgets.set(service, maxLatencyMs);
    logBoth('info', `[LatencyBudget] Set ${service} budget to ${maxLatencyMs}ms`);
  }

  /**
   * Get latency budget for service
   */
  getBudget(service: string): number {
    return this.budgets.get(service) || this.budgets.get('general')!;
  }

  /**
   * Execute with latency budget
   */
  async executeWithBudget<T>(
    service: string,
    fn: () => Promise<T>,
    config?: Partial<LatencyBudgetConfig>
  ): Promise<TimedResult<T>> {
    const budget = config?.maxLatency || this.getBudget(service);
    const startTime = Date.now();

    try {
      // Race against timeout
      const result = await Promise.race([
        fn(),
        this.timeout<T>(budget)
      ]);

      const duration = Date.now() - startTime;
      
      // Record metrics
      performanceMetrics.recordResponseTime(duration);

      // Check if exceeded budget
      if (duration > budget) {
        logBoth('warn', `[LatencyBudget] ${service} exceeded budget: ${duration}ms > ${budget}ms`);
      }

      return {
        data: result,
        duration,
        source: service,
        timestamp: new Date()
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      if (error.message === 'TIMEOUT') {
        logBoth('warn', `[LatencyBudget] ${service} timed out after ${budget}ms`);
        throw new Error(`Service ${service} exceeded latency budget of ${budget}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Execute multiple sources in parallel
   */
  async executeParallel<T>(
    service: string,
    sources: Array<{ name: string; fn: () => Promise<T> }>,
    config?: {
      maxLatency?: number;
      useFirstSuccess?: boolean;
      requireAll?: boolean;
    }
  ): Promise<TimedResult<T>[]> {
    const budget = config?.maxLatency || this.getBudget(service);
    const startTime = Date.now();

    logBoth('info', `[LatencyBudget] Executing ${sources.length} parallel requests for ${service}`);

    const promises = sources.map(async (source) => {
      try {
        const sourceStart = Date.now();
        const result = await Promise.race([
          source.fn(),
          this.timeout<T>(budget)
        ]);
        const duration = Date.now() - sourceStart;

        return {
          data: result,
          duration,
          source: source.name,
          timestamp: new Date(),
          success: true
        };
      } catch (error: any) {
        logBoth('warn', `[LatencyBudget] ${source.name} failed: ${error.message}`);
        return {
          data: null as T,
          duration: Date.now() - startTime,
          source: source.name,
          timestamp: new Date(),
          success: false,
          error: error.message
        };
      }
    });

    // Wait for all or first success
    if (config?.useFirstSuccess) {
      // Return as soon as one succeeds
      const results = await Promise.race(
        promises.map(p => p.then(r => r.success ? [r] : Promise.reject()))
      ).catch(() => [] as any[]);
      
      return results.filter((r: any) => r.success);
    } else if (config?.requireAll) {
      // Wait for all to complete
      const results = await Promise.all(promises);
      return results.filter((r: any) => r.success);
    } else {
      // Wait for all, but don't fail if some fail
      const results = await Promise.allSettled(promises);
      return results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter((r: any) => r.success);
    }
  }

  /**
   * Execute with fallback
   */
  async executeWithFallback<T>(
    service: string,
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    maxLatency?: number
  ): Promise<TimedResult<T>> {
    const budget = maxLatency || this.getBudget(service);

    try {
      // Try primary first
      return await this.executeWithBudget(service, primary, { maxLatency: budget });
    } catch (error) {
      logBoth('warn', `[LatencyBudget] ${service} primary failed, using fallback`);
      
      // Try fallback with half the budget remaining
      return await this.executeWithBudget(
        `${service}.fallback`,
        fallback,
        { maxLatency: Math.floor(budget / 2) }
      );
    }
  }

  /**
   * Create timeout promise
   */
  private timeout<T>(ms: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), ms);
    });
  }

  /**
   * Get budget summary
   */
  getSummary(): string {
    let summary = `
Latency Budget Summary
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
`;

    for (const [service, budget] of this.budgets) {
      summary += `  ${service}: ${budget}ms\n`;
    }

    summary += 'â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”';
    return summary.trim();
  }
}

// Export singleton instance
export const latencyBudget = new LatencyBudgetManager();

/**
 * Helper: Execute with budget
 */
export async function withLatencyBudget<T>(
  service: string,
  fn: () => Promise<T>,
  maxLatency?: number
): Promise<TimedResult<T>> {
  return latencyBudget.executeWithBudget(service, fn, { maxLatency });
}

/**
 * Helper: Execute parallel
 */
export async function executeParallel<T>(
  service: string,
  sources: Array<{ name: string; fn: () => Promise<T> }>,
  useFirstSuccess?: boolean
): Promise<TimedResult<T>[]> {
  return latencyBudget.executeParallel(service, sources, { useFirstSuccess });
}

/**
 * Helper: Execute with fallback
 */
export async function withFallback<T>(
  service: string,
  primary: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<TimedResult<T>> {
  return latencyBudget.executeWithFallback(service, primary, fallback);
}
