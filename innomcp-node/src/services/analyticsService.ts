import { promises as fs } from 'fs';
import path from 'path';

export interface MessageEvent {
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  toolsUsed: string[];
  success: boolean;
  sessionId?: string;
}

export interface ToolEvent {
  toolName: string;
  latencyMs: number;
  success: boolean;
}

export interface ErrorEvent {
  component: string;
  code: string;
  message: string;
  sessionId?: string;
}

interface Metrics {
  totalMessages: number;
  modelCounts: Record<string, number>;
  totalMessageLatencyMs: number;

  totalToolCalls: number;
  toolCounts: Record<string, number>;
  totalToolLatencyMs: number;

  totalErrors: number;

  activeSessions: Map<string, number>;
  startTime: number;
}

export class AnalyticsService {
  private metrics: Metrics;

  constructor() {
    this.metrics = {
      totalMessages: 0,
      modelCounts: {},
      totalMessageLatencyMs: 0,

      totalToolCalls: 0,
      toolCounts: {},
      totalToolLatencyMs: 0,

      totalErrors: 0,

      activeSessions: new Map(),
      startTime: Date.now(),
    };
  }

  /**
   * Track a real-time metric event.
   * Automatically distinguishes message, tool and error events.
   */
  track(event: MessageEvent | ToolEvent | ErrorEvent): void {
    if ('provider' in event && 'model' in event) {
      // MessageEvent
      this.metrics.totalMessages++;
      const { model, latencyMs } = event;

      this.metrics.modelCounts[model] = (this.metrics.modelCounts[model] || 0) + 1;
      this.metrics.totalMessageLatencyMs += latencyMs || 0;
    } else if ('toolName' in event) {
      // ToolEvent
      this.metrics.totalToolCalls++;
      const { toolName, latencyMs } = event;

      this.metrics.toolCounts[toolName] = (this.metrics.toolCounts[toolName] || 0) + 1;
      this.metrics.totalToolLatencyMs += latencyMs || 0;
    } else {
      // ErrorEvent
      this.metrics.totalErrors++;
    }
  }

  /**
   * Return current usage statistics.
   */
  getStats(): {
    messages: { total: number; byModel: Record<string, number>; avgLatencyMs: number };
    tools: { total: number; byTool: Record<string, number> };
    errors: { total: number; rate: number };
    uptime: number;
    activeSessions: number;
  } {
    const totalEvents = this.metrics.totalMessages + this.metrics.totalToolCalls + this.metrics.totalErrors;
    const errorRate = totalEvents > 0 ? this.metrics.totalErrors / totalEvents : 0;

    return {
      messages: {
        total: this.metrics.totalMessages,
        byModel: { ...this.metrics.modelCounts },
        avgLatencyMs:
          this.metrics.totalMessages > 0
            ? this.metrics.totalMessageLatencyMs / this.metrics.totalMessages
            : 0,
      },
      tools: {
        total: this.metrics.totalToolCalls,
        byTool: { ...this.metrics.toolCounts },
      },
      errors: {
        total: this.metrics.totalErrors,
        rate: errorRate,
      },
      uptime: Date.now() - this.metrics.startTime,
      activeSessions: this.metrics.activeSessions.size,
    };
  }

  /**
   * Mark a session as active (no-op if already tracked).
   */
  trackSession(sessionId: string): void {
    if (!this.metrics.activeSessions.has(sessionId)) {
      this.metrics.activeSessions.set(sessionId, Date.now());
    }
  }

  /**
   * Remove a session from active tracking.
   */
  endSession(sessionId: string): void {
    this.metrics.activeSessions.delete(sessionId);
  }

  /**
   * Reset all metrics to initial state.
   */
  reset(): void {
    this.metrics = {
      totalMessages: 0,
      modelCounts: {},
      totalMessageLatencyMs: 0,
      totalToolCalls: 0,
      toolCounts: {},
      totalToolLatencyMs: 0,
      totalErrors: 0,
      activeSessions: new Map(),
      startTime: Date.now(),
    };
  }

  /**
   * Optional persistence: save current metrics snapshot to a JSON file.
   */
  async saveSnapshot(filePath: string): Promise<void> {
    const state = {
      totalMessages: this.metrics.totalMessages,
      modelCounts: this.metrics.modelCounts,
      totalMessageLatencyMs: this.metrics.totalMessageLatencyMs,
      totalToolCalls: this.metrics.totalToolCalls,
      toolCounts: this.metrics.toolCounts,
      totalToolLatencyMs: this.metrics.totalToolLatencyMs,
      totalErrors: this.metrics.totalErrors,
      activeSessions: Array.from(this.metrics.activeSessions.entries()),
      startTime: this.metrics.startTime,
    };

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf8');
  }

  /**
   * Optional persistence: load metrics snapshot from a JSON file.
   * Missing values will fall back to initial state.
   */
  async loadSnapshot(filePath: string): Promise<void> {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(data);

      this.metrics = {
        totalMessages: parsed.totalMessages ?? 0,
        modelCounts: parsed.modelCounts ?? {},
        totalMessageLatencyMs: parsed.totalMessageLatencyMs ?? 0,
        totalToolCalls: parsed.totalToolCalls ?? 0,
        toolCounts: parsed.toolCounts ?? {},
        totalToolLatencyMs: parsed.totalToolLatencyMs ?? 0,
        totalErrors: parsed.totalErrors ?? 0,
        activeSessions: new Map(parsed.activeSessions ?? []),
        startTime: parsed.startTime ?? Date.now(),
      };
    } catch {
      // File not found or invalid – retain current empty state
    }
  }
}

export const analyticsService = new AnalyticsService();