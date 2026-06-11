/**
 * providerFailover.ts
 * Automatic provider failover with circuit breaker pattern for innomcp-node.
 * Primary: mdes-ollama (MDES Ollama, 24/7 unlimited via government platform)
 * Backups: ollama-local, openai-compatible
 * 
 * TypeScript strict. Uses MDES government AI infrastructure.
 */

// ---------- interfaces ----------
export interface ProviderStatus {
  id: string;
  healthy: boolean;
  latencyMs: number;
  failCount: number;
  lastCheck: number; // timestamp ms
}

interface ProviderConfig {
  id: string;
  isPrimary: boolean;
}

// Health check function signature – can be injected externally
export type HealthCheckFn = (providerId: string) => Promise<{ healthy: boolean; latencyMs: number }>;

// ---------- constants ----------
const DEFAULT_PRIMARY_ID = 'mdes-ollama';
const DEFAULT_BACKUP_IDS = ['ollama-local', 'openai-compatible'];

const DEFAULT_FAIL_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 60_000; // 1 minute

// ---------- class ProviderFailover ----------
export class ProviderFailover {
  private readonly statuses: Map<string, ProviderStatus>;
  private activeProviderId: string;
  private readonly failThreshold: number;
  private readonly cooldownMs: number;
  private healthChecker: HealthCheckFn | null = null;

  constructor(
    primaryId: string = DEFAULT_PRIMARY_ID,
    backupIds: string[] = DEFAULT_BACKUP_IDS,
    failThreshold = DEFAULT_FAIL_THRESHOLD,
    cooldownMs = DEFAULT_COOLDOWN_MS,
  ) {
    this.failThreshold = failThreshold;
    this.cooldownMs = cooldownMs;
    this.statuses = new Map();

    const providerIds = [primaryId, ...backupIds];
    for (const id of providerIds) {
      this.statuses.set(id, {
        id,
        healthy: true,
        latencyMs: 0,
        failCount: 0,
        lastCheck: Date.now(),
      });
    }

    this.activeProviderId = primaryId;
  }

  /**
   * Inject a custom health check function.
   * Should return { healthy: boolean; latencyMs: number } after probing the provider.
   */
  public setHealthChecker(fn: HealthCheckFn): void {
    this.healthChecker = fn;
  }

  /**
   * Returns the best provider ID to use for the given task.
   * - If primary is healthy → returns primary.
   * - Else tries backups in order → returns the first healthy backup.
   * - If none are healthy → falls back to primary (last resort) and logs warning.
   */
  public async selectProvider(_task?: string): Promise<string> {
    // Check primary
    const primaryStatus = this.statuses.get(DEFAULT_PRIMARY_ID)!;
    if (primaryStatus.healthy) {
      this.activeProviderId = DEFAULT_PRIMARY_ID;
      return DEFAULT_PRIMARY_ID;
    }

    // Primary unhealthy – try backups
    for (const backupId of DEFAULT_BACKUP_IDS) {
      const backupStatus = this.statuses.get(backupId);
      if (backupStatus && backupStatus.healthy) {
        this.activeProviderId = backupId;
        return backupId;
      }
    }

    // All unhealthy – fallback to primary (but log)
    console.warn(
      `[ProviderFailover] All providers unhealthy. Falling back to primary (${DEFAULT_PRIMARY_ID})`,
    );
    this.activeProviderId = DEFAULT_PRIMARY_ID;
    return DEFAULT_PRIMARY_ID;
  }

  /**
   * Mark a provider as having failed (e.g., timeout, error response).
   * Increments fail counter; if threshold exceeded, sets healthy = false.
   */
  public async markFailed(providerId: string): Promise<void> {
    const status = this.statuses.get(providerId);
    if (!status) {
      console.warn(`[ProviderFailover] Unknown provider ${providerId}, ignoring markFailed.`);
      return;
    }

    status.failCount += 1;
    status.lastCheck = Date.now();

    if (status.failCount >= this.failThreshold) {
      status.healthy = false;
      console.warn(
        `[ProviderFailover] Provider ${providerId} marked unhealthy after ${status.failCount} consecutive failures.`,
      );
    }
  }

