<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-15 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":68,"completion_tokens":3745,"total_tokens":3813,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3498,"image_tokens":0},"cache_creation_input_tokens":0} | 45s
 generated: 2026-06-12T03:52:01.354Z -->
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
