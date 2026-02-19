/**
 * Error Recovery & Retry Module
 * à¸£à¸°à¸šà¸š retry à¹à¸¥à¸° fallback à¹€à¸¡à¸·à¹ˆà¸­à¹€à¸à¸´à¸” error
 * 
 * Features:
 * - Automatic retry with exponential backoff
 * - Fallback strategies
 * - Circuit breaker pattern
 * - Error recovery
 * 
 * @module utils/errorRecovery
 */

import { logBoth } from '../mcpLogger';

/**
 * Retry Configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

/**
 * Circuit Breaker State
 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Retry Manager
 */
class ErrorRecoveryManager {
  private defaultConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED']
  };

  private circuitBreakers: Map<string, {
    state: CircuitState;
    failures: number;
    lastFailureTime: number;
    successCount: number;
  }> = new Map();

  /**
   * Retry function with exponential backoff
   */
  async retryWithBackoff<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const cfg = { ...this.defaultConfig, ...config };
    let lastError: any;
    let delay = cfg.initialDelay;

    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
      try {
        const result = await fn();
        if (attempt > 0) {
          logBoth('info', `[Retry] Success after ${attempt} retries`);
        }
        return result;
      } catch (error: any) {
        lastError = error;
        
        // Check if error is retryable
        if (!this.isRetryableError(error, cfg.retryableErrors)) {
          throw error;
        }

        // Last attempt failed
        if (attempt === cfg.maxRetries) {
          logBoth('error', `[Retry] Failed after ${cfg.maxRetries} retries: ${error.message}`);
          throw error;
        }

        // Wait before retry
        logBoth('warn', `[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await this.sleep(delay);
        
        // Exponential backoff
        delay = Math.min(delay * cfg.backoffMultiplier, cfg.maxDelay);
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any, retryableErrors?: string[]): boolean {
    if (!retryableErrors || retryableErrors.length === 0) {
      return true; // Retry all errors if not specified
    }

    const errorCode = error.code || error.name || error.message;
    return retryableErrors.some(code => 
      errorCode.includes(code) || error.message?.includes(code)
    );
  }

  /**
   * Circuit breaker pattern
   */
  async withCircuitBreaker<T>(
    key: string,
    fn: () => Promise<T>,
    options: {
      failureThreshold?: number;
      resetTimeout?: number;
      halfOpenRequests?: number;
    } = {}
  ): Promise<T> {
    const {
      failureThreshold = 5,
      resetTimeout = 60000, // 1 minute
      halfOpenRequests = 3
    } = options;

    // Get or create circuit breaker
    let breaker = this.circuitBreakers.get(key);
    if (!breaker) {
      breaker = {
        state: 'CLOSED',
        failures: 0,
        lastFailureTime: 0,
        successCount: 0
      };
      this.circuitBreakers.set(key, breaker);
    }

    // Check circuit state
    if (breaker.state === 'OPEN') {
      // Check if we should try half-open
      if (Date.now() - breaker.lastFailureTime > resetTimeout) {
        breaker.state = 'HALF_OPEN';
        breaker.successCount = 0;
        logBoth('info', `[Circuit] ${key} moving to HALF_OPEN`);
      } else {
        throw new Error(`Circuit breaker is OPEN for ${key}`);
      }
    }

    try {
      const result = await fn();
      
      // Success - update circuit
      if (breaker.state === 'HALF_OPEN') {
        breaker.successCount++;
        if (breaker.successCount >= halfOpenRequests) {
          breaker.state = 'CLOSED';
          breaker.failures = 0;
          logBoth('info', `[Circuit] ${key} moving to CLOSED`);
        }
      } else {
        breaker.failures = 0;
      }

      return result;
    } catch (error) {
      // Failure - update circuit
      breaker.failures++;
      breaker.lastFailureTime = Date.now();

      if (breaker.state === 'HALF_OPEN') {
        breaker.state = 'OPEN';
        logBoth('warn', `[Circuit] ${key} moving to OPEN (half-open failure)`);
      } else if (breaker.failures >= failureThreshold) {
        breaker.state = 'OPEN';
        logBoth('warn', `[Circuit] ${key} moving to OPEN (${breaker.failures} failures)`);
      }

      throw error;
    }
  }

  /**
   * Fallback pattern
   */
  async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T> | T
  ): Promise<T> {
    try {
      return await primary();
    } catch (error) {
      logBoth('warn', `[Fallback] Primary failed, using fallback: ${error}`);
      return await Promise.resolve(fallback());
    }
  }

  /**
   * Timeout wrapper
   */
  async withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    timeoutError?: string
  ): Promise<T> {
    return Promise.race([
      fn(),
      this.sleep(timeoutMs).then(() => {
        throw new Error(timeoutError || `Operation timed out after ${timeoutMs}ms`);
      })
    ]);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get circuit breaker status
   */
  getCircuitStatus(key: string): {
    state: CircuitState;
    failures: number;
  } | null {
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) return null;

    return {
      state: breaker.state,
      failures: breaker.failures
    };
  }

  /**
   * Reset circuit breaker
   */
  resetCircuit(key: string): void {
    const breaker = this.circuitBreakers.get(key);
    if (breaker) {
      breaker.state = 'CLOSED';
      breaker.failures = 0;
      breaker.successCount = 0;
      logBoth('info', `[Circuit] ${key} manually reset to CLOSED`);
    }
  }
}

// Export singleton instance
export const errorRecovery = new ErrorRecoveryManager();

/**
 * Helper: Retry with backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  return errorRecovery.retryWithBackoff(fn, config);
}

/**
 * Helper: Circuit breaker
 */
export async function withCircuitBreaker<T>(
  key: string,
  fn: () => Promise<T>,
  options?: Parameters<typeof errorRecovery.withCircuitBreaker>[2]
): Promise<T> {
  return errorRecovery.withCircuitBreaker(key, fn, options);
}

/**
 * Helper: Fallback
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T> | T
): Promise<T> {
  return errorRecovery.withFallback(primary, fallback);
}

/**
 * Helper: Timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutError?: string
): Promise<T> {
  return errorRecovery.withTimeout(fn, timeoutMs, timeoutError);
}