  /**
   * Mark a provider as healthy (successful response).
   * Resets fail count, sets healthy = true, records latency.
   */
  public async markHealthy(providerId: string, latencyMs: number): Promise<void> {
    const status = this.statuses.get(providerId);
    if (!status) {
      console.warn(`[ProviderFailover] Unknown provider ${providerId}, ignoring markHealthy.`);
      return;
    }

    status.healthy = true;
    status.failCount = 0;
    status.latencyMs = latencyMs;
    status.lastCheck = Date.now();
  }

  /**
   * Actively check a provider's health.
   * - If a health checker function is set, it will be used.
   * - If unhealthy but cooldown has passed, the check is attempted.
   * - Updates internal status based on result.
   * Returns true if provider is currently healthy.
   */
  public async checkProvider(providerId: string): Promise<boolean> {
    const status = this.statuses.get(providerId);
    if (!status) {
      console.warn(`[ProviderFailover] Unknown provider ${providerId}, cannot check.`);
      return false;
    }

    // If no health checker configured, just return current healthy state
    if (!this.healthChecker) {
      return status.healthy;
    }

    const now = Date.now();
    // If healthy, optionally re-check to update latency? We'll not force re-check when healthy.
    // Only perform active check if currently unhealthy and cooldown elapsed, or if never checked.
    const shouldAttemptCheck =
      !status.healthy && (now - status.lastCheck >= this.cooldownMs);

    if (!shouldAttemptCheck && status.healthy) {
      // Still healthy, no need to re-probe now
      return true;
    }

    // Perform the actual health check
    try {
      const result = await this.healthChecker(providerId);
      if (result.healthy) {
        // Provider recovered
        await this.markHealthy(providerId, result.latencyMs);
        return true;
      } else {
        // Failed again – mark as failed
        await this.markFailed(providerId);
        return false;
      }
    } catch (error) {
      console.error(
        `[ProviderFailover] Health check for ${providerId} threw error:`,
        (error as Error).message,
      );
      await this.markFailed(providerId);
      return false;
    }
  }

  /**
   * Get current failover statistics.
   */
  public getStats(): {
    primary: ProviderStatus;
    backups: ProviderStatus[];
    activeProvider: string;
  } {
    const primary = this.statuses.get(DEFAULT_PRIMARY_ID)!;
    const backups = DEFAULT_BACKUP_IDS
      .map(id => this.statuses.get(id))
      .filter(Boolean) as ProviderStatus[];

    return {
      primary: { ...primary },
      backups: backups.map(s => ({ ...s })),
      activeProvider: this.activeProviderId,
    };
  }

  /**
   * Reset all providers to initial healthy state (circuit breakers cleared).
   */
  public resetAll(): void {
    const now = Date.now();
    for (const status of this.statuses.values()) {
      status.healthy = true;
      status.failCount = 0;
      status.latencyMs = 0;
      status.lastCheck = now;
    }
    this.activeProviderId = DEFAULT_PRIMARY_ID;
    console.log('[ProviderFailover] All providers reset to healthy.');
  }
}

// ---------- singleton export ----------
export const providerFailover = new ProviderFailover();

/**
 * Example default health checker – you can replace this with actual logic.
 * The implementation below assumes providers expose a /health endpoint
 * and we measure latency via performance.now().
 * 
 * Usage:
 * providerFailover.setHealthChecker(async (providerId) => {
 *   // custom fetch logic
 * });
 */
const defaultHealthChecker: HealthCheckFn = async (providerId: string) => {
  // MDES government provider URLs (adjust as needed)
  const providerUrls: Record<string, string> = {
    'mdes-ollama': 'http://localhost:11434/api/health', // MDES Ollama – 24/7 unlimited
    'ollama-local': 'http://localhost:11434/api/health',
    'openai-compatible': 'http://localhost:8000/v1/health',
  };

  const url = providerUrls[providerId];
  if (!url) {
    throw new Error(`No health URL configured for provider ${providerId}`);
  }

  const start = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - start);
    return { healthy: response.ok, latencyMs };
  } catch {
    const latencyMs = Math.round(performance.now() - start);
    return { healthy: false, latencyMs };
  } finally {
    clearTimeout(timeoutId);
  }
};

// Automatically set the default health checker so the class works out-of-the-box
providerFailover.setHealthChecker(defaultHealthChecker);