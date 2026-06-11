```ts
import { Pool } from 'pg';
import { WebSocket } from 'ws';
import { promises as fs } from 'fs';
import { resolve } from 'path';

type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

interface ServiceHealth {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
}

type HealthResult = {
  overall: HealthStatus;
  services: ServiceHealth[];
  timestamp: number;
};

class HealthAggregator {
  private lastResult: HealthResult | null = null;
  private timer: NodeJS.Timeout | null = null;
  private readonly defaultIntervalMs = 30_000;
  private isRunning = false;

  // Instantiate the dependency pools once and reuse
  private readonly dbPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  private readonly wsPort = parseInt(process.env.WS_PORT ?? '3001', 10);
  private readonly ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434';
  private readonly workspacePath = resolve(process.env.WORKSPACE_STORAGE_PATH ?? './workspace');

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------
  private async measureLatency<T>(fn: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
    const start = Date.now();
    const result = await fn();
    return { result, latencyMs: Date.now() - start };
  }

  private computeOverall(services: ServiceHealth[]): HealthStatus {
    const statuses = services.map((s) => s.status);
    if (statuses.some((s) => s === 'down')) return 'down';
    if (statuses.some((s) => s === 'degraded')) return 'degraded';
    if (statuses.every((s) => s === 'unknown')) return 'unknown';
    return 'healthy';
  }

  // --------------------------------------------------------------------------
  // Check methods
  // --------------------------------------------------------------------------

  async checkMDESOllama(): Promise<ServiceHealth> {
    const name = 'MDES Ollama';
    try {
      const { result, latencyMs } = await this.measureLatency(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5_000);
        try {
          const response = await fetch(`${this.ollamaUrl}/api/tags`, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          // We don't need the body – a successful response means the service is reachable
        } finally {
          clearTimeout(timeout);
        }
      });

      return {
        name,
        status: 'healthy',
        latencyMs,
      };
    } catch (err: any) {
      const message = err.message?.includes('aborted') ? 'Request timed out' : err.message;
      return {
        name,
        status: 'down',
        message: `Ollama unreachable: ${message}`,
      };
    }
  }

  async checkDatabase(): Promise<ServiceHealth> {
    const name = 'Database';
    try {
      const { result, latencyMs } = await this.measureLatency(async () => {
        const client = await this.dbPool.connect();
        try {
          await client.query('SELECT 1');
        } finally {
          client.release();
        }
      });

      return {
        name,
        status: 'healthy',
        latencyMs,
      };
    } catch (err: any) {
      return {
        name,
        status: 'down',
        message: `Database error: ${err.message}`,
      };
    }
  }

  async checkWebSocket(): Promise<ServiceHealth> {
    const name = 'WebSocket';
    try {
      const { result, latencyMs } = await this.measureLatency(async () => {
        return new Promise<void>((resolve, reject) => {
          const wsUrl = `ws://localhost:${this.wsPort}`;
          const ws = new WebSocket(wsUrl);

          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('WebSocket connection timed out'));
          }, 5_000);

          ws.on('open', () => {
            clearTimeout(timeout);
            ws.close();
            resolve();
          });

          ws.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      });

      return {
        name,
        status: 'healthy',
        latencyMs,
      };
    } catch (err: any) {
      return {
        name,
        status: 'down',
        message: `WebSocket error: ${err.message}`,
      };
    }
  }

  async checkDisk(): Promise<ServiceHealth> {
    const name = 'Disk';
    try {
      const { result, latencyMs } = await this.measureLatency(async () => {
        try {
          await fs.access(this.workspacePath);
        } catch {
          // Create the directory if it does not exist
          await fs.mkdir(this.workspacePath, { recursive: true });
        }

        const stats = await fs.statfs(this.workspacePath);
        const freeBytes = stats.bfree * stats.bsize;
        return freeBytes;
      });

      const freeMB = result / (1024 * 1024);
      let status: HealthStatus = 'healthy';
      let message: string | undefined;

      if (freeMB < 100) {
        status = 'down';
        message = `Critical: only ${freeMB.toFixed(1)} MB free`;
      } else if (freeMB < 500) {
        status = 'degraded';
        message = `Low space: ${freeMB.toFixed(1)} MB free`;
      }

      return {
        name,
        status,
        latencyMs,
        message,
      };
    } catch (err: any) {
      return {
        name,
        status: 'down',
        message: `Disk check failed: ${err.message}`,
      };
    }
  }

  async checkMemory(): Promise<ServiceHealth> {
    const name = 'Memory';
    try {
      const { result: mem, latencyMs } = await this.measureLatency(() =>
        Promise.resolve(process.memoryUsage()),
      );

      const usedMB = mem.heapUsed / (1024 * 1024);
      const totalMB = mem.heapTotal / (1024 * 1024);
      const ratio = totalMB > 0 ? usedMB / totalMB : 0;

      let status: HealthStatus = 'healthy';
      let message: string | undefined;

      if (ratio > 0.95 || usedMB > 1800) {
        status = 'down';
        message = `Heap usage critical: ${usedMB.toFixed(1)} / ${totalMB.toFixed(