/**
 * healthAggregator.ts
 * Aggregates health checks from all innomcp-node services into a single response.
 * Provides a singleton HealthAggregator that can register custom health checkers.
 * Includes built-in checkers for memory, event loop lag, and process uptime.
 * Results are cached for 10 seconds to prevent excessive load.
 */

/** Health status values */
export type HealthStatusValue = 'healthy' | 'degraded' | 'unhealthy';

/** Result of a single health checker */
export interface HealthStatus {
  status: HealthStatusValue;
  message?: string;
  details?: Record<string, unknown>;
  latencyMs?: number;
}

/** Signature of a health checker function */
export type HealthChecker = () => Promise<HealthStatus>;

/** Aggregated health from all checkers */
export interface AggregatedHealth {
  status: HealthStatusValue;
  timestamp: string;
  uptime: number;
  checks: Record<string, HealthStatus & { durationMs: number }>;
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

interface RegisteredChecker {
  checker: HealthChecker;
  timeoutMs: number;
}

const DEFAULT_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 10000;

/**
 * Singleton health aggregator for the innomcp-node backend.
 * Use `HealthAggregator.getInstance()` to access the instance.
 */
export default class HealthAggregator {
  private static instance: HealthAggregator;
  private checkers: Map<string, RegisteredChecker> = new Map();
  private cache: { result: AggregatedHealth; timestamp: number } | null = null;

  private constructor() {
    // Register built-in checkers
    this.registerChecker('memory', this.memoryCheck.bind(this));
    this.registerChecker('eventLoop', this.eventLoopCheck.bind(this));
    this.registerChecker('uptime', this.uptimeCheck.bind(this));
  }

  /**
   * Returns the singleton instance of HealthAggregator.
   */
  public static getInstance(): HealthAggregator {
    if (!HealthAggregator.instance) {
      HealthAggregator.instance = new HealthAggregator();
    }
    return HealthAggregator.instance;
  }

  /**
   * Registers a health checker under a given name.
   * @param name - Unique name for the checker (e.g., "database")
   * @param checker - Async function that returns a HealthStatus
   * @param timeoutMs - Maximum time (ms) to wait before marking as unhealthy (default: 5000)
   */
  public registerChecker(
    name: string,
    checker: HealthChecker,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): void {
    this.checkers.set(name, { checker, timeoutMs });
    // Clear cache so that the next check uses updated checkers
    this.cache = null;
  }

  /**
   * Executes all registered health checkers in parallel and returns aggregated health.
   * Uses a 10-second in-memory cache to avoid excessive checks on repeated calls.
   */
  public async check(): Promise<AggregatedHealth> {
    const now = Date.now();

    // Return cached result if still fresh
    if (this.cache && now - this.cache.timestamp < CACHE_TTL_MS) {
      return this.cache.result;
    }

    const results: Record<string, HealthStatus & { durationMs: number }> = {};
    const summary = { total: 0, healthy: 0, degraded: 0, unhealthy: 0 };

    const checkPromises: Promise<{
      name: string;
      result: HealthStatus & { durationMs: number };
    }>[] = [];

    for (const [name, { checker, timeoutMs }] of this.checkers.entries()) {
      summary.total++;
      checkPromises.push(
        this.runCheckerWithTimeout(name, checker, timeoutMs),
      );
    }

    const outcomes = await Promise.all(checkPromises);

    for (const { name, result } of outcomes) {
      results[name] = result;
      switch (result.status) {
        case 'healthy':
          summary.healthy++;
          break;
        case 'degraded':
          summary.degraded++;
          break;
        case 'unhealthy':
          summary.unhealthy++;
          break;
      }
    }

    // Determine overall status
    let overall: HealthStatusValue = 'healthy';
    if (summary.unhealthy > 0) {
      overall = 'unhealthy';
    } else if (summary.degraded > 0) {
      overall = 'degraded';
    }

    const aggregated: AggregatedHealth = {
      status: overall,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: results,
      summary,
    };

    // Cache the result
    this.cache = { result: aggregated, timestamp: now };
    return aggregated;
  }

  /**
   * Runs a checker with a timeout. If the checker throws or times out,
   * it returns an unhealthy status with a Thai error message.
   */
  private async runCheckerWithTimeout(
    name: string,
    checker: HealthChecker,
    timeoutMs: number,
  ): Promise<{ name: string; result: HealthStatus & { durationMs: number } }> {
    const start = process.hrtime.bigint();

    try {
      const result = await Promise.race([
        checker(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`หมดเวลา (${timeoutMs}ms)`)),
            timeoutMs,
          ),
        ),
      ]);

      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;

      return {
        name,
        result: {
          status: result.status,
          message: result.message,
          details: result.details,
          latencyMs: durationMs,
          durationMs,
        },
      };
    } catch (error: unknown) {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;
      const errorMessage =
        error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่รู้จัก';

      return {
        name,
        result: {
          status: 'unhealthy',
          message: `การตรวจสอบล้มเหลว: ${errorMessage}`,
          latencyMs: durationMs,
          durationMs,
        },
      };
    }
  }

  /* Built-in checkers */

  /**
   * Memory health: reports based on heap usage ratio.
   * Healthy: < 80%, Degraded: 80-95%, Unhealthy: > 95%
   */
  private async memoryCheck(): Promise<HealthStatus> {
    const memory = process.memoryUsage();
    const heapUsed = memory.heapUsed;
    const heapTotal = memory.heapTotal;
    const ratio = heapUsed / heapTotal;
    let status: HealthStatusValue = 'healthy';
    let message = 'หน่วยความจำปกติ';

    if (ratio >= 0.95) {
      status = 'unhealthy';
      message = 'หน่วยความจำใกล้เต็ม (มากกว่า 95%)';
    } else if (ratio >= 0.8) {
      status = 'degraded';
      message = 'หน่วยความจำใช้งานสูง (มากกว่า 80%)';
    }

    return {
      status,
      message,
      details: {
        heapUsed: Math.round(heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(heapTotal / 1024 / 1024) + 'MB',
        ratio: Math.round(ratio * 100) + '%',
      },
    };
  }

  /**
   * Event loop lag: measures the time between scheduling a setImmediate and its execution.
   * Healthy: < 50ms, Degraded: 50-200ms, Unhealthy: > 200ms
   */
  private async eventLoopCheck(): Promise<HealthStatus> {
    const start = process.hrtime.bigint();
    await new Promise<void>((resolve) => setImmediate(resolve));
    const end = process.hrtime.bigint();
    const lagMs = Number(end - start) / 1e6;

    let status: HealthStatusValue = 'healthy';
    let message = 'Event loop ทำงานปกติ';

    if (lagMs > 200) {
      status = 'unhealthy';
      message = `Event loop ล่าช้ามาก (${lagMs.toFixed(2)}ms)`;
    } else if (lagMs > 50) {
      status = 'degraded';
      message = `Event loop หน่วงเวลา (${lagMs.toFixed(2)}ms)`;
    }

    return {
      status,
      message,
      details: {
        lagMs: Math.round(lagMs * 100) / 100,
      },
    };
  }

  /**
   * Uptime check: simply reports the process uptime. Always healthy.
   */
  private async uptimeCheck(): Promise<HealthStatus> {
    const uptime = process.uptime();
    return {
      status: 'healthy',
      message: `ระบบทำงานมาแล้ว ${Math.floor(uptime)} วินาที`,
      details: {
        uptimeSeconds: uptime,
      },
    };
  }
}