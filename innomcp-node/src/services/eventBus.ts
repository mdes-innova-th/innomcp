type EventMap = {
  'message:sent': { sessionId: string; text: string };
  'agent:started': { sessionId: string; agentId: string; model: string };
  'agent:done': { sessionId: string; agentId: string; elapsed: number };
  'tool:called': { toolName: string; sessionId: string };
  'error': { component: string; message: string };
  'mdes:healthy': { latencyMs: number };
  'mdes:down': { error: string };
};

class EventBus {
  private listeners = new Map<string, Set<Function>>();

  on<K extends keyof EventMap>(
    event: K,
    handler: (data: EventMap[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const handlers = this.listeners.get(event)!;
    handlers.add(handler);
    return () => {
      this.off(event, handler);
    };
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    handlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`[EventBus] Error in handler for "${String(event)}":`, error);
      }
    });
  }

  off<K extends keyof EventMap>(
    event: K,
    handler: (data: EventMap[K]) => void
  ): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    handlers.delete(handler);
    if (handlers.size === 0) {
      this.listeners.delete(event);
    }
  }

  once<K extends keyof EventMap>(
    event: K,
    handler: (data: EventMap[K]) => void
  ): void {
    const onceWrapper = (data: EventMap[K]) => {
      handler(data);
      this.off(event, onceWrapper);
    };
    this.on(event, onceWrapper);
  }

  removeAll(event?: keyof EventMap): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

export const eventBus = new EventBus();