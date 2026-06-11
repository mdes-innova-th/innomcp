interface QueueItem {
  id: string;
  sessionId: string;
  execute: () => Promise<unknown>;
  priority: number;
  addedAt: number;
}

class BackpressureHandler {
  private MAX_CONCURRENT = 10;
  private MAX_QUEUE_SIZE = 100;
  private running = 0;
  private queue: Array<QueueItem & { deferred: { resolve: (value: unknown) => void; reject: (reason?: unknown) => void } }> = [];
  private processed = 0;
  private rejected = 0; // overflow rejections
  private totalWaitTime = 0;
  private waitCount = 0;
  private drainResolvers: Array<() => void> = [];

  /**
   * Enqueue a task for execution. If the current running count is below MAX_CONCURRENT
   * the task starts immediately; otherwise it waits in priority order.
   * Tasks are dequeued in descending priority order.
   * Queued items that exceed MAX_QUEUE_SIZE are rejected immediately.
   */
  enqueue(item: Omit<QueueItem, 'addedAt'>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (this.queue.length >= this.MAX_QUEUE_SIZE) {
        this.rejected++;
        reject(new Error('Queue overflow: backpressure – too many pending requests'));
        return;
      }

      const fullItem = {
        ...item,
        addedAt: Date.now(),
        deferred: { resolve, reject },
      };

      // Insert sorted by priority descending (higher priority first)
      this.insertSorted(fullItem);
      this.processNext();
    });
  }

  private insertSorted(
    item: QueueItem & { deferred: { resolve: (value: unknown) => void; reject: (reason?: unknown) => void } }
  ): void {
    let low = 0;
    let high = this.queue.length;

    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.queue[mid].priority >= item.priority) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    this.queue.splice(low, 0, item);
  }

  private processNext(): void {
    while (this.running < this.MAX_CONCURRENT && this.queue.length > 0) {
      const item = this.queue.shift()!; // guaranteed highest priority
      this.running++;
      const waitTime = Date.now() - item.addedAt;
      this.totalWaitTime += waitTime;
      this.waitCount++;

      item.execute().then(
        (result) => {
          this.processed++;
          this.running--;
          item.deferred.resolve(result);
          this.processNext();
          this.checkDrain();
        },
        (error) => {
          this.processed++;
          this.running--;
          item.deferred.reject(error);
          this.processNext();
          this.checkDrain();
        }
      );
    }
  }

  getStats(): { running: number; queued: number; rejected: number; processed: number; avgWaitMs: number } {
    return {
      running: this.running,
      queued: this.queue.length,
      rejected: this.rejected,
      processed: this.processed,
      avgWaitMs: this.waitCount ? Math.round(this.totalWaitTime / this.waitCount) : 0,
    };
  }

  /**
   * Returns a promise that resolves when all currently running and queued tasks
   * have finished (i.e. both running and queue are empty).
   */
  drain(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.running === 0 && this.queue.length === 0) {
        resolve();
        return;
      }
      this.drainResolvers.push(resolve);
    });
  }

  private checkDrain(): void {
    if (this.running === 0 && this.queue.length === 0) {
      const resolvers = this.drainResolvers;
      this.drainResolvers = [];
      resolvers.forEach((r) => r());
    }
  }

  /**
   * Immediately remove all queued tasks, rejecting their promises.
   * Already running tasks are not affected.
   */
  clear(): void {
    const error = new Error('Queue cleared by backpressure handler');
    this.queue.forEach((item) => item.deferred.reject(error));
    this.queue = [];
    // Note: we do not affect running count or statistics.
  }

  /**
   * Update the maximum number of concurrently executing tasks.
   * If the limit is increased, pending tasks (if any) will be started automatically.
   */
  setMaxConcurrent(n: number): void {
    if (n < 0) {
      throw new Error('MAX_CONCURRENT must be non-negative');
    }
    this.MAX_CONCURRENT = n;
    this.processNext(); // may start more tasks
  }
}

export const backpressureHandler = new BackpressureHandler();