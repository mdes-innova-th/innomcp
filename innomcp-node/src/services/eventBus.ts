/**
 * EventBus - Singleton pub/sub event bus for innomcp-node services.
 * Provides typed events, async handler support, listener limiting, and event history.
 */

/** Event handler function type */
export type EventHandler = (payload: unknown) => void | Promise<void>;

/** Unsubscribe function returned by `on` */
export type Unsubscribe = () => void;

/** Internal event history entry */
interface EventHistoryEntry {
  event: string;
  payload?: unknown;
  timestamp: number;
}

/** Built-in event names used across innomcp services */
const BUILT_IN_EVENTS = [
  'request:start',
  'request:end',
  'model:error',
  'cache:hit',
  'cache:miss',
  'stream:open',
  'stream:close',
  'tool:execute',
  'tool:result',
  'backpressure:triggered',
] as const;

export class EventBus {
  private static instance: EventBus;
  private readonly listeners: Map<string, Set<EventHandler>> = new Map();
  private readonly history: EventHistoryEntry[] = [];
  private readonly maxListeners = 50;
  private readonly maxHistory = 100;

  private constructor() {}

  /**
   * Returns the singleton instance of EventBus.
   */
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Built-in event names that every innomcp-node service should be aware of.
   */
  public static readonly builtInEvents: ReadonlyArray<string> = BUILT_IN_EVENTS;

  /**
   * Registers an event handler.
   * @param event - The event name to listen for.
   * @param handler - The callback to invoke when the event is emitted.
   * @returns An unsubscribe function to remove this specific handler.
   * Emits a warning if the listener count exceeds the maximum (50).
   */
  public on(event: string, handler: EventHandler): Unsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const handlers = this.listeners.get(event)!;
    handlers.add(handler);

    // Check listener count
    if (handlers.size > this.maxListeners) {
      console.warn(
        `คำเตือน: จำนวนผู้รับฟังเหตุการณ์ '${event}' เกินขีดจำกัดสูงสุด (${this.maxListeners} รายการ)`,
      );
    }

    return () => {
      this.off(event, handler);
    };
  }

  /**
   * Registers a one-time event handler that is automatically removed after the first invocation.
   * @param event - The event name to listen for.
   * @param handler - The callback to invoke once.
   */
  public once(event: string, handler: EventHandler): void {
    const wrapper: EventHandler = (payload) => {
      // Remove itself before executing, to avoid recursion
      this.off(event, wrapper);
      // Propagate call
      const result = handler(payload);
      // If async, handle errors to avoid uncaught rejections
      if (result instanceof Promise) {
        result.catch(console.error);
      }
    };
    // Store the wrapper as a normal listener
    this.on(event, wrapper);
  }

  /**
   * Emits an event, synchronously notifying all registered handlers.
   * Async handlers are fire-and-forget; their errors are caught and logged.
   * @param event - The event name.
   * @param payload - Optional data to pass to handlers.
   */
  public emit(event: string, payload?: unknown): void {
    // Record event in history
    this.pushHistory(event, payload);

    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) {
      return;
    }

    // Copy handlers to avoid mutation during iteration
    const handlersCopy = Array.from(handlers);
    for (const handler of handlersCopy) {
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          result.catch(console.error);
        }
      } catch (error) {
        console.error(
          `ข้อผิดพลาดในตัวจัดการเหตุการณ์ '${event}':`,
          error,
        );
      }
    }
  }

  /**
   * Removes a specific handler from an event, or all handlers if no handler is provided.
   * @param event - The event name.
   * @param handler - The specific handler to remove (optional).
   */
  public off(event: string, handler?: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      return;
    }

    if (handler) {
      handlers.delete(handler);
      // Clean up empty Set to avoid memory leak
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    } else {
      // Remove all listeners for this event
      this.listeners.delete(event);
    }
  }

  /**
   * Returns the number of listeners currently registered for the given event.
   * @param event - The event name.
   * @returns The count of handlers.
   */
  public listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Returns all event names that currently have at least one listener.
   * @returns Array of event names.
   */
  public eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Returns a read-only copy of the event history (last 100 events).
   * Each entry contains the event name, optional payload, and a timestamp.
   * @returns Array of history entries.
   */
  public getHistory(): ReadonlyArray<EventHistoryEntry> {
    return this.history.slice();
  }

  private pushHistory(event: string, payload?: unknown): void {
    this.history.push({
      event,
      payload,
      timestamp: Date.now(),
    });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }
}

export default EventBus;