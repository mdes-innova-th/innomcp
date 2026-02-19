/**
 * Request Queue and Retry Logic
 * For handling concurrent requests and timeout issues
 */

import logger from "../utils/logger";

interface QueuedRequest {
  id: string;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retries: number;
  timestamp: number;
}

class RequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private maxConcurrent: number;
  private currentlyProcessing = 0;
  private maxRetries: number;
  private retryDelay: number;

  constructor(maxConcurrent = 5, maxRetries = 3, retryDelay = 1000) {
    this.maxConcurrent = maxConcurrent;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  async enqueue<T>(id: string, execute: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        id,
        execute,
        resolve,
        reject,
        retries: 0,
        timestamp: Date.now(),
      });

      logger.debug(`[Queue] Request ${id} added. Queue size: ${this.queue.length}`);
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 && this.currentlyProcessing < this.maxConcurrent) {
      const request = this.queue.shift();
      if (!request) break;

      this.currentlyProcessing++;
      logger.debug(`[Queue] Processing ${request.id}. Active: ${this.currentlyProcessing}/${this.maxConcurrent}`);

      this.executeWithRetry(request).finally(() => {
        this.currentlyProcessing--;
        this.processQueue(); // Process next in queue
      });
    }

    this.processing = false;
  }

  private async executeWithRetry(request: QueuedRequest) {
    try {
      const result = await request.execute();
      request.resolve(result);
      logger.debug(`[Queue] Request ${request.id} completed successfully`);
    } catch (error: any) {
      if (request.retries < this.maxRetries) {
        request.retries++;
        const delay = this.retryDelay * Math.pow(2, request.retries - 1); // Exponential backoff
        
        logger.warn(`[Queue] Request ${request.id} failed. Retry ${request.retries}/${this.maxRetries} in ${delay}ms`);
        logger.warn(`[Queue] Error: ${error.message}`);

        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Re-add to queue
        this.queue.unshift(request);
        this.processQueue();
      } else {
        logger.error(`[Queue] Request ${request.id} failed after ${this.maxRetries} retries`);
        request.reject(error);
      }
    }
  }

  getStats() {
    return {
      queueSize: this.queue.length,
      processing: this.currentlyProcessing,
      maxConcurrent: this.maxConcurrent,
    };
  }
}

// Singleton instance
export const requestQueue = new RequestQueue(
  parseInt(process.env.MAX_CONCURRENT_REQUESTS || '5', 10),
  parseInt(process.env.MAX_REQUEST_RETRIES || '3', 10),
  parseInt(process.env.RETRY_DELAY_MS || '1000', 10)
);

/**
 * Timeout wrapper with better error messages
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  taskName: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${taskName} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000,
  taskName = 'Operation'
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        logger.warn(`[Retry] ${taskName} failed (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`);
        logger.warn(`[Retry] Error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  logger.error(`[Retry] ${taskName} failed after ${maxRetries} attempts`);
  throw lastError;
}
