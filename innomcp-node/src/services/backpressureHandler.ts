import EventBus from './eventBus.js';

export type Priority = 'high' | 'normal' | 'low';
export type Release = () => void;

export type BackpressureStats = {
  active: number;
  queued: number;
  rejected: number;
  totalProcessed: number;
  avgWaitMs: number;
  pressure: 'none' | 'low' | 'medium' | 'high' | 'critical';
};

export type Limits = {
  maxConcurrent: number;
  maxQueued: number;
  highPrioritySlots: number;
  timeoutMs: number;
};

export type PressureHandler = (stats: BackpressureStats) => void;

interface QueueEntry {
  resolve: (release: Release) => void;
  reject: (err: Error) => void;
  priority: Priority;
  timeoutId: ReturnType<typeof setTimeout>;
  timestamp: number;
}

const DEFAULT_LIMITS: Limits = {
  maxConcurrent: 50,
  maxQueued: 200,
  highPrioritySlots: 10,
  timeoutMs: 30_000,
};

const QUEUE_TIMEOUT_MESSAGE =
  'ระบบยุ่งมาก กรุณารอสักครู่';

function getPressureLevel(ratio: number): BackpressureStats['pressure'] {
  if (ratio < 0.3) return 'none';
  if (ratio < 0.5) return 'low';
  if (ratio < 0.7) return 'medium';
  if (ratio < 0.9) return 'high';
  return 'critical';
}

export class BackpressureHandler {
  private static instance: BackpressureHandler;
  private limits: Limits = { ...DEFAULT_LIMITS };
  private active = 0;
  private rejected = 0;
  private totalProcessed = 0;
  private readonly waitTimes: number[] = [];
  private readonly queues: Record<Priority, QueueEntry[]> = {
    high: [],
    normal: [],
    low: [],
  };
  private pressure: BackpressureStats['pressure'] = 'none';
  private readonly pressureHandlers = new Set<PressureHandler>();

  private constructor() {}

  static getInstance(): BackpressureHandler {
    if (!BackpressureHandler.instance) {
      BackpressureHandler.instance = new BackpressureHandler();
    }
    return BackpressureHandler.instance;
  }

  acquire(priority: Priority = 'normal'): Promise<Release> {
    const release = this.tryAcquire(priority);
    if (release) {
      return Promise.resolve(release);
    }

    if (this.queuedCount() >= this.limits.maxQueued) {
      this.rejected += 1;
      this.notifyPressureChange();
      return Promise.reject(new Error(QUEUE_TIMEOUT_MESSAGE));
    }

    return new Promise<Release>((resolve, reject) => {
      const entry: QueueEntry = {
        resolve,
        reject,
        priority,
        timestamp: Date.now(),
        timeoutId: setTimeout(() => {
          this.removeQueued(entry);
          this.rejected += 1;
          this.notifyPressureChange();
          reject(new Error(QUEUE_TIMEOUT_MESSAGE));
        }, this.limits.timeoutMs),
      };

      this.queues[priority].push(entry);
      this.notifyPressureChange();
    });
  }

  tryAcquire(priority: Priority = 'normal'): Release | null {
    if (!this.canAcquire(priority)) {
      return null;
    }

    this.active += 1;
    this.notifyPressureChange();
    return this.createRelease();
  }

  getStats(): BackpressureStats {
    const avgWaitMs =
      this.waitTimes.length === 0
        ? 0
        : this.waitTimes.reduce((sum, value) => sum + value, 0) / this.waitTimes.length;

    return {
      active: this.active,
      queued: this.queuedCount(),
      rejected: this.rejected,
      totalProcessed: this.totalProcessed,
      avgWaitMs,
      pressure: getPressureLevel(this.active / Math.max(1, this.limits.maxConcurrent)),
    };
  }

  setLimits(limits: Limits): void {
    this.limits = { ...limits };
    this.drainQueue();
    this.notifyPressureChange();
  }

  onPressure(handler: PressureHandler): void {
    this.pressureHandlers.add(handler);
  }

  private canAcquire(priority: Priority): boolean {
    if (this.active >= this.limits.maxConcurrent) {
      return false;
    }

    if (priority === 'high') {
      return true;
    }

    return this.active < Math.max(0, this.limits.maxConcurrent - this.limits.highPrioritySlots);
  }

  private createRelease(): Release {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active = Math.max(0, this.active - 1);
      this.totalProcessed += 1;
      this.drainQueue();
      this.notifyPressureChange();
    };
  }

  private drainQueue(): void {
    for (const priority of ['high', 'normal', 'low'] as const) {
      const queue = this.queues[priority];
      while (queue.length > 0 && this.canAcquire(priority)) {
        const entry = queue.shift();
        if (!entry) break;

        clearTimeout(entry.timeoutId);
        this.recordWait(Date.now() - entry.timestamp);
        this.active += 1;
        entry.resolve(this.createRelease());
      }
    }
  }

  private removeQueued(entry: QueueEntry): void {
    const queue = this.queues[entry.priority];
    const index = queue.indexOf(entry);
    if (index >= 0) {
      queue.splice(index, 1);
    }
  }

  private queuedCount(): number {
    return this.queues.high.length + this.queues.normal.length + this.queues.low.length;
  }

  private recordWait(waitMs: number): void {
    this.waitTimes.push(waitMs);
    if (this.waitTimes.length > 100) {
      this.waitTimes.shift();
    }
  }

  private notifyPressureChange(): void {
    const stats = this.getStats();
    if (stats.pressure === this.pressure) {
      return;
    }

    this.pressure = stats.pressure;
    EventBus.getInstance().emit('backpressure:triggered', stats);
    for (const handler of this.pressureHandlers) {
      handler(stats);
    }
  }
}

export default BackpressureHandler;
