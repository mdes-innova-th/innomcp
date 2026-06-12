<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-24 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":96,"completion_tokens":2011,"total_tokens":2107,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1434,"image_tokens":0},"cache_creation_input_tokens":0} | 19s
 generated: 2026-06-12T03:51:10.528Z -->
class ReconnectManager {
  private createWS: () => WebSocket;
  private maxRetries: number;
  private backoffMs: number;
  private ws: WebSocket | null = null;
  private retryCount: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private status: string = 'disconnected';
  private statusCallbacks: Array<(status: string) => void> = [];
  private stopping: boolean = false;

  constructor(createWS: () => WebSocket, maxRetries: number = 10, backoffMs: number = 1000) {
    this.createWS = createWS;
    this.maxRetries = maxRetries;
    this.backoffMs = backoffMs;
  }

  public start(): void {
    this.stop();
    this.stopping = false;
    this.retryCount = 0;
    this.connect();
  }

  private connect(): void {
    if (this.stopping) return;
    this.setStatus('connecting');
    this.ws = this.createWS();
    this.ws.onopen = () => {
      this.setStatus('connected');
      this.retryCount = 0;
    };
    this.ws.onclose = (event: CloseEvent) => {
      if (this.stopping) return;
      this.setStatus('disconnected');
      this.scheduleReconnect();
    };
    this.ws.onerror = (event: Event) => {
      // onclose will be called after error
    };
  }

  private scheduleReconnect(): void {
    if (this.stopping) return;
    if (this.retryCount >= this.maxRetries) {
      this.setStatus('disconnected');
      return;
    }
    this.setStatus('reconnecting');
    const delay = this.backoffMs * Math.pow(2, this.retryCount);
    this.retryCount++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  public stop(): void {
    this.stopping = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.retryCount = 0;
    this.setStatus('disconnected');
  }

  public onStatusChange(cb: (status: string) => void): void {
    this.statusCallbacks.push(cb);
  }

  private setStatus(status: string): void {
    this.status = status;
    this.statusCallbacks.forEach(cb => cb(status));
  }
}

export default ReconnectManager;
