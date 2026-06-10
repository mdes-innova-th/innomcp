// telemetry.ts
// INNOMCP lightweight analytics/telemetry – privacy-first, no PII, only usage metrics
// Uses localStorage for opt-out: "innomcp.telemetry.disabled"
// Batches events and sends every 60s or on page unload to /api/stats

export type TelemetryEvent =
  | { type: "message_sent"; provider: string; modelFamily: string }
  | { type: "tool_used"; toolName: string }
  | { type: "provider_switched"; from: string; to: string }
  | { type: "workspace_opened" }
  | { type: "export_done"; format: string }
  | { type: "error"; component: string; code: string };

class INNOMCPTelemetry {
  private readonly queue: TelemetryEvent[] = [];
  private readonly endpoint: string = "/api/stats";
  private readonly intervalMs: number = 60000;
  private readonly optOutKey: string = "innomcp.telemetry.disabled";
  private readonly maxQueueSize: number = 20;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private unloadHandler: ((e: Event) => void) | null = null;

  constructor() {
    // Start batch sending only if telemetry is enabled
    if (this.isEnabled()) {
      this.start();
    }
  }

  // Enable telemetry: remove opt-out key, start batch sender
  enable(): void {
    try {
      localStorage.removeItem(this.optOutKey);
    } catch {
      // localStorage might be unavailable (SSR / privacy mode)
    }
    this.start();
  }

  // Disable telemetry: set opt-out key, flush remaining events, stop batch sender
  disable(): void {
    try {
      localStorage.setItem(this.optOutKey, "true");
    } catch {
      // ignore
    }
    this.flush(); // send any remaining events before stopping
    this.stop();
  }

  isEnabled(): boolean {
    try {
      return !localStorage.getItem(this.optOutKey);
    } catch {
      // If localStorage is inaccessible, assume enabled (fallback)
      return true;
    }
  }

  track(event: TelemetryEvent): void {
    if (!this.isEnabled()) return;

    this.queue.push({ ...event }); // shallow copy to prevent mutation

    // Flush immediately if queue exceeds max size
    if (this.queue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  flush(): void {
    if (this.queue.length === 0) return;

    const events = this.queue.splice(0); // drain queue
    this.sendBatch(events);
  }

  getQueue(): TelemetryEvent[] {
    // Return a shallow copy to prevent external mutation of internal queue
    return [...this.queue];
  }

  clear(): void {
    this.queue.length = 0;
  }

  // Private helpers

  private start(): void {
    if (this.intervalId !== null) return; // already started

    this.intervalId = setInterval(() => this.flush(), this.intervalMs);

    // Register unload handler (beforeunload is most widely supported)
    this.unloadHandler = () => this.flush();
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", this.unloadHandler);
    }
  }

  private stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.unloadHandler && typeof window !== "undefined") {
      window.removeEventListener("beforeunload", this.unloadHandler);
      this.unloadHandler = null;
    }
  }

  private sendBatch(events: TelemetryEvent[]): void {
    const payload = JSON.stringify(events);

    // Prefer sendBeacon for reliable delivery during page unload / visibility change
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(this.endpoint, blob);
    } else {
      // Fallback to fetch with keepalive
      fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
        // Do not await – fire and forget
      }).catch(() => {
        // Silently ignore network errors (privacy-first, no impact on user)
      });
    }
  }
}

// Singleton instance for the entire application
export const telemetry = new INNOMCPTelemetry();