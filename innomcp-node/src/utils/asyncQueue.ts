




export class AsyncQueue<T> {
  private items: T[] = [];
  private maxConcurrent: number;
  private drainResolvers: (() => void)[] = [];

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }

  enqueue(item: T): void {
    this.items.push(item);
  }

  dequeue(): T | undefined {
    const item = this.items.shift();
    if (item !== undefined && this.items.length === 0) {
      this.resolveDrain();
    }
    return item;
  }

  size(): number {
    return this.items.length;
  }

  drain(): Promise<void> {
    return new Promise((resolve) => {
      if (this.items.length === 0) {
        resolve();
      } else {
        this.drainResolvers.push(resolve);
      }
    });
  }

  private resolveDrain(): void {
    if (this.drainResolvers.length > 0) {
      const resolvers = this.drainResolvers.slice();
      this.drainResolvers = [];
      resolvers.forEach((resolve) => resolve());
    }
  }
}
